import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowMenu, type MenuItem } from './appWindowMenu';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { applyInline, closeMenus, escapeHtml, inlineImages, markdownToHtml } from './util';

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

  private status: AppWindowStatusBar;
  private contentArea: HTMLElement;
  private container: HTMLElement;
  private scrollArea: HTMLElement;
  private limitLabelEl: HTMLElement | null = null;
  private limitItemEl: HTMLElement | null = null;
  private menuElement: HTMLElement | null = null;
  private markdownText = '';

  constructor(desktop: HTMLElement, taskbar: Taskbar, filePath: string, title?: string) {
    WordPad.ensureLimitPref();
    super(
      desktop,
      taskbar,
      title || WordPad.titleFromPath(filePath),
      WORDPAD_ICON
    );

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
          { label: 'Exit', shortcut: 'Alt+F4' }
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

    this.status = new AppWindowStatusBar('Line 1 / 1', '');
    this.status.element.classList.add('wordpad__status');

    container.appendChild(menu.element);
    this.scrollArea.appendChild(this.contentArea);
    container.appendChild(this.scrollArea);
    container.appendChild(this.status.element);

    this.setContent(container);
    this.loadFile(filePath);
    this.contentArea.addEventListener('scroll', () => this.updateStatus());

    // Target ~830px readable content area (padding + borders + scrollbar allowance).
    this.element.style.width = `${WordPad.MAX_WIDTH + 68}px`;
    this.element.style.height = '80vh';

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
      this.markdownText = await res.text();
      const basePath = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      const html = markdownToHtml(this.markdownText, basePath);
      this.contentArea.innerHTML = html;
      this.updateStatus();
    } catch (err) {
      this.contentArea.innerHTML = `<div class="wordpad__error">Failed to load file: ${escapeHtml(String(err))}</div>`;
      this.status.setText('Error');
    }
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


