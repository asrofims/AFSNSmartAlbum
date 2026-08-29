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

export function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
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

export interface SnappingConfig {
  enabled: boolean;
  threshold: number; // in physical mm/unit (default: 2.0)
  snapToPageEdges: boolean; // outer spread borders & center gutter/spine crease
  snapToPageCenters: boolean; // optical centerlines of left page, right page, and full spread
  snapToMargins: boolean; // safe zone margin boundaries
  snapToFrames: boolean; // collinear edges and centers of other photo frames
  snapToEqualGaps: boolean; // equidistant spacing between 3+ frames and dynamic gap HUD
}

export const DEFAULT_SNAPPING_CONFIG: SnappingConfig = {
  enabled: true,
  threshold: 0.1,
  snapToPageEdges: true,
  snapToPageCenters: true,
  snapToMargins: true,
  snapToFrames: true,
  snapToEqualGaps: true,
};

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
  thresholdOrConfig: number | SnappingConfig = DEFAULT_SNAPPING_CONFIG,
  unit: string = 'mm'
): { snappedX: number; snappedY: number; snapLines: SnapLine[]; gapGuides: GapGuide[] } {
  const config: SnappingConfig =
    typeof thresholdOrConfig === 'number'
      ? { ...DEFAULT_SNAPPING_CONFIG, threshold: thresholdOrConfig }
      : { ...DEFAULT_SNAPPING_CONFIG, ...thresholdOrConfig };

  if (!config.enabled) {
    return { snappedX: dragged.x, snappedY: dragged.y, snapLines: [], gapGuides: [] };
  }

  const threshold = typeof config.threshold === 'number' ? config.threshold : 0.1;
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

  // Key vertical reference points on spread
  const vTargets: { pos: number; label: string }[] = [];

  if (config.snapToPageEdges) {
    vTargets.push(
      { pos: 0, label: 'Left Outer Edge' },
      { pos: spineLeft, label: 'Left Page Inner Edge' },
      { pos: spineCenter, label: 'Center Spine' },
      { pos: spineRight, label: 'Right Page Inner Edge' },
      { pos: spreadWidth, label: 'Right Outer Edge' }
    );
  }

  if (config.snapToPageCenters) {
    vTargets.push(
      { pos: leftPageCenter, label: 'Left Page Center' },
      { pos: spineCenter, label: 'Spread Center X' },
      { pos: rightPageCenter, label: 'Right Page Center' }
    );
  }

  if (config.snapToMargins && safeArea > 0) {
    vTargets.push(
      { pos: safeArea, label: 'Safe Margin Left' },
      { pos: spineLeft - safeArea, label: 'Safe Margin Left Inner' },
      { pos: spineRight + safeArea, label: 'Safe Margin Right Inner' },
      { pos: spreadWidth - safeArea, label: 'Safe Margin Right' }
    );
  }

  // Key horizontal reference points on spread
  const hTargets: { pos: number; label: string }[] = [];

  if (config.snapToPageEdges) {
    hTargets.push(
      { pos: 0, label: 'Top Edge' },
      { pos: spreadHeight, label: 'Bottom Edge' }
    );
  }

  if (config.snapToPageCenters) {
    hTargets.push({ pos: spreadHeight / 2, label: 'Center Horizontal' });
  }

  if (config.snapToMargins && safeArea > 0) {
    hTargets.push(
      { pos: safeArea, label: 'Safe Margin Top' },
      { pos: spreadHeight - safeArea, label: 'Safe Margin Bottom' }
    );
  }

  // Add points from other frames
  if (config.snapToFrames) {
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
  if (config.snapToEqualGaps) {
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
}

return { snappedX, snappedY, snapLines, gapGuides };
}

/**
 * Calculates smart resize snapping to match neighbor frame dimensions and primary collinear edge alignments.
 */
export function calculateResizeSnapping(
  current: RectBounds,
  _spreadWidth: number,
  _spreadHeight: number,
  _safeArea: number,
  _gutterWidth: number,
  otherFrames: RectBounds[],
  threshold: number = 2.0,
  unit: string = 'mm',
  anchor?: string
): ResizeSnapResult {
  let { x, y, width, height } = current;
  const snapLines: SnapLine[] = [];
  const gapGuides: GapGuide[] = [];

  const right = x + width;
  const bottom = y + height;

  const isTopAnchor = anchor ? anchor.includes('top') : false;
  const isBottomAnchor = anchor ? anchor.includes('bottom') : false;
  const isLeftAnchor = anchor ? anchor.includes('left') : false;
  const isRightAnchor = anchor ? anchor.includes('right') : false;
  const isCorner = anchor
    ? anchor === 'top-left' || anchor === 'top-right' || anchor === 'bottom-left' || anchor === 'bottom-right'
    : false;

  const isWidthResizable = !anchor || isLeftAnchor || isRightAnchor || isCorner;
  const isHeightResizable = !anchor || isTopAnchor || isBottomAnchor || isCorner;

  // Aspect ratio of the frame
  const aspect = width > 0 && height > 0 ? width / height : 1;

  // 1. Primary: Dimension Matching (Equal Width / Equal Height)
  let bestWidthDiff = threshold + 1;
  let bestWidthMatch: { other: RectBounds; val: number } | null = null;

  let bestHeightDiff = threshold + 1;
  let bestHeightMatch: { other: RectBounds; val: number } | null = null;

  for (const other of otherFrames) {
    // Width matching (only if resizing width)
    if (isWidthResizable) {
      const wDiff = Math.abs(width - other.width);
      if (wDiff <= threshold && wDiff < bestWidthDiff) {
        bestWidthDiff = wDiff;
        bestWidthMatch = { other, val: other.width };
      }
    }

    // Height matching (only if resizing height)
    if (isHeightResizable) {
      const hDiff = Math.abs(height - other.height);
      if (hDiff <= threshold && hDiff < bestHeightDiff) {
        bestHeightDiff = hDiff;
        bestHeightMatch = { other, val: other.height };
      }
    }
  }

  // Apply Height Snap (if resizing top or bottom or corner)
  if (bestHeightMatch && (!bestWidthMatch || bestHeightDiff <= bestWidthDiff)) {
    const o = bestHeightMatch.other;
    const targetH = bestHeightMatch.val;
    const diffH = targetH - height;

    if (isTopAnchor) {
      y = y - diffH;
      height = targetH;
      if (isCorner) {
        const targetW = targetH * aspect;
        const diffW = targetW - width;
        if (isLeftAnchor) x = x - diffW;
        width = targetW;
      }
      snapLines.push({
        type: 'horizontal',
        position: y,
        start: Math.min(x, o.x),
        end: Math.max(x + width, o.x + o.width),
        label: `Match Height (${roundToTenth(height)} ${unit})`,
      });
    } else {
      height = targetH;
      if (isCorner) {
        const targetW = targetH * aspect;
        const diffW = targetW - width;
        if (isLeftAnchor) x = x - diffW;
        width = targetW;
      }
      snapLines.push({
        type: 'horizontal',
        position: y + height,
        start: Math.min(x, o.x),
        end: Math.max(x + width, o.x + o.width),
        label: `Match Height (${roundToTenth(height)} ${unit})`,
      });
    }
  }
  // Apply Width Snap (if resizing left or right or corner)
  else if (bestWidthMatch) {
    const o = bestWidthMatch.other;
    const targetW = bestWidthMatch.val;
    const diffW = targetW - width;

    if (isLeftAnchor) {
      x = x - diffW;
      width = targetW;
      if (isCorner) {
        const targetH = targetW / aspect;
        const diffH = targetH - height;
        if (isTopAnchor) y = y - diffH;
        height = targetH;
      }
      snapLines.push({
        type: 'vertical',
        position: x,
        start: Math.min(y, o.y),
        end: Math.max(y + height, o.y + o.height),
        label: `Match Width (${roundToTenth(width)} ${unit})`,
      });
    } else {
      width = targetW;
      if (isCorner) {
        const targetH = targetW / aspect;
        const diffH = targetH - height;
        if (isTopAnchor) y = y - diffH;
        height = targetH;
      }
      snapLines.push({
        type: 'vertical',
        position: x + width,
        start: Math.min(y, o.y),
        end: Math.max(y + height, o.y + o.height),
        label: `Match Width (${roundToTenth(width)} ${unit})`,
      });
    }
  }

  // 2. Secondary: Primary Collinear Edge Alignment (Only for the active side being moved)
  if (snapLines.length === 0 && !isCorner) {
    let bestEdgeV: { line: SnapLine; snapX?: number; snapW?: number } | null = null;
    let bestEdgeVDiff = threshold + 1;

    let bestEdgeH: { line: SnapLine; snapY?: number; snapH?: number } | null = null;
    let bestEdgeHDiff = threshold + 1;

    for (const other of otherFrames) {
      const otherRight = other.x + other.width;
      const otherBottom = other.y + other.height;

      // Vertical (Left-to-Left or Right-to-Right only)
      if (isLeftAnchor) {
        const diffL = Math.abs(x - other.x);
        if (diffL <= threshold && diffL < bestEdgeVDiff) {
          bestEdgeVDiff = diffL;
          const newX = other.x;
          const newW = (x + width) - newX;
          bestEdgeV = {
            line: {
              type: 'vertical',
              position: other.x,
              start: Math.min(y, other.y),
              end: Math.max(y + height, otherBottom),
              label: 'Rata Kiri',
            },
            snapX: newX,
            snapW: newW,
          };
        }
      } else if (isRightAnchor) {
        const diffR = Math.abs(right - otherRight);
        if (diffR <= threshold && diffR < bestEdgeVDiff) {
          bestEdgeVDiff = diffR;
          const newW = otherRight - x;
          bestEdgeV = {
            line: {
              type: 'vertical',
              position: otherRight,
              start: Math.min(y, other.y),
              end: Math.max(bottom, otherBottom),
              label: 'Rata Kanan',
            },
            snapW: newW,
          };
        }
      }

      // Horizontal (Top-to-Top or Bottom-to-Bottom only)
      if (isTopAnchor) {
        const diffT = Math.abs(y - other.y);
        if (diffT <= threshold && diffT < bestEdgeHDiff) {
          bestEdgeHDiff = diffT;
          const newY = other.y;
          const newH = (y + height) - newY;
          bestEdgeH = {
            line: {
              type: 'horizontal',
              position: other.y,
              start: Math.min(x, other.x),
              end: Math.max(x + width, otherRight),
              label: 'Rata Atas',
            },
            snapY: newY,
            snapH: newH,
          };
        }
      } else if (isBottomAnchor) {
        const diffB = Math.abs(bottom - otherBottom);
        if (diffB <= threshold && diffB < bestEdgeHDiff) {
          bestEdgeHDiff = diffB;
          const newH = otherBottom - y;
          bestEdgeH = {
            line: {
              type: 'horizontal',
              position: otherBottom,
              start: Math.min(x, other.x),
              end: Math.max(bottom, otherBottom),
              label: 'Rata Bawah',
            },
            snapH: newH,
          };
        }
      }
    }

    if (bestEdgeV) {
      snapLines.push(bestEdgeV.line);
      if (bestEdgeV.snapX !== undefined) x = bestEdgeV.snapX;
      if (bestEdgeV.snapW !== undefined) width = bestEdgeV.snapW;
    }
    if (bestEdgeH) {
      snapLines.push(bestEdgeH.line);
      if (bestEdgeH.snapY !== undefined) y = bestEdgeH.snapY;
      if (bestEdgeH.snapH !== undefined) height = bestEdgeH.snapH;
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
 * Calculates equidistant gap distribution updates for multiple selected frames.
 * Keeps the outermost bounds intact and distributes equal gaps between all frames.
 * Supports large, normal, and micro-thin gaps without floating-point accumulation drift.
 */
export function distributeFrames(
  frames: PhotoFrameElement[],
  direction: 'horizontal' | 'vertical'
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  if (frames.length < 3) return [];

  if (direction === 'horizontal') {
    // Sort frames strictly from left to right
    const sorted = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
    if (!sorted[0]) return [];
    const minX = sorted[0].x;
    const maxRight = Math.max(...sorted.map((f) => f.x + f.width));
    const totalFramesW = sorted.reduce((sum, f) => sum + f.width, 0);
    const totalSpan = maxRight - minX;
    const availableGap = Math.max(0, totalSpan - totalFramesW);
    const gapPerItem = availableGap / (sorted.length - 1);

    let cumulativeWidth = 0;
    return sorted.map((f, i) => {
      const targetX = minX + cumulativeWidth + i * gapPerItem;
      cumulativeWidth += f.width;
      return { id: f.id, geometry: { x: roundToHundredth(targetX) } };
    });
  } else {
    // Sort frames strictly from top to bottom
    const sorted = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);
    if (!sorted[0]) return [];
    const minY = sorted[0].y;
    const maxBottom = Math.max(...sorted.map((f) => f.y + f.height));
    const totalFramesH = sorted.reduce((sum, f) => sum + f.height, 0);
    const totalSpan = maxBottom - minY;
    const availableGap = Math.max(0, totalSpan - totalFramesH);
    const gapPerItem = availableGap / (sorted.length - 1);

    let cumulativeHeight = 0;
    return sorted.map((f, i) => {
      const targetY = minY + cumulativeHeight + i * gapPerItem;
      cumulativeHeight += f.height;
      return { id: f.id, geometry: { y: roundToHundredth(targetY) } };
    });
  }
}

/**
 * Applies a fixed custom gap spacing between multiple frames starting from the first frame's position.
 */
export function applyFixedGap(
  frames: PhotoFrameElement[],
  direction: 'horizontal' | 'vertical',
  gap: number
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  if (frames.length < 2) return [];

  if (direction === 'horizontal') {
    const sorted = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
    if (!sorted[0]) return [];
    let currentX = sorted[0].x;
    return sorted.map((f) => {
      const update = { id: f.id, geometry: { x: roundToHundredth(currentX) } };
      currentX += f.width + gap;
      return update;
    });
  } else {
    const sorted = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);
    if (!sorted[0]) return [];
    let currentY = sorted[0].y;
    return sorted.map((f) => {
      const update = { id: f.id, geometry: { y: roundToHundredth(currentY) } };
      currentY += f.height + gap;
      return update;
    });
  }
}

export interface FrameBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates resized dimensions and positions for multiple frames while strictly preserving
 * the exact inter-frame gap spacing (both horizontally and vertically).
 */
/**
 * Calculates resized dimensions and positions for multiple frames while strictly preserving
 * the exact inter-frame gap spacing (both horizontally and vertically) across any layout topology.
 */
export function calculateMultiFrameResize(
  initialFrames: FrameBounds[],
  initialGroupBounds: RectBounds,
  newGroupBounds: RectBounds,
  anchor?: string
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  if (initialFrames.length === 0) return [];
  if (initialFrames.length === 1) {
    const f = initialFrames[0];
    if (!f) return [];
    const uniformScale = initialGroupBounds.width > 0 ? newGroupBounds.width / initialGroupBounds.width : 1;
    return [{
      id: f.id,
      geometry: {
        x: roundToHundredth(newGroupBounds.x),
        y: roundToHundredth(newGroupBounds.y),
        width: roundToHundredth(Math.max(1, f.width * uniformScale)),
        height: roundToHundredth(Math.max(1, f.height * uniformScale)),
      },
    }];
  }

  const minGroupX = Math.min(...initialFrames.map((f) => f.x));
  const minGroupY = Math.min(...initialFrames.map((f) => f.y));
  const maxGroupX = Math.max(...initialFrames.map((f) => f.x + f.width));
  const maxGroupY = Math.max(...initialFrames.map((f) => f.y + f.height));
  const initW = maxGroupX - minGroupX;
  const initH = maxGroupY - minGroupY;

  // --- 1. Build 2D Spatial Neighbor Relations & Extract Invariant Gaps ---
  // Horizontal neighbor: A is immediate left neighbor of B if A is to the left of B and their Y spans overlap
  const leftNeighbors = new Map<string, { neighborId: string; gap: number }>();
  for (const b of initialFrames) {
    let closestA: FrameBounds | null = null;
    let closestDist = -Infinity;

    for (const a of initialFrames) {
      if (a.id === b.id) continue;
      const rightEdgeA = a.x + a.width;
      if (rightEdgeA <= b.x + 0.1) {
        // Check if vertical spans overlap
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapY > 0.5) {
          if (rightEdgeA > closestDist) {
            closestDist = rightEdgeA;
            closestA = a;
          }
        }
      }
    }

    if (closestA) {
      const gap = Math.max(0, b.x - (closestA.x + closestA.width));
      leftNeighbors.set(b.id, { neighborId: closestA.id, gap });
    }
  }

  // Vertical neighbor: C is immediate top neighbor of B if C is above B and their X spans overlap
  const topNeighbors = new Map<string, { neighborId: string; gap: number }>();
  for (const b of initialFrames) {
    let closestC: FrameBounds | null = null;
    let closestDist = -Infinity;

    for (const c of initialFrames) {
      if (c.id === b.id) continue;
      const bottomEdgeC = c.y + c.height;
      if (bottomEdgeC <= b.y + 0.1) {
        // Check if horizontal spans overlap
        const overlapX = Math.min(c.x + c.width, b.x + b.width) - Math.max(c.x, b.x);
        if (overlapX > 0.5) {
          if (bottomEdgeC > closestDist) {
            closestDist = bottomEdgeC;
            closestC = c;
          }
        }
      }
    }

    if (closestC) {
      const gap = Math.max(0, b.y - (closestC.y + closestC.height));
      topNeighbors.set(b.id, { neighborId: closestC.id, gap });
    }
  }

  // --- 2. Calculate Longest Path Gaps to Determine Available Frame Scaling ---
  // Compute max accumulated horizontal gap along any path
  let maxPathGapX = 0;
  for (const frame of initialFrames) {
    let curGap = 0;
    let curId = frame.id;
    while (leftNeighbors.has(curId)) {
      const edge = leftNeighbors.get(curId)!;
      curGap += edge.gap;
      curId = edge.neighborId;
    }
    maxPathGapX = Math.max(maxPathGapX, curGap);
  }

  // Compute max accumulated vertical gap along any path
  let maxPathGapY = 0;
  for (const frame of initialFrames) {
    let curGap = 0;
    let curId = frame.id;
    while (topNeighbors.has(curId)) {
      const edge = topNeighbors.get(curId)!;
      curGap += edge.gap;
      curId = edge.neighborId;
    }
    maxPathGapY = Math.max(maxPathGapY, curGap);
  }

  const frameSpanX = Math.max(1, initW - maxPathGapX);
  const frameSpanY = Math.max(1, initH - maxPathGapY);

  const scaleXFromGroup = Math.max(0.05, (newGroupBounds.width - maxPathGapX) / frameSpanX);
  const scaleYFromGroup = Math.max(0.05, (newGroupBounds.height - maxPathGapY) / frameSpanY);

  const rawRatioX = initW > 0 ? newGroupBounds.width / initW : 1;
  const rawRatioY = initH > 0 ? newGroupBounds.height / initH : 1;
  const uniformScale = Math.abs(rawRatioX - 1) >= Math.abs(rawRatioY - 1)
    ? scaleXFromGroup
    : scaleYFromGroup;

  // --- 3. Compute Topologically Sorted Positions with 100% Invariant Gaps ---
  const newPositionsX = new Map<string, number>();
  const sortedByX = [...initialFrames].sort((a, b) => a.x - b.x);
  for (const f of sortedByX) {
    const leftEdge = leftNeighbors.get(f.id);
    if (leftEdge && newPositionsX.has(leftEdge.neighborId)) {
      const leftNeighbor = initialFrames.find((item) => item.id === leftEdge.neighborId)!;
      const leftNeighborNewX = newPositionsX.get(leftEdge.neighborId)!;
      const leftNeighborNewW = leftNeighbor.width * uniformScale;
      newPositionsX.set(f.id, leftNeighborNewX + leftNeighborNewW + leftEdge.gap);
    } else {
      // Root frame along X axis
      newPositionsX.set(f.id, (f.x - minGroupX) * uniformScale);
    }
  }

  const newPositionsY = new Map<string, number>();
  const sortedByY = [...initialFrames].sort((a, b) => a.y - b.y);
  for (const f of sortedByY) {
    const topEdge = topNeighbors.get(f.id);
    if (topEdge && newPositionsY.has(topEdge.neighborId)) {
      const topNeighbor = initialFrames.find((item) => item.id === topEdge.neighborId)!;
      const topNeighborNewY = newPositionsY.get(topEdge.neighborId)!;
      const topNeighborNewH = topNeighbor.height * uniformScale;
      newPositionsY.set(f.id, topNeighborNewY + topNeighborNewH + topEdge.gap);
    } else {
      // Root frame along Y axis
      newPositionsY.set(f.id, (f.y - minGroupY) * uniformScale);
    }
  }

  // --- 4. Anchor-Directional Origin Alignment ---
  const minComputedX = Math.min(...Array.from(newPositionsX.values()));
  const maxComputedX = Math.max(...sortedByX.map((f) => (newPositionsX.get(f.id) ?? 0) + f.width * uniformScale));
  const newTotalW = maxComputedX - minComputedX;

  const minComputedY = Math.min(...Array.from(newPositionsY.values()));
  const maxComputedY = Math.max(...sortedByY.map((f) => (newPositionsY.get(f.id) ?? 0) + f.height * uniformScale));
  const newTotalH = maxComputedY - minComputedY;

  let finalOriginX: number;
  let finalOriginY: number;

  if (anchor) {
    // If left handle was pulled, right edge was fixed at minGroupX + initW
    if (anchor.includes('left')) {
      finalOriginX = (minGroupX + initW) - newTotalW;
    } else {
      finalOriginX = minGroupX;
    }

    // If top handle was pulled, bottom edge was fixed at minGroupY + initH
    if (anchor.includes('top')) {
      finalOriginY = (minGroupY + initH) - newTotalH;
    } else {
      finalOriginY = minGroupY;
    }
  } else {
    // Fallback heuristic: check if group origin moved significantly (> 0.5mm)
    const isLeftDragged = newGroupBounds.x < minGroupX - 0.5 || newGroupBounds.x > minGroupX + 0.5;
    const isTopDragged = newGroupBounds.y < minGroupY - 0.5 || newGroupBounds.y > minGroupY + 0.5;

    finalOriginX = isLeftDragged
      ? minGroupX + initW - newTotalW
      : newGroupBounds.x;
    finalOriginY = isTopDragged
      ? minGroupY + initH - newTotalH
      : newGroupBounds.y;
  }

  return initialFrames.map((f) => {
    const rawX = newPositionsX.get(f.id) ?? (f.x - minGroupX) * uniformScale;
    const rawY = newPositionsY.get(f.id) ?? (f.y - minGroupY) * uniformScale;

    return {
      id: f.id,
      geometry: {
        x: roundToHundredth(finalOriginX + rawX - minComputedX),
        y: roundToHundredth(finalOriginY + rawY - minComputedY),
        width: roundToHundredth(Math.max(1, f.width * uniformScale)),
        height: roundToHundredth(Math.max(1, f.height * uniformScale)),
      },
    };
  });
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
