import './style.scss';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root container #app not found');
}

app.innerHTML = `
  <main class="landing" aria-label="Illustrated room landing">
    <img id="landing-image" src="/room.png" alt="Illustrated room" decoding="async" loading="lazy" />
  </main>
`;

const img = document.querySelector<HTMLImageElement>('#landing-image');

if (!img) {
  throw new Error('Landing image not found');
}

type ImageDimensions = { naturalWidth: number; naturalHeight: number };

const state: ImageDimensions = {
  naturalWidth: 0,
  naturalHeight: 0
};

const TOP_RATIO = 0.2;
const BOTTOM_RATIO = 0.1;
const RATIO_SUM = TOP_RATIO + BOTTOM_RATIO;
const LEFT_RATIO = 0.1;
const RIGHT_RATIO = 0.6;
const H_RATIO_SUM = LEFT_RATIO + RIGHT_RATIO;
const PARALLAX_BUFFER = 0.015; // minimum crop to avoid bars when applying parallax

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
    // Add 1% overdraw on each side to keep parallax shifts from revealing bars.
    const bufferedWidth = width * (1 + PARALLAX_BUFFER * 2);
    const bufferedHeight = height * (1 + PARALLAX_BUFFER * 2);
    const bufferedLeft = left - width * PARALLAX_BUFFER;
    const bufferedTop = top - height * PARALLAX_BUFFER;

    img.style.position = 'absolute';
    img.style.width = `${bufferedWidth}px`;
    img.style.height = `${bufferedHeight}px`;
    img.style.left = `${bufferedLeft}px`;
    img.style.top = `${bufferedTop}px`;
    img.style.transform = 'none';
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
  state.naturalWidth = img.naturalWidth;
  state.naturalHeight = img.naturalHeight;
  applyLayout();
}

// Mouse parallax: move image opposite to cursor up to 1% of width/height for half-screen travel.
const MAX_OFFSET_FACTOR = 0.005;
const MAX_ROTATE_DEG = 1;

function applyParallax(event: MouseEvent) {
  const rect = img.getBoundingClientRect();
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
  img.style.transformOrigin = `${originX}px ${originY}px`;
  img.style.transform = `translate(${translateX}px, ${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
}

window.addEventListener('mousemove', applyParallax);

img.addEventListener('load', handleImageReady, { once: true });
if (img.complete && img.naturalWidth) {
  handleImageReady();
}

window.addEventListener('resize', applyLayout);
