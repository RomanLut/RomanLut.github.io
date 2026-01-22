import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowMenu, type MenuItem } from './appWindowMenu';
import { filesystemUrl } from './util';

declare global {
  interface Window {
    Dos?: any;
    JSDOS_WASM_URL?: string;
  }
}

// Load js-dos v7 core locally from /public to avoid CDN dependence.
const JSDOS_SCRIPT = '/js-dos.js';
const WDOSBOX_JS = '/wdosbox.js';
const WDOSBOX_WASM = '/wdosbox.wasm';

export class DosBox extends AppWindow {
  private host: HTMLDivElement;
  private statusBar: HTMLElement;
  private statusMsg: HTMLElement;
  private statusFps: HTMLElement;
  private statusArchive: HTMLElement;
  private stage: HTMLDivElement;
  private archivePath: string;
  private exeName: string;
  private dosInstance: any = null;
  private ci: any = null;
  private resetStage() {
    this.stage.innerHTML = '';
    this.stage.className = 'dosbox__stage';
  }
  private destroyed = false;
  private runtimeUrls: { js: string; wasm: string; revoke: () => void } | null = null;
  private bundleBytes: Uint8Array | null = null;
  private fpsFrame = 0;
  private fpsTime = 0;
  private fpsRaf = 0;
  private logLines: string[] = [];
  private maxLogLines = 40;
  private paused = false;

  constructor(desktop: HTMLElement, taskbar: Taskbar, archivePath: string, exeName?: string) {
    const guessedExe = DosBox.guessExeName(archivePath);
    super(desktop, taskbar, exeName ? `DOSBox - ${exeName}` : `DOSBox - ${guessedExe}`);
    this.archivePath = archivePath;
    this.exeName = exeName || guessedExe;

    this.element.classList.add('dosbox');

    const container = document.createElement('div');
    container.className = 'dosbox__container';

    this.host = document.createElement('div');
    this.host.className = 'dosbox__screen';
    this.host.style.width = '100%';
    this.host.style.height = '100%';
    this.stage = document.createElement('div');
    this.stage.className = 'dosbox__stage';
    this.host.appendChild(this.stage);
    const menuItems: MenuItem[] = [
      {
        label: 'Run',
        children: [
          { label: 'Pause' },
          { label: 'Resume' },
          { label: '-' },
          { label: 'Reboot' }
        ]
      }
    ];
    const menu = new AppWindowMenu(menuItems);
    menu.onSelect((label) => this.handleMenu(label));
    container.appendChild(menu.element);

    container.appendChild(this.host);
    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-window__statusbar dosbox__status';
    this.statusBar.innerHTML = `
      <div class="app-window__statusbar-left">
        <span class="app-window__statusbar-text"></span>
      </div>
      <div class="app-window__statusbar-right">
        <span class="app-window__statusbar-mode dosbox__status-fps">FPS: -</span>
        <span class="app-window__statusbar-divider"></span>
        <span class="app-window__statusbar-encoding dosbox__status-archive"></span>
      </div>
    `;
    this.statusMsg = this.statusBar.querySelector('.app-window__statusbar-text') as HTMLElement;
    this.statusFps = this.statusBar.querySelector('.dosbox__status-fps') as HTMLElement;
    this.statusArchive = this.statusBar.querySelector('.dosbox__status-archive') as HTMLElement;
    this.statusMsg.textContent = 'Loading emulator...';
    this.statusArchive.textContent = `Archive: ${this.archivePath}`;
    container.appendChild(this.statusBar);
    this.setContent(container);
    // Size window so the screen area is exactly 960x600 (accounting for chrome).
    this.element.style.width = '962px';
    this.element.style.height = '688px';

    void this.launch();
  }

  protected close() {
    this.destroyed = true;
    try {
      if (this.dosInstance) {
        if (typeof this.dosInstance.stop === 'function') this.dosInstance.stop();
        if (typeof this.dosInstance.exit === 'function') this.dosInstance.exit();
      }
    } catch {
      /* ignore shutdown errors */
    }
    if (this.fpsRaf) {
      cancelAnimationFrame(this.fpsRaf);
      this.fpsRaf = 0;
    }
    super.close();
  }

  private async launch() {
    try {
      const Dos = await this.loadRuntime();
      if (!Dos) {
        throw new Error('js-dos runtime not available');
      }
      const zipUrl = filesystemUrl(this.archivePath);
      console.log('[DOSBox] Fetching archive', { zipUrl, exe: this.exeName });
      this.statusMsg.textContent = 'Downloading archive...';
      const res = await fetch(zipUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      this.bundleBytes = new Uint8Array(await blob.arrayBuffer());

      if (this.destroyed) return;
      this.statusMsg.textContent = `Starting ${this.exeName}...`;

      const runtime = this.useCdnRuntime();
      // Update globals so js-dos internals pick the blob/CDN URLs.
      (window as any).JSDOS_CONFIG = { wdosboxUrl: runtime.js, wdosboxWasmUrl: runtime.wasm };
      (window as any).JSDOS_JS = runtime.js;
      (window as any).JSDOS_WASM = runtime.wasm;
      window.JSDOS_WASM_URL = runtime.wasm;

      const player = await this.createPlayer(Dos, runtime.js, runtime.wasm);
      this.dosInstance = player;
      await this.mountAndRun(player, this.bundleBytes, runtime.js, runtime.wasm);
      this.startFpsCounter();
    } catch (err) {
      this.showError(err);
    }
  }

  static guessExeName(path: string) {
    const base = (path.split('/').pop() || path).replace(/\.[^.]+$/, '');
    return `${base}.exe`;
  }

  private loadRuntime(): Promise<any> {
    const applyConfig = () => {
      (window as any).JSDOS_CONFIG = {
        wdosboxUrl: WDOSBOX_JS,
        wdosboxWasmUrl: WDOSBOX_WASM
      };
      (window as any).JSDOS_JS = WDOSBOX_JS;
      (window as any).JSDOS_WASM = WDOSBOX_WASM;
      window.JSDOS_WASM_URL = WDOSBOX_WASM;
      // Official v7 way: set pathPrefix before js-dos loads so all assets resolve under site root.
      (window as any).emulators = (window as any).emulators || {};
      (window as any).emulators.pathPrefix = '/';
      // Emscripten glue (wdosbox.js) consults Module.locateFile to resolve the wasm.
      // Set it *before* the glue loads so it never falls back to /wdosbox.wasm.
      const module = ((window as any).Module = (window as any).Module || {});
      module.locateFile = (path: string) => {
        if (path.endsWith('.wasm')) return WDOSBOX_WASM;
        if (path.endsWith('.js')) return WDOSBOX_JS;
        return path;
      };
      module.wasmBinaryFile = WDOSBOX_WASM;
      (window as any)._scriptDir = '/';
      (window as any).WDOSBOX = {
        locateFile: (path: string) => {
          const base = '/';
          const filename = path.split('/').pop() || path;
          return `${base}${filename}`;
        }
      };
    };

    if (window.Dos) {
      applyConfig();
      return Promise.resolve(window.Dos);
    }
    const loadScript = (src: string) =>
      new Promise<void>((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          res();
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => res();
        s.onerror = () => rej(new Error(`Failed to load script ${src}`));
        document.body.appendChild(s);
      });

    return new Promise((resolve, reject) => {
      // Ensure Module/config are in place BEFORE the glue executes.
      applyConfig();

      if (document.querySelector(`script[src="${JSDOS_SCRIPT}"]`)) {
        const wait = () => {
          if (window.Dos) {
            loadScript(WDOSBOX_JS)
              .then(() => resolve(window.Dos))
              .catch(reject);
          } else {
            requestAnimationFrame(wait);
          }
        };
        wait();
        return;
      }

      const script = document.createElement('script');
      script.src = JSDOS_SCRIPT;
      script.async = true;
      script.onload = () => {
        if (window.Dos) {
          loadScript(WDOSBOX_JS)
            .then(() => resolve(window.Dos))
            .catch(reject);
        } else {
          reject(new Error('js-dos loaded but Dos is undefined'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load js-dos runtime'));
      document.body.appendChild(script);
    });
  }

  private showError(err: unknown) {
    if (this.destroyed) return;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DOSBox] Error', err);
    this.statusMsg.textContent = `Failed to start DOS app: ${msg}`;
    this.host.style.opacity = '0.4';
    this.statusFps.textContent = 'FPS: error';
    this.pushLog(`[error] ${msg}`);
  }

  private useCdnRuntime() {
    this.runtimeUrls = { js: WDOSBOX_JS, wasm: WDOSBOX_WASM, revoke: () => {} };
    return this.runtimeUrls;
  }

  private async runProgram(player: any) {
    const mainFn =
      (player && typeof player.main === 'function' && player.main.bind(player)) ||
      (player && typeof player.run === 'function' && player.run.bind(player)) ||
      null;
    if (!mainFn) {
      console.error('[DOSBox] No runnable entry', {
        hasMain: player && typeof player.main,
        hasRun: player && typeof player.run,
        keys: Object.keys(player || {})
      });
      throw new Error('Cannot start program (main/run missing)');
    }
    const exe = this.exeName || DosBox.guessExeName(this.archivePath);
    const exeBase = exe.replace(/\.(exe|com|bat)$/i, '');
    const commands = [
      ['-c', exeBase],
      [exeBase],
      [exe]
    ];
    let lastErr: unknown = null;
    for (const args of commands) {
      try {
        console.log('[DOSBox] Trying', args);
        await mainFn(args);
        this.log.textContent = '';
        return;
      } catch (err) {
        console.warn('[DOSBox] failed', args, err);
        lastErr = err;
      }
    }
    throw lastErr || new Error('Failed to start DOS program');
  }

  private async createPlayer(Dos: any, wdosboxUrl: string, wdosboxWasmUrl: string) {
    const maybePlayer = Dos(this.stage, {
      wdosboxUrl,
      wdosboxWasmUrl,
      wasmUrl: wdosboxWasmUrl,
      pathPrefix: '/',
      style: 'none', // hide sidebar/control bar
      noSideBar: true,
      noSocialLinks: true,
      noFullscreen: true,
      clickToStart: false, // avoid overlay that blocks rendering
      autolock: false,
      keyboardDiv: this.host,
      mouseDiv: this.host
    });
    const player = typeof maybePlayer?.then === 'function' ? await maybePlayer : maybePlayer;
    if (!player) {
      throw new Error('Failed to initialize js-dos player');
    }
    // Cache command interface for pause/resume/etc once available
    try {
      this.ci = await player.ciPromise;
    } catch {
      this.ci = null;
    }
    try {
      player.frameSize(640, 400); // lock internal framebuffer to 640x400
    } catch {
      /* ignore sizing errors */
    }
    (window as any).dosPlayer = player;
    console.log('[DOSBox] Player created', {
      keys: Object.keys(player || {}),
      readyType: typeof player.ready,
      runType: typeof player.run,
      fsKeys: player?.fs ? Object.keys(player.fs) : null
    });
    return player;
  }

  private async mountAndRun(player: any, bundle: Uint8Array, wdosboxUrl: string, wdosboxWasmUrl: string) {
    const exe = this.exeName || DosBox.guessExeName(this.archivePath);
    const locateFile = (path: string) => {
      if (path.endsWith('.wasm')) return wdosboxWasmUrl;
      if (path.endsWith('.js')) return wdosboxUrl;
      return path;
    };
    const blobUrl = URL.createObjectURL(new Blob([bundle], { type: 'application/zip' }));
    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        /* ignore */
      }
    };
    if (player && typeof player.run === 'function') {
      console.log('[DOSBox] Using run(blob) API');
      // Prefer letting the bundle's autoexec drive execution; fall back to explicit command.
      const runOpts = {
        wdosboxUrl,
        wdosboxWasmUrl,
        wasmUrl: wdosboxWasmUrl,
        pathPrefix: '/',
        style: 'none',
        noSideBar: true,
        noSocialLinks: true,
        noFullscreen: true,
        locateFile,
        onStdout: (t: string) => this.pushLog(t),
        onStderr: (t: string) => this.pushLog(`[err] ${t}`)
      };
      try {
        await player.run(blobUrl, runOpts);
        this.statusMsg.textContent = 'Running';
        this.ensureFrameSize(player);
        this.hideOverlays();
        this.pushLog('run(blob) started');
        cleanup();
        return;
      } catch (err) {
        console.warn('[DOSBox] run(blob) failed, retry with arguments', err);
        await player.run(blobUrl, {
          arguments: [exe],
          wdosboxUrl,
          wdosboxWasmUrl,
          wasmUrl: wdosboxWasmUrl,
          pathPrefix: '/',
          style: 'none',
          noSideBar: true,
          noSocialLinks: true,
          noFullscreen: true,
          locateFile,
          onStdout: runOpts.onStdout,
          onStderr: runOpts.onStderr
        });
        this.statusMsg.textContent = 'Running';
        this.ensureFrameSize(player);
        this.hideOverlays();
        this.pushLog(`run(blob,args) started exe=${exe}`);
        cleanup();
        return;
      }
    }

    if (player && typeof player.ready === 'function') {
      return new Promise<void>((resolve, reject) => {
        player.ready(async (fs: any, main: any) => {
          console.log('[DOSBox] ready()', { hasFs: !!fs, hasMain: typeof main, fsKeys: fs ? Object.keys(fs) : null });
          try {
            if (fs && typeof fs.extract === 'function') {
              await fs.extract(blob);
            } else {
              throw new Error('fs.extract missing in ready');
            }
            await this.runProgram(main ? { main, run: main } : player);
            this.ensureFrameSize(player);
            this.hideOverlays();
            this.statusMsg.textContent = 'Running';
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    }

    const fs = player?.fs;
    if (fs && typeof fs.extract === 'function') {
      console.log('[DOSBox] Using fs.extract fallback');
      await fs.extract(blob);
      await this.runProgram(player);
      this.ensureFrameSize(player);
      this.hideOverlays();
      this.statusMsg.textContent = 'Running';
      return;
    }

    throw new Error('Unexpected js-dos API (neither run, ready nor fs.extract available)');
  }

  private ensureFrameSize(player: any) {
    if (!player || typeof player.frameSize !== 'function') return;
    const { clientWidth, clientHeight } = this.host;
    if (clientWidth && clientHeight) {
      try {
        player.frameSize(clientWidth, clientHeight);
      } catch {
        /* ignore sizing errors */
      }
    }
  }

  // Remove js-dos onboarding overlays that cover the screen.
  private hideOverlays() {
    /*
    const selectors = [
      '.emulator-click-to-start-overlay',
      '.bg-gray-500.bg-opacity-80',
      '.emulator-loading',
      '.bg-gray-300', // side control rail
      '.hg-theme-default', // soft keyboard
      '.emulator-mouse-overlay', // click catcher
      '.bg-gray-800.opacity-95' // fullscreen dark overlay
    ];
    selectors.forEach((sel) => {
      const el = this.host.querySelector(sel);
      if (el) {
        (el as HTMLElement).style.display = 'none';
      }
    });
*/
  }

  private startFpsCounter() {
    this.fpsFrame = 0;
    this.fpsTime = performance.now();
    const loop = (now: number) => {
      this.fpsFrame += 1;
      if (now - this.fpsTime >= 1000) {
        const fps = Math.round((this.fpsFrame * 1000) / (now - this.fpsTime));
        this.statusFps.textContent = `FPS: ${fps}`;
        this.fpsFrame = 0;
        this.fpsTime = now;
      }
      this.fpsRaf = requestAnimationFrame(loop);
    };
    this.fpsRaf = requestAnimationFrame(loop);
  }

  private pushLog(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.logLines.push(trimmed);
    if (this.logLines.length > this.maxLogLines) {
      this.logLines = this.logLines.slice(-this.maxLogLines);
    }
    this.statusMsg.textContent = trimmed;
  }

  private async handleMenu(label: string) {
    const normalized = label.trim().toLowerCase();
    if (normalized === 'pause') {
      if (!this.paused) await this.togglePause();
      return;
    }
    if (normalized === 'resume') {
      if (this.paused) await this.togglePause();
      return;
    }
    if (normalized === 'reboot') {
      await this.reboot();
    }
  }

  private async togglePause() {
    if (!this.dosInstance) return;
    try {
      const player = this.dosInstance;
      const ci = this.ci || (await player.ciPromise);
      const supportsPause = ci && typeof ci.pause === 'function';
      const supportsResume = ci && typeof ci.resume === 'function';

      if (this.paused) {
        if (supportsResume) await ci.resume();
        this.paused = false;
        this.statusMsg.textContent = 'Running';
        this.pushLog('resumed');
      } else {
        if (supportsPause) await ci.pause();
        else if (supportsResume) await ci.resume(); // fallback if only resume exists
        this.paused = true;
        this.statusMsg.textContent = 'Paused';
        this.pushLog('paused');
      }
    } catch (err) {
      this.pushLog('[warn] pause/resume not supported by this runtime');
      this.showError(err);
    }
  }

  private async reboot() {
    if (!this.bundleBytes) {
      this.statusMsg.textContent = 'No bundle to reboot';
      return;
    }
    try {
      this.paused = false;
      if (this.dosInstance) {
        if (typeof this.dosInstance.stop === 'function') await this.dosInstance.stop();
        if (typeof this.dosInstance.exit === 'function') await this.dosInstance.exit();
      }
      this.resetStage();
      this.ci = null;
      const runtime = this.runtimeUrls || this.useCdnRuntime();
      const Dos = window.Dos;
      if (!Dos) throw new Error('Runtime not available for reboot');
      const player = await this.createPlayer(Dos, runtime.js, runtime.wasm);
      this.dosInstance = player;
      await this.mountAndRun(player, this.bundleBytes, runtime.js, runtime.wasm);
      this.statusMsg.textContent = 'Running';
    } catch (err) {
      this.showError(err);
    }
  }
}
