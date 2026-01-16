import './style.scss';
import { Landing } from './landing';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root container #app not found');
}

// Initialize the landing experience.
new Landing(app);
