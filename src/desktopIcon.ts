export type IconType =
  | 'folder'
  | 'notepad'
  | 'word'
  | 'github'
  | 'wordpad'
  | 'youtube'
  | 'archive'
  | 'executable'
  | 'msdos'
  | 'html'
  | 'sound';

const ICON_SVGS: Record<IconType, string> = {
  folder: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.172a1.5 1.5 0 0 1 1.06.44l1.12 1.12H19.5A1.5 1.5 0 0 1 21 8.06V17.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" fill="#f6c344" stroke="#d9a320" stroke-width="1"/></svg>`,
  notepad: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" fill="#2d7df6"/><path d="M7 7h10v1H7zm0 4h10v1H7zm0 4h6v1H7z" fill="#ffffff"/></svg>`,
  word: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="#ffffff" stroke="#d0d6e0" stroke-width="1"/>
    <rect x="7" y="6" width="6.8" height="2" rx="1" fill="#2d7df6"/>
    <path d="M7 10h10v1H7zm0 3h10v1H7zm0 3h7v1H7z" fill="#2d7df6"/>
    <circle cx="17.5" cy="17.5" r="4" fill="#2d7df6"/>
    <path d="M17.5 13.5v4h4a4 4 0 0 0-4-4Z" fill="#8fb7ff"/>
  </svg>`,
  wordpad: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="#ffffff" stroke="#d0d6e0" stroke-width="1"/>
    <rect x="4" y="3" width="16" height="4" rx="2" fill="#2d7df6"/>
    <rect x="6" y="8" width="12" height="1.8" rx="0.9" fill="#2d7df6"/>
    <rect x="6" y="10.5" width="12" height="1.8" rx="0.9" fill="#2d7df6"/>
    <rect x="6" y="13" width="9" height="1.8" rx="0.9" fill="#2d7df6"/>
    <circle cx="18" cy="18" r="4" fill="#2d7df6" opacity="0.9"/>
    <path d="M18 14v4h4a4 4 0 0 0-4-4Z" fill="#8fb7ff"/>
  </svg>`,
  github: `<svg aria-hidden="true" focusable="false" class="octicon octicon-mark-github" viewBox="0 0 24 24" width="32" height="32" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><rect x="0" y="0" width="24" height="24" rx="4" fill="#000000"></rect><path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z" fill="#ffffff"></path></svg>`,
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <g transform="translate(2.4 2.4) scale(0.8)">
      <rect x="1" y="4" width="22" height="16" rx="4" fill="#ff0000"/>
      <polygon points="10,8 16,12 10,16" fill="#ffffff"/>
    </g>
  </svg>`,
  archive: `<img src="/icons/zip-icon.svg" width="32" height="32" alt="Archive icon" />`,
  executable: `<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\" fill=\"#4c8bf5\" stroke=\"#2f63c7\" stroke-width=\"1\"/><path d=\"M6 7h12v2H6z\" fill=\"#e8f0ff\"/><rect x=\"6.5\" y=\"11\" width=\"5\" height=\"5\" rx=\"0.8\" fill=\"#e8f0ff\" stroke=\"#2f63c7\" stroke-width=\"0.8\"/><path d=\"M14 11.5l4 2.5-4 2.5z\" fill=\"#e8f0ff\" stroke=\"#2f63c7\" stroke-width=\"0.8\"/></svg>`,
  msdos: `<img src="/icons/msdos.svg" width="32" height="32" alt="MS-DOS logo" />`,
  html: `<img src="/icons/html5-badge.svg" width="32" height="32" alt="HTML5 logo" />`,
  sound: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#4c8bf5" stroke="#2f63c7" stroke-width="1" />
    <path d="M16 8.5a3.5 3.5 0 0 1 0 7" fill="none" stroke="#4c8bf5" stroke-width="1.8" stroke-linecap="round" />
    <path d="M18.5 7a6 6 0 0 1 0 10" fill="none" stroke="#8fb7ff" stroke-width="1.8" stroke-linecap="round" />
  </svg>`
};

export function getIconSvg(type: IconType): string {
  return ICON_SVGS[type];
}

/** Windows-style shortcut arrow overlay for bottom-left corner */
export const SHORTCUT_OVERLAY_SVG = `<svg class="shortcut-overlay" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="2" y="2" width="28" height="28" rx="2" fill="white" stroke="#7a7878ff" stroke-width="1"/>
  <path d="M7.36 22.4 C 7.36 16.4, 11.36 12.4, 17.36 12.4 L 17.36 8.4 L 25.36 15.4 L 17.36 22.4 L 17.36 18.4 C 13.36 18.4, 10.36 19.4, 7.36 22.4 Z" fill="#0078d7"/>
</svg>`;

export class DesktopIcon {
  readonly element: HTMLElement;
  private desktop: HTMLElement;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };

  constructor(
    desktop: HTMLElement,
    type: IconType,
    label?: string,
    position?: { x: number; y: number },
    onDoubleClick?: () => void
  ) {
    this.desktop = desktop;
    this.element = document.createElement('div');
    this.element.className = 'desktop__icon';
    this.element.classList.add(`desktop__icon--${type}`);
    this.element.innerHTML = `
      <div class="desktop__icon-image">${ICON_SVGS[type]}</div>
      <div class="desktop__icon-label">${label || type.charAt(0).toUpperCase() + type.slice(1)}</div>
    `;
    this.element.style.left = `${position?.x ?? 16}px`;
    this.element.style.top = `${position?.y ?? 16}px`;

    this.attachDrag();
    if (onDoubleClick) {
      this.element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        onDoubleClick();
      });
    }
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
