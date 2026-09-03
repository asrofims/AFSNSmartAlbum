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
  groupId?: string | null;
  groupRotation?: number; // collective rotation orientation for multi-selection / layout grouping

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
  locked?: boolean;
  isMissing?: boolean;
}

export interface SnapLine {
  type: 'vertical' | 'horizontal';
  position: number; // physical position along axis
  start: number;
  end: number;
  label?: string;
  kind?: 'center' | 'margin' | 'frame' | 'edge';
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

export const SNAPPING_CONFIG_STORAGE_KEY = 'afsn_snapping_config';

let memorySnappingConfig: SnappingConfig = { ...DEFAULT_SNAPPING_CONFIG };

export function loadSavedSnappingConfig(): SnappingConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SNAPPING_CONFIG_STORAGE_KEY);
      if (!raw) return memorySnappingConfig;
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SNAPPING_CONFIG.enabled,
        threshold: typeof parsed.threshold === 'number' && parsed.threshold > 0 ? parsed.threshold : DEFAULT_SNAPPING_CONFIG.threshold,
        snapToPageEdges: typeof parsed.snapToPageEdges === 'boolean' ? parsed.snapToPageEdges : DEFAULT_SNAPPING_CONFIG.snapToPageEdges,
        snapToPageCenters: typeof parsed.snapToPageCenters === 'boolean' ? parsed.snapToPageCenters : DEFAULT_SNAPPING_CONFIG.snapToPageCenters,
        snapToMargins: typeof parsed.snapToMargins === 'boolean' ? parsed.snapToMargins : DEFAULT_SNAPPING_CONFIG.snapToMargins,
        snapToFrames: typeof parsed.snapToFrames === 'boolean' ? parsed.snapToFrames : DEFAULT_SNAPPING_CONFIG.snapToFrames,
        snapToEqualGaps: typeof parsed.snapToEqualGaps === 'boolean' ? parsed.snapToEqualGaps : DEFAULT_SNAPPING_CONFIG.snapToEqualGaps,
      };
    }
    return memorySnappingConfig;
  } catch (err) {
    console.warn('[AFSN] Failed to load snapping config:', err);
    return memorySnappingConfig;
  }
}

export function saveSnappingConfig(config: SnappingConfig): void {
  try {
    memorySnappingConfig = { ...config };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SNAPPING_CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
  } catch (err) {
    console.warn('[AFSN] Failed to save snapping config to localStorage:', err);
  }
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
  const vTargets: { pos: number; label: string; kind: 'center' | 'margin' | 'frame' | 'edge' }[] = [];

  if (config.snapToPageEdges) {
    vTargets.push(
      { pos: 0, label: 'Spread Left Edge', kind: 'edge' },
      ...(gutterWidth > 0
        ? [
            { pos: spineLeft, label: 'Left Page Inner Edge', kind: 'edge' as const },
            { pos: spineRight, label: 'Right Page Inner Edge', kind: 'edge' as const },
          ]
        : []),
      { pos: spreadWidth, label: 'Spread Right Edge', kind: 'edge' }
    );
  }

  if (config.snapToPageCenters) {
    vTargets.push(
      { pos: leftPageCenter, label: 'Left Page Center', kind: 'center' },
      { pos: spineCenter, label: 'Spread Center X', kind: 'center' },
      { pos: rightPageCenter, label: 'Right Page Center', kind: 'center' }
    );
  }

  if (config.snapToMargins && safeArea > 0) {
    vTargets.push(
      { pos: safeArea, label: 'Safe Margin Left', kind: 'margin' },
      { pos: spineLeft - safeArea, label: 'Safe Margin Spine Left', kind: 'margin' },
      { pos: spineRight + safeArea, label: 'Safe Margin Spine Right', kind: 'margin' },
      { pos: spreadWidth - safeArea, label: 'Safe Margin Right', kind: 'margin' }
    );
  }

  // Key horizontal reference points on spread
  const hTargets: { pos: number; label: string; kind: 'center' | 'margin' | 'frame' | 'edge' }[] = [];

  if (config.snapToPageEdges) {
    hTargets.push(
      { pos: 0, label: 'Spread Top Edge', kind: 'edge' },
      { pos: spreadHeight, label: 'Spread Bottom Edge', kind: 'edge' }
    );
  }

  if (config.snapToPageCenters) {
    hTargets.push({ pos: spreadHeight / 2, label: 'Spread Center Y', kind: 'center' });
  }

  if (config.snapToMargins && safeArea > 0) {
    hTargets.push(
      { pos: safeArea, label: 'Safe Margin Top', kind: 'margin' },
      { pos: spreadHeight - safeArea, label: 'Safe Margin Bottom', kind: 'margin' }
    );
  }

  // Add points from other frames
  if (config.snapToFrames) {
    for (const other of otherFrames) {
      vTargets.push(
        { pos: other.x, label: 'Align Left', kind: 'frame' },
        { pos: other.x + other.width / 2, label: 'Align Center X', kind: 'center' },
        { pos: other.x + other.width, label: 'Align Right', kind: 'frame' }
      );
      hTargets.push(
        { pos: other.y, label: 'Align Top', kind: 'frame' },
        { pos: other.y + other.height / 2, label: 'Align Center Y', kind: 'center' },
        { pos: other.y + other.height, label: 'Align Bottom', kind: 'frame' }
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

  // 1. First priority: Center-to-Center Magnetic Attraction
  for (const target of vTargets) {
    if (target.kind === 'center') {
      const diffCenter = Math.abs(draggedCenterX - target.pos);
      if (diffCenter <= threshold && diffCenter < minDiffX) {
        minDiffX = diffCenter;
        bestSnapX = target.pos - dragged.width / 2;
        bestVLine = {
          type: 'vertical',
          position: target.pos,
          start: 0,
          end: spreadHeight,
          label: target.label,
          kind: 'center',
        };
      }
    }
  }

  // 2. Second priority: Edges, Margins, and Neighbor Alignment
  for (const target of vTargets) {
    // Snap dragged left edge
    const diffLeft = Math.abs(draggedLeft - target.pos);
    if (diffLeft <= threshold && diffLeft < minDiffX) {
      minDiffX = diffLeft;
      bestSnapX = target.pos;
      bestVLine = {
        type: 'vertical',
        position: target.pos,
        start: 0,
        end: spreadHeight,
        label: target.label,
        kind: target.kind,
      };
    }

    // Snap dragged right edge
    const diffRight = Math.abs(draggedRight - target.pos);
    if (diffRight <= threshold && diffRight < minDiffX) {
      minDiffX = diffRight;
      bestSnapX = target.pos - dragged.width;
      bestVLine = {
        type: 'vertical',
        position: target.pos,
        start: 0,
        end: spreadHeight,
        label: target.label,
        kind: target.kind,
      };
    }

    // Non-center target matching center if not already snapped
    if (target.kind !== 'center') {
      const diffCenter = Math.abs(draggedCenterX - target.pos);
      if (diffCenter <= threshold && diffCenter < minDiffX) {
        minDiffX = diffCenter;
        bestSnapX = target.pos - dragged.width / 2;
        bestVLine = {
          type: 'vertical',
          position: target.pos,
          start: 0,
          end: spreadHeight,
          label: target.label,
          kind: target.kind,
        };
      }
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

  // 1. First priority: Center-to-Center Magnetic Attraction
  for (const target of hTargets) {
    if (target.kind === 'center') {
      const diffCenter = Math.abs(draggedCenterY - target.pos);
      if (diffCenter <= threshold && diffCenter < minDiffY) {
        minDiffY = diffCenter;
        bestSnapY = target.pos - dragged.height / 2;
        bestHLine = {
          type: 'horizontal',
          position: target.pos,
          start: 0,
          end: spreadWidth,
          label: target.label,
          kind: 'center',
        };
      }
    }
  }

  // 2. Second priority: Edges, Margins, and Neighbor Alignment
  for (const target of hTargets) {
    // Snap dragged top edge
    const diffTop = Math.abs(draggedTop - target.pos);
    if (diffTop <= threshold && diffTop < minDiffY) {
      minDiffY = diffTop;
      bestSnapY = target.pos;
      bestHLine = {
        type: 'horizontal',
        position: target.pos,
        start: 0,
        end: spreadWidth,
        label: target.label,
        kind: target.kind,
      };
    }

    // Snap dragged bottom edge
    const diffBottom = Math.abs(draggedBottom - target.pos);
    if (diffBottom <= threshold && diffBottom < minDiffY) {
      minDiffY = diffBottom;
      bestSnapY = target.pos - dragged.height;
      bestHLine = {
        type: 'horizontal',
        position: target.pos,
        start: 0,
        end: spreadWidth,
        label: target.label,
        kind: target.kind,
      };
    }

    // Non-center target matching center if not already snapped
    if (target.kind !== 'center') {
      const diffCenter = Math.abs(draggedCenterY - target.pos);
      if (diffCenter <= threshold && diffCenter < minDiffY) {
        minDiffY = diffCenter;
        bestSnapY = target.pos - dragged.height / 2;
        bestHLine = {
          type: 'horizontal',
          position: target.pos,
          start: 0,
          end: spreadWidth,
          label: target.label,
          kind: target.kind,
        };
      }
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
 * Calculates smart resize snapping to match neighbor frame dimensions, primary collinear edge alignments,
 * and Spread Safe Zone Margins (Blue Guides), Center Spine, and Spread Boundaries.
 */
export function calculateResizeSnapping(
  current: RectBounds,
  spreadWidth: number,
  spreadHeight: number,
  safeArea: number,
  gutterWidth: number,
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

  // Spine coordinates
  const singlePageWidth = (spreadWidth - gutterWidth) / 2;
  const spineLeft = singlePageWidth;
  const spineRight = singlePageWidth + gutterWidth;

  // 1. Primary: Dimension Matching (Equal Width / Equal Height against other frames)
  let bestWidthDiff = threshold + 1;
  let bestWidthMatch: { other: RectBounds; val: number } | null = null;

  let bestHeightDiff = threshold + 1;
  let bestHeightMatch: { other: RectBounds; val: number } | null = null;

  for (const other of otherFrames) {
    if (isWidthResizable) {
      const wDiff = Math.abs(width - other.width);
      if (wDiff <= threshold && wDiff < bestWidthDiff) {
        bestWidthDiff = wDiff;
        bestWidthMatch = { other, val: other.width };
      }
    }

    if (isHeightResizable) {
      const hDiff = Math.abs(height - other.height);
      if (hDiff <= threshold && hDiff < bestHeightDiff) {
        bestHeightDiff = hDiff;
        bestHeightMatch = { other, val: other.height };
      }
    }
  }

  // Apply Dimension Snap
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
  } else if (bestWidthMatch) {
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

  // 2. Secondary & Edge Snapping: Safe Area Margins, Spine, Spread Boundaries, and Other Frames
  // Build Vertical Targets (X lines)
  const verticalTargets: { pos: number; label: string; start?: number; end?: number }[] = [];
  if (safeArea > 0) {
    verticalTargets.push(
      { pos: safeArea, label: 'Safe Margin Left' },
      { pos: spineLeft - safeArea, label: 'Safe Margin Left Inner' },
      { pos: spineRight + safeArea, label: 'Safe Margin Right Inner' },
      { pos: spreadWidth - safeArea, label: 'Safe Margin Right' }
    );
  }
  verticalTargets.push(
    { pos: 0, label: 'Spread Left' },
    { pos: singlePageWidth / 2, label: 'Left Page Center' },
    { pos: spineLeft, label: 'Spine Left' },
    { pos: spreadWidth / 2, label: 'Spread Center X' },
    { pos: spineRight, label: 'Spine Right' },
    { pos: spineRight + singlePageWidth / 2, label: 'Right Page Center' },
    { pos: spreadWidth, label: 'Spread Right' }
  );
  for (const o of otherFrames) {
    verticalTargets.push(
      { pos: o.x, label: 'Align Left', start: o.y, end: o.y + o.height },
      { pos: o.x + o.width, label: 'Align Right', start: o.y, end: o.y + o.height }
    );
  }

  // Build Horizontal Targets (Y lines)
  const horizontalTargets: { pos: number; label: string; start?: number; end?: number }[] = [];
  if (safeArea > 0) {
    horizontalTargets.push(
      { pos: safeArea, label: 'Safe Margin Top' },
      { pos: spreadHeight - safeArea, label: 'Safe Margin Bottom' }
    );
  }
  horizontalTargets.push(
    { pos: 0, label: 'Spread Top' },
    { pos: spreadHeight / 2, label: 'Spread Center Y' },
    { pos: spreadHeight, label: 'Spread Bottom' }
  );
  for (const o of otherFrames) {
    horizontalTargets.push(
      { pos: o.y, label: 'Align Top', start: o.x, end: o.x + o.width },
      { pos: o.y + o.height, label: 'Align Bottom', start: o.x, end: o.x + o.width }
    );
  }

  // Check Vertical Edge Snapping (if width is resizable and no conflicting dimension snap line)
  if (snapLines.filter((l) => l.type === 'vertical').length === 0 && isWidthResizable) {
    let bestVDiff = threshold + 1;
    let bestVTarget: (typeof verticalTargets)[0] | null = null;
    let isVLeft = false;

    if (isLeftAnchor) {
      for (const t of verticalTargets) {
        const diff = Math.abs(x - t.pos);
        if (diff <= threshold && diff < bestVDiff) {
          bestVDiff = diff;
          bestVTarget = t;
          isVLeft = true;
        }
      }
    } else if (isRightAnchor) {
      for (const t of verticalTargets) {
        const diff = Math.abs(right - t.pos);
        if (diff <= threshold && diff < bestVDiff) {
          bestVDiff = diff;
          bestVTarget = t;
          isVLeft = false;
        }
      }
    }

    if (bestVTarget) {
      if (isVLeft) {
        const newX = bestVTarget.pos;
        const newW = (x + width) - newX;
        if (newW >= 4) {
          x = newX;
          width = newW;
          if (isCorner) {
            const newH = width / aspect;
            const diffH = newH - height;
            if (isTopAnchor) y = y - diffH;
            height = newH;
          }
          snapLines.push({
            type: 'vertical',
            position: bestVTarget.pos,
            start: Math.min(y, bestVTarget.start ?? 0),
            end: Math.max(y + height, bestVTarget.end ?? spreadHeight),
            label: bestVTarget.label,
          });
        }
      } else {
        const newW = bestVTarget.pos - x;
        if (newW >= 4) {
          width = newW;
          if (isCorner) {
            const newH = width / aspect;
            const diffH = newH - height;
            if (isTopAnchor) y = y - diffH;
            height = newH;
          }
          snapLines.push({
            type: 'vertical',
            position: bestVTarget.pos,
            start: Math.min(y, bestVTarget.start ?? 0),
            end: Math.max(y + height, bestVTarget.end ?? spreadHeight),
            label: bestVTarget.label,
          });
        }
      }
    }
  }

  // Check Horizontal Edge Snapping (if height is resizable and no conflicting dimension snap line)
  if (snapLines.filter((l) => l.type === 'horizontal').length === 0 && isHeightResizable) {
    let bestHDiff = threshold + 1;
    let bestHTarget: (typeof horizontalTargets)[0] | null = null;
    let isHTop = false;

    if (isTopAnchor) {
      for (const t of horizontalTargets) {
        const diff = Math.abs(y - t.pos);
        if (diff <= threshold && diff < bestHDiff) {
          bestHDiff = diff;
          bestHTarget = t;
          isHTop = true;
        }
      }
    } else if (isBottomAnchor) {
      for (const t of horizontalTargets) {
        const diff = Math.abs(bottom - t.pos);
        if (diff <= threshold && diff < bestHDiff) {
          bestHDiff = diff;
          bestHTarget = t;
          isHTop = false;
        }
      }
    }

    if (bestHTarget) {
      if (isHTop) {
        const newY = bestHTarget.pos;
        const newH = (y + height) - newY;
        if (newH >= 4) {
          y = newY;
          height = newH;
          if (isCorner) {
            const newW = height * aspect;
            const diffW = newW - width;
            if (isLeftAnchor) x = x - diffW;
            width = newW;
          }
          snapLines.push({
            type: 'horizontal',
            position: bestHTarget.pos,
            start: Math.min(x, bestHTarget.start ?? 0),
            end: Math.max(x + width, bestHTarget.end ?? spreadWidth),
            label: bestHTarget.label,
          });
        }
      } else {
        const newH = bestHTarget.pos - y;
        if (newH >= 4) {
          height = newH;
          if (isCorner) {
            const newW = height * aspect;
            const diffW = newW - width;
            if (isLeftAnchor) x = x - diffW;
            width = newW;
          }
          snapLines.push({
            type: 'horizontal',
            position: bestHTarget.pos,
            start: Math.min(x, bestHTarget.start ?? 0),
            end: Math.max(x + width, bestHTarget.end ?? spreadWidth),
            label: bestHTarget.label,
          });
        }
      }
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
 * Represents a composite layout entity (either a single independent frame or a grouped cluster of frames).
 */
export interface LayoutEntity {
  id: string; // groupId if group, or frameId if standalone
  isGroup: boolean;
  frames: PhotoFrameElement[];
  x: number;      // minX of all member frames
  y: number;      // minY of all member frames
  width: number;  // maxX - minX
  height: number; // maxY - minY
}

/**
 * Clusters an array of frames into LayoutEntities based on their groupId.
 * All frames sharing a non-empty groupId form a single composite LayoutEntity (rigid bounding box).
 * Standalone frames without groupId form individual 1-frame LayoutEntities.
 */
export function clusterFramesIntoEntities(frames: PhotoFrameElement[]): LayoutEntity[] {
  const groupMap = new Map<string, PhotoFrameElement[]>();
  const standaloneFrames: PhotoFrameElement[] = [];

  for (const frame of frames) {
    if (frame.groupId) {
      const existing = groupMap.get(frame.groupId) || [];
      existing.push(frame);
      groupMap.set(frame.groupId, existing);
    } else {
      standaloneFrames.push(frame);
    }
  }

  const entities: LayoutEntity[] = [];

  // Add grouped entities
  for (const [groupId, groupFrames] of groupMap.entries()) {
    const minX = Math.min(...groupFrames.map((f) => f.x));
    const minY = Math.min(...groupFrames.map((f) => f.y));
    const maxX = Math.max(...groupFrames.map((f) => f.x + f.width));
    const maxY = Math.max(...groupFrames.map((f) => f.y + f.height));

    entities.push({
      id: groupId,
      isGroup: true,
      frames: groupFrames,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  }

  // Add standalone frame entities
  for (const frame of standaloneFrames) {
    entities.push({
      id: frame.id,
      isGroup: false,
      frames: [frame],
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    });
  }

  return entities;
}

export interface SafeMarginBounds {
  singlePageWidth: number;
  spreadHeight: number;
  gutterWidth: number;
  safeMargin: number;
}

/**
 * Calculates batch alignment updates for selected frames.
 * - When 2+ independent entities are selected: Aligns entities relative to their composite bounding box.
 * - When a single entity (single standalone frame OR single group) is selected:
 *   Aligns the entity to the active page's Blue Safe Margin Box (or spread safe margins if spanning both pages).
 * Groups of frames are always treated as single rigid entities, preserving their internal relative layout.
 */
export function alignFrames(
  frames: PhotoFrameElement[],
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  safeMarginBounds?: SafeMarginBounds
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  const entities = clusterFramesIntoEntities(frames);
  if (entities.length === 0) return [];

  const updates: { id: string; geometry: Partial<PhotoFrameElement> }[] = [];

  // SINGLE ENTITY (Single Frame OR Single Group): Align against Blue Safe Margin Box
  if (entities.length === 1 && safeMarginBounds) {
    const entity = entities[0];
    if (!entity) return [];
    const { singlePageWidth, spreadHeight, gutterWidth, safeMargin } = safeMarginBounds;
    const totalSpreadWidth = singlePageWidth * 2 + gutterWidth;
    const spineLeft = singlePageWidth;
    const spineRight = singlePageWidth + gutterWidth;
    const spineCenter = singlePageWidth + gutterWidth / 2;

    const entityCenterX = entity.x + entity.width / 2;
    const spansBothPages = entity.x < spineLeft && entity.x + entity.width > spineRight;

    let refMinX: number;
    let refMaxX: number;
    let refCenterX: number;

    if (spansBothPages) {
      // Panoramic / Full Spread Safe Margin Box
      refMinX = safeMargin;
      refMaxX = totalSpreadWidth - safeMargin;
      refCenterX = totalSpreadWidth / 2;
    } else if (entityCenterX < spineCenter) {
      // Left Page Blue Safe Margin Box
      refMinX = safeMargin;
      refMaxX = singlePageWidth - safeMargin;
      refCenterX = (refMinX + refMaxX) / 2;
    } else {
      // Right Page Blue Safe Margin Box
      refMinX = singlePageWidth + gutterWidth + safeMargin;
      refMaxX = totalSpreadWidth - safeMargin;
      refCenterX = (refMinX + refMaxX) / 2;
    }

    const refMinY = safeMargin;
    const refMaxY = spreadHeight - safeMargin;
    const refMiddleY = spreadHeight / 2;

    let deltaX = 0;
    let deltaY = 0;
    let applyX = false;
    let applyY = false;

    switch (alignment) {
      case 'left':
        deltaX = refMinX - entity.x;
        applyX = true;
        break;
      case 'center':
        deltaX = refCenterX - entity.width / 2 - entity.x;
        applyX = true;
        break;
      case 'right':
        deltaX = refMaxX - entity.width - entity.x;
        applyX = true;
        break;
      case 'top':
        deltaY = refMinY - entity.y;
        applyY = true;
        break;
      case 'middle':
        deltaY = refMiddleY - entity.height / 2 - entity.y;
        applyY = true;
        break;
      case 'bottom':
        deltaY = refMaxY - entity.height - entity.y;
        applyY = true;
        break;
    }

    for (const f of entity.frames) {
      const geometry: Partial<PhotoFrameElement> = {};
      if (applyX) geometry.x = roundToTenth(f.x + deltaX);
      if (applyY) geometry.y = roundToTenth(f.y + deltaY);
      updates.push({ id: f.id, geometry });
    }

    return updates;
  }

  // MULTIPLE ENTITIES (2+ Standalone Frames or Groups): Align relative to selection bounds
  if (entities.length < 2) return [];

  const minX = Math.min(...entities.map((e) => e.x));
  const maxX = Math.max(...entities.map((e) => e.x + e.width));
  const minY = Math.min(...entities.map((e) => e.y));
  const maxY = Math.max(...entities.map((e) => e.y + e.height));
  const centerX = (minX + maxX) / 2;
  const middleY = (minY + maxY) / 2;

  for (const entity of entities) {
    let deltaX = 0;
    let deltaY = 0;
    let applyX = false;
    let applyY = false;

    switch (alignment) {
      case 'left':
        deltaX = minX - entity.x;
        applyX = true;
        break;
      case 'center':
        deltaX = centerX - entity.width / 2 - entity.x;
        applyX = true;
        break;
      case 'right':
        deltaX = maxX - entity.width - entity.x;
        applyX = true;
        break;
      case 'top':
        deltaY = minY - entity.y;
        applyY = true;
        break;
      case 'middle':
        deltaY = middleY - entity.height / 2 - entity.y;
        applyY = true;
        break;
      case 'bottom':
        deltaY = maxY - entity.height - entity.y;
        applyY = true;
        break;
    }

    for (const f of entity.frames) {
      const geometry: Partial<PhotoFrameElement> = {};
      if (applyX) geometry.x = roundToTenth(f.x + deltaX);
      if (applyY) geometry.y = roundToTenth(f.y + deltaY);
      updates.push({ id: f.id, geometry });
    }
  }

  return updates;
}

/**
 * Calculates equidistant gap distribution updates for multiple selected entities (standalone frames or groups).
 * Keeps the outermost bounds intact and distributes equal gaps between all entities while preserving group interiors.
 */
export function distributeFrames(
  frames: PhotoFrameElement[],
  direction: 'horizontal' | 'vertical'
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  const entities = clusterFramesIntoEntities(frames);
  if (entities.length < 3) return [];

  const updates: { id: string; geometry: Partial<PhotoFrameElement> }[] = [];

  if (direction === 'horizontal') {
    const sorted = [...entities].sort((a, b) => a.x - b.x || a.y - b.y);
    if (!sorted[0]) return [];
    const minX = sorted[0].x;
    const maxRight = Math.max(...sorted.map((e) => e.x + e.width));
    const totalEntitiesW = sorted.reduce((sum, e) => sum + e.width, 0);
    const totalSpan = maxRight - minX;
    const availableGap = Math.max(0, totalSpan - totalEntitiesW);
    const gapPerItem = availableGap / (sorted.length - 1);

    let cumulativeWidth = 0;
    sorted.forEach((entity, i) => {
      const targetEntityX = minX + cumulativeWidth + i * gapPerItem;
      const deltaX = targetEntityX - entity.x;
      for (const f of entity.frames) {
        updates.push({
          id: f.id,
          geometry: { x: roundToHundredth(f.x + deltaX) },
        });
      }
      cumulativeWidth += entity.width;
    });
  } else {
    const sorted = [...entities].sort((a, b) => a.y - b.y || a.x - b.x);
    if (!sorted[0]) return [];
    const minY = sorted[0].y;
    const maxBottom = Math.max(...sorted.map((e) => e.y + e.height));
    const totalEntitiesH = sorted.reduce((sum, e) => sum + e.height, 0);
    const totalSpan = maxBottom - minY;
    const availableGap = Math.max(0, totalSpan - totalEntitiesH);
    const gapPerItem = availableGap / (sorted.length - 1);

    let cumulativeHeight = 0;
    sorted.forEach((entity, i) => {
      const targetEntityY = minY + cumulativeHeight + i * gapPerItem;
      const deltaY = targetEntityY - entity.y;
      for (const f of entity.frames) {
        updates.push({
          id: f.id,
          geometry: { y: roundToHundredth(f.y + deltaY) },
        });
      }
      cumulativeHeight += entity.height;
    });
  }

  return updates;
}

/**
 * Applies a fixed custom gap spacing between multiple entities (standalone frames or groups)
 * starting from the first entity's position. Groups move as rigid units without breaking internal gaps.
 */
export function applyFixedGap(
  frames: PhotoFrameElement[],
  direction: 'horizontal' | 'vertical',
  gap: number
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  const entities = clusterFramesIntoEntities(frames);
  if (entities.length < 2) return [];

  const updates: { id: string; geometry: Partial<PhotoFrameElement> }[] = [];

  if (direction === 'horizontal') {
    const sorted = [...entities].sort((a, b) => a.x - b.x || a.y - b.y);
    if (!sorted[0]) return [];
    let currentX = sorted[0].x;

    for (const entity of sorted) {
      const deltaX = currentX - entity.x;
      for (const f of entity.frames) {
        updates.push({
          id: f.id,
          geometry: { x: roundToHundredth(f.x + deltaX) },
        });
      }
      currentX += entity.width + gap;
    }
  } else {
    const sorted = [...entities].sort((a, b) => a.y - b.y || a.x - b.x);
    if (!sorted[0]) return [];
    let currentY = sorted[0].y;

    for (const entity of sorted) {
      const deltaY = currentY - entity.y;
      for (const f of entity.frames) {
        updates.push({
          id: f.id,
          geometry: { y: roundToHundredth(f.y + deltaY) },
        });
      }
      currentY += entity.height + gap;
    }
  }

  return updates;
}

export interface FrameBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  groupRotation?: number;
  type?: string;
  style?: any;
  styledRanges?: any[];
}

/**
 * Computes the axis-aligned visual bounding box of a photo frame in spread coordinates,
 * taking its rotation angle into account.
 */
export function getFrameVisualBounds(frame: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): RectBounds {
  const rot = frame.rotation || 0;
  if (Math.abs(rot % 360) < 0.001) {
    return {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    };
  }

  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const w = frame.width;
  const h = frame.height;

  const x0 = 0;
  const y0 = 0;
  const x1 = w * cos;
  const y1 = w * sin;
  const x2 = w * cos - h * sin;
  const y2 = w * sin + h * cos;
  const x3 = -h * sin;
  const y3 = h * cos;

  const minRelX = Math.min(x0, x1, x2, x3);
  const maxRelX = Math.max(x0, x1, x2, x3);
  const minRelY = Math.min(y0, y1, y2, y3);
  const maxRelY = Math.max(y0, y1, y2, y3);

  return {
    x: roundToHundredth(frame.x + minRelX),
    y: roundToHundredth(frame.y + minRelY),
    width: roundToHundredth(maxRelX - minRelX),
    height: roundToHundredth(maxRelY - minRelY),
  };
}

/**
 * Accurately checks if a rectangular marquee intersects a potentially rotated photo frame,
 * using the Separating Axis Theorem (SAT) for exact oriented polygon collision detection.
 */
export function doesMarqueeIntersectFrame(
  marquee: RectBounds,
  frame: { x: number; y: number; width: number; height: number; rotation?: number }
): boolean {
  const rot = frame.rotation || 0;
  // If not rotated, standard fast AABB check
  if (Math.abs(rot % 360) < 0.001) {
    return intersectRect(marquee, {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    });
  }

  // Broad phase: Visual AABB check
  const visualBounds = getFrameVisualBounds(frame);
  if (!intersectRect(marquee, visualBounds)) {
    return false;
  }

  // Narrow phase: Separating Axis Theorem (SAT) for 2D OBB vs AABB
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const w = frame.width;
  const h = frame.height;

  // 4 corners of the rotated frame
  const frameCorners = [
    { x: frame.x, y: frame.y },
    { x: frame.x + w * cos, y: frame.y + w * sin },
    { x: frame.x + w * cos - h * sin, y: frame.y + w * sin + h * cos },
    { x: frame.x - h * sin, y: frame.y + h * cos },
  ];

  // 4 corners of the marquee
  const marqueeCorners = [
    { x: marquee.x, y: marquee.y },
    { x: marquee.x + marquee.width, y: marquee.y },
    { x: marquee.x + marquee.width, y: marquee.y + marquee.height },
    { x: marquee.x, y: marquee.y + marquee.height },
  ];

  // Test axes: 2 from marquee (X: (1, 0), Y: (0, 1)) + 2 from rotated frame ((cos, sin), (-sin, cos))
  const axes = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: cos, y: sin },
    { x: -sin, y: cos },
  ];

  for (const axis of axes) {
    // Project frame corners onto axis
    let minA = Infinity;
    let maxA = -Infinity;
    for (const pt of frameCorners) {
      const dot = pt.x * axis.x + pt.y * axis.y;
      if (dot < minA) minA = dot;
      if (dot > maxA) maxA = dot;
    }

    // Project marquee corners onto axis
    let minB = Infinity;
    let maxB = -Infinity;
    for (const pt of marqueeCorners) {
      const dot = pt.x * axis.x + pt.y * axis.y;
      if (dot < minB) minB = dot;
      if (dot > maxB) maxB = dot;
    }

    // If there is a separating axis with no overlap, they do not intersect
    if (maxA < minB || maxB < minA) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates resized dimensions and positions for multiple frames while strictly preserving
 * the exact inter-frame gap spacing (both horizontally and vertically) across any layout topology,
 * fully supporting rotated frames with center pivot invariance.
 */
export type ResizedFrameUpdate = {
  id: string;
  geometry: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    groupRotation?: number;
    style?: any;
    styledRanges?: any[];
    [key: string]: any;
  };
};

export function calculateMultiFrameResize(
  initialFrames: FrameBounds[],
  initialGroupBounds: RectBounds,
  newGroupBounds: RectBounds,
  anchor?: string,
  mode: 'proportional' | 'fixed_gap' = 'proportional'
): ResizedFrameUpdate[] {
  if (initialFrames.length === 0) return [];

  // Compute visual bounds for all initial frames
  const visualMap = new Map<string, RectBounds>();
  for (const f of initialFrames) {
    visualMap.set(f.id, getFrameVisualBounds(f));
  }

  if (initialFrames.length === 1) {
    const f = initialFrames[0];
    if (!f) return [];
    const uniformScale = initialGroupBounds.width > 0 ? newGroupBounds.width / initialGroupBounds.width : 1;
    const newWidth = roundToHundredth(Math.max(1, f.width * uniformScale));
    const newHeight = roundToHundredth(Math.max(1, f.height * uniformScale));
    const newCenterX = newGroupBounds.x + newGroupBounds.width / 2;
    const newCenterY = newGroupBounds.y + newGroupBounds.height / 2;
    const rad = ((f.rotation || 0) * Math.PI) / 180;
    const finalX = newCenterX - ((newWidth / 2) * Math.cos(rad) - (newHeight / 2) * Math.sin(rad));
    const finalY = newCenterY - ((newWidth / 2) * Math.sin(rad) + (newHeight / 2) * Math.cos(rad));

    const isText = (f as any)?.type === 'text';
    const textStyle = isText ? (f as any)?.style : undefined;
    let newStyle = undefined;
    let newStyledRanges = undefined;

    if (isText && textStyle) {
      const currentFontSize = textStyle.fontSize || 24;
      const newFontSize = Math.max(1, Math.min(200, Math.round((currentFontSize * uniformScale) * 10) / 10));
      newStyle = {
        ...textStyle,
        fontSize: newFontSize,
      };
      const origRanges = (f as any)?.styledRanges;
      if (origRanges && Array.isArray(origRanges)) {
        newStyledRanges = origRanges.map((r: any) => ({
          ...r,
          fontSize: r.fontSize ? Math.max(1, Math.min(200, Math.round((r.fontSize * uniformScale) * 10) / 10)) : undefined,
        }));
      }
    }

    return [{
      id: f.id,
      geometry: {
        x: roundToHundredth(finalX),
        y: roundToHundredth(finalY),
        width: newWidth,
        height: newHeight,
        ...(isText && newStyle ? { style: newStyle } : {}),
        ...(isText && newStyledRanges ? { styledRanges: newStyledRanges } : {}),
      },
    }];
  }

  const visualBoxes = initialFrames.map((f) => visualMap.get(f.id)!);
  const minGroupX = Math.min(...visualBoxes.map((b) => b.x));
  const minGroupY = Math.min(...visualBoxes.map((b) => b.y));
  const maxGroupX = Math.max(...visualBoxes.map((b) => b.x + b.width));
  const maxGroupY = Math.max(...visualBoxes.map((b) => b.y + b.height));
  const initW = maxGroupX - minGroupX;
  const initH = maxGroupY - minGroupY;

  // --- PROPORTIONAL VISUAL GAP MODE (Preserves constant visual proportion of gaps & frames) ---
  if (mode === 'proportional') {
    const scaleX = initW > 0 ? newGroupBounds.width / initW : 1;
    const scaleY = initH > 0 ? newGroupBounds.height / initH : 1;
    const scale = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;

    const newTotalW = initW * scale;
    const newTotalH = initH * scale;

    let finalOriginX: number;
    let finalOriginY: number;

    if (anchor) {
      if (anchor.includes('left')) {
        finalOriginX = (minGroupX + initW) - newTotalW;
      } else {
        finalOriginX = minGroupX;
      }
      if (anchor.includes('top')) {
        finalOriginY = (minGroupY + initH) - newTotalH;
      } else {
        finalOriginY = minGroupY;
      }
    } else {
      const isLeftDragged = newGroupBounds.x < minGroupX - 0.5 || newGroupBounds.x > minGroupX + 0.5;
      const isTopDragged = newGroupBounds.y < minGroupY - 0.5 || newGroupBounds.y > minGroupY + 0.5;
      finalOriginX = isLeftDragged ? minGroupX + initW - newTotalW : newGroupBounds.x;
      finalOriginY = isTopDragged ? minGroupY + initH - newTotalH : newGroupBounds.y;
    }

    return initialFrames.map((f) => {
      const vb = visualMap.get(f.id)!;
      const newVbX = finalOriginX + (vb.x - minGroupX) * scale;
      const newVbY = finalOriginY + (vb.y - minGroupY) * scale;
      const newVbW = vb.width * scale;
      const newVbH = vb.height * scale;
      const newCenterX = newVbX + newVbW / 2;
      const newCenterY = newVbY + newVbH / 2;
      const newWidth = roundToHundredth(Math.max(1, f.width * scale));
      const newHeight = roundToHundredth(Math.max(1, f.height * scale));

      const rad = ((f.rotation || 0) * Math.PI) / 180;
      const finalX = newCenterX - ((newWidth / 2) * Math.cos(rad) - (newHeight / 2) * Math.sin(rad));
      const finalY = newCenterY - ((newWidth / 2) * Math.sin(rad) + (newHeight / 2) * Math.cos(rad));

      const isText = (f as any)?.type === 'text';
      const textStyle = isText ? (f as any)?.style : undefined;
      let newStyle = undefined;
      let newStyledRanges = undefined;

      if (isText && textStyle) {
        const currentFontSize = textStyle.fontSize || 24;
        const newFontSize = Math.max(1, Math.min(200, Math.round((currentFontSize * scale) * 10) / 10));
        newStyle = {
          ...textStyle,
          fontSize: newFontSize,
        };
        const origRanges = (f as any)?.styledRanges;
        if (origRanges && Array.isArray(origRanges)) {
          newStyledRanges = origRanges.map((r: any) => ({
            ...r,
            fontSize: r.fontSize ? Math.max(1, Math.min(200, Math.round((r.fontSize * scale) * 10) / 10)) : undefined,
          }));
        }
      }

      return {
        id: f.id,
        geometry: {
          x: roundToHundredth(finalX),
          y: roundToHundredth(finalY),
          width: newWidth,
          height: newHeight,
          ...(isText && newStyle ? { style: newStyle } : {}),
          ...(isText && newStyledRanges ? { styledRanges: newStyledRanges } : {}),
        },
      };
    });
  }

  // --- FIXED GAP MODE ---
  // 1. Build 2D Spatial Neighbor Relations from Visual Bounds
  const leftNeighbors = new Map<string, { neighborId: string; gap: number }>();
  for (const b of initialFrames) {
    const vb = visualMap.get(b.id)!;
    let closestA: FrameBounds | null = null;
    let closestDist = -Infinity;

    for (const a of initialFrames) {
      if (a.id === b.id) continue;
      const va = visualMap.get(a.id)!;
      const rightEdgeA = va.x + va.width;
      if (rightEdgeA <= vb.x + 0.1) {
        const overlapY = Math.min(va.y + va.height, vb.y + vb.height) - Math.max(va.y, vb.y);
        if (overlapY > 0.5) {
          if (rightEdgeA > closestDist) {
            closestDist = rightEdgeA;
            closestA = a;
          }
        }
      }
    }

    if (closestA) {
      const va = visualMap.get(closestA.id)!;
      const gap = Math.max(0, vb.x - (va.x + va.width));
      leftNeighbors.set(b.id, { neighborId: closestA.id, gap });
    }
  }

  const topNeighbors = new Map<string, { neighborId: string; gap: number }>();
  for (const b of initialFrames) {
    const vb = visualMap.get(b.id)!;
    let closestC: FrameBounds | null = null;
    let closestDist = -Infinity;

    for (const c of initialFrames) {
      if (c.id === b.id) continue;
      const vc = visualMap.get(c.id)!;
      const bottomEdgeC = vc.y + vc.height;
      if (bottomEdgeC <= vb.y + 0.1) {
        const overlapX = Math.min(vc.x + vc.width, vb.x + vb.width) - Math.max(vc.x, vb.x);
        if (overlapX > 0.5) {
          if (bottomEdgeC > closestDist) {
            closestDist = bottomEdgeC;
            closestC = c;
          }
        }
      }
    }

    if (closestC) {
      const vc = visualMap.get(closestC.id)!;
      const gap = Math.max(0, vb.y - (vc.y + vc.height));
      topNeighbors.set(b.id, { neighborId: closestC.id, gap });
    }
  }

  // 2. Longest Path Gaps
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

  // 3. Topologically Sorted Positions
  const newPositionsX = new Map<string, number>();
  const sortedByX = [...initialFrames].sort((a, b) => visualMap.get(a.id)!.x - visualMap.get(b.id)!.x);
  for (const f of sortedByX) {
    const vf = visualMap.get(f.id)!;
    const leftEdge = leftNeighbors.get(f.id);
    if (leftEdge && newPositionsX.has(leftEdge.neighborId)) {
      const leftNeighbor = initialFrames.find((item) => item.id === leftEdge.neighborId)!;
      const leftNeighborNewX = newPositionsX.get(leftEdge.neighborId)!;
      const leftNeighborNewW = visualMap.get(leftNeighbor.id)!.width * uniformScale;
      newPositionsX.set(f.id, leftNeighborNewX + leftNeighborNewW + leftEdge.gap);
    } else {
      newPositionsX.set(f.id, (vf.x - minGroupX) * uniformScale);
    }
  }

  const newPositionsY = new Map<string, number>();
  const sortedByY = [...initialFrames].sort((a, b) => visualMap.get(a.id)!.y - visualMap.get(b.id)!.y);
  for (const f of sortedByY) {
    const vf = visualMap.get(f.id)!;
    const topEdge = topNeighbors.get(f.id);
    if (topEdge && newPositionsY.has(topEdge.neighborId)) {
      const topNeighbor = initialFrames.find((item) => item.id === topEdge.neighborId)!;
      const topNeighborNewY = newPositionsY.get(topEdge.neighborId)!;
      const topNeighborNewH = visualMap.get(topNeighbor.id)!.height * uniformScale;
      newPositionsY.set(f.id, topNeighborNewY + topNeighborNewH + topEdge.gap);
    } else {
      newPositionsY.set(f.id, (vf.y - minGroupY) * uniformScale);
    }
  }

  // 4. Anchor-Directional Origin Alignment
  const minComputedX = Math.min(...Array.from(newPositionsX.values()));
  const maxComputedX = Math.max(...sortedByX.map((f) => (newPositionsX.get(f.id) ?? 0) + visualMap.get(f.id)!.width * uniformScale));
  const newTotalW = maxComputedX - minComputedX;

  const minComputedY = Math.min(...Array.from(newPositionsY.values()));
  const maxComputedY = Math.max(...sortedByY.map((f) => (newPositionsY.get(f.id) ?? 0) + visualMap.get(f.id)!.height * uniformScale));
  const newTotalH = maxComputedY - minComputedY;

  let finalOriginX: number;
  let finalOriginY: number;

  if (anchor) {
    if (anchor.includes('left')) {
      finalOriginX = (minGroupX + initW) - newTotalW;
    } else {
      finalOriginX = minGroupX;
    }
    if (anchor.includes('top')) {
      finalOriginY = (minGroupY + initH) - newTotalH;
    } else {
      finalOriginY = minGroupY;
    }
  } else {
    const isLeftDragged = newGroupBounds.x < minGroupX - 0.5 || newGroupBounds.x > minGroupX + 0.5;
    const isTopDragged = newGroupBounds.y < minGroupY - 0.5 || newGroupBounds.y > minGroupY + 0.5;
    finalOriginX = isLeftDragged ? minGroupX + initW - newTotalW : newGroupBounds.x;
    finalOriginY = isTopDragged ? minGroupY + initH - newTotalH : newGroupBounds.y;
  }

  return initialFrames.map((f) => {
    const vf = visualMap.get(f.id)!;
    const rawX = newPositionsX.get(f.id) ?? (vf.x - minGroupX) * uniformScale;
    const rawY = newPositionsY.get(f.id) ?? (vf.y - minGroupY) * uniformScale;
    const newVbX = finalOriginX + rawX - minComputedX;
    const newVbY = finalOriginY + rawY - minComputedY;
    const newVbW = vf.width * uniformScale;
    const newVbH = vf.height * uniformScale;
    const newCenterX = newVbX + newVbW / 2;
    const newCenterY = newVbY + newVbH / 2;
    const newWidth = roundToHundredth(Math.max(1, f.width * uniformScale));
    const newHeight = roundToHundredth(Math.max(1, f.height * uniformScale));

    const rad = ((f.rotation || 0) * Math.PI) / 180;
    const finalX = newCenterX - ((newWidth / 2) * Math.cos(rad) - (newHeight / 2) * Math.sin(rad));
    const finalY = newCenterY - ((newWidth / 2) * Math.sin(rad) + (newHeight / 2) * Math.cos(rad));

    const isText = (f as any)?.type === 'text';
    const textStyle = isText ? (f as any)?.style : undefined;
    let newStyle = undefined;
    let newStyledRanges = undefined;

    if (isText && textStyle) {
      const currentFontSize = textStyle.fontSize || 24;
      const newFontSize = Math.max(1, Math.min(200, Math.round((currentFontSize * uniformScale) * 10) / 10));
      newStyle = {
        ...textStyle,
        fontSize: newFontSize,
      };
      const origRanges = (f as any)?.styledRanges;
      if (origRanges && Array.isArray(origRanges)) {
        newStyledRanges = origRanges.map((r: any) => ({
          ...r,
          fontSize: r.fontSize ? Math.max(1, Math.min(200, Math.round((r.fontSize * uniformScale) * 10) / 10)) : undefined,
        }));
      }
    }

    return {
      id: f.id,
      geometry: {
        x: roundToHundredth(finalX),
        y: roundToHundredth(finalY),
        width: newWidth,
        height: newHeight,
        ...(isText && newStyle ? { style: newStyle } : {}),
        ...(isText && newStyledRanges ? { styledRanges: newStyledRanges } : {}),
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

/**
 * Calculates new top-left (x, y) coordinates for a photo frame when rotating to targetRotation,
 * guaranteeing that the visual center of the frame remains exact and unchanged.
 * Prevents adjacent objects from swinging wildly and overlapping each other.
 */
export function calculateCenterRotatedPosition(
  frame: { x: number; y: number; width: number; height: number; rotation?: number },
  targetRotation: number
): { x: number; y: number; rotation: number } {
  const currentRot = frame.rotation || 0;
  const targetRot = ((targetRotation % 360) + 360) % 360;

  if (Math.abs(currentRot - targetRot) < 0.001) {
    return { x: roundToHundredth(frame.x), y: roundToHundredth(frame.y), rotation: Math.round(targetRot * 10) / 10 };
  }

  const rad1 = (currentRot * Math.PI) / 180;
  const halfW = frame.width / 2;
  const halfH = frame.height / 2;

  // 1. Calculate the current visual center point (cx, cy)
  const cx = frame.x + halfW * Math.cos(rad1) - halfH * Math.sin(rad1);
  const cy = frame.y + halfW * Math.sin(rad1) + halfH * Math.cos(rad1);

  // 2. Calculate the new top-left (x', y') with targetRot such that center stays at (cx, cy)
  const rad2 = (targetRot * Math.PI) / 180;
  const newX = cx - (halfW * Math.cos(rad2) - halfH * Math.sin(rad2));
  const newY = cy - (halfW * Math.sin(rad2) + halfH * Math.cos(rad2));

  return {
    x: roundToHundredth(newX),
    y: roundToHundredth(newY),
    rotation: Math.round(targetRot * 10) / 10,
  };
}

/**
 * Rotates multiple frames around their collective visual center by a given delta angle.
 * Strictly preserves each frame's dimensions (width & height), relative gap distances,
 * and handles any arbitrary initial rotations per frame without position or size distortion.
 */
export function calculateMultiFrameRotation(
  frames: FrameBounds[],
  deltaAngle: number
): { id: string; geometry: { x: number; y: number; rotation: number; groupRotation?: number } }[] {
  if (frames.length === 0) return [];
  if (frames.length === 1) {
    const f = frames[0]!;
    const targetRot = (((f.rotation || 0) + deltaAngle) % 360 + 360) % 360;
    const rotated = calculateCenterRotatedPosition(f, targetRot);
    return [{ id: f.id, geometry: { ...rotated, groupRotation: rotated.rotation } }];
  }

  // 1. Calculate the true visual center of the entire selection group
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const f of frames) {
    const fRot = ((f.rotation || 0) * Math.PI) / 180;
    const fCos = Math.cos(fRot);
    const fSin = Math.sin(fRot);

    const corners = [
      { x: f.x, y: f.y },
      { x: f.x + f.width * fCos, y: f.y + f.width * fSin },
      { x: f.x + f.width * fCos - f.height * fSin, y: f.y + f.width * fSin + f.height * fCos },
      { x: f.x - f.height * fSin, y: f.y + f.height * fCos },
    ];

    for (const pt of corners) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }

  const groupCenterX = (minX + maxX) / 2;
  const groupCenterY = (minY + maxY) / 2;

  const radDelta = (deltaAngle * Math.PI) / 180;
  const cosDelta = Math.cos(radDelta);
  const sinDelta = Math.sin(radDelta);

  // 2. Rotate each frame's center around (groupCenterX, groupCenterY) by deltaAngle
  return frames.map((f) => {
    const fCurrentRot = f.rotation || 0;
    const fRad = (fCurrentRot * Math.PI) / 180;
    const halfW = f.width / 2;
    const halfH = f.height / 2;

    // Current visual center of frame f
    const fcX = f.x + halfW * Math.cos(fRad) - halfH * Math.sin(fRad);
    const fcY = f.y + halfW * Math.sin(fRad) + halfH * Math.cos(fRad);

    // Rotate center around group center
    const dx = fcX - groupCenterX;
    const dy = fcY - groupCenterY;
    const newFcX = groupCenterX + dx * cosDelta - dy * sinDelta;
    const newFcY = groupCenterY + dx * sinDelta + dy * cosDelta;

    // New frame rotation
    const newRot = ((fCurrentRot + deltaAngle) % 360 + 360) % 360;
    const newRad = (newRot * Math.PI) / 180;

    // New top-left (x, y) from new center
    const newX = newFcX - (halfW * Math.cos(newRad) - halfH * Math.sin(newRad));
    const newY = newFcY - (halfW * Math.sin(newRad) + halfH * Math.cos(newRad));

    const currentGroupRot = f.groupRotation ?? 0;
    const newGroupRot = (((currentGroupRot + deltaAngle) % 360) + 360) % 360;

    return {
      id: f.id,
      geometry: {
        x: roundToHundredth(newX),
        y: roundToHundredth(newY),
        rotation: Math.round(newRot * 10) / 10,
        groupRotation: Math.round(newGroupRot * 10) / 10,
      },
    };
  });
}

/**
 * Computes the tight rotated bounding box for a group of frames.
 * If all frames share the same rotation angle, the returned group box inherits
 * that rotation angle, keeping the Transformer bounding box and its rotation handle
 * aligned with the rotation of the selected objects.
 */
export interface MultiFrameGroupInfo {
  groupX: number;
  groupY: number;
  groupWidth: number;
  groupHeight: number;
  groupRotation: number;
  childLocalFrames: Array<{
    id: string;
    localX: number;
    localY: number;
    localRotation: number;
  }>;
}

export function computeMultiFrameGroupInfo(
  frames: PhotoFrameElement[],
  preferredRotation?: number
): MultiFrameGroupInfo {
  if (frames.length === 0) {
    return {
      groupX: 0,
      groupY: 0,
      groupWidth: 0,
      groupHeight: 0,
      groupRotation: 0,
      childLocalFrames: [],
    };
  }

  const firstFrame = frames[0];
  if (frames.length === 1 && firstFrame) {
    return {
      groupX: firstFrame.x,
      groupY: firstFrame.y,
      groupWidth: firstFrame.width,
      groupHeight: firstFrame.height,
      groupRotation: firstFrame.rotation || 0,
      childLocalFrames: [
        {
          id: firstFrame.id,
          localX: 0,
          localY: 0,
          localRotation: 0,
        },
      ],
    };
  }

  let groupRot = 0;
  if (typeof preferredRotation === 'number') {
    groupRot = ((preferredRotation % 360) + 360) % 360;
  } else {
    const firstGroupRot = frames[0]?.groupRotation;
    const allSameGroupRot =
      typeof firstGroupRot === 'number' &&
      frames.every(
        (f) =>
          typeof f.groupRotation === 'number' &&
          Math.abs(((((f.groupRotation % 360) + 360) % 360) - (((firstGroupRot % 360) + 360) % 360))) < 0.1
      );

    if (allSameGroupRot && typeof firstGroupRot === 'number') {
      groupRot = ((firstGroupRot % 360) + 360) % 360;
    } else {
      const firstRot = (((firstFrame?.rotation || 0) % 360) + 360) % 360;
      const allSameRot = frames.every(
        (f) => Math.abs(((((f.rotation || 0) % 360) + 360) % 360) - firstRot) < 0.1
      );
      groupRot = allSameRot ? firstRot : 0;
    }
  }

  const rad = (groupRot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;

  for (const f of frames) {
    const fRot = ((f.rotation || 0) * Math.PI) / 180;
    const fCos = Math.cos(fRot);
    const fSin = Math.sin(fRot);

    const corners = [
      { x: f.x, y: f.y },
      { x: f.x + f.width * fCos, y: f.y + f.width * fSin },
      { x: f.x + f.width * fCos - f.height * fSin, y: f.y + f.width * fSin + f.height * fCos },
      { x: f.x - f.height * fSin, y: f.y + f.height * fCos },
    ];

    for (const pt of corners) {
      const u = pt.x * cos + pt.y * sin;
      const v = -pt.x * sin + pt.y * cos;
      minU = Math.min(minU, u);
      minV = Math.min(minV, v);
      maxU = Math.max(maxU, u);
      maxV = Math.max(maxV, v);
    }
  }

  const groupW = maxU - minU;
  const groupH = maxV - minV;

  const groupX = minU * cos - minV * sin;
  const groupY = minU * sin + minV * cos;

  const childLocalFrames = frames.map((f) => {
    const dx = f.x - groupX;
    const dy = f.y - groupY;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const localRot = (((f.rotation || 0) - groupRot) % 360 + 360) % 360;

    return {
      id: f.id,
      localX: roundToHundredth(lx),
      localY: roundToHundredth(ly),
      localRotation: Math.round(localRot * 10) / 10,
    };
  });

  return {
    groupX: roundToHundredth(groupX),
    groupY: roundToHundredth(groupY),
    groupWidth: roundToHundredth(groupW),
    groupHeight: roundToHundredth(groupH),
    groupRotation: Math.round(groupRot * 10) / 10,
    childLocalFrames,
  };
}

export function unprojectGroupChildToWorld(
  groupX: number,
  groupY: number,
  groupRotation: number,
  localX: number,
  localY: number,
  localRotation: number
): { x: number; y: number; rotation: number } {
  const rad = (groupRotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const worldX = groupX + localX * cos - localY * sin;
  const worldY = groupY + localX * sin + localY * cos;
  const worldRot = ((groupRotation + localRotation) % 360 + 360) % 360;

  return {
    x: roundToHundredth(worldX),
    y: roundToHundredth(worldY),
    rotation: Math.round(worldRot * 10) / 10,
  };
}

export function computeMultiFrameGroupBounds(frames: PhotoFrameElement[]): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
} {
  const info = computeMultiFrameGroupInfo(frames);
  return {
    x: info.groupX,
    y: info.groupY,
    width: info.groupWidth,
    height: info.groupHeight,
    rotation: info.groupRotation,
  };
}

/**
 * Calculates resized dimensions and world positions for multiple frames within a rotated group envelope.
 * Accurately scales child positions and dimensions in the rotated coordinate space, and maps back to world coordinates.
 */
export function calculateRotatedMultiFrameResize(
  groupInfo: MultiFrameGroupInfo,
  initialFrames: FrameBounds[],
  newGroupX: number,
  newGroupY: number,
  scaleX: number,
  scaleY: number
): ResizedFrameUpdate[] {
  if (initialFrames.length === 0 || groupInfo.childLocalFrames.length === 0) return [];

  const initialMap = new Map(initialFrames.map((f) => [f.id, f]));
  const scale = (scaleX + scaleY) / 2;

  return groupInfo.childLocalFrames.map((child) => {
    const orig = initialMap.get(child.id);
    const origW = orig ? orig.width : 100;
    const origH = orig ? orig.height : 100;

    const newLocalX = child.localX * scale;
    const newLocalY = child.localY * scale;
    const newWidth = roundToHundredth(Math.max(1, origW * scale));
    const newHeight = roundToHundredth(Math.max(1, origH * scale));

    const worldGeom = unprojectGroupChildToWorld(
      newGroupX,
      newGroupY,
      groupInfo.groupRotation,
      newLocalX,
      newLocalY,
      child.localRotation
    );

    const isText = (orig as any)?.type === 'text';
    const textStyle = isText ? (orig as any)?.style : undefined;
    let newStyle = undefined;
    let newStyledRanges = undefined;

    if (isText && textStyle) {
      const currentFontSize = textStyle.fontSize || 24;
      const newFontSize = Math.max(1, Math.min(200, Math.round((currentFontSize * scale) * 10) / 10));
      newStyle = {
        ...textStyle,
        fontSize: newFontSize,
      };
      const origRanges = (orig as any)?.styledRanges;
      if (origRanges && Array.isArray(origRanges)) {
        newStyledRanges = origRanges.map((r: any) => ({
          ...r,
          fontSize: r.fontSize ? Math.max(1, Math.min(200, Math.round((r.fontSize * scale) * 10) / 10)) : undefined,
        }));
      }
    }

    return {
      id: child.id,
      geometry: {
        x: worldGeom.x,
        y: worldGeom.y,
        width: newWidth,
        height: newHeight,
        rotation: worldGeom.rotation,
        groupRotation: groupInfo.groupRotation,
        ...(isText && newStyle ? { style: newStyle } : {}),
        ...(isText && newStyledRanges ? { styledRanges: newStyledRanges } : {}),
      },
    };
  });
}
