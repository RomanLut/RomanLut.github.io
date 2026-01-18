export class AppWindowToolbar {
  readonly element: HTMLElement;
  private textEl: HTMLElement;
  private extraEl: HTMLElement;

  constructor(initialText = '', extra = '') {
    this.element = document.createElement('div');
    this.element.className = 'app-window__toolbar';
    this.element.innerHTML = `
      <div class="app-window__toolbar-left">
      <span class="app-window__toolbar-text"></span>
      <span class="app-window__toolbar-divider"></span>
      <span class="app-window__toolbar-extra"></span>
      </div>
      <div class="app-window__toolbar-right">
      <span class="app-window__toolbar-divider"></span>
      <span class="app-window__toolbar-mode">Plain text</span>
      <span class="app-window__toolbar-divider"></span>
      <span class="app-window__toolbar-eol">Windows (CRLF)</span>
      <span class="app-window__toolbar-divider"></span>
      <span class="app-window__toolbar-encoding">UTF-8</span>
      </div>
    `;
    this.textEl = this.element.querySelector('.app-window__toolbar-text') as HTMLElement;
    this.extraEl = this.element.querySelector('.app-window__toolbar-extra') as HTMLElement;
    this.setText(initialText);
    this.setExtra(extra);
  }

  setText(text: string) {
    this.textEl.textContent = text;
  }

  setExtra(text: string) {
    this.extraEl.textContent = text;
  }
}
