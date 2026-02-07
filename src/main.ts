import './style.scss';
import { PC } from './pc';
import { Landing } from './landing';
import { isIosDevice } from './util';

function preventIosZoom() {
  if (!isIosDevice()) return;

  let lastTouchEnd = 0;

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  const preventGesture = (event: Event) => event.preventDefault();
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });
}

preventIosZoom();

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root container #app not found');
}

const params = new URLSearchParams(window.location.search);
const startParam = params.get('start');
const folderParam = params.get('folder')?.trim() || '';
const fileParam = params.get('file')?.trim() || '';
const shouldShowDesktop = Boolean(folderParam || fileParam);
const initialState =
  startParam === '1'
    ? 'pc-blocked'
    : startParam === '2'
    ? 'pc-desktop'
    : shouldShowDesktop
    ? 'pc-desktop'
    : 'landing';

const pc = new PC(app);

if (initialState === 'pc-blocked') {
  pc.showBlocked();
} else if (initialState === 'pc-desktop') {
  pc.showDesktop();
}

new Landing(app, initialState);
