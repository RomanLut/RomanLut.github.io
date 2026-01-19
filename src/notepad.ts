import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { AppWindowMenu, type MenuItem } from './appWindowMenu';

export class Notepad extends AppWindow {
  private statusBar: AppWindowStatusBar;
  private textarea: HTMLTextAreaElement;
  private history: { value: string; selection: number }[] = [];
  private historyIndex = 0;

  constructor(desktop: HTMLElement, taskbar: Taskbar, title = 'Notepad') {
    super(
      desktop,
      taskbar,
      title,
      `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" fill="#2d7df6"/><path d="M7 7h10v1H7zm0 4h10v1H7zm0 4h6v1H7z" fill="#ffffff"/></svg>`
    );
    this.element.style.width = '880px';
    this.element.style.height = '80vh';
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
          { label: 'Exit', shortcut: 'Alt+F4' }
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
    const handleSelect = (label: string) => {
      if (label.trim().toLowerCase() === 'exit') {
        this.close();
        return;
      }
      const normalized = label.trim().toLowerCase();
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
    this.recordHistory();
    this.updateCaret();
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
}
