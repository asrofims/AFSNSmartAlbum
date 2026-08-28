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
  // 1. Horizontal Gaps (frames nearby in Y)
  const yNearbyFrames = otherFrames.filter((f) => {
    const verticalDistance = Math.max(0, Math.max(dragged.y, f.y) - Math.min(dragged.y + dragged.height, f.y + f.height));
    return verticalDistance <= Math.max(dragged.height, f.height) * 0.5 + 25;
  });

  const leftFrames = yNearbyFrames.filter((f) => f.x + f.width <= dragged.x + threshold).sort((a, b) => (b.x + b.width) - (a.x + a.width));
  const rightFrames = yNearbyFrames.filter((f) => f.x >= dragged.x + dragged.width - threshold).sort((a, b) => a.x - b.x);

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
    } else {
      if (leftGap > 0 && leftGap <= 80) {
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
      if (rightGap > 0 && rightGap <= 80) {
        const crossY = Math.min(dragged.y + dragged.height / 2, rightNeighbor.y + rightNeighbor.height / 2);
        gapGuides.push({
          type: 'horizontal',
          start: snappedX + dragged.width,
          end: rightNeighbor.x,
          crossPos: crossY,
          distance: roundToTenth(rightGap),
          label: `${roundToTenth(rightGap)} ${unit}`,
        });
      }
    }
  } else if (leftNeighbor) {
    const leftGap = dragged.x - (leftNeighbor.x + leftNeighbor.width);
    if (leftGap > 0 && leftGap <= 80) {
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
  } else if (rightNeighbor) {
    const rightGap = rightNeighbor.x - (dragged.x + dragged.width);
    if (rightGap > 0 && rightGap <= 80) {
      const crossY = Math.min(dragged.y + dragged.height / 2, rightNeighbor.y + rightNeighbor.height / 2);
      gapGuides.push({
        type: 'horizontal',
        start: snappedX + dragged.width,
        end: rightNeighbor.x,
        crossPos: crossY,
        distance: roundToTenth(rightGap),
        label: `${roundToTenth(rightGap)} ${unit}`,
      });
    }
  }

  // 2. Vertical Gaps (frames nearby in X)
  const xNearbyFrames = otherFrames.filter((f) => {
    const horizontalDistance = Math.max(0, Math.max(dragged.x, f.x) - Math.min(dragged.x + dragged.width, f.x + f.width));
    return horizontalDistance <= Math.max(dragged.width, f.width) * 0.5 + 25;
  });

  const topFrames = xNearbyFrames.filter((f) => f.y + f.height <= dragged.y + threshold).sort((a, b) => (b.y + b.height) - (a.y + a.height));
  const bottomFrames = xNearbyFrames.filter((f) => f.y >= dragged.y + dragged.height - threshold).sort((a, b) => a.y - b.y);

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
    } else {
      if (topGap > 0 && topGap <= 80) {
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
      if (bottomGap > 0 && bottomGap <= 80) {
        const crossX = Math.min(dragged.x + dragged.width / 2, bottomNeighbor.x + bottomNeighbor.width / 2);
        gapGuides.push({
          type: 'vertical',
          start: snappedY + dragged.height,
          end: bottomNeighbor.y,
          crossPos: crossX,
          distance: roundToTenth(bottomGap),
          label: `${roundToTenth(bottomGap)} ${unit}`,
        });
      }
    }
  } else if (topNeighbor) {
    const topGap = dragged.y - (topNeighbor.y + topNeighbor.height);
    if (topGap > 0 && topGap <= 80) {
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
  } else if (bottomNeighbor) {
    const bottomGap = bottomNeighbor.y - (dragged.y + dragged.height);
    if (bottomGap > 0 && bottomGap <= 80) {
      const crossX = Math.min(dragged.x + dragged.width / 2, bottomNeighbor.x + bottomNeighbor.width / 2);
      gapGuides.push({
        type: 'vertical',
        start: snappedY + dragged.height,
        end: bottomNeighbor.y,
        crossPos: crossX,
        distance: roundToTenth(bottomGap),
        label: `${roundToTenth(bottomGap)} ${unit}`,
      });
    }
  }

  return { snappedX, snappedY, snapLines, gapGuides };
}

/**
 * Calculates smart resize snapping to match neighbor frame dimensions and edge alignments cleanly.
 */
export function calculateResizeSnapping(
  current: RectBounds,
  _spreadWidth: number,
  _spreadHeight: number,
  _safeArea: number,
  _gutterWidth: number,
  otherFrames: RectBounds[],
  threshold: number = 3.0,
  unit: string = 'mm'
): ResizeSnapResult {
  let { x, y, width, height } = current;
  const snapLines: SnapLine[] = [];
  const gapGuides: GapGuide[] = [];

  const right = x + width;
  const bottom = y + height;

  // 1. Primary: Dimension Matching (Match Width / Match Height)
  let bestWidthDiff = threshold + 1;
  let bestWidthMatch: { other: RectBounds; val: number } | null = null;

  let bestHeightDiff = threshold + 1;
  let bestHeightMatch: { other: RectBounds; val: number } | null = null;

  for (const other of otherFrames) {
    // Width matching
    const wDiff = Math.abs(width - other.width);
    if (wDiff <= threshold && wDiff < bestWidthDiff) {
      bestWidthDiff = wDiff;
      bestWidthMatch = { other, val: other.width };
    }

    // Height matching
    const hDiff = Math.abs(height - other.height);
    if (hDiff <= threshold && hDiff < bestHeightDiff) {
      bestHeightDiff = hDiff;
      bestHeightMatch = { other, val: other.height };
    }
  }

  if (bestWidthMatch) {
    const o = bestWidthMatch.other;
    width = bestWidthMatch.val;
    snapLines.push({
      type: 'vertical',
      position: x + width,
      start: Math.min(y, o.y),
      end: Math.max(y + height, o.y + o.height),
      label: `Sama Lebar (${roundToTenth(width)} ${unit})`,
    });
  }

  if (bestHeightMatch) {
    const o = bestHeightMatch.other;
    height = bestHeightMatch.val;
    snapLines.push({
      type: 'horizontal',
      position: y + height,
      start: Math.min(x, o.x),
      end: Math.max(x + width, o.x + o.width),
      label: `Sama Tinggi (${roundToTenth(height)} ${unit})`,
    });
  }

  // 2. Secondary: Clean Edge Alignment with Nearest Frames
  let bestEdgeV: SnapLine | null = null;
  let bestEdgeVDiff = threshold + 1;

  let bestEdgeH: SnapLine | null = null;
  let bestEdgeHDiff = threshold + 1;

  for (const other of otherFrames) {
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;

    // Check Right Edge alignment
    const diffR_R = Math.abs(right - otherRight);
    if (diffR_R <= threshold && diffR_R < bestEdgeVDiff) {
      bestEdgeVDiff = diffR_R;
      bestEdgeV = {
        type: 'vertical',
        position: otherRight,
        start: Math.min(y, other.y),
        end: Math.max(bottom, otherBottom),
        label: 'Rata Kanan',
      };
    }
    const diffR_L = Math.abs(right - other.x);
    if (diffR_L <= threshold && diffR_L < bestEdgeVDiff) {
      bestEdgeVDiff = diffR_L;
      bestEdgeV = {
        type: 'vertical',
        position: other.x,
        start: Math.min(y, other.y),
        end: Math.max(bottom, otherBottom),
        label: 'Sejajar Sisi',
      };
    }

    // Check Bottom Edge alignment
    const diffB_B = Math.abs(bottom - otherBottom);
    if (diffB_B <= threshold && diffB_B < bestEdgeHDiff) {
      bestEdgeHDiff = diffB_B;
      bestEdgeH = {
        type: 'horizontal',
        position: otherBottom,
        start: Math.min(x, other.x),
        end: Math.max(right, otherRight),
        label: 'Rata Bawah',
      };
    }
    const diffB_T = Math.abs(bottom - other.y);
    if (diffB_T <= threshold && diffB_T < bestEdgeHDiff) {
      bestEdgeHDiff = diffB_T;
      bestEdgeH = {
        type: 'horizontal',
        position: other.y,
        start: Math.min(x, other.x),
        end: Math.max(right, otherRight),
        label: 'Sejajar Sisi',
      };
    }
  }

  // Only display edge lines if dimension line is not active on that axis
  if (bestEdgeV && !bestWidthMatch) {
    snapLines.push(bestEdgeV);
  }
  if (bestEdgeH && !bestHeightMatch) {
    snapLines.push(bestEdgeH);
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

/**
 * Checks if two bounding boxes intersect.
 */
export function intersectRect(r1: RectBounds, r2: RectBounds): boolean {
  return !(
    r2.x > r1.x + r1.width ||
    r2.x + r2.width < r1.x ||
    r2.y > r1.y + r1.height ||
    r2.y + r2.height < r1.y
  );
}

/**
 * Calculates alignment updates for multiple selected frames.
 */
export function alignFrames(
  frames: PhotoFrameElement[],
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  if (frames.length < 2) return [];

  const minX = Math.min(...frames.map((f) => f.x));
  const maxX = Math.max(...frames.map((f) => f.x + f.width));
  const minY = Math.min(...frames.map((f) => f.y));
  const maxY = Math.max(...frames.map((f) => f.y + f.height));
  const centerX = (minX + maxX) / 2;
  const middleY = (minY + maxY) / 2;

  return frames.map((f) => {
    switch (alignment) {
      case 'left':
        return { id: f.id, geometry: { x: roundToTenth(minX) } };
      case 'center':
        return { id: f.id, geometry: { x: roundToTenth(centerX - f.width / 2) } };
      case 'right':
        return { id: f.id, geometry: { x: roundToTenth(maxX - f.width) } };
      case 'top':
        return { id: f.id, geometry: { y: roundToTenth(minY) } };
      case 'middle':
        return { id: f.id, geometry: { y: roundToTenth(middleY - f.height / 2) } };
      case 'bottom':
        return { id: f.id, geometry: { y: roundToTenth(maxY - f.height) } };
    }
  });
}

/**
 * Calculates equidistant distribution updates for multiple selected frames.
 */
export function distributeFrames(
  frames: PhotoFrameElement[],
  direction: 'horizontal' | 'vertical'
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  if (frames.length < 3) return [];

  if (direction === 'horizontal') {
    const sorted = [...frames].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) return [];

    const totalSpan = (last.x + last.width) - first.x;
    const totalFramesW = sorted.reduce((sum, f) => sum + f.width, 0);
    const availableGap = totalSpan - totalFramesW;
    const gapPerItem = Math.max(0, availableGap / (sorted.length - 1));

    let currentX = first.x;
    return sorted.map((f) => {
      const update = { id: f.id, geometry: { x: roundToTenth(currentX) } };
      currentX += f.width + gapPerItem;
      return update;
    });
  } else {
    const sorted = [...frames].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) return [];

    const totalSpan = (last.y + last.height) - first.y;
    const totalFramesH = sorted.reduce((sum, f) => sum + f.height, 0);
    const availableGap = totalSpan - totalFramesH;
    const gapPerItem = Math.max(0, availableGap / (sorted.length - 1));

    let currentY = first.y;
    return sorted.map((f) => {
      const update = { id: f.id, geometry: { y: roundToTenth(currentY) } };
      currentY += f.height + gapPerItem;
      return update;
    });
  }
}

/**
 * Matches width, height, or both across multiple frames.
 */
export function matchFrameDimensions(
  frames: PhotoFrameElement[],
  dimension: 'width' | 'height' | 'both',
  sourceFrameId?: string
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  if (frames.length < 2) return [];

  const source = sourceFrameId
    ? frames.find((f) => f.id === sourceFrameId) || frames[0]
    : frames[0];
  if (!source) return [];

  const targetW = roundToTenth(source.width);
  const targetH = roundToTenth(source.height);

  return frames.map((f) => {
    const geometry: Partial<PhotoFrameElement> = {};
    if (dimension === 'width' || dimension === 'both') {
      geometry.width = targetW;
    }
    if (dimension === 'height' || dimension === 'both') {
      geometry.height = targetH;
    }
    return { id: f.id, geometry };
  });
}
