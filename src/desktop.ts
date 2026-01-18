import { Taskbar } from './taskbar';
import { AppWindow } from './appWindow';

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

    this.spawnTestWindow();

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

  private spawnTestWindow() {
    const win = new AppWindow(this.element, this.taskbar, 'Welcome to personal page');
    const body = document.createElement('div');
    body.textContent = 'Welcome to personal page';
    win.setContent(body);
  }
}
