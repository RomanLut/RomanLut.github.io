import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowMenu, type MenuItem } from './appWindowMenu';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { Browser } from './browser';
import { SoundPlayer } from './soundPlayer';
import { applyInline, closeMenus, escapeHtml, inlineImages, filesystemUrl, isDownloadUrl, markdownToHtml, normalizeFsPath, responsiveWidth, responsiveHeight, navigateToUrl, setFileParam } from './util';

const WORDPAD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <rect x="4" y="3" width="16" height="18" rx="2" fill="#ffffff" stroke="#d0d6e0" stroke-width="1"/>
  <rect x="7" y="6" width="6.8" height="2" rx="1" fill="#2d7df6"/>
  <path d="M7 10h10v1H7zm0 3h10v1H7zm0 3h7v1H7z" fill="#2d7df6"/>
  <circle cx="17.5" cy="17.5" r="4" fill="#2d7df6"/>
  <path d="M17.5 13.5v4h4a4 4 0 0 0-4-4Z" fill="#8fb7ff"/>
</svg>`;

export class WordPad extends AppWindow {
  private static readonly MAX_WIDTH = 830;
  private static readonly STORAGE_KEY = 'wordpadLimitWidth';
  private static limitArticleWidth: boolean | null = null;
  private static instances = new Set<WordPad>();

  private desktopRef: HTMLElement;
  private taskbarRef: Taskbar;
  private status: AppWindowStatusBar;
  private contentArea: HTMLElement;
  private container: HTMLElement;
  private scrollArea: HTMLElement;
  private limitLabelEl: HTMLElement | null = null;
  private limitItemEl: HTMLElement | null = null;
  private menuElement: HTMLElement | null = null;
  private markdownText = '';
  private imageOverlay: HTMLElement;
  private overlayImage: HTMLImageElement;
  private overlayCloseBtn: HTMLButtonElement;
  private overlayKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private overlayResizeHandler: (() => void) | null = null;
  private overlayResizeObserver: ResizeObserver | null = null;
  private scrollState: { overflow: string; top: number; left: number } | null = null;

  constructor(desktop: HTMLElement, taskbar: Taskbar, filePath: string, title?: string) {
    WordPad.ensureLimitPref();
    super(
      desktop,
      taskbar,
      title || WordPad.titleFromPath(filePath),
      WORDPAD_ICON
    );
    this.desktopRef = desktop;
    this.taskbarRef = taskbar;

    const container = document.createElement('div');
    container.className = 'wordpad';
    this.container = container;

    const menuItems: MenuItem[] = [
      {
        label: 'File',
        children: [
          { label: 'Open', shortcut: 'Ctrl+O' },
          { label: 'Save', shortcut: 'Ctrl+S' },
          { label: 'Print', shortcut: 'Ctrl+P' },
          { label: '-' },
          { label: 'Exit'}
        ]
      },
      {
        label: 'View',
        children: [{ label: 'Limit Article Width' }]
      }
    ];
    const menu = new AppWindowMenu(menuItems);
    this.menuElement = menu.element;
    const handleSelect = (label: string) => {
      const normalized = label.trim().toLowerCase();
      if (normalized === 'exit') {
        this.close();
        return;
      }
      if (normalized === 'open') {
        void this.openFile();
        return;
      }
      if (normalized === 'save') {
        void this.saveFile();
        return;
      }
      if (normalized === 'print') {
        this.printContent();
        return;
      }
      if (normalized === 'limit article width') {
        WordPad.setLimitWidth(!(WordPad.limitArticleWidth ?? true));
      }
    };
    menu.onSelect(handleSelect);
    menu.element.addEventListener('menu-select', (e: Event) => {
      const detail = (e as CustomEvent<{ label: string }>).detail;
      if (detail?.label) {
        handleSelect(detail.label);
      }
    });
    menu.element.classList.add('wordpad__menu');
    this.limitLabelEl = menu.element.querySelector(
      '.app-window__menu-item[data-label="Limit Article Width"] .app-window__menu-item-label'
    ) as HTMLElement | null;
    this.limitItemEl = menu.element.querySelector(
      '.app-window__menu-item[data-label="Limit Article Width"]'
    ) as HTMLElement | null;
    if (this.limitItemEl) {
      this.limitItemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        WordPad.setLimitWidth(!(WordPad.limitArticleWidth ?? true));
      });
    }
    const openItem = menu.element.querySelector('.app-window__menu-item[data-label="Open"]') as HTMLElement | null;
    if (openItem) {
      openItem.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.openFile();
      });
    }
    const saveItem = menu.element.querySelector('.app-window__menu-item[data-label="Save"]') as HTMLElement | null;
    if (saveItem) {
      saveItem.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.saveFile();
      });
    }
    const printItem = menu.element.querySelector('.app-window__menu-item[data-label="Print"]') as HTMLElement | null;
    if (printItem) {
      printItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.printContent();
      });
    }

    this.scrollArea = document.createElement('div');
    this.scrollArea.className = 'wordpad__scroll';

    this.contentArea = document.createElement('div');
    this.contentArea.className = 'wordpad__content';
    this.setupImageOverlay();

    this.status = new AppWindowStatusBar('Line 1 / 1', '');
    this.status.element.classList.add('wordpad__status');

    container.appendChild(menu.element);
    this.scrollArea.appendChild(this.contentArea);
    container.appendChild(this.scrollArea);
    container.appendChild(this.status.element);

    this.setContent(container);
    this.registerCloseHandler(() => setFileParam(null));
    this.registerCloseHandler(() => this.removeImageOverlay());
    this.loadFile(filePath);
    this.contentArea.addEventListener('scroll', () => this.updateStatus());
    this.contentArea.addEventListener('click', (e) => this.handleContentClick(e as MouseEvent));

    // Target ~830px readable content area (padding + borders + scrollbar allowance).
    this.element.style.width = `${responsiveWidth(WordPad.MAX_WIDTH + 68)}px`;
    const taskbarHeight = taskbar.element.getBoundingClientRect().height || 0;
    const baseHeight = Math.floor(window.innerHeight * 0.7);
    this.element.style.height = `${responsiveHeight(baseHeight, taskbarHeight)}px`;

    WordPad.instances.add(this);
    this.applyLimitWidth(WordPad.limitArticleWidth ?? true);
    this.syncLimitLabel();
  }

  private static titleFromPath(path: string) {
    const clean = path.split('/').pop() || path;
    return clean;
  }

  private static ensureLimitPref() {
    if (WordPad.limitArticleWidth !== null) return;
    try {
      const stored = localStorage.getItem(WordPad.STORAGE_KEY);
      if (stored === '0') {
        WordPad.limitArticleWidth = false;
        return;
      }
      if (stored === '1') {
        WordPad.limitArticleWidth = true;
        return;
      }
    } catch {
      /* ignore */
    }
    WordPad.limitArticleWidth = true;
  }

  private static setLimitWidth(flag: boolean) {
    WordPad.limitArticleWidth = flag;
    try {
      localStorage.setItem(WordPad.STORAGE_KEY, flag ? '1' : '0');
    } catch {
      /* ignore */
    }
    WordPad.instances.forEach((inst) => {
      inst.applyLimitWidth(flag);
      inst.syncLimitLabel();
    });
  }

  private applyLimitWidth(flag: boolean) {
    if (flag) {
      this.container.classList.add('wordpad--limited');
    } else {
      this.container.classList.remove('wordpad--limited');
    }
  }

  private syncLimitLabel() {
    if (!this.limitLabelEl) return;
    this.limitLabelEl.textContent = `${WordPad.limitArticleWidth ? '☑' : '☐'} Limit Article Width`;
  }

  private async loadFile(path: string) {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const contentType = res.headers.get('content-type') || '';
      this.markdownText = await res.text();
      const isHtmlError =
        contentType.includes('text/html') ||
        (/^\s*<!doctype html/i.test(this.markdownText) && this.markdownText.includes('<body'));
      if (isHtmlError) {
        throw new Error('unexpected HTML response');
      }
      const basePath = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      const html = markdownToHtml(this.markdownText, basePath);
      this.contentArea.innerHTML = html;
      this.enhanceEmbeds();
      this.appendImageOverlay();
      this.updateStatus();
    } catch (err) {
      this.markdownText = '';
      this.contentArea.innerHTML = '';
      this.appendImageOverlay();
      this.updateStatus();
      this.status.setText('Empty document');
      console.warn('WordPad failed to load file', path, err);
      }
  }

  private setupImageOverlay() {
    this.imageOverlay = document.createElement('div');
    this.imageOverlay.className = 'wordpad__image-overlay';
    this.imageOverlay.tabIndex = -1;
    const frame = document.createElement('div');
    frame.className = 'wordpad__image-overlay__frame';
    this.overlayImage = document.createElement('img');
    this.overlayImage.className = 'wordpad__image-overlay__img';
    this.overlayImage.addEventListener('load', () => this.updateOverlayImageSize());
    frame.appendChild(this.overlayImage);
    this.overlayCloseBtn = document.createElement('button');
    this.overlayCloseBtn.type = 'button';
    this.overlayCloseBtn.className = 'wordpad__image-overlay__close';
    this.overlayCloseBtn.setAttribute('aria-label', 'Close preview');
    this.overlayCloseBtn.textContent = '×';
    this.imageOverlay.appendChild(frame);
    this.imageOverlay.appendChild(this.overlayCloseBtn);
    this.imageOverlay.addEventListener('click', (evt) => {
      if (evt.target === this.imageOverlay) {
        this.hideImageOverlay();
      }
    });
    this.overlayCloseBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      this.hideImageOverlay();
    });
    if (this.scrollArea && !this.scrollArea.contains(this.imageOverlay)) {
      this.scrollArea.appendChild(this.imageOverlay);
    }
  }

  private appendImageOverlay() {
    if (!this.imageOverlay || !this.scrollArea) return;
    if (!this.scrollArea.contains(this.imageOverlay)) {
      this.scrollArea.appendChild(this.imageOverlay);
    }
  }

  private removeImageOverlay() {
    this.hideImageOverlay();
    if (this.imageOverlay && this.imageOverlay.parentElement) {
      this.imageOverlay.parentElement.removeChild(this.imageOverlay);
    }
  }

  private handleContentClick(event: MouseEvent) {
    if (this.imageOverlay.contains(event.target as Node)) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const imageEl = target?.closest('.wp-img img') as HTMLImageElement | null;
    if (imageEl) {
      event.preventDefault();
      event.stopPropagation();
      this.showImageOverlay(imageEl.src, imageEl.getAttribute('alt') || imageEl.title || '');
      return;
    }
    const link = target?.closest('a') as HTMLAnchorElement | null;
    if (!link) return;
    const hrefAttr = link.getAttribute('href') || '';
    if (hrefAttr.startsWith('#')) return;
    event.preventDefault();
    event.stopPropagation();
    const url = hrefAttr || link.href;
    const localMarkdown = this.getLocalMarkdownPath(url);
    if (localMarkdown) {
      const normalizedPath = normalizeFsPath(localMarkdown);
      const targetUrl = filesystemUrl(normalizedPath);
      setFileParam(normalizedPath);
      new WordPad(this.desktopRef, this.taskbarRef, targetUrl);
      return;
    }
    if (hrefAttr.toLowerCase().endsWith('.ogg')) {
      const filename = hrefAttr.split('/').pop() || 'Audio';
      new SoundPlayer(this.desktopRef, this.taskbarRef, [{ title: filename, url: hrefAttr }]);
    } else if (isDownloadUrl(url)) {
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      navigateToUrl(this.desktopRef, this.taskbarRef, url);
    }
  }

  private getLocalMarkdownPath(url: string): string | null {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin !== window.location.origin) return null;
      const pathname = parsed.pathname || '';
      const lowerPath = pathname.toLowerCase();
      const prefix = '/filesystem/';
      if (!lowerPath.startsWith(prefix)) return null;
      if (!lowerPath.endsWith('.md')) return null;
      return pathname.slice(prefix.length);
    } catch {
      return null;
    }
  }

  private showImageOverlay(src: string, alt?: string) {
    if (!src) return;
    this.overlayImage.src = src;
    this.overlayImage.alt = alt || '';
    this.appendImageOverlay();
    this.freezeScroll();
    this.imageOverlay.classList.add('is-visible');
    this.setupResizeHandler();
    this.ensureResizeObserver();
    this.overlayKeyHandler = (event) => {
      if (event.key === 'Escape') {
        this.hideImageOverlay();
      }
    };
    document.addEventListener('keydown', this.overlayKeyHandler);
  }

  private hideImageOverlay() {
    if (!this.imageOverlay || !this.imageOverlay.classList.contains('is-visible')) return;
    this.imageOverlay.classList.remove('is-visible');
    this.overlayImage.src = '';
    this.overlayImage.style.width = '';
    this.overlayImage.style.height = '';
    if (this.overlayKeyHandler) {
      document.removeEventListener('keydown', this.overlayKeyHandler);
      this.overlayKeyHandler = null;
    }
    this.teardownResizeHandler();
    this.teardownResizeObserver();
    this.restoreScroll();
  }

  private freezeScroll() {
    if (!this.scrollArea) return;
    if (this.scrollState) return;
    this.scrollState = {
      overflow: this.scrollArea.style.overflow,
      top: this.scrollArea.scrollTop,
      left: this.scrollArea.scrollLeft
    };
    this.scrollArea.style.overflow = 'hidden';
    this.scrollArea.scrollTop = 0;
    this.scrollArea.scrollLeft = 0;
    this.scrollArea.classList.add('wordpad__scroll--frozen');
  }

  private restoreScroll() {
    if (!this.scrollArea || !this.scrollState) return;
    this.scrollArea.style.overflow = this.scrollState.overflow;
    this.scrollArea.scrollTop = this.scrollState.top;
    this.scrollArea.scrollLeft = this.scrollState.left;
    this.scrollArea.classList.remove('wordpad__scroll--frozen');
    this.scrollState = null;
  }

  private setupResizeHandler() {
    if (this.overlayResizeHandler) return;
    this.overlayResizeHandler = () => this.updateOverlayImageSize();
    window.addEventListener('resize', this.overlayResizeHandler);
    this.updateOverlayImageSize();
  }

  private teardownResizeHandler() {
    if (!this.overlayResizeHandler) return;
    window.removeEventListener('resize', this.overlayResizeHandler);
    this.overlayResizeHandler = null;
  }

  private ensureResizeObserver() {
    if (this.overlayResizeObserver) return;
    if (typeof ResizeObserver === 'function') {
      this.overlayResizeObserver = new ResizeObserver(() => this.updateOverlayImageSize());
      if (this.scrollArea) {
        this.overlayResizeObserver.observe(this.scrollArea);
      }
    }
  }

  private teardownResizeObserver() {
    if (!this.overlayResizeObserver) return;
    this.overlayResizeObserver.disconnect();
    this.overlayResizeObserver = null;
  }

  private updateOverlayImageSize() {
    if (!this.scrollArea || !this.overlayImage.naturalWidth || !this.overlayImage.naturalHeight) return;
    const rect = this.scrollArea.getBoundingClientRect();
    const padFactor = 0.01;
    const availWidth = Math.max(1, rect.width * (1 - padFactor * 2));
    const availHeight = Math.max(1, rect.height * (1 - padFactor * 2));
    const maxScaledWidth = this.overlayImage.naturalWidth * 2;
    const maxScaledHeight = this.overlayImage.naturalHeight * 2;
    const widthLimit = Math.min(maxScaledWidth, availWidth);
    const heightLimit = Math.min(maxScaledHeight, availHeight);
    const widthScale = widthLimit / this.overlayImage.naturalWidth;
    const heightScale = heightLimit / this.overlayImage.naturalHeight;
    const scale = Math.min(widthScale, heightScale, 2);
    if (!Number.isFinite(scale) || scale <= 0) return;
    this.overlayImage.style.width = `${this.overlayImage.naturalWidth * scale}px`;
    this.overlayImage.style.height = `${this.overlayImage.naturalHeight * scale}px`;
  }

  private updateStatus() {
    if (!this.markdownText) {
      this.status.setText('Line 1 / 1');
      return;
    }
    const totalLines = Math.max(1, this.markdownText.split(/\r?\n/).length);
    const scrollable = this.contentArea.scrollHeight - this.contentArea.clientHeight;
    const ratio = scrollable > 0 ? this.contentArea.scrollTop / scrollable : 0;
    const currentLine = Math.max(1, Math.floor(ratio * (totalLines - 1)) + 1);
    this.status.setText(`Line ${currentLine} / ${totalLines}`);
  }

  protected close() {
    WordPad.instances.delete(this);
    super.close();
  }

  private async openFile() {
    closeMenus(this.menuElement);
    const picker = (window as any).showOpenFilePicker;
    const processFile = async (file: File) => {
      const text = await file.text();
      this.markdownText = text;
      const escaped = escapeHtml(text).replace(/\r?\n/g, '<br/>');
      this.contentArea.innerHTML = `<div class="wordpad__plain">${escaped}</div>`;
      this.appendImageOverlay();
      this.updateStatus();
      this.updateWindowTitle(`${file.name} - WordPad`);
    };

    if (typeof picker === 'function') {
      try {
        const handles = await picker({
          multiple: false,
          types: [
            {
              description: 'Text files',
              accept: { 'text/plain': ['.txt'] }
            }
          ]
        });
        if (handles && handles[0]) {
          const file = await handles[0].getFile();
          await processFile(file);
          return;
        }
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || err.name === 'SecurityError')) {
          return;
        }
      }
    }

    await new Promise<void>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,text/plain';
      input.style.display = 'none';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          await processFile(file);
        }
        input.remove();
        resolve();
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  private enhanceEmbeds() {
    const anchors = Array.from(this.contentArea.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    anchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const absolute = a.href || href;
      if (this.isSlideShareLink(absolute)) {
        const embedSrc = this.toSlideShareEmbed(absolute);
        const container = document.createElement('div');
        container.className = 'wordpad__embed';
        const iframe = document.createElement('iframe');
        iframe.src = embedSrc;
        iframe.allowFullscreen = true;
        iframe.setAttribute('frameborder', '0');
        iframe.style.width = '100%';
        iframe.style.height = '420px';
        iframe.style.border = 'none';
        container.appendChild(iframe);
        // Keep the original link below for reference
        const linkHolder = document.createElement('div');
        linkHolder.className = 'wordpad__embed-link';
        const clone = a.cloneNode(true) as HTMLElement;
        linkHolder.appendChild(clone);
        const wrapper = document.createElement('div');
        wrapper.appendChild(container);
        wrapper.appendChild(linkHolder);
        a.replaceWith(wrapper);
      }
    });
  }

  private isArchiveUrl(url: string): boolean {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.split('.').pop()?.toLowerCase();
      return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '');
    } catch {
      return false;
    }
  }

  private isSlideShareLink(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'www.slideshare.net' || host === 'slideshare.net';
    } catch {
      return false;
    }
  }

  private toSlideShareEmbed(url: string): string {
    try {
      const u = new URL(url);
      const path = u.pathname;
      const directEmbed = path.match(/\/slideshow\/embed_code\/(\d+)/i);
      if (directEmbed?.[1]) {
        return `https://www.slideshare.net/slideshow/embed_code/${directEmbed[1]}`;
      }
      const idMatch = path.match(/(\d+)(?:\/)?$/);
      if (idMatch?.[1]) {
        return `https://www.slideshare.net/slideshow/embed_code/${idMatch[1]}`;
      }
    } catch {
      /* ignore */
    }
    return url;
  }

  private updateWindowTitle(newTitle: string) {
    const titleEl = this.element.querySelector('.app-window__title');
    if (titleEl) titleEl.textContent = newTitle;
    this.element.setAttribute('aria-label', newTitle);
    const winId = this.element.dataset.winId;
    if (winId) {
      const btn = document.querySelector(`.taskbar__winbtn[data-win-id="${winId}"] .taskbar__winbtn-title`);
      if (btn) (btn as HTMLElement).textContent = newTitle;
    }
  }

  private async saveFile() {
    closeMenus(this.menuElement);
    const html = await this.buildSelfContainedHtml();
    const filename =
      `${(this.element.getAttribute('aria-label') || 'document').trim().replace(/\s+/g, '_') || 'document'}.html`;
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker === 'function') {
      try {
        const handle = await picker({
          suggestedName: filename,
          types: [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(html);
        await writable.close();
        return;
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || err.name === 'SecurityError')) {
          return;
        }
      }
    }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async buildSelfContainedHtml() {
    const clone = this.contentArea.cloneNode(true) as HTMLElement;
    await inlineImages(clone);
    const body = clone.innerHTML;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>${escapeHtml(this.element.getAttribute('aria-label') || 'Document')}</title>
    <style>
      body { margin: 24px auto; width: auto; max-width: ${WordPad.MAX_WIDTH}px; font-family: 'Cambria', 'Georgia', 'Times New Roman', serif; font-size: 16px; line-height: 1.6; color: #1b1b1b; }
      img { max-width: 100%; height: auto; }
      pre { overflow: visible; white-space: pre-wrap; }
      code { font-family: Consolas, 'Courier New', monospace; }
      .wordpad__plain { font-family: Consolas, 'Courier New', monospace; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
  }

  private printContent() {
    const html = this.contentArea.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const printDoc = printWindow.document;
    printDoc.open();
    printDoc.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(this.element.getAttribute('aria-label') || 'Document')}</title>
          <style>
            @page { size: A4; margin: 15mm 15mm 15mm 25mm; }
            @media print {
              body { margin: 0 auto; }
            }
            body {
              margin: 0 auto;
              padding: 0;
              width: auto;
              max-width: 180mm;
              font-family: 'Cambria', 'Georgia', 'Times New Roman', serif;
              font-size: 16px;
              line-height: 1.6;
              color: #1b1b1b;
            }
            img { max-width: 100%; height: auto; }
            pre { overflow: visible; white-space: pre-wrap; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    printDoc.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 100);
  }
}


