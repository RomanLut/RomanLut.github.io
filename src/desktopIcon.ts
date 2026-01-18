type IconType = 'folder' | 'notepad' | 'word';

const ICON_SVGS: Record<IconType, string> = {
  folder: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.172a1.5 1.5 0 0 1 1.06.44l1.12 1.12H19.5A1.5 1.5 0 0 1 21 8.06V17.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" fill="#f6c344" stroke="#d9a320" stroke-width="1"/></svg>`,
  notepad: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" fill="#2d7df6"/><path d="M7 7h10v1H7zm0 4h10v1H7zm0 4h6v1H7z" fill="#ffffff"/></svg>`,
  word: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="#ffffff" stroke="#d0d6e0" stroke-width="1"/>
    <rect x="7" y="6" width="6.8" height="2" rx="1" fill="#2d7df6"/>
    <path d="M7 10h10v1H7zm0 3h10v1H7zm0 3h7v1H7z" fill="#2d7df6"/>
    <circle cx="17.5" cy="17.5" r="4" fill="#2d7df6"/>
    <path d="M17.5 13.5v4h4a4 4 0 0 0-4-4Z" fill="#8fb7ff"/>
  </svg>`
};

export class DesktopIcon {
  readonly element: HTMLElement;
  private desktop: HTMLElement;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };

  constructor(desktop: HTMLElement, type: IconType, label?: string, position?: { x: number; y: number }) {
    this.desktop = desktop;
    this.element = document.createElement('div');
    this.element.className = 'desktop__icon';
    this.element.innerHTML = `
      <div class="desktop__icon-image">${ICON_SVGS[type]}</div>
      <div class="desktop__icon-label">${label || type.charAt(0).toUpperCase() + type.slice(1)}</div>
    `;
    this.element.style.left = `${position?.x ?? 16}px`;
    this.element.style.top = `${position?.y ?? 16}px`;

    this.attachDrag();
    this.desktop.appendChild(this.element);
  }

  private attachDrag() {
    this.element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      const rect = this.element.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      document.addEventListener('mousemove', this.handleDrag);
      document.addEventListener('mouseup', this.stopDrag);
    });
  }

  private handleDrag = (e: MouseEvent) => {
    if (!this.dragging) return;
    const parentRect = this.desktop.getBoundingClientRect();
    const x = e.clientX - parentRect.left - this.dragOffset.x;
    const y = e.clientY - parentRect.top - this.dragOffset.y;
    const clampedX = Math.max(0, Math.min(parentRect.width - this.element.offsetWidth, x));
    const clampedY = Math.max(0, Math.min(parentRect.height - this.element.offsetHeight, y));
    this.element.style.left = `${clampedX}px`;
    this.element.style.top = `${clampedY}px`;
  };

  private stopDrag = () => {
    this.dragging = false;
    document.removeEventListener('mousemove', this.handleDrag);
    document.removeEventListener('mouseup', this.stopDrag);
  };
}
