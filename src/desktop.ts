import { Taskbar } from './taskbar';
import { Notepad } from './notepad';

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

    this.spawnNotepad();
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
}
