import { getIconSvg } from './desktopIcon';

type StartMenuActions = {
  explorer: () => void;
  browser: () => void;
  notepad: () => void;
  wordpad: () => void;
  dosbox: () => void;
  sound: () => void;
  logout: () => void;
  power: () => void;
};

export class StartMenu {
  readonly element: HTMLElement;
  private panel: HTMLElement | null = null;
  private isOpen = false;
  private actions: StartMenuActions;

  constructor(container: HTMLElement, actions: StartMenuActions) {
    this.actions = actions;
    this.element = document.createElement('div');
    this.element.className = 'start-menu';
    this.element.style.display = 'none';
    this.element.innerHTML = `
      <div class="start-menu__panel" role="menu" aria-label="Start menu">
        <div class="start-menu__grid">
          ${this.renderTile('explorer', getIconSvg('folder'), 'File Explorer')}
          ${this.renderTile('browser', getIconSvg('html'), 'Browser')}
          ${this.renderTile('notepad', getIconSvg('notepad'), 'Notepad')}
          ${this.renderTile('wordpad', getIconSvg('wordpad'), 'WordPad')}
          ${this.renderTile('dosbox', getIconSvg('msdos'), 'DOSBox')}
          ${this.renderTile('sound', getIconSvg('sound'), 'Sound Player')}
        </div>
        <div class="start-menu__footer">
          <div class="start-menu__profile" aria-label="Current user">
            <span class="start-menu__profile-avatar" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
                <circle cx="24" cy="24" r="24" fill="rgba(255,255,255,0.24)" />
                <g transform="translate(0,-2)">
                  <circle cx="24" cy="18" r="8" fill="#ffffff" />
                  <path d="M12 38c0-8 6.4-14.4 14-14.4S40 30 40 38v3H12z" fill="#ffffff" opacity="0.92" />
                </g>
              </svg>
            </span>
            <span class="start-menu__profile-name">User</span>
          </div>
          <div class="start-menu__spacer" aria-hidden="true"></div>
          <div class="start-menu__footer-actions">
            <button class="start-menu__footer-btn start-menu__footer-btn--logout" data-action="logout" aria-label="Logout">
              <span class="start-menu__footer-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M14 16l4-4-4-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12h10" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
              </span>
              <span class="start-menu__sr">Logout</span>
            </button>
            <button class="start-menu__footer-btn start-menu__footer-btn--power" data-action="power" aria-label="Power">
              <span class="start-menu__footer-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 4v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  <path
                    d="M7 6.5a7 7 0 1 0 10 0"
                    stroke="currentColor"
                    stroke-width="1.8"
                    fill="none"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
              <span class="start-menu__sr">Power</span>
            </button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(this.element);
    this.panel = this.element.querySelector('.start-menu__panel');

    this.element.addEventListener('mousedown', (e) => {
      if (e.target === this.element) {
        this.hide();
      }
    });

    const buttons = this.element.querySelectorAll<HTMLButtonElement>('[data-action]');
    buttons.forEach((btn) =>
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = btn.dataset.action as keyof StartMenuActions | undefined;
        if (!action) return;
        const handler = this.actions[action];
        if (handler) {
          handler();
        }
        this.hide();
      })
    );

    document.addEventListener('keydown', this.handleKeydown);
    document.addEventListener('mousedown', this.handleOutsideClick, true);
  }

  show() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.element.style.display = 'block';
    this.element.classList.add('is-open');
  }

  hide() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.element.classList.remove('is-open');
    this.element.style.display = 'none';
  }

  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('mousedown', this.handleOutsideClick, true);
    this.element.remove();
  }

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.hide();
    }
  };

  private handleOutsideClick = (e: MouseEvent) => {
    if (!this.isOpen) return;
    const target = e.target as Node | null;
    if (target instanceof Element && target.closest('.taskbar__start')) {
      return;
    }
    if (target && this.panel && !this.panel.contains(target) && target !== this.element) {
      this.hide();
    }
  };

  private renderTile(action: keyof StartMenuActions, icon: string, label: string) {
    return `
      <button class="start-menu__tile" data-action="${action}">
        <span class="start-menu__icon" aria-hidden="true">${icon}</span>
        <span class="start-menu__label">${label}</span>
      </button>
    `;
  }
}
