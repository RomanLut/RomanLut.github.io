export class Taskbar {
  readonly element: HTMLElement;
  private timeEl: HTMLSpanElement | null = null;
  private dateEl: HTMLSpanElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'taskbar';
    this.element.innerHTML = `
      <button class="taskbar__start" aria-label="Open start">
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" fill="currentColor" />
        </svg>
      </button>
      <div class="taskbar__spacer"></div>
      <div class="taskbar__tray">
        <svg class="tray-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" />
        </svg>
        <svg class="tray-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9v6c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4V9c0-2.2-1.8-4-4-4H8c-2.2 0-4 1.8-4 4zm13.5-4.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-1v-12h1z" fill="currentColor" />
        </svg>
        <svg class="tray-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4zm8-6a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V6zm0 6a4 4 0 0 1 4 4h-3a1 1 0 0 0-1-1v-3z" fill="currentColor" />
        </svg>
      </div>
      <div class="taskbar__clock">
        <span class="taskbar__time"></span>
        <span class="taskbar__date"></span>
      </div>
    `;

    this.timeEl = this.element.querySelector('.taskbar__time');
    this.dateEl = this.element.querySelector('.taskbar__date');
  }

  updateClock(now: Date = new Date()) {
    const hh = String(now.getHours());
    const mm = String(now.getMinutes()).padStart(2, '0');
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = now.getDate();
    if (this.timeEl) this.timeEl.textContent = `${hh}:${mm}`;
    if (this.dateEl) this.dateEl.textContent = `${month} ${day}`;
  }
}
