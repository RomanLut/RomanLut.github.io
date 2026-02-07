import './style.scss';
import { PC } from './pc';
import { Landing } from './landing';
import { isMobileTouchDevice } from './util';

const TOUCH_POINT_DEBUG = false;
const TOUCH_AREA_DEBUG = false;

function preventTouchZoom() {
  if (!isMobileTouchDevice()) return;

  let lastTouchEnd = 0;
  const touchOptions: AddEventListenerOptions = { passive: false, capture: true };
  let viewportRefreshRaf: number | null = null;
  let viewportRefreshTimers: number[] = [];

  // Keep one stable target scale for the whole session to avoid fullscreen flicker.
  const baseShortEdge = Math.min(window.screen.width, window.screen.height);
  const isSmallPhone = baseShortEdge <= 480;
  const mobileViewportScale = isSmallPhone ? 0.5 : 1;
  const rootEl = document.documentElement;

  if (isSmallPhone) {
    rootEl.classList.add('is-small-phone');
    rootEl.style.setProperty('--mobile-ui-scale', String(mobileViewportScale));
  }

  const forceViewportNoZoom = () => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) return;
    const isFullscreen = Boolean(document.fullscreenElement);
    const landingActive = rootEl.classList.contains('landing-active');
    const scale = isSmallPhone && isFullscreen && !landingActive ? 1 : mobileViewportScale;
    const content = `width=device-width, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no, viewport-fit=cover`;
    if (viewportMeta.getAttribute('content') !== content) {
      viewportMeta.setAttribute('content', content);
    }
  };

  const scheduleViewportRefresh = () => {
    if (viewportRefreshRaf !== null) {
      cancelAnimationFrame(viewportRefreshRaf);
      viewportRefreshRaf = null;
    }
    viewportRefreshTimers.forEach((id) => window.clearTimeout(id));
    viewportRefreshTimers = [];

    forceViewportNoZoom();
    viewportRefreshRaf = requestAnimationFrame(() => {
      forceViewportNoZoom();
      viewportRefreshRaf = null;
    });
    [120, 300].forEach((ms) => {
      const id = window.setTimeout(() => {
        forceViewportNoZoom();
      }, ms);
      viewportRefreshTimers.push(id);
    });
  };

  scheduleViewportRefresh();
  window.addEventListener('orientationchange', scheduleViewportRefresh);
  window.addEventListener('resize', () => {
    forceViewportNoZoom();
  });
  document.addEventListener('fullscreenchange', () => {
    if (isSmallPhone) {
      rootEl.classList.toggle('is-mobile-fullscreen', Boolean(document.fullscreenElement));
    }
    scheduleViewportRefresh();
  });
  window.addEventListener('landing-active-changed', scheduleViewportRefresh);

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    touchOptions
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      const legacyTouchEvent = event as TouchEvent & { scale?: number };
      if (event.touches.length > 1 || (typeof legacyTouchEvent.scale === 'number' && legacyTouchEvent.scale !== 1)) {
        event.preventDefault();
      }
    },
    touchOptions
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
    touchOptions
  );

  document.addEventListener('dblclick', (event) => event.preventDefault(), touchOptions);

  const preventGesture = (event: Event) => event.preventDefault();
  document.addEventListener('gesturestart', preventGesture, touchOptions);
  document.addEventListener('gesturechange', preventGesture, touchOptions);
  document.addEventListener('gestureend', preventGesture, touchOptions);
}

preventTouchZoom();

function enableTouchPointDebug() {
  if (!TOUCH_POINT_DEBUG || !isMobileTouchDevice()) return;

  const drawCross = (x: number, y: number, color: string) => {
    const cross = document.createElement('div');
    cross.style.position = 'fixed';
    cross.style.left = `${x}px`;
    cross.style.top = `${y}px`;
    cross.style.width = '24px';
    cross.style.height = '24px';
    cross.style.transform = 'translate(-50%, -50%)';
    cross.style.pointerEvents = 'none';
    cross.style.zIndex = '99999';

    const h = document.createElement('div');
    h.style.position = 'absolute';
    h.style.left = '0';
    h.style.right = '0';
    h.style.top = '50%';
    h.style.height = '2px';
    h.style.transform = 'translateY(-50%)';
    h.style.background = color;

    const v = document.createElement('div');
    v.style.position = 'absolute';
    v.style.top = '0';
    v.style.bottom = '0';
    v.style.left = '50%';
    v.style.width = '2px';
    v.style.transform = 'translateX(-50%)';
    v.style.background = color;

    cross.append(h, v);
    document.body.appendChild(cross);
    window.setTimeout(() => cross.remove(), 500);
  };

  document.addEventListener(
    'touchstart',
    (event) => {
      Array.from(event.touches).forEach((touch) => drawCross(touch.clientX, touch.clientY, '#00e0ff'));
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      Array.from(event.touches).forEach((touch) => drawCross(touch.clientX, touch.clientY, '#ffd000'));
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    (event) => {
      Array.from(event.changedTouches).forEach((touch) => drawCross(touch.clientX, touch.clientY, '#ff4b4b'));
    },
    { passive: true }
  );
}

enableTouchPointDebug();

if (TOUCH_AREA_DEBUG && isMobileTouchDevice()) {
  document.body.classList.add('touch-area-debug');
}

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
