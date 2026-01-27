export class AppWindowStatusBar {
  readonly element: HTMLElement;
  private textEl: HTMLElement;
  private extraEl: HTMLElement;
  private spinnerEl: HTMLElement;

  constructor(initialText = '', extra = '') {
    this.element = document.createElement('div');
    this.element.className = 'app-window__statusbar';
    this.element.innerHTML = `
      <div class="app-window__statusbar-left">
        <span class="app-window__statusbar-text"></span>
        <span class="app-window__statusbar-spinner" aria-hidden="true"></span>
        <span class="app-window__statusbar-divider"></span>
        <span class="app-window__statusbar-extra"></span>
      </div>
      <div class="app-window__statusbar-right">
        <span class="app-window__statusbar-divider"></span>
        <span class="app-window__statusbar-mode">Plain text</span>
        <span class="app-window__statusbar-divider"></span>
        <span class="app-window__statusbar-eol">Windows (CRLF)</span>
        <span class="app-window__statusbar-divider"></span>
        <span class="app-window__statusbar-encoding">UTF-8</span>
      </div>
    `;
    this.spinnerEl = this.element.querySelector('.app-window__statusbar-spinner') as HTMLElement;
    this.textEl = this.element.querySelector('.app-window__statusbar-text') as HTMLElement;
    this.extraEl = this.element.querySelector('.app-window__statusbar-extra') as HTMLElement;
    this.setText(initialText);
    this.setExtra(extra);
  }

  setText(text: string) {
    this.textEl.textContent = text;
  }

  setExtra(text: string) {
    this.extraEl.textContent = text;
  }

  setBusy(flag: boolean) {
    this.spinnerEl.classList.toggle('is-visible', flag);
  }
}
