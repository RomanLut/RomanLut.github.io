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
  private statusRes: HTMLElement;
  private stage: HTMLDivElement;
  private archivePath: string;
  private exeName: string;
  private dosInstance: any = null;
  private ci: any = null;
  private resPoll: number | null = null;
  private lastRes = '';
  private resetStage() {
    this.stage.innerHTML = '';
    this.stage.className = 'dosbox__stage';
  }
  private destroyed = false;
  private bundleBytes: Uint8Array | null = null;
  private fpsFrame = 0;
  private fpsTime = 0;
  private fpsRaf = 0;
  private logLines: string[] = [];
  private maxLogLines = 40;
  private paused = false;
  private launched = false;

  constructor(desktop: HTMLElement, taskbar: Taskbar, archivePath: string, exeName?: string) {
    const guessedExe = DosBox.guessExeName(archivePath);
    const icon = '<img src="/icons/msdos.svg" alt="MS-DOS icon" />';
    // Enable fullscreen button (same behavior as Browser)
    super(desktop, taskbar, exeName ? `DOSBox - ${exeName}` : `DOSBox - ${guessedExe}`, icon, true);
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
        <span class="app-window__statusbar-mode dosbox__status-res"></span>
        <span class="app-window__statusbar-divider"></span>
        <span class="app-window__statusbar-encoding dosbox__status-archive"></span>
      </div>
    `;
    this.statusMsg = this.statusBar.querySelector('.app-window__statusbar-text') as HTMLElement;
    this.statusFps = this.statusBar.querySelector('.dosbox__status-fps') as HTMLElement;
    this.statusRes = this.statusBar.querySelector('.dosbox__status-res') as HTMLElement;
    this.statusArchive = this.statusBar.querySelector('.dosbox__status-archive') as HTMLElement;
    this.statusMsg.textContent = 'Loading emulator...';
    this.statusRes.textContent = '640x400';
    this.statusArchive.textContent = `Archive: ${this.archivePath}`;
    container.appendChild(this.statusBar);
    this.setContent(container);
    // Size window so the screen area is exactly 960x600 (accounting for chrome).
    this.element.style.width = '962px';
    this.element.style.height = '688px';

    // Expose for devtools debugging of the current instance
    (window as any).__lastDosBox = this;

    const launchWhenReady = () => {
      this.element.removeEventListener('appwindow:maximized', launchWhenReady);
      if (!this.launched) void this.launch();
    };
    this.element.addEventListener('appwindow:maximized', launchWhenReady, { once: true });
    // If already maximized (or becomes so before the event attaches), launch immediately.
    if (this.element.classList.contains('is-maximized')) {
      launchWhenReady();
    }
    // Fallback: launch after 1s even if not maximized (to avoid never-start)
    setTimeout(() => {
      if (!this.launched) void this.launch();
    }, 1000);
  }

  protected close() {
    this.destroyed = true;
    if (this.resPoll) {
      clearInterval(this.resPoll);
      this.resPoll = null;
    }
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
    if (this.launched) return;
    this.launched = true;
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

      const runtime = { js: WDOSBOX_JS, wasm: WDOSBOX_WASM, revoke: () => {} };
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
    this.ci = await player.ciPromise;
    try {
      const w =
        (this.ci && typeof this.ci.width === 'function' && this.ci.width()) ||
        this.ci?.frameWidth ||
        640;
      const h =
        (this.ci && typeof this.ci.height === 'function' && this.ci.height()) ||
        this.ci?.frameHeight ||
        400;
      this.updateResolution(w, h);
      const ev =
        (typeof this.ci?.events === 'function' && this.ci.events()) ||
        (typeof (player as any)?.events === 'function' && (player as any).events());
      if (ev && typeof ev.onFrameSize === 'function') {
        ev.onFrameSize((width: number, height: number) => this.updateResolution(width, height));
      }
    } catch {
      /* ignore CI event wiring errors */
    }
    this.startResolutionWatcher();
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
        if (!this.ci && player.ciPromise) {
          this.ci = await player.ciPromise;
        }
        this.statusMsg.textContent = 'Running';
        this.ensureFrameSize(player);
        this.hideOverlays();
        this.pushLog('run(blob) started');
        this.startResolutionWatcher();
        this.refreshResolution();
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
        if (!this.ci && player.ciPromise) {
          this.ci = await player.ciPromise;
        }
        this.statusMsg.textContent = 'Running';
        this.ensureFrameSize(player);
        this.hideOverlays();
        this.pushLog(`run(blob,args) started exe=${exe}`);
        this.startResolutionWatcher();
        this.refreshResolution();
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
            if (!this.ci && (player as any)?.ciPromise) {
              this.ci = await (player as any).ciPromise;
            }
            await this.runProgram(main ? { main, run: main } : player);
            this.ensureFrameSize(player);
            this.hideOverlays();
            this.statusMsg.textContent = 'Running';
            this.startResolutionWatcher();
            this.refreshResolution();
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
      if (!this.ci && (player as any)?.ciPromise) {
        this.ci = await (player as any).ciPromise;
      }
      await this.runProgram(player);
      this.ensureFrameSize(player);
      this.hideOverlays();
      this.statusMsg.textContent = 'Running';
      this.startResolutionWatcher();
      this.refreshResolution();
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

  private updateResolution(w: number, h: number) {
    if (!this.statusRes) return;
    const txt = `${Math.round(w)}x${Math.round(h)}`;
    this.lastRes = txt;
    this.statusRes.textContent = txt;
  }

  private startResolutionWatcher() {
    if (!this.ci) return;
    if (this.resPoll) {
      clearInterval(this.resPoll);
      this.resPoll = null;
    }
    this.resPoll = window.setInterval(() => {
      try {
        const cw =
          (typeof this.ci.width === 'function' && this.ci.width()) || (this.ci as any)?.frameWidth;
        const ch =
          (typeof this.ci.height === 'function' && this.ci.height()) || (this.ci as any)?.frameHeight;
        if (cw && ch) {
          this.updateResolution(cw, ch);
        }
      } catch {
        /* ignore polling errors */
      }
    }, 500);
  }

  private refreshResolution() {
    if (!this.ci) return;
    try {
      const w = (typeof this.ci.width === 'function' && this.ci.width()) || this.ci?.frameWidth;
      const h = (typeof this.ci.height === 'function' && this.ci.height()) || this.ci?.frameHeight;
      if (w && h) this.updateResolution(w, h);
    } catch {
      /* ignore */
    }
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
      if (this.resPoll) {
        clearInterval(this.resPoll);
        this.resPoll = null;
      }
      this.resetStage();
      this.ci = null;
      const runtime = { js: WDOSBOX_JS, wasm: WDOSBOX_WASM, revoke: () => {} };
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
