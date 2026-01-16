import { BlockedScreen } from './blockedScreen';

export class PC {
  private blockedScreen: BlockedScreen;

  constructor(root: HTMLElement) {
    this.blockedScreen = new BlockedScreen(root);
  }

  getBlockedScreen() {
    return this.blockedScreen;
  }
}
