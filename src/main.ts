import './style.scss';
import { PC } from './pc';
import { Landing } from './landing';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root container #app not found');
}

const params = new URLSearchParams(window.location.search);
const startParam = params.get('start');
const initialState = startParam === '1' ? 'pc-blocked' : startParam === '2' ? 'pc-desktop' : 'landing';

const pc = new PC(app);

if (initialState === 'pc-blocked') {
  pc.showBlocked();
} else if (initialState === 'pc-desktop') {
  pc.showDesktop();
}

new Landing(app, initialState);
