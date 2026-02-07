import { Taskbar } from './taskbar';
import { setMaximizedParam } from './util';

type WindowState = 'normal' | 'maximized' | 'minimized';

let zCounter = 10;
let windowId = 0;
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type ResizeSession = {
  dir: ResizeDir;
  startX: number;
  startY: number;
  startRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  parentRect: {
    left: number;
    top: number;
  };
};
const SPAWN_BASE = { x: 80, y: 80 };
const SPAWN_STEP = { x: 32, y: 32 };
const SPAWN_MARGIN = 16;

export class AppWindow {
  readonly element: HTMLElement;
  private desktop: HTMLElement;
  private headerEl: HTMLElement;
  private contentEl: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private maxBtn: HTMLButtonElement;
  private minBtn: HTMLButtonElement;
  private fsBtn: HTMLButtonElement | null = null;
  private state: WindowState = 'normal';
  private taskbar: Taskbar;
  private taskbarButton:
    | {
        remove: () => void;
        setActive: (active: boolean) => void;
      }
    | null = null;
  private lastRect: { x: number; y: number; w: number; h: number } | null = null;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  private resizing: ResizeSession | null = null;
  private resizeCursor: string | null = null;
  private prevUserSelect: string | null = null;
  private iconMarkup: string | undefined;
  private static openWindows = new Set<AppWindow>();
  private static fsWatcherInit = false;
  private static maximizedWindows = new Set<AppWindow>();
  public static skipNextSpawnAnimation = false;
  private static updateMaximizedFlag() {
    setMaximizedParam(AppWindow.maximizedWindows.size > 0);
  }
  private positioned = false;
  private overlayActive = false;
  private overlayKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private overlayClickHandler: ((e: MouseEvent) => void) | null = null;
  private overlayPrevOverflow: string | null = null;
  private overlayPrevBox: { left: number; top: number; width: number; height: number } | null = null;
  private overlayPrevInline: { left: string; top: string; width: string; height: string; right: string; bottom: string } | null = null;
  private overlayIframeHandlers: Array<{ win: Window; click: (e: MouseEvent) => void; key: (e: KeyboardEvent) => void }> =
    [];
  private overlayFsHandler: ((e: Event) => void) | null = null;
  private overlayNativeFs = false;
  private closeHandlers: Array<() => void> = [];
  private showAnimation?: Animation;
  private spawnedAnimated = false;
  private spawnOrigin: { x: number; y: number } | null = null;
  private pendingInitialMaximize = false;
  private noSpawnAnimation = false;

  constructor(desktop: HTMLElement, taskbar: Taskbar, title: string, icon?: string, showFullscreen = false) {
    this.taskbar = taskbar;
    this.desktop = desktop;
    this.noSpawnAnimation = AppWindow.skipNextSpawnAnimation;
    AppWindow.skipNextSpawnAnimation = false;
    this.element = document.createElement('div');
    this.element.className = 'app-window';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', title);
    this.element.dataset.winId = String(++windowId);
    this.iconMarkup =
      icon ||
      `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" fill="#4b8dff"/><path d="M8 9h8v2H8zm0 4h6v2H8z" fill="#fff"/></svg>`;
    this.element.innerHTML = `
      <div class="app-window__header">
        <div class="app-window__icon">
          ${this.iconMarkup}
        </div>
        <div class="app-window__title">${title}</div>
      <div class="app-window__actions">
          ${showFullscreen ? '<button class="app-window__btn app-window__btn--fs" aria-label="Fullscreen"></button>' : ''}
          <button class="app-window__btn app-window__btn--min" aria-label="Minimize"></button>
          <button class="app-window__btn app-window__btn--max" aria-label="Maximize"></button>
          <button class="app-window__btn app-window__btn--close" aria-label="Close"></button>
        </div>
      </div>
      <div class="app-window__body"></div>
      <div class="app-window__resize app-window__resize--n" data-resize="n"></div>
      <div class="app-window__resize app-window__resize--s" data-resize="s"></div>
      <div class="app-window__resize app-window__resize--e" data-resize="e"></div>
      <div class="app-window__resize app-window__resize--w" data-resize="w"></div>
      <div class="app-window__resize app-window__resize--ne" data-resize="ne"></div>
      <div class="app-window__resize app-window__resize--nw" data-resize="nw"></div>
      <div class="app-window__resize app-window__resize--se" data-resize="se"></div>
      <div class="app-window__resize app-window__resize--sw" data-resize="sw"></div>
    `;

    this.headerEl = this.element.querySelector('.app-window__header') as HTMLElement;
    this.contentEl = this.element.querySelector('.app-window__body') as HTMLElement;
    this.fsBtn = this.element.querySelector('.app-window__btn--fs') as HTMLButtonElement | null;
    this.closeBtn = this.element.querySelector('.app-window__btn--close') as HTMLButtonElement;
    this.maxBtn = this.element.querySelector('.app-window__btn--max') as HTMLButtonElement;
    this.minBtn = this.element.querySelector('.app-window__btn--min') as HTMLButtonElement;

    desktop.appendChild(this.element);
    requestAnimationFrame(() => this.positionInitial());
    this.createTaskbarButton(title);
    this.focus();
    this.attachEvents(desktop);
    if (this.fsBtn) {
      this.fsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleOverlay();
      });
    }
    AppWindow.openWindows.add(this);
    AppWindow.ensureFsWatcher();
  }

  private positionInitial() {
    if (this.positioned) return;
    const parentRect = this.desktop.getBoundingClientRect();
    const prevTransform = this.element.style.transform;
    this.element.style.transform = '';
    const rect = this.element.getBoundingClientRect();
    this.element.style.transform = prevTransform;
    if (rect.width < 10 || rect.height < 10) {
      // Wait for layout (e.g., subclasses set width/height after super()).
      requestAnimationFrame(() => this.positionInitial());
      return;
    }
    const margin = SPAWN_MARGIN;
    const availableWidth = Math.max(margin, parentRect.width - margin * 2);
    const availableHeight = Math.max(margin, parentRect.height - margin * 2);
    let windowWidth = rect.width;
    let windowHeight = rect.height;
    if (windowWidth > availableWidth) {
      windowWidth = availableWidth;
      this.element.style.width = `${windowWidth}px`;
    }
    if (windowHeight > availableHeight) {
      windowHeight = availableHeight;
      this.element.style.height = `${windowHeight}px`;
    }
    const maxLeft = Math.max(margin, parentRect.width - windowWidth - margin);
    const maxTop = Math.max(margin, parentRect.height - windowHeight - margin);
    const baseX = Math.min(Math.max(SPAWN_BASE.x, margin), maxLeft);
    const baseY = Math.min(Math.max(SPAWN_BASE.y, margin), maxTop);
    const stepX = SPAWN_STEP.x;
    const stepY = SPAWN_STEP.y;

    const getOrigin = (w: AppWindow) => {
      if (w.spawnOrigin) return { ...w.spawnOrigin };
      const r = w.element.getBoundingClientRect();
      return { x: Math.round(r.left - parentRect.left), y: Math.round(r.top - parentRect.top) };
    };

    const existingOrigins = Array.from(AppWindow.openWindows)
      .filter((w) => w !== this)
      .map((w) => getOrigin(w));

    const originUsed = (x: number, y: number) =>
      existingOrigins.some((o) => Math.abs(o.x - x) < 1 && Math.abs(o.y - y) < 1);

    const cols = Math.max(1, Math.floor((maxLeft - baseX) / stepX) + 1);
    let x = baseX;
    let y = baseY;
    let attempts = 0;
    const maxAttempts = 500;
    const rows = Math.max(1, Math.floor((maxTop - baseY) / stepY) + 1);
    while (attempts < maxAttempts && originUsed(x, y)) {
      attempts++;
      x = Math.min(baseX + attempts * stepX, maxLeft);
      const row = attempts % rows;
      y = baseY + row * stepY;
    }

    if (originUsed(x, y)) {
      const offset = (AppWindow.openWindows.size % 8) * 4;
      x = Math.min(Math.max(baseX + offset, margin), maxLeft);
      y = Math.min(Math.max(baseY + offset, margin), maxTop);
    }

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.spawnOrigin = { x, y };
    this.positioned = true;
    if (!this.spawnedAnimated) {
      this.spawnedAnimated = true;
      if (!this.noSpawnAnimation) {
        void this.animateSpawn();
      }
    }
  }

  setContent(node: HTMLElement) {
    let safeNode = node;
    if (
      safeNode.contains(this.element) ||
      safeNode.contains(this.contentEl) ||
      this.element.contains(safeNode) ||
      this.contentEl.contains(safeNode)
    ) {
      safeNode = safeNode.cloneNode(true) as HTMLElement;
    }
    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(safeNode);
  }

  private attachEvents(desktop: HTMLElement) {
    this.element.addEventListener('pointerdown', () => this.focus());

    this.headerEl.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.app-window__actions')) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      this.dragging = true;
      const rect = this.element.getBoundingClientRect();
      this.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      document.addEventListener('pointermove', this.handleDrag);
      document.addEventListener('pointerup', this.stopDrag);
      document.addEventListener('pointercancel', this.stopDrag);
      if (event.pointerType !== 'mouse') {
        event.preventDefault();
      }
    });
    this.headerEl.addEventListener('dblclick', () => {
      if (this.state === 'maximized') {
        this.restoreFromMax();
      } else {
        this.maximize();
      }
    });

    const resizeZones = this.element.querySelectorAll<HTMLElement>('[data-resize]');
    resizeZones.forEach((zone) => {
      zone.addEventListener('pointerdown', (event) => {
        if (this.state === 'maximized' || this.overlayActive) return;
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        event.stopPropagation();
        const dir = zone.dataset.resize as ResizeDir;
        const rect = this.element.getBoundingClientRect();
        const parentRect = this.element.parentElement?.getBoundingClientRect();
        if (!parentRect) return;
        this.resizing = {
          dir,
          startX: event.clientX,
          startY: event.clientY,
          startRect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          },
          parentRect: {
            left: parentRect.left,
            top: parentRect.top
          }
        };
        this.resizeCursor = this.cursorForDir(dir);
        if (this.resizeCursor) {
          document.body.style.cursor = this.resizeCursor;
        }
        this.prevUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        this.element.classList.add('is-resizing');
        document.addEventListener('pointermove', this.handleResize);
        document.addEventListener('pointerup', this.stopResize);
        document.addEventListener('pointercancel', this.stopResize);
        if (event.pointerType !== 'mouse') {
          event.preventDefault();
        }
      });
    });

    this.minBtn.addEventListener('click', () => this.minimize());
    this.maxBtn.addEventListener('click', () => this.toggleMaximize());
    this.closeBtn.addEventListener('click', () => this.close());
  }

  private handleDrag = (event: PointerEvent) => {
    if (!this.dragging || this.state === 'maximized') return;
    const parentRect = this.element.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    const x = event.clientX - this.dragOffset.x - parentRect.left;
    const y = event.clientY - this.dragOffset.y - parentRect.top;
    this.element.style.left = `${Math.max(0, Math.min(parentRect.width - 100, x))}px`;
    this.element.style.top = `${Math.max(0, Math.min(parentRect.height - 80, y))}px`;
  };

  private handleResize = (event: PointerEvent) => {
    if (!this.resizing || this.state === 'maximized') return;
    const minWidth = 300;
    const minHeight = 200;
    const { dir, startX, startY, startRect, parentRect } = this.resizing;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    let left = startRect.left;
    let top = startRect.top;
    let right = startRect.right;
    let bottom = startRect.bottom;

    if (dir.includes('e')) {
      right = Math.max(startRect.left + minWidth, startRect.right + dx);
    }
    if (dir.includes('s')) {
      bottom = Math.max(startRect.top + minHeight, startRect.bottom + dy);
    }
    if (dir.includes('w')) {
      left = Math.min(startRect.left + dx, startRect.right - minWidth);
    }
    if (dir.includes('n')) {
      top = Math.min(startRect.top + dy, startRect.bottom - minHeight);
    }
    const width = right - left;
    const height = bottom - top;

    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.element.style.left = `${left - parentRect.left}px`;
    this.element.style.top = `${top - parentRect.top}px`;
  };

  private stopResize = () => {
    this.resizing = null;
    if (this.resizeCursor) {
      document.body.style.cursor = '';
      this.resizeCursor = null;
    }
    if (this.prevUserSelect !== null) {
      document.body.style.userSelect = this.prevUserSelect;
      this.prevUserSelect = null;
    }
    this.element.classList.remove('is-resizing');
    document.removeEventListener('pointermove', this.handleResize);
    document.removeEventListener('pointerup', this.stopResize);
    document.removeEventListener('pointercancel', this.stopResize);
  };

  // --- Overlay (fullscreen) support for optional fullscreen button ---
  protected toggleOverlay() {
    if (this.overlayActive) {
      this.exitOverlay();
    } else {
      this.enterOverlay();
    }
  }

  private enterOverlay() {
    if (this.overlayActive) return;
    const parentRect = this.desktop.getBoundingClientRect();
    const rect = this.element.getBoundingClientRect();
    this.overlayPrevBox = {
      left: rect.left - parentRect.left,
      top: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height
    };
    this.overlayPrevInline = {
      left: this.element.style.left,
      top: this.element.style.top,
      width: this.element.style.width,
      height: this.element.style.height,
      right: this.element.style.right,
      bottom: this.element.style.bottom
    };
    this.overlayPrevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.element.classList.add('app-window--overlay');
    this.element.style.left = '0';
    this.element.style.top = '0';
    this.element.style.width = '100vw';
    this.element.style.height = '100vh';
    this.overlayActive = true;
    this.overlayNativeFs = false;
    if (!document.fullscreenElement && this.element.requestFullscreen) {
      this.element
        .requestFullscreen()
        .then(() => {
          this.overlayNativeFs = true;
        })
        .catch(() => {
          /* ignore failure to enter native fullscreen */
        });
    } else if (document.fullscreenElement === this.element) {
      this.overlayNativeFs = true;
    }
    this.overlayKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.exitOverlay();
    };
    this.overlayClickHandler = (evt: MouseEvent) => {
      // ignore clicks on the fullscreen button itself to prevent immediate toggle loops
      const target = evt.target as HTMLElement;
      if (target && target.closest('.app-window__btn--fs')) return;
      this.exitOverlay();
    };
    this.overlayFsHandler = () => {
      // If native fullscreen was exited (e.g., user pressed Esc), restore window size.
      if (this.overlayActive && this.overlayNativeFs && document.fullscreenElement !== this.element) {
        this.exitOverlay();
      }
    };
    window.addEventListener('keydown', this.overlayKeyHandler);
    this.element.addEventListener('click', this.overlayClickHandler);
    document.addEventListener('fullscreenchange', this.overlayFsHandler);
    this.bindIframeOverlayHandlers();
  }

  private applyOverlayRestore() {
    // Clear overlay-specific inline props that could keep the window stretched.
    this.element.style.right = '';
    this.element.style.bottom = '';
    this.element.style.transform = 'translate(0,0)';
    if (this.overlayPrevBox) {
      this.element.style.left = `${this.overlayPrevBox.left}px`;
      this.element.style.top = `${this.overlayPrevBox.top}px`;
      this.element.style.width = `${this.overlayPrevBox.width}px`;
      this.element.style.height = `${this.overlayPrevBox.height}px`;
    } else if (this.overlayPrevInline) {
      this.element.style.left = this.overlayPrevInline.left;
      this.element.style.top = this.overlayPrevInline.top;
      this.element.style.width = this.overlayPrevInline.width;
      this.element.style.height = this.overlayPrevInline.height;
      this.element.style.right = this.overlayPrevInline.right;
      this.element.style.bottom = this.overlayPrevInline.bottom;
    }
  }

  private exitOverlay() {
    if (!this.overlayActive) return;
    this.applyOverlayRestore();
    // Apply again on next frame and shortly after to override late layout writes from native fullscreen.
    requestAnimationFrame(() => this.applyOverlayRestore());
    setTimeout(() => this.applyOverlayRestore(), 50);
    if (this.overlayPrevOverflow !== null) {
      document.body.style.overflow = this.overlayPrevOverflow;
      this.overlayPrevOverflow = null;
    }
    this.element.classList.remove('app-window--overlay');
    this.overlayActive = false;
    if (this.overlayNativeFs && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {
        /* ignore failures to exit fullscreen */
      });
    }
    this.overlayNativeFs = false;
    if (this.overlayKeyHandler) window.removeEventListener('keydown', this.overlayKeyHandler);
    if (this.overlayClickHandler) this.element.removeEventListener('click', this.overlayClickHandler);
    if (this.overlayFsHandler) document.removeEventListener('fullscreenchange', this.overlayFsHandler);
    this.unbindIframeOverlayHandlers();
    this.overlayKeyHandler = null;
    this.overlayClickHandler = null;
    this.overlayFsHandler = null;
    this.overlayPrevBox = null;
    this.overlayPrevInline = null;
  }

  private bindIframeOverlayHandlers() {
    this.unbindIframeOverlayHandlers();
    const iframes = Array.from(this.element.querySelectorAll('iframe'));
    iframes.forEach((frame) => {
      const win = frame.contentWindow;
      if (!win) return;
      const click = () => this.exitOverlay();
      const key = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.exitOverlay();
      };
      win.addEventListener('click', click);
      win.addEventListener('keydown', key);
      this.overlayIframeHandlers.push({ win, click, key });
    });
  }

  private unbindIframeOverlayHandlers() {
    this.overlayIframeHandlers.forEach(({ win, click, key }) => {
      win.removeEventListener('click', click);
      win.removeEventListener('keydown', key);
    });
    this.overlayIframeHandlers = [];
  }

  private stopDrag = () => {
    this.dragging = false;
    document.removeEventListener('pointermove', this.handleDrag);
    document.removeEventListener('pointerup', this.stopDrag);
    document.removeEventListener('pointercancel', this.stopDrag);
  };

  private focus() {
    this.element.style.zIndex = String(++zCounter);
    this.setActiveState(true);
    AppWindow.activeWindows.forEach((win) => {
      if (win !== this) {
        win.deactivate();
      }
    });
  }

  public applyInitialState(options?: { maximize?: boolean }) {
    if (options?.maximize) {
      this.pendingInitialMaximize = true;
      requestAnimationFrame(() => {
        if (!this.pendingInitialMaximize) return;
        this.pendingInitialMaximize = false;
        if (this.state !== 'normal') return;
        this.maximize();
      });
    }
  }

  private minimize() {
    if (this.state === 'minimized') return;
    this.pendingInitialMaximize = false;
    if (this.state === 'maximized') {
      AppWindow.maximizedWindows.delete(this);
      AppWindow.updateMaximizedFlag();
    }
    this.animateToTaskbar().then(() => {
      this.state = 'minimized';
      this.element.style.display = 'none';
      this.setActiveState(false);
    });
  }

  private restore() {
    this.state = 'normal';
    this.element.style.display = 'flex';
    this.setActiveState(true);
    this.animateFromTaskbar();
    this.focus();
  }

  private toggleMaximize(desktop: HTMLElement) {
    if (this.state === 'maximized') {
      this.restoreFromMax();
      return;
    }
    this.maximize();
  }

  protected close() {
    if (this.closeHandlers.length) {
      this.closeHandlers.forEach((handler) => {
        try {
          handler();
        } catch {
          /* ignore */
        }
      });
      this.closeHandlers = [];
    }
    this.exitOverlay();
    this.element.remove();
    if (this.taskbarButton) {
      this.taskbarButton.remove();
      this.taskbarButton = null;
    }
    if (AppWindow.maximizedWindows.delete(this)) {
      AppWindow.updateMaximizedFlag();
    }
    AppWindow.activeWindows.delete(this);
    AppWindow.openWindows.delete(this);
    if (AppWindow.openWindows.size === 0) {
      AppWindow.nextSpawn = { ...SPAWN_BASE };
    }
  }

  protected registerCloseHandler(handler: () => void) {
    this.closeHandlers.push(handler);
  }

  private createTaskbarButton(title: string) {
    this.taskbarButton = this.taskbar.addWindowButton(this.element.dataset.winId || '', title, this.iconMarkup, () => {
      this.handleTaskbarClick();
    });
    this.taskbarButton.setActive(true);
    this.setActiveState(true);
  }

  private deactivate() {
    if (this.taskbarButton) this.taskbarButton.setActive(false);
    AppWindow.activeWindows.delete(this);
  }

  private static activeWindows = new Set<AppWindow>();
  private static ensureFsWatcher() {
    if (AppWindow.fsWatcherInit) return;
    AppWindow.fsWatcherInit = true;
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) return;
      AppWindow.openWindows.forEach((win) => {
        if ((win as any).overlayActive) {
          win.exitOverlay();
        }
      });
    });
  }

  private setActiveState(active: boolean) {
    if (active) {
      AppWindow.activeWindows.add(this);
      if (this.taskbarButton) this.taskbarButton.setActive(true);
    } else {
      AppWindow.activeWindows.delete(this);
      if (this.taskbarButton) this.taskbarButton.setActive(false);
    }
  }

  private handleTaskbarClick() {
    if (this.state === 'minimized') {
      this.restore();
      return;
    }
    if (this.isActive()) {
      this.minimize();
      return;
    }
    this.focus();
  }

  private isActive() {
    return AppWindow.activeWindows.has(this);
  }

  private getTaskbarButtonEl(): HTMLElement | null {
    const id = this.element.dataset.winId;
    if (!id) return null;
    return document.querySelector(`.taskbar__winbtn[data-win-id="${id}"]`) as HTMLElement | null;
  }

  private computeTaskbarDelta() {
    const btn = this.getTaskbarButtonEl();
    if (!btn) return { dx: 0, dy: 0 };
    const btnRect = btn.getBoundingClientRect();
    const winRect = this.element.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const btnCenterY = btnRect.top + btnRect.height / 2;
    const winCenterX = winRect.left + winRect.width / 2;
    const winCenterY = winRect.top + winRect.height / 2;
    return { dx: btnCenterX - winCenterX, dy: btnCenterY - winCenterY };
  }

  private animateFromTaskbar(reverse = false): Promise<void> {
    const { dx, dy } = this.computeTaskbarDelta();
    const taskbarKeyframes = [
      { transform: `translate(${dx}px, ${dy}px) scale(0.25, 0.05)`, opacity: 0 },
      { transform: 'translate(0,0) scale(1,1)', opacity: 1 }
    ];
    const keyframes = reverse ? [...taskbarKeyframes].reverse() : taskbarKeyframes;
    const anim = this.element.animate(keyframes, {
      duration: 250,
      easing: 'cubic-bezier(0.02, 0.0, 0.35, 1)'
    });
    return anim.finished.then(() => {
      this.element.style.transform = 'translate(0,0) scale(1)';
      this.element.style.opacity = '';
    });
  }

  private animateToTaskbar() {
    return this.animateFromTaskbar(true);
  }

  private animateSpawn(): Promise<void> {
    const spawnKeyframes = [
      { transform: 'scale(0.6)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 }
    ];
    const anim = this.element.animate(spawnKeyframes, {
      duration: 250,
      easing: 'cubic-bezier(0.02, 0.0, 0.35, 1)'
    });
    return anim.finished.then(() => {
      this.element.style.transform = 'translate(0,0) scale(1)';
      this.element.style.opacity = '';
    });
  }

  private maximize() {
    if (this.state === 'maximized') return;
    const rect = this.element.getBoundingClientRect();
    const parentRect = this.desktop.getBoundingClientRect();
    this.lastRect = { x: rect.left - parentRect.left, y: rect.top - parentRect.top, w: rect.width, h: rect.height };
    this.element.style.left = '0px';
    this.element.style.top = '0px';
    this.element.style.width = '100%';
    this.element.style.height = `calc(100% - 44px)`;
    this.state = 'maximized';
    this.element.classList.add('is-maximized');
    this.setActiveState(true);
    AppWindow.maximizedWindows.add(this);
    AppWindow.updateMaximizedFlag();
    this.element.dispatchEvent(new CustomEvent('appwindow:maximized', { detail: { win: this } }));
  }

  private restoreFromMax() {
    if (this.state !== 'maximized' || !this.lastRect) return;
    AppWindow.maximizedWindows.delete(this);
    AppWindow.updateMaximizedFlag();
    this.element.style.left = `${this.lastRect.x}px`;
    this.element.style.top = `${this.lastRect.y}px`;
    this.element.style.width = `${this.lastRect.w}px`;
    this.element.style.height = `${this.lastRect.h}px`;
    this.state = 'normal';
    this.element.classList.remove('is-maximized');
    this.setActiveState(true);
    this.element.dispatchEvent(new CustomEvent('appwindow:restored', { detail: { win: this } }));
  }

  private cursorForDir(dir: ResizeDir): string {
    switch (dir) {
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      case 'ne':
        return 'nesw-resize';
      case 'nw':
        return 'nwse-resize';
      case 'se':
        return 'nwse-resize';
      case 'sw':
        return 'nesw-resize';
      default:
        return '';
    }
  }
}
