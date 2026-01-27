import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { responsiveWidth, responsiveHeight, isDownloadUrl } from './util';

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  // If it contains no dot and no scheme, treat as search (handled later).
  if (!trimmed.startsWith('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    // Absolute path on current origin (e.g., /filesystem/...)
    return `${window.location.origin}${trimmed}`;
  }
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
    try {
      return new URL(trimmed, window.location.href).toString();
    } catch {
      return trimmed;
    }
  }
  // Fallback: assume https URL if no scheme provided.
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
  private iframe: HTMLIFrameElement;
  private currentUrl: string;
  private blockedOverlay: HTMLElement;
  private blockedLink: HTMLButtonElement;
  private statusBar: AppWindowStatusBar;
  private resizeObserver: ResizeObserver | null = null;
  private probeAbort: AbortController | null = null;
  private probeState: 'idle' | 'pending' | 'ok' | 'error' = 'idle';
  private loadSettled = false;
  private isFrameBlankOrBlocked(): boolean {
    try {
      const href = this.iframe.contentWindow?.location?.href || '';
      const doc = this.iframe.contentDocument;
      // If we can inspect and it's truly blank, mark blocked.
      if (!doc) return false; // cross-origin but loaded; assume ok
      if (!href || href === 'about:blank') return true;
      const body = doc.body;
      if (!body) return true;
      if (!body.childElementCount && !body.innerText?.trim()) return true;
    } catch {
      // Cross-origin and inaccessible; assume it loaded.
      return false;
    }
    return false;
  }

  private isIframeErrorPage(): boolean {
    try {
      const doc = this.iframe.contentDocument;
      const href = this.iframe.contentWindow?.location?.href || '';
      const bodyText = doc?.body?.innerText || '';

      // Browser error schemes (Chrome/Edge)
      if (href.startsWith('chrome-error://') || href.startsWith('edge-error://')) return true;

      // Some browsers land on about:blank with an error body
      if (href === 'about:blank') {
        if (/ERR_|This site can't be reached|DNS_PROBE_|connection|refused|not found/i.test(bodyText)) {
          return true;
        }
      }
    } catch {
      // Cross-origin; assume ok.
    }
    return false;
  }

  private isSlideShare(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'www.slideshare.net' || host === 'slideshare.net';
    } catch {
      return false;
    }
  }

  private async resolveSlideShareEmbed(pageUrl: string): Promise<string> {
    if (/slideshare\.net\/slideshow\/embed_code\//i.test(pageUrl)) {
      return pageUrl;
    }
    // Heuristic: if the path ends with a numeric slide ID, try embed_code/{id}
    try {
      const path = new URL(pageUrl).pathname;
      const m = path.match(/(\d+)(?:\/)?$/);
      if (m?.[1]) {
        return `https://www.slideshare.net/slideshow/embed_code/${m[1]}`;
      }
    } catch {
      /* ignore */
    }
    return pageUrl;
  }

  private bumpResize = () => {
    const win = this.iframe?.contentWindow;
    if (win) {
      try {
        win.dispatchEvent(new Event('resize'));
      } catch {
        /* ignore cross-origin */
      }
    }
  };

  constructor(desktop: HTMLElement, taskbar: Taskbar, startUrl = 'https://github.com') {
    super(desktop, taskbar, 'Browser', BROWSER_ICON, true);
    this.element.style.width = `${responsiveWidth(1144)}px`;
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

    const externalBtn = document.createElement('button');
    externalBtn.className = 'browser__btn';
    externalBtn.textContent = '↗';
    externalBtn.title = 'Open in new window';
    externalBtn.addEventListener('click', () => {
      const url = this.currentUrl || this.addressInput.value;
      if (!url) return;
      window.open(url, '_blank', 'noopener');
    });

    this.addressInput = document.createElement('input');
    this.addressInput.type = 'text';
    this.addressInput.className = 'browser__address';
    this.addressInput.addEventListener('focus', (e) => {
      const target = e.target as HTMLInputElement;
      target.select();
    });
    this.addressInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigate(this.addressInput.value);
      }
    });

    toolbar.append(backBtn, fwdBtn, reloadBtn, this.addressInput, externalBtn);

    const content = document.createElement('div');
    content.className = 'browser__content';
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'browser__frame';
    // Allow same-origin so we can dispatch resize into the iframe for canvas demos.
    this.iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads'
    );
    this.iframe.addEventListener('load', () => {
      this.loadSettled = true;
      const blankBlocked = this.isFrameBlankOrBlocked();
      const pageError = this.probeState === 'error' || this.isIframeErrorPage() || blankBlocked;
      if (pageError) {
        this.setErrorState();
      } else if (this.probeState === 'ok') {
        this.setSuccessState();
      }
      this.bumpResize();
    });
    this.iframe.addEventListener('error', () => {
      this.setErrorState();
    });
    // Propagate size changes to the iframe content (helps canvas/WebGL demos resize)
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.bumpResize();
      });
      this.resizeObserver.observe(this.iframe);
    } else {
      // Fallback: poll size changes
      let lastW = this.iframe.clientWidth;
      let lastH = this.iframe.clientHeight;
      const tick = () => {
        const w = this.iframe.clientWidth;
        const h = this.iframe.clientHeight;
        if (w !== lastW || h !== lastH) {
          lastW = w;
          lastH = h;
          this.bumpResize();
        }
        this.resizeObserver = requestAnimationFrame(tick) as unknown as ResizeObserver;
      };
      this.resizeObserver = requestAnimationFrame(tick) as unknown as ResizeObserver;
    }
    window.addEventListener('resize', this.bumpResize);
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

  private async navigate(url: string) {
    let normalized = normalizeUrl(url);
    let finalUrl = normalized;
    let iframeUrl = finalUrl;
    try {
      // If input has no scheme and no dot, treat as search
      const looksLikeSearch = !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized) && !normalized.includes('.');
      if (looksLikeSearch) {
        finalUrl = `https://www.google.com/?igu=1&q=${encodeURIComponent(url)}`;
        iframeUrl = finalUrl;
      } else {
        const u = new URL(normalized, window.location.href);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          if (u.hostname.includes('google.com') && !u.searchParams.has('igu')) {
            u.searchParams.set('igu', '1');
          }
          finalUrl = u.toString();
          // If this is a YouTube watch URL, load an embeddable URL in the iframe but keep the address bar as-is.
          if (u.hostname.includes('youtube.com') && u.pathname === '/watch' && u.searchParams.has('v')) {
            const videoId = u.searchParams.get('v');
            // Preserve start time if present as t or start.
            const t = u.searchParams.get('t') || u.searchParams.get('start');
            const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
            if (t) embed.searchParams.set('start', t.replace(/s$/i, ''));
            iframeUrl = embed.toString();
          } else {
            iframeUrl = finalUrl;
          }
        } else {
          finalUrl = `https://www.google.com/?igu=1&q=${encodeURIComponent(url)}`;
          iframeUrl = finalUrl;
        }
      }
    } catch {
      finalUrl = `https://www.google.com/?igu=1&q=${encodeURIComponent(url)}`;
      iframeUrl = finalUrl;
    }
    // Slideshare: resolve to embeddable iframe via oEmbed but keep address bar as original URL.
    if (this.isSlideShare(finalUrl)) {
      iframeUrl = await this.resolveSlideShareEmbed(finalUrl);
    }
    if (!finalUrl) return;
    this.currentUrl = finalUrl;
    this.addressInput.value = finalUrl;
    if (isDownloadUrl(iframeUrl)) {
      this.statusBar.setText('Loaded');
      this.statusBar.setBusy(false);
      this.setBlocked(false, false);
      this.loadSettled = true;
      this.probeState = 'idle';
    } else {
      this.statusBar.setText('Loading...');
      this.statusBar.setBusy(true);
      this.setBlocked(false, false);
      this.loadSettled = false;
      this.probeState = 'pending';
      if (this.probeAbort) {
        this.probeAbort.abort();
      }
      this.probeAbort = new AbortController();
      // DNS/protocol probe without timers; failure marks error state immediately.
      fetch(iframeUrl, { mode: 'no-cors', signal: this.probeAbort.signal })
        .then(() => {
          if (this.currentUrl !== finalUrl) return;
          this.probeState = 'ok';
          if (this.loadSettled) this.setSuccessState();
        })
        .catch(() => {
          if (this.currentUrl !== finalUrl) return;
          this.probeState = 'error';
          if (this.loadSettled) this.setErrorState();
        });
    }
    this.iframe.src = iframeUrl;
    this.bumpResize();
  }

  private reload() {
    if (!this.currentUrl) return;
    this.navigate(this.currentUrl);
  }

  private setSuccessState() {
    this.statusBar.setText('Done');
    this.statusBar.setBusy(false);
    this.setBlocked(false);
    this.probeState = 'idle';
    this.probeAbort = null;
  }

  private setErrorState() {
    this.statusBar.setText('Blocked or failed to load');
    this.statusBar.setBusy(false);
    this.setBlocked(true);
    this.probeState = 'idle';
    this.probeAbort = null;
  }

  // Optionally suppress status updates so navigation can hide the overlay without
  // prematurely marking the page as loaded.
  private setBlocked(flag: boolean, updateStatus = true) {
    this.blockedOverlay.classList.toggle('is-visible', flag);
    if (!updateStatus) return;
    if (flag) {
      this.statusBar.setText('Blocked or failed to load');
    } else {
      this.statusBar.setText('Loaded');
    }
  }

  protected close(): void {
    if (this.resizeObserver) {
      if (typeof (this.resizeObserver as any).disconnect === 'function') {
        (this.resizeObserver as any).disconnect();
      } else if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.resizeObserver as unknown as number);
      }
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.bumpResize);
    super.close();
  }
}

