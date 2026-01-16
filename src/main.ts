import './style.scss';
import roomUrl from '../public/room.png';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root container #app not found');
}

app.innerHTML = `
  <main class="landing" aria-label="Illustrated room landing">
    <canvas id="landing-canvas" aria-label="Illustrated room"></canvas>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#landing-canvas');

if (!canvas) {
  throw new Error('Landing canvas not found');
}

const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('2D context not available');
}

const baseImage = new Image();
baseImage.src = roomUrl;
baseImage.decoding = 'async';
baseImage.loading = 'lazy';
baseImage.addEventListener('error', () => {
  console.error('Failed to load base image', roomUrl);
});

type ImageDimensions = { naturalWidth: number; naturalHeight: number };

const state: ImageDimensions = {
  naturalWidth: 0,
  naturalHeight: 0
};
type RenderState = {
  width: number;
  height: number;
  dpr: number;
};

const renderState: RenderState = {
  width: 0,
  height: 0,
  dpr: window.devicePixelRatio || 1
};

const TOP_RATIO = 0.2;
const BOTTOM_RATIO = 0.1;
const RATIO_SUM = TOP_RATIO + BOTTOM_RATIO;
const LEFT_RATIO = 0.1;
const RIGHT_RATIO = 0.6;
const H_RATIO_SUM = LEFT_RATIO + RIGHT_RATIO;
const PARALLAX_BUFFER = 0.015; // minimum crop to avoid bars when applying parallax
const LED_POSITION = { x: 409, y: 737 };
const LED_DIAMETER = 2;
const BLINK_MIN_MS = 100;
const BLINK_MAX_MS = 5000;
const BLINK_DURATION_MS = 120;
const NOISE_SIZE = 180;
const NOISE_FRAME_MS = 1000 / 30;
const NOISE_ALPHA = 0.05; // tiny white noise overlay

const noiseCanvas = document.createElement('canvas');
noiseCanvas.width = NOISE_SIZE;
noiseCanvas.height = NOISE_SIZE;
const noiseCtx = noiseCanvas.getContext('2d');

if (!noiseCtx) {
  throw new Error('Noise 2D context not available');
}
let ledOn = false;
let blinkTimeout: number | undefined;
let lastNoiseFrame = 0;
let noiseRaf = 0;

function drawFrame() {
  if (!renderState.width || !renderState.height || !state.naturalWidth || !state.naturalHeight) return;

  const dpr = renderState.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, renderState.width, renderState.height);

  ctx.drawImage(baseImage, 0, 0, renderState.width, renderState.height);

  // LED overlay
  if (ledOn) {
    const scale = renderState.width / state.naturalWidth;
    const ledRadius = (LED_DIAMETER / 2) * scale;
    const ledX = LED_POSITION.x * scale;
    const ledY = LED_POSITION.y * scale;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ledX, ledY, ledRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // White noise overlay
  const pattern = ctx.createPattern(noiseCanvas, 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = NOISE_ALPHA;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, renderState.width, renderState.height);
    ctx.restore();
  }
}

function queueBlink() {
  const delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
  blinkTimeout = window.setTimeout(() => {
    ledOn = true;
    drawFrame();
    blinkTimeout = window.setTimeout(() => {
      ledOn = false;
      drawFrame();
      queueBlink();
    }, BLINK_DURATION_MS);
  }, delay);
}

function generateNoise() {
  const imageData = noiseCtx.createImageData(NOISE_SIZE, NOISE_SIZE);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.floor(Math.random() * 256);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  noiseCtx.putImageData(imageData, 0, 0);
}

function animateNoise(timestamp: number) {
  if (!state.naturalWidth || !state.naturalHeight) {
    noiseRaf = window.requestAnimationFrame(animateNoise);
    return;
  }

  if (timestamp - lastNoiseFrame >= NOISE_FRAME_MS) {
    generateNoise();
    drawFrame();
    lastNoiseFrame = timestamp;
  }

  noiseRaf = window.requestAnimationFrame(animateNoise);
}

function applyLayout() {
  if (!state.naturalWidth || !state.naturalHeight) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const scaleToWidth = vw / state.naturalWidth;
  const heightFromWidth = state.naturalHeight * scaleToWidth;
  const widthFromWidth = state.naturalWidth * scaleToWidth;

  const topLimit = heightFromWidth * TOP_RATIO;
  const bottomLimit = heightFromWidth * BOTTOM_RATIO;
  const allowedCropTotal = topLimit + bottomLimit;

  const applyBufferedLayout = (width: number, height: number, left: number, top: number) => {
    // Add 1.5% overdraw on each side to keep parallax shifts from revealing bars.
    const bufferedWidth = width * (1 + PARALLAX_BUFFER * 2);
    const bufferedHeight = height * (1 + PARALLAX_BUFFER * 2);
    const bufferedLeft = left - width * PARALLAX_BUFFER;
    const bufferedTop = top - height * PARALLAX_BUFFER;
    const dpr = window.devicePixelRatio || 1;

    renderState.width = bufferedWidth;
    renderState.height = bufferedHeight;
    renderState.dpr = dpr;

    canvas.width = Math.max(1, Math.round(bufferedWidth * dpr));
    canvas.height = Math.max(1, Math.round(bufferedHeight * dpr));

    canvas.style.position = 'absolute';
    canvas.style.width = `${bufferedWidth}px`;
    canvas.style.height = `${bufferedHeight}px`;
    canvas.style.left = `${bufferedLeft}px`;
    canvas.style.top = `${bufferedTop}px`;
    canvas.style.transform = 'none';

    drawFrame();
  };

  if (heightFromWidth <= vh) {
    // Image is shorter than viewport when fit to width: scale up to fill height, then crop horizontally within limits.
    const scaleToHeight = vh / state.naturalHeight;
    const widthFromHeight = state.naturalWidth * scaleToHeight;
    const horizontalOverflow = widthFromHeight - vw;
    const leftLimit = widthFromHeight * LEFT_RATIO;
    const rightLimit = widthFromHeight * RIGHT_RATIO;
    const allowedHorizontal = leftLimit + rightLimit;

    if (horizontalOverflow <= 0) {
      // Even when scaled to height, the image is not wider than the viewport.
      const leftOffset = (vw - widthFromHeight) / 2;
      applyBufferedLayout(widthFromHeight, vh, leftOffset, 0);
      return;
    }

    if (horizontalOverflow <= allowedHorizontal) {
      // Crop within horizontal limits.
      let leftCrop = Math.min((horizontalOverflow * LEFT_RATIO) / H_RATIO_SUM, leftLimit);
      let rightCrop = horizontalOverflow - leftCrop;

      if (rightCrop > rightLimit) {
        rightCrop = rightLimit;
        const remaining = horizontalOverflow - rightCrop;
        leftCrop = Math.min(remaining, leftLimit);
      }

      applyBufferedLayout(widthFromHeight, vh, -leftCrop, 0);
      return;
    }

    // Horizontal crop limits exceeded: cap at max crop and letterbox vertically.
    const maxWidthWithCrop = vw / (1 - H_RATIO_SUM);
    const scaleLimited = maxWidthWithCrop / state.naturalWidth;
    const limitedHeight = state.naturalHeight * scaleLimited;
    const leftCrop = maxWidthWithCrop * LEFT_RATIO;
    const verticalOffset = (vh - limitedHeight) / 2;

    applyBufferedLayout(maxWidthWithCrop, limitedHeight, -leftCrop, verticalOffset);
    return;
  }

  const croppingNeeded = heightFromWidth - vh;

  if (croppingNeeded <= allowedCropTotal) {
    // Crop proportionally within allowed top/bottom limits.
    let topCrop = Math.min((croppingNeeded * TOP_RATIO) / RATIO_SUM, topLimit);
    let bottomCrop = croppingNeeded - topCrop;

    if (bottomCrop > bottomLimit) {
      bottomCrop = bottomLimit;
      const remaining = croppingNeeded - bottomCrop;
      topCrop = Math.min(remaining, topLimit);
    }

    applyBufferedLayout(widthFromWidth, heightFromWidth, 0, -topCrop);
    return;
  }

  // Exceeds allowed crop: crop at limits and scale down so visible area fits; bars appear on sides.
  const scaleLimited = vh / (state.naturalHeight * (1 - RATIO_SUM));
  let widthLimited = state.naturalWidth * scaleLimited;
  let heightLimited = state.naturalHeight * scaleLimited;
  let topCropMax = heightLimited * TOP_RATIO;

  if (widthLimited <= vw) {
    const leftOffset = (vw - widthLimited) / 2;
    applyBufferedLayout(widthLimited, heightLimited, leftOffset, -topCropMax);
    return;
  }

  const horizontalOverflow = widthLimited - vw;
  const leftLimit = widthLimited * LEFT_RATIO;
  const rightLimit = widthLimited * RIGHT_RATIO;
  const allowedHorizontal = leftLimit + rightLimit;

  if (horizontalOverflow <= allowedHorizontal) {
    // Crop within horizontal limits, biasing toward the larger right allowance.
    let leftCrop = Math.min((horizontalOverflow * LEFT_RATIO) / H_RATIO_SUM, leftLimit);
    let rightCrop = horizontalOverflow - leftCrop;

    if (rightCrop > rightLimit) {
      rightCrop = rightLimit;
      const remaining = horizontalOverflow - rightCrop;
      leftCrop = Math.min(remaining, leftLimit);
    }

    applyBufferedLayout(widthLimited, heightLimited, -leftCrop, -topCropMax);
    return;
  }

  // Horizontal limits hit: reduce scale so overflow equals allowed max, show bars on top/bottom.
  const maxWidthWithAllowedCrop = vw / (1 - H_RATIO_SUM);
  const scaleDown = maxWidthWithAllowedCrop / widthLimited;

  widthLimited *= scaleDown;
  heightLimited *= scaleDown;
  topCropMax = heightLimited * TOP_RATIO;
  const bottomCropMax = heightLimited * BOTTOM_RATIO;

  const leftCrop = widthLimited * LEFT_RATIO;

  // Recompute vertical handling now that width is constrained by horizontal limits.
  const verticalOverflow = heightLimited - vh;
  const allowedVertical = topCropMax + bottomCropMax;

  if (verticalOverflow <= 0) {
    // Image is shorter than viewport after horizontal constraint; center with bars.
    const offset = (vh - heightLimited) / 2;
    applyBufferedLayout(widthLimited, heightLimited, -leftCrop, offset);
    return;
  }

  if (verticalOverflow <= allowedVertical) {
    let topCrop = Math.min((verticalOverflow * TOP_RATIO) / RATIO_SUM, topCropMax);
    let bottomCrop = verticalOverflow - topCrop;

    if (bottomCrop > bottomCropMax) {
      bottomCrop = bottomCropMax;
      const remaining = verticalOverflow - bottomCrop;
      topCrop = Math.min(remaining, topCropMax);
    }

    applyBufferedLayout(widthLimited, heightLimited, -leftCrop, -topCrop);
    return;
  }

  // If vertical overflow still exceeds limits, center the maximum visible window with bars.
  const visibleHeight = heightLimited * (1 - RATIO_SUM);
  const offset = (vh - visibleHeight) / 2 - topCropMax;
  applyBufferedLayout(widthLimited, heightLimited, -leftCrop, offset);
}

function handleImageReady() {
  state.naturalWidth = baseImage.naturalWidth;
  state.naturalHeight = baseImage.naturalHeight;
  applyLayout();
  if (blinkTimeout !== undefined) {
    window.clearTimeout(blinkTimeout);
    blinkTimeout = undefined;
  }
  queueBlink();
  generateNoise();
  if (noiseRaf) {
    window.cancelAnimationFrame(noiseRaf);
  }
  lastNoiseFrame = 0;
  noiseRaf = window.requestAnimationFrame(animateNoise);
}

// Mouse parallax: move image opposite to cursor up to 0.5% of width/height for half-screen travel.
const MAX_OFFSET_FACTOR = 0.005;
const MAX_ROTATE_DEG = 1;

function applyParallax(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  const deltaX = (event.clientX - centerX) / (window.innerWidth / 2); // -1 to 1 across the screen
  const deltaY = (event.clientY - centerY) / (window.innerHeight / 2); // -1 to 1 across the screen

  const clampedX = Math.max(Math.min(deltaX, 0.5), -0.5); // half-screen reach triggers max offset
  const clampedY = Math.max(Math.min(deltaY, 0.5), -0.5);

  const translateX = -clampedX * (rect.width * (MAX_OFFSET_FACTOR / 0.5));
  const translateY = -clampedY * (rect.height * (MAX_OFFSET_FACTOR / 0.5));

  // Normalize image movement (-1..1) and rotate so the leading edge recedes at max movement.
  const movementX = translateX / (rect.width * MAX_OFFSET_FACTOR);
  const movementY = translateY / (rect.height * MAX_OFFSET_FACTOR);
  const rotateY = -movementX * MAX_ROTATE_DEG;
  const rotateX = movementY * MAX_ROTATE_DEG;

  const originX = centerX - rect.left;
  const originY = centerY - rect.top;
  canvas.style.transformOrigin = `${originX}px ${originY}px`;
  canvas.style.transform = `translate(${translateX}px, ${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
}

window.addEventListener('mousemove', applyParallax);

baseImage.addEventListener('load', handleImageReady, { once: true });
if (baseImage.complete && baseImage.naturalWidth) {
  handleImageReady();
}

window.addEventListener('resize', applyLayout);
