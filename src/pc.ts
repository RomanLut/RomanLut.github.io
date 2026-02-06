import { BlockedScreen } from './blockedScreen';
import { Desktop } from './desktop';
import { setStartParam } from './util';

export class PC {
  private blockedScreen: BlockedScreen;
  private desktop: Desktop;
  readonly element: HTMLElement;

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'pc';
    this.element.style.display = 'none';
    root.prepend(this.element);

    this.desktop = new Desktop(this.element);
    this.blockedScreen = new BlockedScreen(this.element);
    this.desktop.setOnLogout(() => this.blockedScreen.fadeFromDesktop());
  }

  getBlockedScreen() {
    return this.blockedScreen;
  }

  getDesktop() {
    return this.desktop;
  }

  showBlocked() {
    this.blockedScreen.showBlocked(1);
    setStartParam('1');
  }

  showDesktop() {
    this.element.style.display = 'block';
    this.element.style.opacity = '1';
    this.blockedScreen.hideOverlayImmediate();
    setStartParam('2');
  }
}
