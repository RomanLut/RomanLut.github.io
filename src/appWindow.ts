import { Taskbar } from './taskbar';

type WindowState = 'normal' | 'maximized' | 'minimized';

let zCounter = 10;
let windowId = 0;
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export class AppWindow {
  readonly element: HTMLElement;
  private headerEl: HTMLElement;
  private contentEl: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private maxBtn: HTMLButtonElement;
  private minBtn: HTMLButtonElement;
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
  private resizing: null | { dir: ResizeDir } = null;
  private resizeCursor: string | null = null;
  private prevUserSelect: string | null = null;
  private iconMarkup: string | undefined;

  constructor(desktop: HTMLElement, taskbar: Taskbar, title: string, icon?: string) {
    this.taskbar = taskbar;
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
    this.closeBtn = this.element.querySelector('.app-window__btn--close') as HTMLButtonElement;
    this.maxBtn = this.element.querySelector('.app-window__btn--max') as HTMLButtonElement;
    this.minBtn = this.element.querySelector('.app-window__btn--min') as HTMLButtonElement;

    desktop.appendChild(this.element);
    this.createTaskbarButton(title);
    this.focus();
    this.attachEvents(desktop);
  }

  setContent(node: HTMLElement) {
    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(node);
  }

  private attachEvents(desktop: HTMLElement) {
    this.element.addEventListener('mousedown', () => this.focus());

    this.headerEl.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement).closest('.app-window__actions')) return;
      this.dragging = true;
      const rect = this.element.getBoundingClientRect();
      this.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      document.addEventListener('mousemove', this.handleDrag);
      document.addEventListener('mouseup', this.stopDrag);
    });

    const resizeZones = this.element.querySelectorAll<HTMLElement>('[data-resize]');
    resizeZones.forEach((zone) => {
      zone.addEventListener('mousedown', (event) => {
        event.stopPropagation();
        const dir = zone.dataset.resize as ResizeDir;
        this.resizing = { dir };
        this.resizeCursor = this.cursorForDir(dir);
        if (this.resizeCursor) {
          document.body.style.cursor = this.resizeCursor;
        }
        this.prevUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.handleResize);
        document.addEventListener('mouseup', this.stopResize);
      });
    });

    this.minBtn.addEventListener('click', () => this.minimize());
    this.maxBtn.addEventListener('click', () => this.toggleMaximize(desktop));
    this.closeBtn.addEventListener('click', () => this.close());
  }

  private handleDrag = (event: MouseEvent) => {
    if (!this.dragging || this.state === 'maximized') return;
    const parentRect = this.element.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    const x = event.clientX - this.dragOffset.x - parentRect.left;
    const y = event.clientY - this.dragOffset.y - parentRect.top;
    this.element.style.left = `${Math.max(0, Math.min(parentRect.width - 100, x))}px`;
    this.element.style.top = `${Math.max(0, Math.min(parentRect.height - 80, y))}px`;
  };

  private handleResize = (event: MouseEvent) => {
    if (!this.resizing || this.state === 'maximized') return;
    const parentRect = this.element.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    const rect = this.element.getBoundingClientRect();
    const minWidth = 300;
    const minHeight = 200;
    let { left, top, width, height } = rect;
    const dir = this.resizing.dir;

    if (dir.includes('e')) {
      width = Math.max(minWidth, event.clientX - rect.left);
    }
    if (dir.includes('s')) {
      height = Math.max(minHeight, event.clientY - rect.top);
    }
    if (dir.includes('w')) {
      const newLeft = Math.min(event.clientX, rect.right - minWidth);
      width = rect.right - newLeft;
      left = newLeft;
    }
    if (dir.includes('n')) {
      const newTop = Math.min(event.clientY, rect.bottom - minHeight);
      height = rect.bottom - newTop;
      top = newTop;
    }

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
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
  };

  private stopDrag = () => {
    this.dragging = false;
    document.removeEventListener('mousemove', this.handleDrag);
    document.removeEventListener('mouseup', this.stopDrag);
  };

  private focus() {
    this.element.style.zIndex = String(++zCounter);
    if (this.taskbarButton) this.taskbarButton.setActive(true);
  }

  private minimize() {
    if (this.state === 'minimized') return;
    this.state = 'minimized';
    this.element.style.display = 'none';
    if (this.taskbarButton) this.taskbarButton.setActive(false);
  }

  private restore() {
    this.state = 'normal';
    this.element.style.display = 'block';
    this.focus();
    if (this.taskbarButton) this.taskbarButton.setActive(true);
  }

  private toggleMaximize(desktop: HTMLElement) {
    if (this.state === 'maximized') {
      if (this.lastRect) {
        this.element.style.left = `${this.lastRect.x}px`;
        this.element.style.top = `${this.lastRect.y}px`;
        this.element.style.width = `${this.lastRect.w}px`;
        this.element.style.height = `${this.lastRect.h}px`;
      }
      this.state = 'normal';
      this.element.classList.remove('is-maximized');
      return;
    }
    const rect = this.element.getBoundingClientRect();
    const parentRect = desktop.getBoundingClientRect();
    this.lastRect = { x: rect.left - parentRect.left, y: rect.top - parentRect.top, w: rect.width, h: rect.height };
    this.element.style.left = '0px';
    this.element.style.top = '0px';
    this.element.style.width = '100%';
    this.element.style.height = `calc(100% - 51.2px)`; // leave room for taskbar
    this.state = 'maximized';
    this.element.classList.add('is-maximized');
  }

  private close() {
    this.element.remove();
    if (this.taskbarButton) {
      this.taskbarButton.remove();
      this.taskbarButton = null;
    }
  }

  private createTaskbarButton(title: string) {
    this.taskbarButton = this.taskbar.addWindowButton(this.element.dataset.winId || '', title, this.iconMarkup, () => {
      if (this.state === 'minimized') {
        this.restore();
      } else {
        this.focus();
      }
    });
    this.taskbarButton.setActive(true);
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
