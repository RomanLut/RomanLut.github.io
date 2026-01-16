export class BlockedScreen {
  private timeEl: HTMLSpanElement | null = null;
  private dateEl: HTMLSpanElement | null = null;
  private intervalId: number | undefined;
  readonly element: HTMLElement;

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'pc';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `
      <div class="blocked_screen"></div>
      <div class="wallpaper__clock">
        <span class="wallpaper__time"></span>
        <span class="wallpaper__date"></span>
      </div>
      <div class="lock-ui">
        <div class="lock-avatar" aria-hidden="true">
          <svg viewBox="0 0 96 96" role="img" aria-hidden="true" class="lock-avatar__icon">
            <circle cx="48" cy="48" r="48" fill="rgba(255,255,255,0.3)" />
            <g transform="translate(0,-8)">
              <circle cx="48" cy="38" r="16" fill="#ffffff" />
              <path
                d="M24 78c0-13 10.7-23.6 24-23.6S72 65 72 78v6H24z"
                fill="#ffffff"
                opacity="0.95"
              />
            </g>
          </svg>
        </div>
        <div class="lock-user" aria-label="User name">user</div>
        <button class="lock-login" type="button">Login</button>
      </div>
    `;

    root.prepend(this.element);

    this.timeEl = this.element.querySelector('.wallpaper__time');
    this.dateEl = this.element.querySelector('.wallpaper__date');

    this.tick();
    this.intervalId = window.setInterval(() => this.tick(), 5000);
  }

  show(opacity = 1) {
    this.element.style.display = 'block';
    this.element.style.opacity = String(opacity);
  }

  hide() {
    this.element.style.display = 'none';
    this.element.style.opacity = '0';
  }

  private tick() {
    const now = new Date();
    const hh = String(now.getHours());
    const mm = String(now.getMinutes()).padStart(2, '0');
    const weekday = now.toLocaleString('en-US', { weekday: 'long' });
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = now.getDate();

    if (this.timeEl) this.timeEl.textContent = `${hh}:${mm}`;
    if (this.dateEl) this.dateEl.textContent = `${weekday}, ${month} ${day}`;
  }

  destroy() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.element.remove();
  }
}
