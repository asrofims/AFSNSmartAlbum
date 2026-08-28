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

export interface GapGuide {
  type: 'horizontal' | 'vertical';
  start: number; // Physical start coordinate along primary axis (e.g. x1)
  end: number;   // Physical end coordinate along primary axis (e.g. x2)
  crossPos: number; // Physical coordinate on perpendicular axis
  distance: number; // Physical distance (e.g. 10.0)
  label: string; // Formatted label (e.g. "10.0 mm")
}

export interface ResizeSnapResult {
  snappedBounds: RectBounds;
  snapLines: SnapLine[];
  gapGuides: GapGuide[];
}

/**
 * Calculates smart magnetic snapping lines, equal distance gaps, and adjustments for a dragged frame.
 */
export function calculateSnapping(
  dragged: RectBounds,
  spreadWidth: number,
  spreadHeight: number,
  safeArea: number,
  gutterWidth: number,
  otherFrames: RectBounds[],
  threshold: number = 3.0, // snap distance in physical units (e.g. 3mm)
  unit: string = 'mm'
): { snappedX: number; snappedY: number; snapLines: SnapLine[]; gapGuides: GapGuide[] } {
  let snappedX = dragged.x;
  let snappedY = dragged.y;
  const snapLines: SnapLine[] = [];
  const gapGuides: GapGuide[] = [];

  const singlePageW = (spreadWidth - gutterWidth) / 2;
  const leftPageCenter = singlePageW / 2;
  const spineLeft = singlePageW;
  const spineCenter = spreadWidth / 2;
  const spineRight = singlePageW + gutterWidth;
  const rightPageCenter = spineRight + singlePageW / 2;

  // Key vertical reference points on spread (Page Centers and Spines are Fixed physical targets)
  const vTargets = [
    { pos: 0, label: 'Left Outer Edge' },
    { pos: leftPageCenter, label: 'Left Page Center' },
    { pos: spineLeft, label: 'Left Page Inner Edge' },
    { pos: spineCenter, label: 'Center Spine' },
    { pos: spineRight, label: 'Right Page Inner Edge' },
    { pos: rightPageCenter, label: 'Right Page Center' },
    { pos: spreadWidth, label: 'Right Outer Edge' },
    ...(safeArea > 0
      ? [
          { pos: safeArea, label: 'Safe Margin Left' },
          { pos: spineLeft - safeArea, label: 'Safe Margin Left Inner' },
          { pos: spineRight + safeArea, label: 'Safe Margin Right Inner' },
          { pos: spreadWidth - safeArea, label: 'Safe Margin Right' },
        ]
      : []),
  ];

  // Key horizontal reference points on spread
  const hTargets = [
    { pos: 0, label: 'Top Edge' },
    { pos: spreadHeight / 2, label: 'Center Horizontal' },
    { pos: spreadHeight, label: 'Bottom Edge' },
    ...(safeArea > 0
      ? [
          { pos: safeArea, label: 'Safe Margin Top' },
          { pos: spreadHeight - safeArea, label: 'Safe Margin Bottom' },
        ]
      : []),
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

  // --- EQUAL SPACING & GAP DETECTION ---
  // 1. Horizontal Gaps (frames aligned in a row / overlapping Y)
  const yOverlapFrames = otherFrames.filter((f) => {
    const overlapY = Math.min(dragged.y + dragged.height, f.y + f.height) - Math.max(dragged.y, f.y);
    return overlapY > 10;
  });

  const leftFrames = yOverlapFrames.filter((f) => f.x + f.width <= dragged.x + threshold).sort((a, b) => (b.x + b.width) - (a.x + a.width));
  const rightFrames = yOverlapFrames.filter((f) => f.x >= dragged.x + dragged.width - threshold).sort((a, b) => a.x - b.x);

  const leftNeighbor = leftFrames[0];
  const rightNeighbor = rightFrames[0];

  if (leftNeighbor && rightNeighbor) {
    const leftGap = dragged.x - (leftNeighbor.x + leftNeighbor.width);
    const rightGap = rightNeighbor.x - (dragged.x + dragged.width);

    if (leftGap > 0 && rightGap > 0 && Math.abs(leftGap - rightGap) <= threshold * 2) {
      // Snap to equidistant midpoint
      const totalSpan = rightNeighbor.x - (leftNeighbor.x + leftNeighbor.width) - dragged.width;
      const equalGap = Math.max(0, totalSpan / 2);
      snappedX = roundToTenth(leftNeighbor.x + leftNeighbor.width + equalGap);

      const crossY = Math.min(dragged.y + dragged.height / 2, Math.min(leftNeighbor.y + leftNeighbor.height / 2, rightNeighbor.y + rightNeighbor.height / 2));
      gapGuides.push(
        {
          type: 'horizontal',
          start: leftNeighbor.x + leftNeighbor.width,
          end: snappedX,
          crossPos: crossY,
          distance: roundToTenth(equalGap),
          label: `${roundToTenth(equalGap)} ${unit}`,
        },
        {
          type: 'horizontal',
          start: snappedX + dragged.width,
          end: rightNeighbor.x,
          crossPos: crossY,
          distance: roundToTenth(equalGap),
          label: `${roundToTenth(equalGap)} ${unit}`,
        }
      );
    } else if (leftGap > 0 && leftGap <= 40) {
      const crossY = Math.min(dragged.y + dragged.height / 2, leftNeighbor.y + leftNeighbor.height / 2);
      gapGuides.push({
        type: 'horizontal',
        start: leftNeighbor.x + leftNeighbor.width,
        end: snappedX,
        crossPos: crossY,
        distance: roundToTenth(leftGap),
        label: `${roundToTenth(leftGap)} ${unit}`,
      });
    }
  } else if (leftNeighbor) {
    const leftGap = dragged.x - (leftNeighbor.x + leftNeighbor.width);
    if (leftGap > 0 && leftGap <= 40) {
      const crossY = Math.min(dragged.y + dragged.height / 2, leftNeighbor.y + leftNeighbor.height / 2);
      gapGuides.push({
        type: 'horizontal',
        start: leftNeighbor.x + leftNeighbor.width,
        end: snappedX,
        crossPos: crossY,
        distance: roundToTenth(leftGap),
        label: `${roundToTenth(leftGap)} ${unit}`,
      });
    }
  }

  // 2. Vertical Gaps (frames aligned in a column / overlapping X)
  const xOverlapFrames = otherFrames.filter((f) => {
    const overlapX = Math.min(dragged.x + dragged.width, f.x + f.width) - Math.max(dragged.x, f.x);
    return overlapX > 10;
  });

  const topFrames = xOverlapFrames.filter((f) => f.y + f.height <= dragged.y + threshold).sort((a, b) => (b.y + b.height) - (a.y + a.height));
  const bottomFrames = xOverlapFrames.filter((f) => f.y >= dragged.y + dragged.height - threshold).sort((a, b) => a.y - b.y);

  const topNeighbor = topFrames[0];
  const bottomNeighbor = bottomFrames[0];

  if (topNeighbor && bottomNeighbor) {
    const topGap = dragged.y - (topNeighbor.y + topNeighbor.height);
    const bottomGap = bottomNeighbor.y - (dragged.y + dragged.height);

    if (topGap > 0 && bottomGap > 0 && Math.abs(topGap - bottomGap) <= threshold * 2) {
      const totalSpan = bottomNeighbor.y - (topNeighbor.y + topNeighbor.height) - dragged.height;
      const equalGap = Math.max(0, totalSpan / 2);
      snappedY = roundToTenth(topNeighbor.y + topNeighbor.height + equalGap);

      const crossX = Math.min(dragged.x + dragged.width / 2, Math.min(topNeighbor.x + topNeighbor.width / 2, bottomNeighbor.x + bottomNeighbor.width / 2));
      gapGuides.push(
        {
          type: 'vertical',
          start: topNeighbor.y + topNeighbor.height,
          end: snappedY,
          crossPos: crossX,
          distance: roundToTenth(equalGap),
          label: `${roundToTenth(equalGap)} ${unit}`,
        },
        {
          type: 'vertical',
          start: snappedY + dragged.height,
          end: bottomNeighbor.y,
          crossPos: crossX,
          distance: roundToTenth(equalGap),
          label: `${roundToTenth(equalGap)} ${unit}`,
        }
      );
    } else if (topGap > 0 && topGap <= 40) {
      const crossX = Math.min(dragged.x + dragged.width / 2, topNeighbor.x + topNeighbor.width / 2);
      gapGuides.push({
        type: 'vertical',
        start: topNeighbor.y + topNeighbor.height,
        end: snappedY,
        crossPos: crossX,
        distance: roundToTenth(topGap),
        label: `${roundToTenth(topGap)} ${unit}`,
      });
    }
  } else if (topNeighbor) {
    const topGap = dragged.y - (topNeighbor.y + topNeighbor.height);
    if (topGap > 0 && topGap <= 40) {
      const crossX = Math.min(dragged.x + dragged.width / 2, topNeighbor.x + topNeighbor.width / 2);
      gapGuides.push({
        type: 'vertical',
        start: topNeighbor.y + topNeighbor.height,
        end: snappedY,
        crossPos: crossX,
        distance: roundToTenth(topGap),
        label: `${roundToTenth(topGap)} ${unit}`,
      });
    }
  }

  return { snappedX, snappedY, snapLines, gapGuides };
}

/**
 * Calculates smart resize snapping to match neighbor frame dimensions, alignment lines, and spread targets.
 */
export function calculateResizeSnapping(
  current: RectBounds,
  spreadWidth: number,
  spreadHeight: number,
  safeArea: number,
  gutterWidth: number,
  otherFrames: RectBounds[],
  threshold: number = 3.0,
  unit: string = 'mm'
): ResizeSnapResult {
  let { x, y, width, height } = current;
  const snapLines: SnapLine[] = [];
  const gapGuides: GapGuide[] = [];

  const singlePageW = (spreadWidth - gutterWidth) / 2;
  const leftPageCenter = singlePageW / 2;
  const spineLeft = singlePageW;
  const spineCenter = spreadWidth / 2;
  const spineRight = singlePageW + gutterWidth;
  const rightPageCenter = spineRight + singlePageW / 2;

  const vTargets = [
    { pos: 0, label: 'Left Outer Edge' },
    { pos: leftPageCenter, label: 'Left Page Center' },
    { pos: spineLeft, label: 'Left Page Inner Edge' },
    { pos: spineCenter, label: 'Center Spine' },
    { pos: spineRight, label: 'Right Page Inner Edge' },
    { pos: rightPageCenter, label: 'Right Page Center' },
    { pos: spreadWidth, label: 'Right Outer Edge' },
    ...(safeArea > 0
      ? [
          { pos: safeArea, label: 'Safe Margin Left' },
          { pos: spineLeft - safeArea, label: 'Safe Margin Left Inner' },
          { pos: spineRight + safeArea, label: 'Safe Margin Right Inner' },
          { pos: spreadWidth - safeArea, label: 'Safe Margin Right' },
        ]
      : []),
  ];

  const hTargets = [
    { pos: 0, label: 'Top Edge' },
    { pos: spreadHeight / 2, label: 'Center Horizontal' },
    { pos: spreadHeight, label: 'Bottom Edge' },
    ...(safeArea > 0
      ? [
          { pos: safeArea, label: 'Safe Margin Top' },
          { pos: spreadHeight - safeArea, label: 'Safe Margin Bottom' },
        ]
      : []),
  ];

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

    // Dimension matching (Width / Height)
    if (Math.abs(width - other.width) <= threshold) {
      width = other.width;
      snapLines.push({
        type: 'vertical',
        position: x + width,
        start: Math.min(y, other.y),
        end: Math.max(y + height, other.y + other.height),
        label: `Match Width (${roundToTenth(width)} ${unit})`,
      });
    }

    if (Math.abs(height - other.height) <= threshold) {
      height = other.height;
      snapLines.push({
        type: 'horizontal',
        position: y + height,
        start: Math.min(x, other.x),
        end: Math.max(x + width, other.x + other.width),
        label: `Match Height (${roundToTenth(height)} ${unit})`,
      });
    }
  }

  // Right Edge Snapping
  const currentRight = x + width;
  for (const target of vTargets) {
    if (Math.abs(currentRight - target.pos) <= threshold) {
      width = Math.max(5, target.pos - x);
      snapLines.push({
        type: 'vertical',
        position: target.pos,
        start: 0,
        end: spreadHeight,
        label: target.label,
      });
      break;
    }
  }

  // Bottom Edge Snapping
  const currentBottom = y + height;
  for (const target of hTargets) {
    if (Math.abs(currentBottom - target.pos) <= threshold) {
      height = Math.max(5, target.pos - y);
      snapLines.push({
        type: 'horizontal',
        position: target.pos,
        start: 0,
        end: spreadWidth,
        label: target.label,
      });
      break;
    }
  }

  return {
    snappedBounds: {
      x: roundToTenth(x),
      y: roundToTenth(y),
      width: roundToTenth(width),
      height: roundToTenth(height),
    },
    snapLines,
    gapGuides,
  };
}
