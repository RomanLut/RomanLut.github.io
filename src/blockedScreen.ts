import { setStartParam, formatTime, formatDateLong } from './util';

export class BlockedScreen {
  private timeEl: HTMLSpanElement | null = null;
  private dateEl: HTMLSpanElement | null = null;
  private intervalId: number | undefined;
  private blockedLayer: HTMLElement | null = null;
  private faded = false;
  readonly element: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = container;
    this.element.setAttribute('aria-hidden', 'true');

    const blockedLayer = document.createElement('div');
    blockedLayer.className = 'blocked-layer';
    blockedLayer.innerHTML = `
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
    this.element.appendChild(blockedLayer);

    this.blockedLayer = blockedLayer;
    this.timeEl = blockedLayer.querySelector('.wallpaper__time');
    this.dateEl = blockedLayer.querySelector('.wallpaper__date');

    this.tick();
    this.intervalId = window.setInterval(() => this.tick(), 5000);

    const loginButton = this.element.querySelector<HTMLButtonElement>('.lock-login');
    loginButton?.addEventListener('click', () => this.fadeToDesktop());
  }

  showBlocked(opacity = 1) {
    this.element.style.display = 'block';
    this.element.style.opacity = String(opacity);
    this.faded = false;
    if (this.blockedLayer) {
      this.blockedLayer.style.display = 'block';
      this.blockedLayer.style.opacity = '1';
      this.blockedLayer.style.transition = '';
    }
    if (!this.intervalId) {
      this.intervalId = window.setInterval(() => this.tick(), 5000);
    }
  }

  show(opacity = 1) {
    this.element.style.display = 'block';
    this.element.style.opacity = String(opacity);
    if (this.blockedLayer) {
      this.blockedLayer.style.display = 'block';
      this.blockedLayer.style.opacity = '1';
      this.blockedLayer.style.transition = '';
    }
  }

  hide() {
    this.element.style.display = 'none';
    this.element.style.opacity = '0';
    if (this.blockedLayer) {
      this.blockedLayer.style.display = 'block';
      this.blockedLayer.style.opacity = '1';
      this.blockedLayer.style.transition = '';
    }
  }

  private fadeToDesktop(duration = 1000) {
    if (this.faded) return;
    const layer = this.blockedLayer;
    if (!layer) return;

    layer.style.transition = `opacity ${duration}ms ease`;
    layer.style.opacity = '0';
    setStartParam('2');
    const onEnd = () => {
      this.stopTimers();
      layer.style.display = 'none';
      layer.removeEventListener('transitionend', onEnd);
      this.faded = true;
    };
    layer.addEventListener('transitionend', onEnd);
  }

  hideOverlayImmediate() {
    this.stopTimers();
    if (this.blockedLayer) {
      this.blockedLayer.style.display = 'none';
      this.blockedLayer.style.opacity = '0';
      this.blockedLayer.style.transition = '';
    }
    this.faded = true;
  }

  fadeFromDesktop(duration = 800) {
    const layer = this.blockedLayer;
    if (!layer) return;
    this.faded = false;
    this.element.style.display = 'block';
    this.element.style.opacity = '1';
    layer.style.display = 'block';
    layer.style.opacity = '0';
    layer.style.transition = `opacity ${duration}ms ease`;
    if (!this.intervalId) {
      this.intervalId = window.setInterval(() => this.tick(), 5000);
    }
    setStartParam('1');
    requestAnimationFrame(() => {
      layer.style.opacity = '1';
    });
    const onEnd = () => {
      layer.style.transition = '';
      layer.removeEventListener('transitionend', onEnd);
    };
    layer.addEventListener('transitionend', onEnd);
  }

  private tick() {
    const now = new Date();
    if (this.timeEl) this.timeEl.textContent = formatTime(now);
    if (this.dateEl) this.dateEl.textContent = formatDateLong(now);
  }

  private stopTimers() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  destroy() {
    this.stopTimers();
    this.element.remove();
  }
}
