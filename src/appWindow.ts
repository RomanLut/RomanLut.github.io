import { Taskbar } from './taskbar';
import { isTouchDevice, setMaximizedParam } from './util';

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
};
const SPAWN_BASE = { x: 80, y: 80 };
const SPAWN_STEP = { x: 16, y: 16 };
const SPAWN_MARGIN = 16;
const MIN_WINDOW_WIDTH = 300;
const MIN_WINDOW_HEIGHT = 200;
const TOUCH_DRAG_THRESHOLD_PX = 14;
const MOUSE_DRAG_THRESHOLD_PX = 4;

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
  private dragMoved = false;
  private dragPointerId: number | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragStartClient = { x: 0, y: 0 };
  private resizing: ResizeSession | null = null;
  private resizeCursor: string | null = null;
  private prevUserSelect: string | null = null;
  private iconMarkup: string | undefined;
  private static openWindows = new Set<AppWindow>();
  private static fsWatcherInit = false;
  private static viewportWatcherInit = false;
  private static lastLandscape: boolean | null = null;
  private static maximizedWindows = new Set<AppWindow>();
  private static overlayCount = 0;
  public static skipNextSpawnAnimation = false;
  private static updateMaximizedFlag() {
    setMaximizedParam(AppWindow.maximizedWindows.size > 0);
  }
  private static updateOverlayFlag() {
    document.documentElement.classList.toggle('app-overlay-active', AppWindow.overlayCount > 0);
  }
  private positioned = false;
  private overlayActive = false;
  private overlayKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private overlayPrevOverflow: string | null = null;
  private overlayPrevBox: { left: number; top: number; width: number; height: number } | null = null;
  private overlayPrevInline: { left: string; top: string; width: string; height: string; right: string; bottom: string } | null = null;
  private overlayIframeHandlers: Array<{
    win: Window;
    key: (e: KeyboardEvent) => void;
  }> = [];
  private overlayFsHandler: ((e: Event) => void) | null = null;
  private overlayNativeFs = false;
  private overlayExitBtn: HTMLButtonElement | null = null;
  private closeHandlers: Array<() => void> = [];
  private showAnimation?: Animation;
  private spawnedAnimated = false;
  private spawnOrigin: { x: number; y: number } | null = null;
  private pendingInitialMaximize = false;
  private noSpawnAnimation = false;
  private minimizedWasMaximized = false;
  private lastHeaderTouchTapAt = 0;
  private lastHeaderTouchTapClient = { x: 0, y: 0 };
  private lastHeaderTouchToggleAt = 0;

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
    AppWindow.ensureViewportWatcher();
  }

  private getTaskbarHeight() {
    const h = this.taskbar.element.offsetHeight;
    return h > 0 ? h : 44;
  }

  private getDesktopScale() {
    const rect = this.desktop.getBoundingClientRect();
    return {
      x: rect.width > 0 ? rect.width / Math.max(1, this.desktop.clientWidth) : 1,
      y: rect.height > 0 ? rect.height / Math.max(1, this.desktop.clientHeight) : 1
    };
  }

  private toDesktopCoords(clientX: number, clientY: number) {
    const rect = this.desktop.getBoundingClientRect();
    const scale = this.getDesktopScale();
    return {
      x: (clientX - rect.left) / (scale.x || 1),
      y: (clientY - rect.top) / (scale.y || 1)
    };
  }

  private getUsableBounds() {
    const rect = this.desktop.getBoundingClientRect();
    const width = this.desktop.clientWidth;
    const height = this.desktop.clientHeight;
    const usableHeight = Math.max(0, height - this.getTaskbarHeight());
    return {
      left: rect.left,
      top: rect.top,
      width,
      height: usableHeight
    };
  }

  private positionInitial() {
    if (this.positioned) return;
    const bounds = this.getUsableBounds();
    const windowWidth = this.element.offsetWidth;
    const windowHeight = this.element.offsetHeight;
    if (windowWidth < 10 || windowHeight < 10) {
      // Wait for layout (e.g., subclasses set width/height after super()).
      requestAnimationFrame(() => this.positionInitial());
      return;
    }
    const margin = SPAWN_MARGIN;
    const availableWidth = Math.max(margin, bounds.width - margin * 2);
    const availableHeight = Math.max(margin, bounds.height - margin * 2);
    let nextWindowWidth = windowWidth;
    let nextWindowHeight = windowHeight;
    if (nextWindowWidth > availableWidth) {
      nextWindowWidth = availableWidth;
      this.element.style.width = `${nextWindowWidth}px`;
    }
    if (nextWindowHeight > availableHeight) {
      nextWindowHeight = availableHeight;
      this.element.style.height = `${nextWindowHeight}px`;
    }
    const maxLeft = Math.max(margin, bounds.width - nextWindowWidth - margin);
    const maxTop = Math.max(margin, bounds.height - nextWindowHeight - margin);
    const baseX = Math.min(Math.max(SPAWN_BASE.x, margin), maxLeft);
    const baseY = Math.min(Math.max(SPAWN_BASE.y, margin), maxTop);
    const stepX = SPAWN_STEP.x;
    const stepY = SPAWN_STEP.y;

    const getOrigin = (w: AppWindow) => {
      if (w.spawnOrigin) return { ...w.spawnOrigin };
      return { x: Math.round(w.element.offsetLeft), y: Math.round(w.element.offsetTop) };
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
      const offset = (AppWindow.openWindows.size % 8) * 2;
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
    this.element.addEventListener('pointerdown', (event) => {
      this.focus();
      if (!this.isHeaderPointer(event)) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      this.dragging = true;
      this.dragMoved = false;
      this.dragPointerId = event.pointerId;
      this.dragStartClient = { x: event.clientX, y: event.clientY };
      const pointer = this.toDesktopCoords(event.clientX, event.clientY);
      this.dragOffset = {
        x: pointer.x - this.element.offsetLeft,
        y: pointer.y - this.element.offsetTop
      };
      document.addEventListener('pointermove', this.handleDrag);
      document.addEventListener('pointerup', this.stopDrag);
      document.addEventListener('pointercancel', this.stopDrag);
      if (event.pointerType !== 'mouse') {
        event.preventDefault();
      }
    });
    this.element.addEventListener('dblclick', (event) => {
      if (!this.isHeaderPointer(event)) return;
      if (Date.now() - this.lastHeaderTouchToggleAt < 700) return;
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
        if (isTouchDevice() && (dir === 'n' || dir === 'ne' || dir === 'nw')) {
          return;
        }
        const pointer = this.toDesktopCoords(event.clientX, event.clientY);
        const left = this.element.offsetLeft;
        const top = this.element.offsetTop;
        const width = this.element.offsetWidth;
        const height = this.element.offsetHeight;
        this.resizing = {
          dir,
          startX: pointer.x,
          startY: pointer.y,
          startRect: {
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height
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

  private isHeaderPointer(event: PointerEvent | MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.app-window__actions')) return false;
    if (target?.closest('[data-resize]')) return false;
    const rect = this.headerEl.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  private handleDrag = (event: PointerEvent) => {
    if (!this.dragging || this.state === 'maximized') return;
    if (!this.dragMoved) {
      const dx = event.clientX - this.dragStartClient.x;
      const dy = event.clientY - this.dragStartClient.y;
      const threshold = event.pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD_PX : MOUSE_DRAG_THRESHOLD_PX;
      this.dragMoved = Math.hypot(dx, dy) > threshold;
    }
    if (!this.dragMoved) {
      return;
    }
    const bounds = this.getUsableBounds();
    const pointer = this.toDesktopCoords(event.clientX, event.clientY);
    const x = pointer.x - this.dragOffset.x;
    const y = pointer.y - this.dragOffset.y;
    this.element.style.left = `${Math.max(0, Math.min(bounds.width - 100, x))}px`;
    this.element.style.top = `${Math.max(0, Math.min(bounds.height - 80, y))}px`;
  };

  private handleResize = (event: PointerEvent) => {
    if (!this.resizing || this.state === 'maximized') return;
    const minWidth = MIN_WINDOW_WIDTH;
    const minHeight = MIN_WINDOW_HEIGHT;
    const { dir, startX, startY, startRect } = this.resizing;
    const bounds = this.getUsableBounds();
    const pointer = this.toDesktopCoords(event.clientX, event.clientY);
    const dx = pointer.x - startX;
    const dy = pointer.y - startY;
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
    const localLeft = Math.max(0, left);
    const localTop = Math.max(0, top);
    const maxAllowedWidth = Math.max(80, bounds.width - localLeft);
    const maxAllowedHeight = Math.max(80, bounds.height - localTop);
    const finalWidth = Math.min(width, maxAllowedWidth);
    const finalHeight = Math.min(height, maxAllowedHeight);
    const maxLeft = Math.max(0, bounds.width - finalWidth);
    const maxTop = Math.max(0, bounds.height - finalHeight);

    this.element.style.width = `${finalWidth}px`;
    this.element.style.height = `${finalHeight}px`;
    this.element.style.left = `${Math.min(localLeft, maxLeft)}px`;
    this.element.style.top = `${Math.min(localTop, maxTop)}px`;
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
    this.overlayPrevBox = {
      left: this.element.offsetLeft,
      top: this.element.offsetTop,
      width: this.element.offsetWidth,
      height: this.element.offsetHeight
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
    AppWindow.overlayCount += 1;
    AppWindow.updateOverlayFlag();
    this.overlayNativeFs = false;
    if (isTouchDevice()) {
      if (!this.overlayExitBtn) {
        const btn = document.createElement('button');
        btn.className = 'app-window__overlay-exit';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Exit fullscreen');
        btn.innerHTML = '<span aria-hidden="true">⤢</span>';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.exitOverlay();
        });
        this.overlayExitBtn = btn;
      }
      this.element.appendChild(this.overlayExitBtn);
    }
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
    this.overlayFsHandler = () => {
      // If native fullscreen was exited (e.g., user pressed Esc), restore window size.
      if (this.overlayActive && this.overlayNativeFs && document.fullscreenElement !== this.element) {
        this.exitOverlay();
      }
    };
    window.addEventListener('keydown', this.overlayKeyHandler);
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
    AppWindow.overlayCount = Math.max(0, AppWindow.overlayCount - 1);
    AppWindow.updateOverlayFlag();
    if (this.overlayNativeFs && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {
        /* ignore failures to exit fullscreen */
      });
    }
    this.overlayNativeFs = false;
    if (this.overlayExitBtn && this.overlayExitBtn.parentElement === this.element) {
      this.overlayExitBtn.remove();
    }
    if (this.overlayKeyHandler) window.removeEventListener('keydown', this.overlayKeyHandler);
    if (this.overlayFsHandler) document.removeEventListener('fullscreenchange', this.overlayFsHandler);
    this.unbindIframeOverlayHandlers();
    this.overlayKeyHandler = null;
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
      const key = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.exitOverlay();
      };
      win.addEventListener('keydown', key);
      this.overlayIframeHandlers.push({ win, key });
    });
  }

  private unbindIframeOverlayHandlers() {
    this.overlayIframeHandlers.forEach(({ win, key }) => {
      win.removeEventListener('keydown', key);
    });
    this.overlayIframeHandlers = [];
  }

  private stopDrag = (event: PointerEvent) => {
    if (this.dragPointerId !== null && event.pointerId !== this.dragPointerId) return;
    const touchTravel = Math.hypot(event.clientX - this.dragStartClient.x, event.clientY - this.dragStartClient.y);
    const wasTap = event.pointerType === 'touch' ? touchTravel <= TOUCH_DRAG_THRESHOLD_PX : !this.dragMoved;
    this.dragging = false;
    this.dragMoved = false;
    document.removeEventListener('pointermove', this.handleDrag);
    document.removeEventListener('pointerup', this.stopDrag);
    document.removeEventListener('pointercancel', this.stopDrag);
    this.dragPointerId = null;
    if (event.pointerType !== 'touch' || !wasTap) return;
    const now = Date.now();
    const dt = now - this.lastHeaderTouchTapAt;
    const dx = event.clientX - this.lastHeaderTouchTapClient.x;
    const dy = event.clientY - this.lastHeaderTouchTapClient.y;
    const isSecondTap = dt > 0 && dt <= 350 && Math.hypot(dx, dy) <= 24;
    if (isSecondTap) {
      this.lastHeaderTouchTapAt = 0;
      this.lastHeaderTouchToggleAt = now;
      if (this.state === 'maximized') {
        this.restoreFromMax();
      } else {
        this.maximize();
      }
      return;
    }
    this.lastHeaderTouchTapAt = now;
    this.lastHeaderTouchTapClient = { x: event.clientX, y: event.clientY };
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
    if (this.overlayActive) {
      this.exitOverlay();
    }
    this.minimizedWasMaximized = this.state === 'maximized';
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
    this.element.style.display = 'flex';
    if (this.minimizedWasMaximized) {
      this.state = 'maximized';
      this.element.classList.add('is-maximized');
      this.applyMaximizedLayout();
      AppWindow.maximizedWindows.add(this);
      AppWindow.updateMaximizedFlag();
    } else {
      this.state = 'normal';
      this.element.classList.remove('is-maximized');
    }
    this.minimizedWasMaximized = false;
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
    this.element.classList.remove('is-active');
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

  private static ensureViewportWatcher() {
    if (AppWindow.viewportWatcherInit) return;
    AppWindow.viewportWatcherInit = true;
    AppWindow.lastLandscape = window.innerWidth >= window.innerHeight;

    let resizeTick: number | null = null;
    const applyViewportLayout = () => {
      const isLandscape = window.innerWidth >= window.innerHeight;
      const switchedToPortrait = AppWindow.lastLandscape === true && isLandscape === false;
      const switchedToLandscape = AppWindow.lastLandscape === false && isLandscape === true;
      AppWindow.lastLandscape = isLandscape;
      const transition: 'none' | 'toPortrait' | 'toLandscape' =
        switchedToPortrait ? 'toPortrait' : switchedToLandscape ? 'toLandscape' : 'none';
      AppWindow.openWindows.forEach((win) => win.onViewportChanged(transition));
    };

    const scheduleApply = (delay = 0) => {
      if (resizeTick !== null) {
        window.clearTimeout(resizeTick);
      }
      resizeTick = window.setTimeout(() => {
        resizeTick = null;
        applyViewportLayout();
      }, delay);
    };

    window.addEventListener('resize', () => scheduleApply(50));
    window.addEventListener('orientationchange', () => scheduleApply(120));
  }

  private onViewportChanged(transition: 'none' | 'toPortrait' | 'toLandscape') {
    if (this.state === 'minimized' || this.overlayActive) return;

    const bounds = this.getUsableBounds();
    if (!bounds.width || !bounds.height) return;

    const margin = SPAWN_MARGIN;
    const maxWidth = Math.max(MIN_WINDOW_WIDTH, bounds.width - margin * 2);
    const maxHeight = Math.max(MIN_WINDOW_HEIGHT, bounds.height - margin * 2);
    const clampForViewport = (x: number, y: number, w: number, h: number) => {
      const width = Math.max(MIN_WINDOW_WIDTH, Math.min(maxWidth, w));
      const height = Math.max(MIN_WINDOW_HEIGHT, Math.min(maxHeight, h));
      const maxLeft = Math.max(margin, bounds.width - width - margin);
      const maxTop = Math.max(margin, bounds.height - height - margin);
      const left = Math.min(Math.max(x, margin), maxLeft);
      const top = Math.min(Math.max(y, margin), maxTop);
      return { left, top, width, height };
    };

    if (this.state === 'maximized') {
      if (this.lastRect) {
        const normalized = clampForViewport(this.lastRect.x, this.lastRect.y, this.lastRect.w, this.lastRect.h);
        this.lastRect = { x: normalized.left, y: normalized.top, w: normalized.width, h: normalized.height };
      }
      this.applyMaximizedLayout();
      return;
    }

    const currentX = this.element.offsetLeft;
    const currentY = this.element.offsetTop;
    const currentWidth = this.element.offsetWidth;
    const currentHeight = this.element.offsetHeight;
    const nextWidth = transition === 'toPortrait' && currentWidth > maxWidth ? maxWidth : currentWidth;
    const nextHeight = transition === 'toLandscape' && currentHeight > maxHeight ? maxHeight : currentHeight;
    const target = clampForViewport(currentX, currentY, nextWidth, nextHeight);

    this.element.style.left = `${target.left}px`;
    this.element.style.top = `${target.top}px`;
    this.element.style.width = `${target.width}px`;
    this.element.style.height = `${target.height}px`;
    this.spawnOrigin = { x: target.left, y: target.top };
  }

  private setActiveState(active: boolean) {
    this.element.classList.toggle('is-active', active);
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
    const scale = this.getDesktopScale();
    const btnRect = btn.getBoundingClientRect();
    const winRect = this.element.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const btnCenterY = btnRect.top + btnRect.height / 2;
    const winCenterX = winRect.left + winRect.width / 2;
    const winCenterY = winRect.top + winRect.height / 2;
    return {
      dx: (btnCenterX - winCenterX) / (scale.x || 1),
      dy: (btnCenterY - winCenterY) / (scale.y || 1)
    };
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
    this.lastRect = {
      x: this.element.offsetLeft,
      y: this.element.offsetTop,
      w: this.element.offsetWidth,
      h: this.element.offsetHeight
    };
    this.applyMaximizedLayout();
    this.state = 'maximized';
    this.element.classList.add('is-maximized');
    this.setActiveState(true);
    AppWindow.maximizedWindows.add(this);
    AppWindow.updateMaximizedFlag();
    this.element.dispatchEvent(new CustomEvent('appwindow:maximized', { detail: { win: this } }));
  }

  private applyMaximizedLayout() {
    const bounds = this.getUsableBounds();
    this.element.style.left = '0px';
    this.element.style.top = '0px';
    this.element.style.width = '100%';
    this.element.style.height = `${bounds.height}px`;
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
