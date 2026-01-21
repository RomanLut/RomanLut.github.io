import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { responsiveWidth, responsiveHeight } from './util';

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const BROWSER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24">
  <g transform="scale(0.82) translate(2.2 2.2)">
    <circle cx="12" cy="12" r="10" fill="#fbbc04"/>
    <path d="M12 2c-4.31 0-8 2.73-9.39 6.57L7 15l2.6-4.5L7 6h10l3.6 6.24C20.78 10.08 21 9.07 21 8c0-3.31-4.03-6-9-6Z" fill="#ea4335"/>
    <path d="M4.22 17.42C5.8 20.3 8.69 22 12 22c4.47 0 8.2-3.07 9.63-7.28L17 9h-5l1.8 3.12L12 15l-7.78 2.42Z" fill="#34a853"/>
    <path d="M14.4 12 12 8H7l5 9h5l3.3-5.72C18.85 9.66 15.62 8 12 8l2.4 4Z" fill="#4285f4" opacity="0.9"/>
    <circle cx="12" cy="12" r="3" fill="#fff"/>
  </g>
</svg>`;

export class Browser extends AppWindow {
  private addressInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private iframe: HTMLIFrameElement;
  private currentUrl: string;
  private blockedOverlay: HTMLElement;
  private blockedLink: HTMLButtonElement;
  private statusBar: AppWindowStatusBar;

  constructor(desktop: HTMLElement, taskbar: Taskbar, startUrl = 'https://github.com') {
    super(desktop, taskbar, 'Browser', BROWSER_ICON);
    this.element.style.width = `${responsiveWidth(880)}px`;
    const taskbarHeight = taskbar.element.getBoundingClientRect().height || 0;
    const baseHeight = Math.floor(window.innerHeight * 0.7);
    this.element.style.height = `${responsiveHeight(baseHeight, taskbarHeight)}px`;

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

    toolbar.append(backBtn, fwdBtn, reloadBtn, this.addressInput);

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

    this.statusBar = new AppWindowStatusBar('Ready', '');
    this.statusBar.element.classList.add('browser__statusbar');

    container.append(toolbar, content, this.statusBar.element);
    this.setContent(container);

    this.navigate(startUrl);
  }

  private navigate(url: string) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    this.currentUrl = normalized;
    this.addressInput.value = normalized;
    this.statusBar.setText('Loading...');
    this.setBlocked(false);
    this.iframe.src = normalized;
  }

  private reload() {
    if (!this.currentUrl) return;
    this.navigate(this.currentUrl);
  }

  private setBlocked(flag: boolean) {
    this.blockedOverlay.classList.toggle('is-visible', flag);
    if (flag) {
      this.statusBar.setText('Blocked or failed to load');
    } else {
      this.statusBar.setText('Done');
    }
  }
}
