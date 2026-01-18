import { formatDateShort, formatTime } from './util';

export class Taskbar {
  readonly element: HTMLElement;
  private timeEl: HTMLSpanElement | null = null;
  private dateEl: HTMLSpanElement | null = null;
  private windowsEl: HTMLElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'taskbar';
    this.element.innerHTML = `
      <button class="taskbar__start" aria-label="Open start">
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" fill="currentColor" />
        </svg>
      </button>
      <div class="taskbar__windows"></div>
      <div class="taskbar__spacer"></div>
      <div class="taskbar__tray">
        <svg class="tray-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" />
        </svg>
        <svg class="tray-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M3 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm2 0a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5Z"
            fill="currentColor"
          />
          <rect x="5" y="9.5" width="9" height="5" rx="1" fill="currentColor" opacity="0.9" />
        </svg>
        <svg class="tray-icon tray-icon--wifi" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 11.5c4.7-4.1 11.3-4.1 16 0l-1.6 1.8c-3.5-3-9.3-3-12.8 0L4 11.5zm3 3.2c2.9-2.5 7.1-2.5 10 0l-1.6 1.8c-1.9-1.6-4.9-1.6-6.8 0L7 14.7zm3 3.2c1.2-1 2.8-1 4 0l-2 2.1-2-2.1zm1.9 4.6a1.4 1.4 0 1 0 0-2.9 1.4 1.4 0 0 0 0 2.9z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div class="taskbar__clock">
        <span class="taskbar__time"></span>
        <span class="taskbar__date"></span>
      </div>
    `;

    this.timeEl = this.element.querySelector('.taskbar__time');
    this.dateEl = this.element.querySelector('.taskbar__date');
    this.windowsEl = this.element.querySelector('.taskbar__windows');
  }

  updateClock(now: Date = new Date()) {
    if (this.timeEl) this.timeEl.textContent = formatTime(now);
    if (this.dateEl) this.dateEl.textContent = formatDateShort(now);
  }

  addWindowButton(id: string, title: string, iconSvg?: string, onClick?: () => void) {
    if (!this.windowsEl)
      return {
        remove: () => undefined,
        setActive: (_active: boolean) => undefined
      };
    const btn = document.createElement('button');
    btn.className = 'taskbar__winbtn';
    btn.innerHTML = `${iconSvg ? iconSvg : ''}<span class="taskbar__winbtn-title">${title}</span>`;
    btn.dataset.winId = id;
    if (onClick) {
      btn.addEventListener('click', () => onClick());
    }
    this.windowsEl.appendChild(btn);
    return {
      remove: () => btn.remove(),
      setActive: (active: boolean) => btn.classList.toggle('is-active', active)
    };
  }
}
