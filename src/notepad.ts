import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { AppWindowMenu, type MenuItem } from './appWindowMenu';

export class Notepad extends AppWindow {
  private statusBar: AppWindowStatusBar;
  private textarea: HTMLTextAreaElement;

  constructor(desktop: HTMLElement, taskbar: Taskbar, title = 'Notepad') {
    super(
      desktop,
      taskbar,
      title,
      `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" fill="#2d7df6"/><path d="M7 7h10v1H7zm0 4h10v1H7zm0 4h6v1H7z" fill="#ffffff"/></svg>`
    );
    const container = document.createElement('div');
    container.className = 'notepad';

    const menuItems: MenuItem[] = [
      {
        label: 'File',
        children: [{ label: 'Open' }, { label: 'Save' }, { label: 'Print' }, { label: '-' }, { label: 'Exit' }]
      },
      {
        label: 'Edit',
        children: [{ label: 'Undo' }, { label: '-' }, { label: 'Cut' }, { label: 'Copy' }, { label: 'Paste' }, { label: 'Delete' }]
      }
    ];
    const menu = new AppWindowMenu(menuItems);

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'notepad__input';
    this.textarea.spellcheck = false;

    this.statusBar = new AppWindowStatusBar('ln 1, col 1', '0 characters');

    this.textarea.addEventListener('input', () => this.updateCaret());
    this.textarea.addEventListener('click', () => this.updateCaret());
    this.textarea.addEventListener('keyup', () => this.updateCaret());
    this.textarea.addEventListener('mouseup', () => this.updateCaret());

    container.appendChild(menu.element);
    container.appendChild(this.textarea);
    container.appendChild(this.statusBar.element);

    this.setContent(container);
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
}
