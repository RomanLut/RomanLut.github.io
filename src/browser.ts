import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const BROWSER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10" fill="#2d7df6"/>
  <path d="M3.5 8.5h17M3.5 15.5h17M12 2a15 15 0 0 0 0 20M12 2a15 15 0 0 1 0 20" stroke="#ffffff" stroke-width="1.4" fill="none"/>
</svg>`;

export class Browser extends AppWindow {
  private addressInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private iframe: HTMLIFrameElement;
  private currentUrl: string;
  private blockedOverlay: HTMLElement;
  private blockedLink: HTMLButtonElement;

  constructor(desktop: HTMLElement, taskbar: Taskbar, startUrl = 'https://github.com') {
    super(desktop, taskbar, 'Browser', BROWSER_ICON);

    const container = document.createElement('div');
    container.className = 'browser';

    const toolbar = document.createElement('div');
    toolbar.className = 'browser__toolbar';

    const backBtn = document.createElement('button');
    backBtn.className = 'browser__btn browser__btn--disabled';
    backBtn.textContent = '←';
    backBtn.title = 'Back (disabled)';
    backBtn.disabled = true;

    const fwdBtn = document.createElement('button');
    fwdBtn.className = 'browser__btn browser__btn--disabled';
    fwdBtn.textContent = '→';
    fwdBtn.title = 'Forward (disabled)';
    fwdBtn.disabled = true;

    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'browser__btn';
    reloadBtn.textContent = '⟳';
    reloadBtn.title = 'Reload';
    reloadBtn.addEventListener('click', () => this.reload());

    this.addressInput = document.createElement('input');
    this.addressInput.type = 'text';
    this.addressInput.className = 'browser__address';
    this.addressInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigate(this.addressInput.value);
      }
    });

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'browser__status';
    this.statusEl.textContent = 'Ready';

    toolbar.append(backBtn, fwdBtn, reloadBtn, this.addressInput, this.statusEl);

    const content = document.createElement('div');
    content.className = 'browser__content';
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'browser__frame';
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads');
    this.iframe.addEventListener('load', () => {
      this.statusEl.textContent = 'Done';
      this.setBlocked(false);
    });
    this.iframe.addEventListener('error', () => {
      this.statusEl.textContent = 'Blocked or failed to load';
      this.setBlocked(true);
    });
    this.blockedOverlay = document.createElement('div');
    this.blockedOverlay.className = 'browser__blocked';
    const blockedText = document.createElement('div');
    blockedText.className = 'browser__blocked-text';
    blockedText.textContent = 'This site disallows embedding. Open in a new tab?';
    this.blockedLink = document.createElement('button');
    this.blockedLink.className = 'browser__blocked-btn';
    this.blockedLink.textContent = 'Open in new tab';
    this.blockedLink.addEventListener('click', () => {
      if (this.currentUrl) window.open(this.currentUrl, '_blank', 'noopener');
    });
    this.blockedOverlay.append(blockedText, this.blockedLink);
    content.appendChild(this.iframe);
    content.appendChild(this.blockedOverlay);

    container.append(toolbar, content);
    this.setContent(container);

    this.navigate(startUrl);
  }

  private navigate(url: string) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    this.currentUrl = normalized;
    this.addressInput.value = normalized;
    this.statusEl.textContent = 'Loading...';
    this.setBlocked(false);
    this.iframe.src = normalized;
  }

  private reload() {
    if (!this.currentUrl) return;
    this.navigate(this.currentUrl);
  }

  private setBlocked(flag: boolean) {
    this.blockedOverlay.classList.toggle('is-visible', flag);
  }
}
