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
      <div class="wallpaper__image"></div>
      <div class="wallpaper__clock">
        <span class="wallpaper__time"></span>
        <span class="wallpaper__date"></span>
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
