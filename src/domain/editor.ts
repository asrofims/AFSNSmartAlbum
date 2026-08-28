export interface PhotoFrameElement {
  id: string;
  type: 'photo';
  photoId: string | null;
  filePath: string;
  previewPath: string;
  thumbnailPath: string;
  fileName: string;
  
  // Physical dimensions & position on spread (in project unit: mm, cm, inch)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // 0 - 360 degrees
  zIndex: number;

  // Original photo metadata for Aspect Ratio restoration
  photoAspect?: number; // width / height of original master photo
  originalWidth?: number;
  originalHeight?: number;

  // Image layer dimensions behind the frame window
  imageWidth?: number;
  imageHeight?: number;

  // Internal Crop inside frame
  cropX: number; // offset in px/ratio
  cropY: number;
  cropScale: number; // zoom inside frame, default 1.0 (>= 1.0)
  cropRotation: number;

  // Styling
  borderEnabled: boolean;
  borderWidth: number;
  borderColor: string;
  opacity: number;
}

export interface SnapLine {
  type: 'vertical' | 'horizontal';
  position: number; // physical position along axis
  start: number;
  end: number;
  label?: string;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAX_CROP_SCALE = 3.5;

export interface CropTransform {
  cropX: number; // Normalized pan offset: -1.0 (left/top) to +1.0 (right/bottom), 0.0 is center
  cropY: number;
  cropScale: number; // Zoom level: 1.0 (100% cover fit) to 3.5 (350% zoom)
}

export interface Point {
  x: number;
  y: number;
}

export type CropResizeHandle = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getPhotoAspect(frame: PhotoFrameElement): number {
  if (frame.photoAspect && Number.isFinite(frame.photoAspect) && frame.photoAspect > 0) {
    return frame.photoAspect;
  }

  if (frame.originalWidth && frame.originalHeight && frame.originalHeight > 0) {
    return frame.originalWidth / frame.originalHeight;
  }

  return frame.width / Math.max(1, frame.height);
}

/**
 * Calculates the exact rendered dimensions of a photo inside a frame using Cover Fit math.
 */
export function calculateCoverDimensions(
  frameWidth: number,
  frameHeight: number,
  photoAspect: number,
  cropScale: number = 1.0
): { baseWidth: number; baseHeight: number; width: number; height: number; zoom: number } {
  const safeFrameW = Math.max(0.1, frameWidth);
  const safeFrameH = Math.max(0.1, frameHeight);
  const frameAspect = safeFrameW / safeFrameH;
  const safePhotoAspect = Math.max(0.01, photoAspect);

  let baseW = safeFrameW;
  let baseH = safeFrameH;

  if (safePhotoAspect >= frameAspect) {
    // Photo is wider than frame -> height matches frame, width expands
    baseH = safeFrameH;
    baseW = safeFrameH * safePhotoAspect;
  } else {
    // Photo is taller than frame -> width matches frame, height expands
    baseW = safeFrameW;
    baseH = safeFrameW / safePhotoAspect;
  }

  const zoom = clamp(cropScale, 1.0, MAX_CROP_SCALE);
  return {
    baseWidth: roundToTenth(baseW),
    baseHeight: roundToTenth(baseH),
    width: roundToTenth(baseW * zoom),
    height: roundToTenth(baseH * zoom),
    zoom,
  };
}

/**
 * Calculates rendered image offset inside frame using normalized focal pan coordinates (-1.0 to 1.0).
 */
export function calculateImageOffset(
  frameWidth: number,
  frameHeight: number,
  photoAspect: number,
  cropScale: number = 1.0,
  normPanX: number = 0,
  normPanY: number = 0
): { offsetX: number; offsetY: number; width: number; height: number; normPanX: number; normPanY: number } {
  const { width, height } = calculateCoverDimensions(frameWidth, frameHeight, photoAspect, cropScale);

  const maxExcessX = Math.max(0, width - frameWidth);
  const maxExcessY = Math.max(0, height - frameHeight);

  // Normalize pan coordinates to [-1, 1]
  const clampedNormX = clamp(Number.isFinite(normPanX) ? normPanX : 0, -1, 1);
  const clampedNormY = clamp(Number.isFinite(normPanY) ? normPanY : 0, -1, 1);

  // When normPan is 0, image is dead-center.
  // When normPan is -1, image is aligned to left/top edge.
  // When normPan is +1, image is aligned to right/bottom edge.
  const offsetX = -(maxExcessX / 2) + (clampedNormX * (maxExcessX / 2));
  const offsetY = -(maxExcessY / 2) + (clampedNormY * (maxExcessY / 2));

  return {
    offsetX: roundToTenth(offsetX),
    offsetY: roundToTenth(offsetY),
    width,
    height,
    normPanX: clampedNormX,
    normPanY: clampedNormY,
  };
}

export function getCoverImageSize(frame: PhotoFrameElement): { width: number; height: number } {
  const photoAspect = getPhotoAspect(frame);
  const cover = calculateCoverDimensions(frame.width, frame.height, photoAspect, 1.0);
  return {
    width: cover.width,
    height: cover.height,
  };
}

export function getCropImageSize(frame: PhotoFrameElement): { width: number; height: number } {
  return getCoverImageSize(frame);
}

export function getCenteredCrop(): CropTransform {
  return {
    cropX: 0,
    cropY: 0,
    cropScale: 1.0,
  };
}

export function clampCropTransform(
  frame: PhotoFrameElement,
  crop: Partial<CropTransform> = {}
): CropTransform {
  const zoom = clamp(crop.cropScale ?? frame.cropScale ?? 1.0, 1.0, MAX_CROP_SCALE);
  const panX = clamp(crop.cropX ?? frame.cropX ?? 0, -1, 1);
  const panY = clamp(crop.cropY ?? frame.cropY ?? 0, -1, 1);

  return {
    cropX: Math.round(panX * 1000) / 1000,
    cropY: Math.round(panY * 1000) / 1000,
    cropScale: roundToTenth(zoom),
  };
}

export function moveCropBy(
  frame: PhotoFrameElement,
  deltaPxX: number,
  deltaPxY: number,
  scaleFactor: number
): CropTransform {
  const photoAspect = getPhotoAspect(frame);
  const { width, height } = calculateCoverDimensions(frame.width, frame.height, photoAspect, frame.cropScale || 1.0);
  const maxExcessX = Math.max(0, width - frame.width) * scaleFactor;
  const maxExcessY = Math.max(0, height - frame.height) * scaleFactor;

  let currentNormX = frame.cropX || 0;
  let currentNormY = frame.cropY || 0;

  // If previous crop was stored in physical mm, normalize it
  if (Math.abs(currentNormX) > 1 && maxExcessX > 0) {
    currentNormX = clamp((currentNormX * scaleFactor + maxExcessX / 2) / (maxExcessX / 2), -1, 1);
  }
  if (Math.abs(currentNormY) > 1 && maxExcessY > 0) {
    currentNormY = clamp((currentNormY * scaleFactor + maxExcessY / 2) / (maxExcessY / 2), -1, 1);
  }

  let nextNormX = currentNormX;
  let nextNormY = currentNormY;

  if (maxExcessX > 0.5) {
    nextNormX = clamp(currentNormX + (deltaPxX / (maxExcessX / 2)), -1, 1);
  }
  if (maxExcessY > 0.5) {
    nextNormY = clamp(currentNormY + (deltaPxY / (maxExcessY / 2)), -1, 1);
  }

  return {
    cropX: Math.round(nextNormX * 1000) / 1000,
    cropY: Math.round(nextNormY * 1000) / 1000,
    cropScale: frame.cropScale || 1.0,
  };
}

export function zoomCropAtPoint(
  frame: PhotoFrameElement,
  _anchor: Point,
  nextScale: number
): CropTransform {
  return clampCropTransform(frame, {
    cropScale: nextScale,
    cropX: frame.cropX || 0,
    cropY: frame.cropY || 0,
  });
}

export function resizeCropFromHandle(
  frame: PhotoFrameElement,
  _handle: CropResizeHandle,
  _pointer: Point
): CropTransform {
  return clampCropTransform(frame);
}

/**
 * Calculates smart magnetic snapping lines and adjustments for a dragged or resized frame.
 */
export function calculateSnapping(
  dragged: RectBounds,
  spreadWidth: number,
  spreadHeight: number,
  safeArea: number,
  gutterWidth: number,
  otherFrames: RectBounds[],
  threshold: number = 3.0 // snap distance in physical units (e.g. 3mm)
): { snappedX: number; snappedY: number; snapLines: SnapLine[] } {
  let snappedX = dragged.x;
  let snappedY = dragged.y;
  const snapLines: SnapLine[] = [];

  const halfSpreadW = spreadWidth / 2;
  const leftCenterGutter = halfSpreadW - gutterWidth / 2;
  const rightCenterGutter = halfSpreadW + gutterWidth / 2;

  // Key vertical reference points on spread
  const vTargets = [
    { pos: 0, label: 'Left Edge' },
    { pos: safeArea, label: 'Safe Margin Left' },
    { pos: leftCenterGutter, label: 'Center Fold Left' },
    { pos: halfSpreadW, label: 'Center Spine' },
    { pos: rightCenterGutter, label: 'Center Fold Right' },
    { pos: spreadWidth - safeArea, label: 'Safe Margin Right' },
    { pos: spreadWidth, label: 'Right Edge' },
  ];

  // Key horizontal reference points on spread
  const hTargets = [
    { pos: 0, label: 'Top Edge' },
    { pos: safeArea, label: 'Safe Margin Top' },
    { pos: spreadHeight / 2, label: 'Center Horizontal' },
    { pos: spreadHeight - safeArea, label: 'Safe Margin Bottom' },
    { pos: spreadHeight, label: 'Bottom Edge' },
  ];

  // Add points from other frames
  for (const other of otherFrames) {
    vTargets.push(
      { pos: other.x, label: 'Align Left' },
      { pos: other.x + other.width / 2, label: 'Align Center X' },
      { pos: other.x + other.width, label: 'Align Right' }
    );
    hTargets.push(
      { pos: other.y, label: 'Align Top' },
      { pos: other.y + other.height / 2, label: 'Align Center Y' },
      { pos: other.y + other.height, label: 'Align Bottom' }
    );
  }

  // Check X snapping (left edge, center, right edge of dragged frame)
  const draggedLeft = dragged.x;
  const draggedCenterX = dragged.x + dragged.width / 2;
  const draggedRight = dragged.x + dragged.width;

  let minDiffX = threshold + 1;
  let bestSnapX: number | null = null;
  let bestVLine: SnapLine | null = null;

  for (const target of vTargets) {
    // Snap dragged left edge
    const diffLeft = Math.abs(draggedLeft - target.pos);
    if (diffLeft < threshold && diffLeft < minDiffX) {
      minDiffX = diffLeft;
      bestSnapX = target.pos;
      bestVLine = {
        type: 'vertical',
        position: target.pos,
        start: 0,
        end: spreadHeight,
        label: target.label,
      };
    }

    // Snap dragged center
    const diffCenter = Math.abs(draggedCenterX - target.pos);
    if (diffCenter < threshold && diffCenter < minDiffX) {
      minDiffX = diffCenter;
      bestSnapX = target.pos - dragged.width / 2;
      bestVLine = {
        type: 'vertical',
        position: target.pos,
        start: 0,
        end: spreadHeight,
        label: target.label,
      };
    }

    // Snap dragged right edge
    const diffRight = Math.abs(draggedRight - target.pos);
    if (diffRight < threshold && diffRight < minDiffX) {
      minDiffX = diffRight;
      bestSnapX = target.pos - dragged.width;
      bestVLine = {
        type: 'vertical',
        position: target.pos,
        start: 0,
        end: spreadHeight,
        label: target.label,
      };
    }
  }

  if (bestSnapX !== null && bestVLine !== null) {
    snappedX = bestSnapX;
    snapLines.push(bestVLine);
  }

  // Check Y snapping (top edge, center, bottom edge of dragged frame)
  const draggedTop = dragged.y;
  const draggedCenterY = dragged.y + dragged.height / 2;
  const draggedBottom = dragged.y + dragged.height;

  let minDiffY = threshold + 1;
  let bestSnapY: number | null = null;
  let bestHLine: SnapLine | null = null;

  for (const target of hTargets) {
    // Snap dragged top edge
    const diffTop = Math.abs(draggedTop - target.pos);
    if (diffTop < threshold && diffTop < minDiffY) {
      minDiffY = diffTop;
      bestSnapY = target.pos;
      bestHLine = {
        type: 'horizontal',
        position: target.pos,
        start: 0,
        end: spreadWidth,
        label: target.label,
      };
    }

    // Snap dragged center
    const diffCenter = Math.abs(draggedCenterY - target.pos);
    if (diffCenter < threshold && diffCenter < minDiffY) {
      minDiffY = diffCenter;
      bestSnapY = target.pos - dragged.height / 2;
      bestHLine = {
        type: 'horizontal',
        position: target.pos,
        start: 0,
        end: spreadWidth,
        label: target.label,
      };
    }

    // Snap dragged bottom edge
    const diffBottom = Math.abs(draggedBottom - target.pos);
    if (diffBottom < threshold && diffBottom < minDiffY) {
      minDiffY = diffBottom;
      bestSnapY = target.pos - dragged.height;
      bestHLine = {
        type: 'horizontal',
        position: target.pos,
        start: 0,
        end: spreadWidth,
        label: target.label,
      };
    }
  }

  if (bestSnapY !== null && bestHLine !== null) {
    snappedY = bestSnapY;
    snapLines.push(bestHLine);
  }

  return { snappedX, snappedY, snapLines };
}
