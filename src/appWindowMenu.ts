export type MenuItem = {
  label: string;
  children?: MenuItem[];
  shortcut?: string;
};

export class AppWindowMenu {
  readonly element: HTMLElement;
  private parents: HTMLElement[] = [];
  private selectHandlers: Array<(label: string) => void> = [];

  constructor(items: MenuItem[]) {
    this.element = document.createElement('nav');
    this.element.className = 'app-window__menu';
    const list = document.createElement('ul');
    list.className = 'app-window__menu-root';
    items.forEach((item) => {
      list.appendChild(this.renderItem(item));
    });
    this.element.appendChild(list);

    document.addEventListener('click', this.closeAll);

    this.parents.forEach((li) => {
      li.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // If the click originated inside a submenu item, let it bubble to the root handler.
        if (target.closest('.app-window__menu-sub')) {
          return;
        }
        e.stopPropagation();
        this.toggle(li);
      });
      li.addEventListener('mouseenter', () => {
        if (this.parents.some((p) => p.classList.contains('is-open'))) {
          this.toggle(li, true);
        }
      });
    });

    this.element.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.app-window__menu-item');
      if (!item) return;
      if (item.classList.contains('has-children')) return;
      const label = (item.dataset.label || '').trim();
      if (!label) return;
      e.stopPropagation();
      this.emitSelect(label);
    });
  }

  onSelect(cb: (label: string) => void) {
    this.selectHandlers.push(cb);
  }

  private emitSelect(label: string) {
    this.selectHandlers.forEach((cb) => cb(label));
    this.element.dispatchEvent(new CustomEvent('menu-select', { detail: { label } }));
    this.closeAll();
  }

  private renderItem(item: MenuItem) {
    if (item.label.trim() === '-') {
      const sep = document.createElement('li');
      sep.className = 'app-window__menu-separator';
      sep.dataset.label = '-';
      return sep;
    }
    const li = document.createElement('li');
    li.className = 'app-window__menu-item';
    li.dataset.label = item.label;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'app-window__menu-item-label';
    labelSpan.textContent = item.label;
    li.appendChild(labelSpan);

    if (item.shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.className = 'app-window__menu-item-shortcut';
      shortcutSpan.textContent = item.shortcut;
      li.appendChild(shortcutSpan);
    }
    if (item.children && item.children.length) {
      const sub = document.createElement('ul');
      sub.className = 'app-window__menu-sub';
      item.children.forEach((child) => sub.appendChild(this.renderItem(child)));
      li.appendChild(sub);
      li.classList.add('has-children');
      this.parents.push(li);
    }
    return li;
  }

  private closeAll = () => {
    this.parents.forEach((p) => p.classList.remove('is-open'));
  };

  private toggle(li: HTMLElement, forceOpen = false) {
    const isOpen = li.classList.contains('is-open');
    this.closeAll();
    if (!isOpen || forceOpen) {
      li.classList.add('is-open');
    }
  }

  private injectSeparators(root: HTMLElement) {
    const fileMenu = root.querySelector('.app-window__menu-item:first-child > ul');
    if (!fileMenu) return;
    const exitItem = Array.from(fileMenu.children).find((el) =>
      (el as HTMLElement).textContent?.trim().toLowerCase() === 'exit'
    );
    if (!exitItem) return;
    const divider = document.createElement('li');
    divider.className = 'app-window__menu-separator';
    fileMenu.insertBefore(divider, exitItem);
  }
}
