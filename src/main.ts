import './style.scss';
import { PC } from './pc';
import { Landing } from './landing';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root container #app not found');
}

const params = new URLSearchParams(window.location.search);
const initialState = params.get('start') === '1' ? 'pc' : 'landing';

new PC(app);
new Landing(app, initialState);
