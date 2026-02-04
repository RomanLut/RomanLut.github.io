import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { AppWindowMenu, type MenuItem } from './appWindowMenu';
import { closeMenus, escapeHtml, responsiveWidth, responsiveHeight, setFileParam } from './util';

export class Notepad extends AppWindow {
  private statusBar: AppWindowStatusBar;
  private textarea: HTMLTextAreaElement;
  private history: { value: string; selection: number }[] = [];
  private historyIndex = 0;
  private docTitle: string;
  private menuElement: HTMLElement | null = null;

  constructor(desktop: HTMLElement, taskbar: Taskbar, title = 'Notepad', fileUrl?: string) {
    super(
      desktop,
      taskbar,
      title,
      `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" fill="#2d7df6"/><path d="M7 7h10v1H7zm0 4h10v1H7zm0 4h6v1H7z" fill="#ffffff"/></svg>`
    );
    this.docTitle = title;
    this.element.style.width = `${responsiveWidth(880)}px`;
    const taskbarHeight = this.taskbar.element.getBoundingClientRect().height || 0;
    const baseHeight = Math.floor(window.innerHeight * 0.7);
    this.element.style.height = `${responsiveHeight(baseHeight, taskbarHeight)}px`;
    const container = document.createElement('div');
    container.className = 'notepad';

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
        label: 'Edit',
        children: [
          { label: 'Undo', shortcut: 'Ctrl+Z' },
          { label: '-' },
          { label: 'Cut', shortcut: 'Ctrl+X' },
          { label: 'Copy', shortcut: 'Ctrl+C' },
          { label: 'Paste', shortcut: 'Ctrl+V' },
          { label: 'Delete', shortcut: 'Del' }
        ]
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
      if (normalized === 'print') {
        closeMenus(this.menuElement);
        this.printContent();
        return;
      }
      if (normalized === 'save') {
        void this.saveFile();
        return;
      }
      if (normalized === 'undo') this.undo();
      if (normalized === 'cut') this.cut();
      if (normalized === 'copy') this.copy();
      if (normalized === 'paste') this.paste();
      if (normalized === 'delete') this.deleteSelection();
    };
    menu.onSelect(handleSelect);
    menu.element.addEventListener('menu-select', (e: Event) => {
      const detail = (e as CustomEvent<{ label: string }>).detail;
      if (detail?.label) {
        handleSelect(detail.label);
      }
    });
    const printItem = menu.element.querySelector('.app-window__menu-item[data-label="Print"]') as HTMLElement | null;
    if (printItem) {
      printItem.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenus(this.menuElement);
        this.printContent();
      });
    }
    const saveItem = menu.element.querySelector('.app-window__menu-item[data-label="Save"]') as HTMLElement | null;
    if (saveItem) {
      saveItem.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.saveFile();
      });
    }
    const openItem = menu.element.querySelector('.app-window__menu-item[data-label="Open"]') as HTMLElement | null;
    if (openItem) {
      openItem.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.openFile();
      });
    }

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'notepad__input';
    this.textarea.spellcheck = false;

    this.statusBar = new AppWindowStatusBar('ln 1, col 1', '0 characters');

    this.textarea.addEventListener('input', () => {
      this.recordHistory();
      this.updateCaret();
    });
    this.textarea.addEventListener('click', () => this.updateCaret());
    this.textarea.addEventListener('keyup', () => this.updateCaret());
    this.textarea.addEventListener('mouseup', () => this.updateCaret());
    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      }
    });

    container.appendChild(menu.element);
    container.appendChild(this.textarea);
    container.appendChild(this.statusBar.element);

    this.setContent(container);
    this.registerCloseHandler(() => {
      setFileParam(null);
    });
    this.recordHistory();
    this.updateCaret();
    if (fileUrl) {
      void this.loadFile(fileUrl);
    }
  }

  private updateCaret() {
    const pos = this.textarea.selectionStart || 0;
    const textUpToPos = this.textarea.value.slice(0, pos);
    const lines = textUpToPos.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    this.statusBar.setText(`ln ${line}, col ${col}`);
    this.statusBar.setExtra(`${this.textarea.value.length} characters`);
  }

  private recordHistory() {
    const current = { value: this.textarea.value, selection: this.textarea.selectionStart || 0 };
    const last = this.history[this.historyIndex];
    if (last && last.value === current.value && last.selection === current.selection) {
      return;
    }
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(current);
    this.historyIndex = this.history.length - 1;
    if (this.history.length > 200) {
      this.history.shift();
      this.historyIndex = this.history.length - 1;
    }
  }

  private undo() {
    if (this.historyIndex === 0) return;
    this.historyIndex -= 1;
    const entry = this.history[this.historyIndex];
    this.textarea.value = entry.value;
    this.textarea.setSelectionRange(entry.selection, entry.selection);
    this.updateCaret();
  }

  private cut() {
    this.textarea.focus();
    const success = document.execCommand('cut');
    if (!success) {
      this.copy();
      this.deleteSelection();
    } else {
      this.recordHistory();
      this.updateCaret();
    }
  }

  private copy() {
    this.textarea.focus();
    const success = document.execCommand('copy');
    if (!success && navigator.clipboard) {
      const sel = this.textarea.value.substring(this.textarea.selectionStart || 0, this.textarea.selectionEnd || 0);
      if (sel) navigator.clipboard.writeText(sel).catch(() => {});
    }
  }

  private async paste() {
    this.textarea.focus();
    const success = document.execCommand('paste');
    if (!success && navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        const start = this.textarea.selectionStart || 0;
        const end = this.textarea.selectionEnd || 0;
        const value = this.textarea.value;
        this.textarea.value = value.slice(0, start) + text + value.slice(end);
        const pos = start + text.length;
        this.textarea.setSelectionRange(pos, pos);
      } catch {
        /* ignore */
      }
    }
    this.recordHistory();
    this.updateCaret();
  }

  private deleteSelection() {
    const start = this.textarea.selectionStart || 0;
    const end = this.textarea.selectionEnd || 0;
    if (start === end) {
      const value = this.textarea.value;
      if (start >= value.length) return;
      this.textarea.value = value.slice(0, start) + value.slice(start + 1);
      this.textarea.setSelectionRange(start, start);
    } else {
      const value = this.textarea.value;
      this.textarea.value = value.slice(0, start) + value.slice(end);
      this.textarea.setSelectionRange(start, start);
    }
    this.recordHistory();
    this.updateCaret();
  }

  private printContent() {
    const html = `<pre>${escapeHtml(this.textarea.value || '')}</pre>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const printDoc = printWindow.document;
    printDoc.open();
    printDoc.write(`
      <!doctype html>
      <html>
        <head>
          <title>${this.element.getAttribute('aria-label') || 'Document'}</title>
          <style>
            @page { size: A4; margin: 15mm 15mm 15mm 25mm; }
            body {
              margin: 0 auto;
              padding: 0;
              width: auto;
              max-width: 180mm;
              font-family: Consolas, 'Courier New', monospace;
              font-size: 14px;
              line-height: 1.4;
              color: #000;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
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

  private async saveFile() {
    closeMenus(this.menuElement);
    const text = this.textarea.value ?? '';
    const safeName = (this.docTitle || 'document').trim().replace(/\s+/g, '_');
    const filename = `${safeName || 'document'}.txt`;

    const picker = (window as any).showSaveFilePicker;
    if (typeof picker === 'function') {
      try {
        const handle = await picker({
          suggestedName: filename,
          types: [
            {
              description: 'Text file',
              accept: { 'text/plain': ['.txt'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return;
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || err.name === 'SecurityError')) {
          return; // user cancelled; do nothing
        }
        // fall back to download below
      }
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async loadFile(url: string) {
    try {
      this.statusBar.setExtra('Loading...');
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      const isHtmlError =
        contentType.includes('text/html') ||
        (/^\s*<!doctype html/i.test(text) && text.includes('<body'));
      if (isHtmlError) {
        throw new Error('unexpected HTML response');
      }
      this.textarea.value = text;
      this.recordHistory();
      this.updateCaret();
      this.statusBar.setExtra(`${this.textarea.value.length} characters`);
    } catch (err) {
      this.textarea.value = '';
      this.recordHistory();
      this.updateCaret();
      this.statusBar.setExtra('File not found');
      console.warn('Notepad failed to load file', url, err);
    }
  }

  private async openFile() {
    closeMenus(this.menuElement);
    const picker = (window as any).showOpenFilePicker;
    const processFile = async (file: File) => {
      const text = await file.text();
      this.textarea.value = text;
      this.recordHistory();
      this.updateCaret();
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
          this.updateWindowTitle(`${file.name} - Notepad`);
          return;
        }
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || err.name === 'SecurityError')) {
          return; // user cancelled
        }
        // fall through to fallback
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
          this.updateWindowTitle(`${file.name} - Notepad`);
        }
        input.remove();
        resolve();
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  private updateWindowTitle(newTitle: string) {
    this.docTitle = newTitle;
    const titleEl = this.element.querySelector('.app-window__title');
    if (titleEl) titleEl.textContent = newTitle;
    this.element.setAttribute('aria-label', newTitle);
    const winId = this.element.dataset.winId;
    if (winId) {
      const btn = document.querySelector(`.taskbar__winbtn[data-win-id="${winId}"] .taskbar__winbtn-title`);
      if (btn) (btn as HTMLElement).textContent = newTitle;
    }
  }
}
