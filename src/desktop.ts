import { Taskbar } from './taskbar';
import { Notepad } from './notepad';
import { DesktopIcon } from './desktopIcon';

export class Desktop {
  readonly element: HTMLElement;
  private taskbar: Taskbar;
  private intervalId: number | undefined;

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'desktop';
    this.element.setAttribute('aria-hidden', 'true');

    this.taskbar = new Taskbar();
    this.element.appendChild(this.taskbar.element);

    this.spawnIcons();
    //this.spawnNotepad();
    this.taskbar.onStart(() => this.spawnNotepad());

    root.prepend(this.element);

    this.updateClock();
    this.intervalId = window.setInterval(() => this.updateClock(), 5000);
  }

  private updateClock() {
    this.taskbar.updateClock();
  }

  destroy() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.element.remove();
  }

  private spawnNotepad() {
    const win = new Notepad(this.element, this.taskbar);
    win.element.style.top = `60px`;
    win.element.style.left = `60px`;
  }

  private spawnIcons() {
    //new DesktopIcon(this.element, 'notepad', 'Notepad', { x: 16, y: 136 });
    new DesktopIcon(this.element, 'word', 'About me', { x: 16, y: 16 });
    new DesktopIcon(this.element, 'word', 'Resume', { x: 120, y: 16 });
    new DesktopIcon(this.element, 'folder', 'Game development', { x: 16, y: 136 });
    new DesktopIcon(this.element, 'folder', 'Demoscene', { x: 136, y: 136 });
    new DesktopIcon(this.element, 'folder', 'Electronics', { x: 136+120, y: 136 });
    new DesktopIcon(this.element, 'folder', 'Hobby projects', { x: 136+120+120, y: 136 });
    new DesktopIcon(this.element, 'folder', 'Publications', { x: 136+120+120+120, y: 136 });
  }
}
