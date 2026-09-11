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
  cornerRadius?: number | [number, number, number, number];
  cornerRadiusTl?: number;
  cornerRadiusTr?: number;
  cornerRadiusBr?: number;
  cornerRadiusBl?: number;
  opacity: number;
  locked?: boolean;
  isMissing?: boolean;
}

/**
 * Normalizes corner radius values from an element into [top-left, top-right, bottom-right, bottom-left].
 * Supports scalar number, 4-tuple array, or individual per-corner properties.
 */
export function getCornerRadii(elem?: {
  cornerRadius?: number | [number, number, number, number];
  cornerRadiusTl?: number;
  cornerRadiusTr?: number;
  cornerRadiusBr?: number;
  cornerRadiusBl?: number;
} | null): [number, number, number, number] {
  if (!elem) return [0, 0, 0, 0];

  if (Array.isArray(elem.cornerRadius)) {
    return [
      Number.isFinite(elem.cornerRadius[0]) ? Math.max(0, elem.cornerRadius[0]) : 0,
      Number.isFinite(elem.cornerRadius[1]) ? Math.max(0, elem.cornerRadius[1]) : 0,
      Number.isFinite(elem.cornerRadius[2]) ? Math.max(0, elem.cornerRadius[2]) : 0,
      Number.isFinite(elem.cornerRadius[3]) ? Math.max(0, elem.cornerRadius[3]) : 0,
    ];
  }

  if (
    elem.cornerRadiusTl !== undefined ||
    elem.cornerRadiusTr !== undefined ||
    elem.cornerRadiusBr !== undefined ||
    elem.cornerRadiusBl !== undefined
  ) {
    return [
      Math.max(0, elem.cornerRadiusTl || 0),
      Math.max(0, elem.cornerRadiusTr || 0),
      Math.max(0, elem.cornerRadiusBr || 0),
      Math.max(0, elem.cornerRadiusBl || 0),
    ];
  }

  const r = typeof elem.cornerRadius === 'number' && Number.isFinite(elem.cornerRadius)
    ? Math.max(0, elem.cornerRadius)
    : 0;
  return [r, r, r, r];
}

/**
 * Checks if an element has any active corner rounding (> 0).
 */
export function hasCornerRadius(elem?: {
  cornerRadius?: number | [number, number, number, number];
  cornerRadiusTl?: number;
  cornerRadiusTr?: number;
  cornerRadiusBr?: number;
  cornerRadiusBl?: number;
} | null): boolean {
  const [tl, tr, br, bl] = getCornerRadii(elem);
  return tl > 0 || tr > 0 || br > 0 || bl > 0;
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
  rotation?: number;
}

export const MAX_CROP_SCALE = 3.5;

export interface CropTransform {
  cropX: number; // Normalized pan offset: -1.0 (left/top) to +1.0 (right/bottom), 0.0 is center
  cropY: number;
  cropScale: number; // Zoom level: 1.0 (100% cover fit) to 3.5 (350% zoom)
  cropRotation?: number; // In-frame rotation angle in degrees (0 - 360)
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
    // Physical precision is required: rounding down exposes the frame background.
    baseWidth: baseW,
    baseHeight: baseH,
    width: baseW * zoom,
    height: baseH * zoom,
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
    offsetX,
    offsetY,
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

export function normalizeAngle(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

export const STANDARD_ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];

export function calculateCropRotationSnap(
  angleDeg: number,
  isShiftPressed: boolean = false,
  snapAngles: number[] = STANDARD_ROTATION_SNAPS,
  tolerance: number = 5
): { angle: number; isSnapped: boolean } {
  const normalized = normalizeAngle(angleDeg);

  if (isShiftPressed) {
    // When Shift is held, strictly snap to nearest 45-degree increment
    const step = 45;
    const snapped = Math.round(normalized / step) * step;
    return {
      angle: normalizeAngle(snapped),
      isSnapped: true,
    };
  }

  for (const snap of snapAngles) {
    const diff = Math.abs(normalized - snap);
    const wrapDiff = Math.min(diff, 360 - diff);
    if (wrapDiff <= tolerance) {
      return {
        angle: snap === 360 ? 0 : snap,
        isSnapped: true,
      };
    }
  }

  return {
    angle: normalized,
    isSnapped: false,
  };
}

export function calculateMinCropScaleForRotation(
  frameWidth: number,
  frameHeight: number,
  photoAspect: number,
  rotationDeg: number
): number {
  if (frameWidth <= 0 || frameHeight <= 0 || photoAspect <= 0) return 1.0;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  const neededW = frameWidth * cos + frameHeight * sin;
  const neededH = frameWidth * sin + frameHeight * cos;

  const baseCover = calculateCoverDimensions(frameWidth, frameHeight, photoAspect, 1.0);
  const scaleW = neededW / baseCover.width;
  const scaleH = neededH / baseCover.height;

  const minScale = Math.max(1.0, scaleW, scaleH);
  return roundToHundredth(minScale);
}

export function getCenteredCrop(): CropTransform {
  return {
    cropX: 0,
    cropY: 0,
    cropScale: 1.0,
    cropRotation: 0,
  };
}

export function clampCropTransform(
  frame: PhotoFrameElement,
  crop: Partial<CropTransform> = {}
): CropTransform {
  const currentRotation = normalizeAngle(crop.cropRotation ?? frame.cropRotation ?? 0);

  const zoom = clamp(crop.cropScale ?? frame.cropScale ?? 1.0, 1.0, MAX_CROP_SCALE);
  const panX = clamp(crop.cropX ?? frame.cropX ?? 0, -1, 1);
  const panY = clamp(crop.cropY ?? frame.cropY ?? 0, -1, 1);

  return {
    cropX: Math.round(panX * 1000) / 1000,
    cropY: Math.round(panY * 1000) / 1000,
    cropScale: roundToHundredth(zoom),
    cropRotation: Math.round(currentRotation * 10) / 10,
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

export interface SnappingLevel {
  level: number;
  name: string;
  px: number;
  mm: number;
  desc: string;
  isDefault?: boolean;
}

export const SNAPPING_LEVELS: readonly SnappingLevel[] = [
  { level: 1, name: 'Soft', px: 10, mm: 0.85, desc: 'Gentle magnetic pull for fine micro-adjustments' },
  { level: 2, name: 'Normal', px: 15, mm: 1.27, desc: 'Standard comfortable alignment (Recommended)', isDefault: true },
  { level: 3, name: 'Medium', px: 35, mm: 2.96, desc: 'Responsive snapping with a broader catch radius' },
  { level: 4, name: 'Strong', px: 50, mm: 4.23, desc: 'Firm magnetic pull, ideal for rapid multi-photo layout' },
  { level: 5, name: 'Max', px: 75, mm: 6.35, desc: 'Maximum snap distance, locks quickly to nearest guides' },
] as const;

export const DEFAULT_SNAPPING_CONFIG: SnappingConfig = {
  enabled: true,
  threshold: 1.27,
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
 * Accurately aligns element X position to the spread spine fold line without floating point drift or slivers.
 * If an element's right edge is within tolerance (0.05 units) of the left spine edge (page split),
 * its position is snapped cleanly so that `x + width === singlePageW` exactly.
 * If an element's left edge is within tolerance of the right spine edge,
 * its position is snapped cleanly to `x === spineRight`.
 * If an element intentionally crosses across the spine (panorama / spread hero), it is preserved.
 */
export function alignElementPositionToSpine(
  x: number,
  width: number,
  spreadWidth: number,
  gutterWidth: number = 0,
  tolerance: number = 0.05
): number {
  const singlePageW = (spreadWidth - gutterWidth) / 2;
  const spineLeft = singlePageW;
  const spineRight = singlePageW + gutterWidth;

  const currentRight = x + width;

  // Case 1: Left page element whose right edge is flush or near flush with spine
  if (Math.abs(currentRight - spineLeft) <= tolerance && x < spineLeft) {
    return Number((spineLeft - width).toFixed(4));
  }

  // Case 2: Right page element whose left edge is flush or near flush with spine
  if (Math.abs(x - spineRight) <= tolerance && currentRight > spineRight) {
    return Number(spineRight.toFixed(4));
  }

  return roundToHundredth(x);
}

/**
 * Calculates smart magnetic snapping lines, equal distance gaps, and adjustments for a dragged frame.
 */
export function calculateSnapping(
  dragged: RectBounds,
  spreadWidth: number,
  spreadHeight: number,
  safeArea:
    | number
    | {
        top?: number;
        bottom?: number;
        outside?: number;
        spine?: number;
      },
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

  const safeAreaTop = typeof safeArea === 'object' ? (safeArea.top ?? 0) : safeArea;
  const safeAreaBottom = typeof safeArea === 'object' ? (safeArea.bottom ?? 0) : safeArea;
  const safeAreaOutside = typeof safeArea === 'object' ? (safeArea.outside ?? 0) : safeArea;
  const safeAreaSpine = typeof safeArea === 'object' ? (safeArea.spine ?? 0) : safeArea;

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
        : [{ pos: spineCenter, label: 'Center Fold / Page Edge', kind: 'edge' as const }]),
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

  if (config.snapToMargins) {
    if (safeAreaOutside > 0) {
      vTargets.push(
        { pos: safeAreaOutside, label: 'Safe Margin Outside (Left)', kind: 'margin' },
        { pos: spreadWidth - safeAreaOutside, label: 'Safe Margin Outside (Right)', kind: 'margin' }
      );
    }
    if (safeAreaSpine > 0) {
      vTargets.push(
        { pos: spineLeft - safeAreaSpine, label: 'Safe Margin Spine (Left)', kind: 'margin' },
        { pos: spineRight + safeAreaSpine, label: 'Safe Margin Spine (Right)', kind: 'margin' }
      );
    }
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

  if (config.snapToMargins) {
    if (safeAreaTop > 0) {
      hTargets.push({ pos: safeAreaTop, label: 'Safe Margin Top', kind: 'margin' });
    }
    if (safeAreaBottom > 0) {
      hTargets.push({ pos: spreadHeight - safeAreaBottom, label: 'Safe Margin Bottom', kind: 'margin' });
    }
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
    if (
      bestVLine.label === 'Left Page Inner Edge' ||
      bestVLine.label === 'Right Page Inner Edge' ||
      bestVLine.label === 'Center Fold / Page Edge'
    ) {
      snappedX = alignElementPositionToSpine(bestSnapX, dragged.width, spreadWidth, gutterWidth, threshold);
    } else {
      snappedX = bestSnapX;
    }
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
    // Maximum proximity distance for displaying adjacent gap guides (25mm / 2.5cm / 1.0 inch)
    const maxProximityGap =
      unit === 'cm' ? 2.5 : unit === 'inch' ? 1.0 : unit === 'px' ? 300 : 25.0;

    // Visual bounds taking rotation into account
    const draggedBounds = getFrameVisualBounds(dragged);
    const dragOffsetX = draggedBounds.x - dragged.x;
    const dragOffsetY = draggedBounds.y - dragged.y;

    // Active visual bounds at current snapped position
    const activeVisualDragged: RectBounds = {
      x: snappedX + dragOffsetX,
      y: snappedY + dragOffsetY,
      width: draggedBounds.width,
      height: draggedBounds.height,
    };

    // 1. Horizontal Gaps (strictly facing neighbors with vertical overlap)
    const facingHorizontal = otherFrames
      .map((f) => {
        const bounds = getFrameVisualBounds(f);
        const overlapStartY = Math.max(activeVisualDragged.y, bounds.y);
        const overlapEndY = Math.min(activeVisualDragged.y + activeVisualDragged.height, bounds.y + bounds.height);
        const overlapY = overlapEndY - overlapStartY;
        return { bounds, overlapY, overlapStartY, overlapEndY };
      })
      .filter((item) => item.overlapY > 0);

    // Nearest left neighbor: maximum (bounds.x + bounds.width)
    const leftNeighbors = facingHorizontal
      .filter((item) => item.bounds.x + item.bounds.width <= activeVisualDragged.x + threshold)
      .sort((a, b) => (b.bounds.x + b.bounds.width) - (a.bounds.x + a.bounds.width));

    // Nearest right neighbor: minimum bounds.x
    const rightNeighbors = facingHorizontal
      .filter((item) => item.bounds.x >= activeVisualDragged.x + activeVisualDragged.width - threshold)
      .sort((a, b) => a.bounds.x - b.bounds.x);

    const leftNeighborItem = leftNeighbors[0];
    const rightNeighborItem = rightNeighbors[0];

    if (leftNeighborItem && rightNeighborItem) {
      const leftEdge = leftNeighborItem.bounds.x + leftNeighborItem.bounds.width;
      const rightEdge = rightNeighborItem.bounds.x;
      const leftGap = activeVisualDragged.x - leftEdge;
      const rightGap = rightEdge - (activeVisualDragged.x + activeVisualDragged.width);

      if (leftGap > 0 && rightGap > 0 && Math.abs(leftGap - rightGap) <= threshold * 2) {
        // Equidistant snap!
        const totalSpan = rightEdge - leftEdge - activeVisualDragged.width;
        const equalGap = Math.max(0, totalSpan / 2);
        const targetVisualX = leftEdge + equalGap;
        snappedX = roundToTenth(targetVisualX - dragOffsetX);

        const leftCrossY = (leftNeighborItem.overlapStartY + leftNeighborItem.overlapEndY) / 2;
        const rightCrossY = (rightNeighborItem.overlapStartY + rightNeighborItem.overlapEndY) / 2;

        gapGuides.push(
          {
            type: 'horizontal',
            start: leftEdge,
            end: leftEdge + equalGap,
            crossPos: leftCrossY,
            distance: roundToTenth(equalGap),
            label: `${roundToTenth(equalGap)} ${unit}`,
          },
          {
            type: 'horizontal',
            start: leftEdge + equalGap + activeVisualDragged.width,
            end: rightEdge,
            crossPos: rightCrossY,
            distance: roundToTenth(equalGap),
            label: `${roundToTenth(equalGap)} ${unit}`,
          }
        );
      } else {
        const currentVisualLeft = snappedX + dragOffsetX;
        const currentLeftGap = currentVisualLeft - leftEdge;
        if (currentLeftGap > 0 && currentLeftGap <= maxProximityGap) {
          const crossY = (leftNeighborItem.overlapStartY + leftNeighborItem.overlapEndY) / 2;
          gapGuides.push({
            type: 'horizontal',
            start: leftEdge,
            end: currentVisualLeft,
            crossPos: crossY,
            distance: roundToTenth(currentLeftGap),
            label: `${roundToTenth(currentLeftGap)} ${unit}`,
          });
        }

        const currentVisualRight = currentVisualLeft + activeVisualDragged.width;
        const currentRightGap = rightEdge - currentVisualRight;
        if (currentRightGap > 0 && currentRightGap <= maxProximityGap) {
          const crossY = (rightNeighborItem.overlapStartY + rightNeighborItem.overlapEndY) / 2;
          gapGuides.push({
            type: 'horizontal',
            start: currentVisualRight,
            end: rightEdge,
            crossPos: crossY,
            distance: roundToTenth(currentRightGap),
            label: `${roundToTenth(currentRightGap)} ${unit}`,
          });
        }
      }
    } else if (leftNeighborItem) {
      const leftEdge = leftNeighborItem.bounds.x + leftNeighborItem.bounds.width;
      const currentVisualLeft = snappedX + dragOffsetX;
      const currentLeftGap = currentVisualLeft - leftEdge;
      if (currentLeftGap > 0 && currentLeftGap <= maxProximityGap) {
        const crossY = (leftNeighborItem.overlapStartY + leftNeighborItem.overlapEndY) / 2;
        gapGuides.push({
          type: 'horizontal',
          start: leftEdge,
          end: currentVisualLeft,
          crossPos: crossY,
          distance: roundToTenth(currentLeftGap),
          label: `${roundToTenth(currentLeftGap)} ${unit}`,
        });
      }
    } else if (rightNeighborItem) {
      const rightEdge = rightNeighborItem.bounds.x;
      const currentVisualLeft = snappedX + dragOffsetX;
      const currentVisualRight = currentVisualLeft + activeVisualDragged.width;
      const currentRightGap = rightEdge - currentVisualRight;
      if (currentRightGap > 0 && currentRightGap <= maxProximityGap) {
        const crossY = (rightNeighborItem.overlapStartY + rightNeighborItem.overlapEndY) / 2;
        gapGuides.push({
          type: 'horizontal',
          start: currentVisualRight,
          end: rightEdge,
          crossPos: crossY,
          distance: roundToTenth(currentRightGap),
          label: `${roundToTenth(currentRightGap)} ${unit}`,
        });
      }
    }

    // 2. Vertical Gaps (strictly facing neighbors with horizontal overlap)
    const facingVertical = otherFrames
      .map((f) => {
        const bounds = getFrameVisualBounds(f);
        const overlapStartX = Math.max(activeVisualDragged.x, bounds.x);
        const overlapEndX = Math.min(activeVisualDragged.x + activeVisualDragged.width, bounds.x + bounds.width);
        const overlapX = overlapEndX - overlapStartX;
        return { bounds, overlapX, overlapStartX, overlapEndX };
      })
      .filter((item) => item.overlapX > 0);

    // Nearest top neighbor: maximum (bounds.y + bounds.height)
    const topNeighbors = facingVertical
      .filter((item) => item.bounds.y + item.bounds.height <= activeVisualDragged.y + threshold)
      .sort((a, b) => (b.bounds.y + b.bounds.height) - (a.bounds.y + a.bounds.height));

    // Nearest bottom neighbor: minimum bounds.y
    const bottomNeighbors = facingVertical
      .filter((item) => item.bounds.y >= activeVisualDragged.y + activeVisualDragged.height - threshold)
      .sort((a, b) => a.bounds.y - b.bounds.y);

    const topNeighborItem = topNeighbors[0];
    const bottomNeighborItem = bottomNeighbors[0];

    if (topNeighborItem && bottomNeighborItem) {
      const topEdge = topNeighborItem.bounds.y + topNeighborItem.bounds.height;
      const bottomEdge = bottomNeighborItem.bounds.y;
      const topGap = activeVisualDragged.y - topEdge;
      const bottomGap = bottomEdge - (activeVisualDragged.y + activeVisualDragged.height);

      if (topGap > 0 && bottomGap > 0 && Math.abs(topGap - bottomGap) <= threshold * 2) {
        // Equidistant snap!
        const totalSpan = bottomEdge - topEdge - activeVisualDragged.height;
        const equalGap = Math.max(0, totalSpan / 2);
        const targetVisualY = topEdge + equalGap;
        snappedY = roundToTenth(targetVisualY - dragOffsetY);

        const topCrossX = (topNeighborItem.overlapStartX + topNeighborItem.overlapEndX) / 2;
        const bottomCrossX = (bottomNeighborItem.overlapStartX + bottomNeighborItem.overlapEndX) / 2;

        gapGuides.push(
          {
            type: 'vertical',
            start: topEdge,
            end: topEdge + equalGap,
            crossPos: topCrossX,
            distance: roundToTenth(equalGap),
            label: `${roundToTenth(equalGap)} ${unit}`,
          },
          {
            type: 'vertical',
            start: topEdge + equalGap + activeVisualDragged.height,
            end: bottomEdge,
            crossPos: bottomCrossX,
            distance: roundToTenth(equalGap),
            label: `${roundToTenth(equalGap)} ${unit}`,
          }
        );
      } else {
        const currentVisualTop = snappedY + dragOffsetY;
        const currentTopGap = currentVisualTop - topEdge;
        if (currentTopGap > 0 && currentTopGap <= maxProximityGap) {
          const crossX = (topNeighborItem.overlapStartX + topNeighborItem.overlapEndX) / 2;
          gapGuides.push({
            type: 'vertical',
            start: topEdge,
            end: currentVisualTop,
            crossPos: crossX,
            distance: roundToTenth(currentTopGap),
            label: `${roundToTenth(currentTopGap)} ${unit}`,
          });
        }

        const currentVisualBottom = currentVisualTop + activeVisualDragged.height;
        const currentBottomGap = bottomEdge - currentVisualBottom;
        if (currentBottomGap > 0 && currentBottomGap <= maxProximityGap) {
          const crossX = (bottomNeighborItem.overlapStartX + bottomNeighborItem.overlapEndX) / 2;
          gapGuides.push({
            type: 'vertical',
            start: currentVisualBottom,
            end: bottomEdge,
            crossPos: crossX,
            distance: roundToTenth(currentBottomGap),
            label: `${roundToTenth(currentBottomGap)} ${unit}`,
          });
        }
      }
    } else if (topNeighborItem) {
      const topEdge = topNeighborItem.bounds.y + topNeighborItem.bounds.height;
      const currentVisualTop = snappedY + dragOffsetY;
      const currentTopGap = currentVisualTop - topEdge;
      if (currentTopGap > 0 && currentTopGap <= maxProximityGap) {
        const crossX = (topNeighborItem.overlapStartX + topNeighborItem.overlapEndX) / 2;
        gapGuides.push({
          type: 'vertical',
          start: topEdge,
          end: currentVisualTop,
          crossPos: crossX,
          distance: roundToTenth(currentTopGap),
          label: `${roundToTenth(currentTopGap)} ${unit}`,
        });
      }
    } else if (bottomNeighborItem) {
      const bottomEdge = bottomNeighborItem.bounds.y;
      const currentVisualTop = snappedY + dragOffsetY;
      const currentVisualBottom = currentVisualTop + activeVisualDragged.height;
      const currentBottomGap = bottomEdge - currentVisualBottom;
      if (currentBottomGap > 0 && currentBottomGap <= maxProximityGap) {
        const crossX = (bottomNeighborItem.overlapStartX + bottomNeighborItem.overlapEndX) / 2;
        gapGuides.push({
          type: 'vertical',
          start: currentVisualBottom,
          end: bottomEdge,
          crossPos: crossX,
          distance: roundToTenth(currentBottomGap),
          label: `${roundToTenth(currentBottomGap)} ${unit}`,
        });
      }
    }
  }

  const finalSnapLines = snapLines.filter((line) => {
    if (line.type === 'vertical') {
      return (
        Math.abs(line.position - snappedX) <= 0.05 ||
        Math.abs(line.position - (snappedX + dragged.width / 2)) <= 0.05 ||
        Math.abs(line.position - (snappedX + dragged.width)) <= 0.05
      );
    } else {
      return (
        Math.abs(line.position - snappedY) <= 0.05 ||
        Math.abs(line.position - (snappedY + dragged.height / 2)) <= 0.05 ||
        Math.abs(line.position - (snappedY + dragged.height)) <= 0.05
      );
    }
  });

  return { snappedX, snappedY, snapLines: finalSnapLines, gapGuides };
}

/**
 * Calculates smart resize snapping to match neighbor frame dimensions, primary collinear edge alignments,
 * and Spread Safe Zone Margins (Blue Guides), Center Spine, and Spread Boundaries.
 */
export function calculateResizeSnapping(
  current: RectBounds,
  spreadWidth: number,
  spreadHeight: number,
  safeArea: number | { top?: number; bottom?: number; outside?: number; spine?: number },
  gutterWidth: number,
  otherFrames: RectBounds[],
  threshold: number = 2.0,
  unit: string = 'mm',
  anchor?: string
): ResizeSnapResult {
  let { x, y, width, height } = current;
  const snapLines: SnapLine[] = [];
  const gapGuides: GapGuide[] = [];

  const marginTop = typeof safeArea === 'number' ? safeArea : (safeArea.top ?? 0);
  const marginBottom = typeof safeArea === 'number' ? safeArea : (safeArea.bottom ?? 0);
  const marginOutside = typeof safeArea === 'number' ? safeArea : (safeArea.outside ?? 0);
  const marginSpine = typeof safeArea === 'number' ? safeArea : (safeArea.spine ?? 0);

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
  if (marginOutside > 0) {
    verticalTargets.push(
      { pos: marginOutside, label: 'Safe Margin Left' },
      { pos: spreadWidth - marginOutside, label: 'Safe Margin Right' }
    );
  }
  if (marginSpine > 0) {
    verticalTargets.push(
      { pos: spineLeft - marginSpine, label: 'Safe Margin Left Inner' },
      { pos: spineRight + marginSpine, label: 'Safe Margin Right Inner' }
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
  if (marginTop > 0) {
    horizontalTargets.push({ pos: marginTop, label: 'Safe Margin Top' });
  }
  if (marginBottom > 0) {
    horizontalTargets.push({ pos: spreadHeight - marginBottom, label: 'Safe Margin Bottom' });
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
        const newX = bestVTarget.label === 'Spine Right' ? Number(spineRight.toFixed(4)) : bestVTarget.pos;
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
        const newW = (bestVTarget.label === 'Spine Left' || bestVTarget.label === 'Spread Center X')
          ? Number((spineLeft - x).toFixed(4))
          : bestVTarget.pos - x;
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
      // Rounding either the origin or size moves the snapped edge off its guide.
      x,
      y,
      width,
      height,
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
  safeMarginTop?: number;
  safeMarginBottom?: number;
  safeMarginOutside?: number;
  safeMarginSpine?: number;
  targetMode?: 'safe_margin' | 'page_edge' | 'selection';
}

/**
 * Calculates batch alignment updates for selected frames.
 * - When targetMode is 'page_edge': Aligns frames flush against canvas/page boundaries (0, pageWidth, spreadWidth, spreadHeight).
 * - When targetMode is 'safe_margin' (or single entity with margins enabled): Aligns against the Blue Safe Margin box.
 * - When 2+ independent entities are selected and targetMode is 'selection': Aligns entities relative to their composite bounding box.
 * Groups of frames are always treated as single rigid entities, preserving their internal relative layout.
 */
export function alignFrames(
  frames: PhotoFrameElement[],
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  safeMarginBounds?: SafeMarginBounds,
  targetModeOverride?: 'safe_margin' | 'page_edge' | 'selection'
): { id: string; geometry: Partial<PhotoFrameElement> }[] {
  const entities = clusterFramesIntoEntities(frames);
  if (entities.length === 0) return [];

  const updates: { id: string; geometry: Partial<PhotoFrameElement> }[] = [];

  const targetMode = targetModeOverride ?? safeMarginBounds?.targetMode ?? (
    safeMarginBounds && safeMarginBounds.safeMargin === 0 ? 'page_edge' : undefined
  );

  // When aligning relative to page/canvas edge or safe margin:
  const isPageTargeted = Boolean(
    safeMarginBounds && (entities.length === 1 || targetMode === 'page_edge' || targetMode === 'safe_margin')
  );

  if (isPageTargeted && safeMarginBounds) {
    const { singlePageWidth, spreadHeight, gutterWidth, safeMargin } = safeMarginBounds;
    const totalSpreadWidth = singlePageWidth * 2 + gutterWidth;
    const spineLeft = singlePageWidth;
    const spineRight = singlePageWidth + gutterWidth;
    const spineCenter = singlePageWidth + gutterWidth / 2;

    const isPageEdge = targetMode === 'page_edge' || safeMargin === 0;

    const mTop = isPageEdge ? 0 : (safeMarginBounds.safeMarginTop ?? safeMargin);
    const mBottom = isPageEdge ? 0 : (safeMarginBounds.safeMarginBottom ?? safeMargin);
    const mOutside = isPageEdge ? 0 : (safeMarginBounds.safeMarginOutside ?? safeMargin);
    const mSpine = isPageEdge ? 0 : (safeMarginBounds.safeMarginSpine ?? safeMargin);

    const minSelX = Math.min(...entities.map((e) => e.x));
    const maxSelX = Math.max(...entities.map((e) => e.x + e.width));
    const minSelY = Math.min(...entities.map((e) => e.y));
    const maxSelY = Math.max(...entities.map((e) => e.y + e.height));
    const selW = maxSelX - minSelX;
    const selH = maxSelY - minSelY;
    const selCenterX = minSelX + selW / 2;

    const spansBothPages = minSelX < spineLeft && maxSelX > spineRight;

    let refMinX: number;
    let refMaxX: number;
    let refCenterX: number;

    if (spansBothPages) {
      refMinX = mOutside;
      refMaxX = totalSpreadWidth - mOutside;
      refCenterX = totalSpreadWidth / 2;
    } else if (selCenterX < spineCenter) {
      // Left Page
      refMinX = mOutside;
      refMaxX = singlePageWidth - mSpine;
      refCenterX = (refMinX + refMaxX) / 2;
    } else {
      // Right Page
      refMinX = singlePageWidth + gutterWidth + mSpine;
      refMaxX = totalSpreadWidth - mOutside;
      refCenterX = (refMinX + refMaxX) / 2;
    }

    const refMinY = mTop;
    const refMaxY = spreadHeight - mBottom;
    const refMiddleY = (refMinY + refMaxY) / 2;

    let deltaX = 0;
    let deltaY = 0;
    let applyX = false;
    let applyY = false;

    switch (alignment) {
      case 'left':
        deltaX = refMinX - minSelX;
        applyX = true;
        break;
      case 'center':
        deltaX = refCenterX - selW / 2 - minSelX;
        applyX = true;
        break;
      case 'right':
        deltaX = refMaxX - selW - minSelX;
        applyX = true;
        break;
      case 'top':
        deltaY = refMinY - minSelY;
        applyY = true;
        break;
      case 'middle':
        deltaY = refMiddleY - selH / 2 - minSelY;
        applyY = true;
        break;
      case 'bottom':
        deltaY = refMaxY - selH - minSelY;
        applyY = true;
        break;
    }

    for (const entity of entities) {
      for (const f of entity.frames) {
        const geometry: Partial<PhotoFrameElement> = {};
        // Keep the rigid translation exact, including fractional page edges and gaps.
        if (applyX) geometry.x = f.x + deltaX;
        if (applyY) geometry.y = f.y + deltaY;
        updates.push({ id: f.id, geometry });
      }
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
      if (applyX) geometry.x = f.x + deltaX;
      if (applyY) geometry.y = f.y + deltaY;
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
  mode: 'proportional' | 'fixed_gap' = 'proportional',
  fixedScale?: number
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
    const isText = (f as any)?.type === 'text';
    const newWidth = isText
      ? Math.ceil((f.width * uniformScale) * 100) / 100
      : roundToHundredth(Math.max(1, f.width * uniformScale));
    const newHeight = isText
      ? Math.ceil((f.height * uniformScale) * 100) / 100
      : roundToHundredth(Math.max(1, f.height * uniformScale));
    const newCenterX = newGroupBounds.x + newGroupBounds.width / 2;
    const newCenterY = newGroupBounds.y + newGroupBounds.height / 2;
    const rad = ((f.rotation || 0) * Math.PI) / 180;
    const finalX = newCenterX - ((newWidth / 2) * Math.cos(rad) - (newHeight / 2) * Math.sin(rad));
    const finalY = newCenterY - ((newWidth / 2) * Math.sin(rad) + (newHeight / 2) * Math.cos(rad));

    const textStyle = isText ? (f as any)?.style : undefined;
    let newStyle = undefined;
    let newStyledRanges = undefined;

    if (isText && textStyle) {
      const currentFontSize = textStyle.fontSize || 24;
      const newFontSize = Math.max(1, Math.min(200, currentFontSize * uniformScale));
      newStyle = {
        ...textStyle,
        fontSize: newFontSize,
        padding: (textStyle.padding ?? 4) * uniformScale,
        letterSpacing: (textStyle.letterSpacing ?? 0) * uniformScale,
      };
      const origRanges = (f as any)?.styledRanges;
      if (origRanges && Array.isArray(origRanges)) {
        newStyledRanges = origRanges.map((r: any) => ({
          ...r,
          fontSize: r.fontSize ? Math.max(1, Math.min(200, r.fontSize * uniformScale)) : undefined,
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
    const scale = fixedScale !== undefined
      ? fixedScale
      : (Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY);

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
      const isText = (f as any)?.type === 'text';
      const newWidth = isText
        ? Math.ceil((f.width * scale) * 100) / 100
        : roundToHundredth(Math.max(1, f.width * scale));
      const newHeight = isText
        ? Math.ceil((f.height * scale) * 100) / 100
        : roundToHundredth(Math.max(1, f.height * scale));

      const rad = ((f.rotation || 0) * Math.PI) / 180;
      const finalX = newCenterX - ((newWidth / 2) * Math.cos(rad) - (newHeight / 2) * Math.sin(rad));
      const finalY = newCenterY - ((newWidth / 2) * Math.sin(rad) + (newHeight / 2) * Math.cos(rad));

      const textStyle = isText ? (f as any)?.style : undefined;
      let newStyle = undefined;
      let newStyledRanges = undefined;

      if (isText && textStyle) {
        const currentFontSize = textStyle.fontSize || 24;
        const newFontSize = Math.max(1, Math.min(200, currentFontSize * scale));
        newStyle = {
          ...textStyle,
          fontSize: newFontSize,
          padding: (textStyle.padding ?? 4) * scale,
          letterSpacing: (textStyle.letterSpacing ?? 0) * scale,
        };
        const origRanges = (f as any)?.styledRanges;
        if (origRanges && Array.isArray(origRanges)) {
          newStyledRanges = origRanges.map((r: any) => ({
            ...r,
            fontSize: r.fontSize ? Math.max(1, Math.min(200, r.fontSize * scale)) : undefined,
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
  const uniformScale = fixedScale !== undefined
    ? fixedScale
    : (Math.abs(rawRatioX - rawRatioY) < 0.005
      ? (initW >= initH ? scaleXFromGroup : scaleYFromGroup)
      : (Math.abs(rawRatioX - 1) >= Math.abs(rawRatioY - 1)
        ? scaleXFromGroup
        : scaleYFromGroup));

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
    const isText = (f as any)?.type === 'text';
    const newWidth = isText
      ? Math.ceil((f.width * uniformScale) * 100) / 100
      : roundToHundredth(Math.max(1, f.width * uniformScale));
    const newHeight = isText
      ? Math.ceil((f.height * uniformScale) * 100) / 100
      : roundToHundredth(Math.max(1, f.height * uniformScale));

    const rad = ((f.rotation || 0) * Math.PI) / 180;
    const finalX = newCenterX - ((newWidth / 2) * Math.cos(rad) - (newHeight / 2) * Math.sin(rad));
    const finalY = newCenterY - ((newWidth / 2) * Math.sin(rad) + (newHeight / 2) * Math.cos(rad));

    const textStyle = isText ? (f as any)?.style : undefined;
    let newStyle = undefined;
    let newStyledRanges = undefined;

    if (isText && textStyle) {
      const currentFontSize = textStyle.fontSize || 24;
      const newFontSize = Math.max(1, Math.min(200, currentFontSize * uniformScale));
      newStyle = {
        ...textStyle,
        fontSize: newFontSize,
        padding: (textStyle.padding ?? 4) * uniformScale,
        letterSpacing: (textStyle.letterSpacing ?? 0) * uniformScale,
      };
      const origRanges = (f as any)?.styledRanges;
      if (origRanges && Array.isArray(origRanges)) {
        newStyledRanges = origRanges.map((r: any) => ({
          ...r,
          fontSize: r.fontSize ? Math.max(1, Math.min(200, r.fontSize * uniformScale)) : undefined,
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
  scaleY: number,
  mode: 'proportional' | 'fixed_gap' = 'proportional',
  anchor?: string
): ResizedFrameUpdate[] {
  if (initialFrames.length === 0 || groupInfo.childLocalFrames.length === 0) return [];

  const initialMap = new Map(initialFrames.map((f) => [f.id, f]));
  const scale = (scaleX + scaleY) / 2;

  // --- 1. PROPORTIONAL MODE (Visual Harmony) ---
  if (mode === 'proportional') {
    return groupInfo.childLocalFrames.map((child) => {
      const orig = initialMap.get(child.id);
      const origW = orig ? orig.width : 100;
      const origH = orig ? orig.height : 100;

      const isText = (orig as any)?.type === 'text';
      const newLocalX = child.localX * scale;
      const newLocalY = child.localY * scale;
      const newWidth = isText
        ? Math.ceil((origW * scale) * 100) / 100
        : roundToHundredth(Math.max(1, origW * scale));
      const newHeight = isText
        ? Math.ceil((origH * scale) * 100) / 100
        : roundToHundredth(Math.max(1, origH * scale));

      const worldGeom = unprojectGroupChildToWorld(
        newGroupX,
        newGroupY,
        groupInfo.groupRotation,
        newLocalX,
        newLocalY,
        child.localRotation
      );

      const textStyle = isText ? (orig as any)?.style : undefined;
      let newStyle = undefined;
      let newStyledRanges = undefined;

      if (isText && textStyle) {
        const currentFontSize = textStyle.fontSize || 24;
        const newFontSize = Math.max(1, Math.min(200, currentFontSize * scale));
        newStyle = {
          ...textStyle,
          fontSize: newFontSize,
          padding: (textStyle.padding ?? 4) * scale,
          letterSpacing: (textStyle.letterSpacing ?? 0) * scale,
        };
        const origRanges = (orig as any)?.styledRanges;
        if (origRanges && Array.isArray(origRanges)) {
          newStyledRanges = origRanges.map((r: any) => ({
            ...r,
            fontSize: r.fontSize ? Math.max(1, Math.min(200, r.fontSize * scale)) : undefined,
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

  // --- 2. FIXED GAP MODE: 2D TOPOLOGICAL SPATIAL NEIGHBOR GRAPH IN LOCAL SPACE ---
  // Represent each frame in the group's local coordinate space
  const localFrames: FrameBounds[] = groupInfo.childLocalFrames.map((child) => {
    const orig = initialMap.get(child.id);
    return {
      ...(orig || {}),
      id: child.id,
      x: child.localX,
      y: child.localY,
      width: orig ? orig.width : 100,
      height: orig ? orig.height : 100,
      rotation: child.localRotation,
    };
  });

  const initialLocalBounds: RectBounds = {
    x: 0,
    y: 0,
    width: groupInfo.groupWidth,
    height: groupInfo.groupHeight,
  };

  const newLocalBounds: RectBounds = {
    x: 0,
    y: 0,
    width: groupInfo.groupWidth * scale,
    height: groupInfo.groupHeight * scale,
  };

  // Run the 2D Topological Spatial Neighbor Graph algorithm in local group space
  // passing fixedScale = scale to guarantee smooth, jitter-free 60 FPS scaling
  const localUpdates = calculateMultiFrameResize(
    localFrames,
    initialLocalBounds,
    newLocalBounds,
    anchor,
    'fixed_gap',
    scale
  );

  // Unproject each frame's updated local coordinates back to world coordinates
  const childMap = new Map(groupInfo.childLocalFrames.map((c) => [c.id, c]));

  return localUpdates.map((u) => {
    const child = childMap.get(u.id);
    const localRot = child ? child.localRotation : 0;
    const worldGeom = unprojectGroupChildToWorld(
      anchor ? groupInfo.groupX : newGroupX,
      anchor ? groupInfo.groupY : newGroupY,
      groupInfo.groupRotation,
      u.geometry.x ?? (child?.localX || 0),
      u.geometry.y ?? (child?.localY || 0),
      u.geometry.rotation ?? localRot
    );

    return {
      id: u.id,
      geometry: {
        ...u.geometry,
        x: worldGeom.x,
        y: worldGeom.y,
        rotation: worldGeom.rotation,
        groupRotation: groupInfo.groupRotation,
      },
    };
  });
}

export interface SafeZoneParams {
  safeMarginTop?: number;
  safeMarginBottom?: number;
  safeMarginOutside?: number;
  safeMarginSpine?: number;
  enabled?: boolean;
  spreadWidth?: number;
  spreadHeight?: number;
}

/**
 * Adjusts the inter-frame gaps between existing photo frames on a spread to targetGap in-place,
 * preserving the exact layout structure, frame topology, relative proportions, and outer bounds.
 * Does not replace, shuffle, or cycle the layout.
 */
export function adjustSpreadPhotoGaps(
  elements: any[],
  targetGapInCanvasUnit: number,
  pageWidth: number,
  gutterWidth = 0,
  safeZone?: SafeZoneParams
): any[] {
  if (!elements || elements.length === 0) return elements;

  const photoFrames = elements.filter((el): el is PhotoFrameElement => el.type === 'photo');

  if (photoFrames.length < 2) {
    return elements;
  }

  const spineX = pageWidth + gutterWidth / 2;

  // Check if any frame crosses the spine by more than 5 units (spread-spanning layout)
  const hasSpanningPhoto = photoFrames.some(
    (f) => f.x < spineX - 5 && f.x + f.width > spineX + 5
  );

  let clusters: PhotoFrameElement[][];
  if (hasSpanningPhoto) {
    clusters = [photoFrames];
  } else {
    const leftCluster = photoFrames.filter((f) => f.x + f.width / 2 < spineX);
    const rightCluster = photoFrames.filter((f) => f.x + f.width / 2 >= spineX);
    clusters = [leftCluster, rightCluster].filter((c) => c.length > 0);
  }

  const updatedFramesMap = new Map<string, PhotoFrameElement>();

  for (const cluster of clusters) {
    if (cluster.length < 2) {
      for (const f of cluster) {
        updatedFramesMap.set(f.id, f);
      }
      continue;
    }

    const isLeftCluster = cluster[0] && cluster[0].x + cluster[0].width / 2 < spineX;
    const marginEnabled = safeZone?.enabled ?? true;
    const safeOutside = marginEnabled ? (safeZone?.safeMarginOutside ?? 0) : 0;
    const safeSpine = marginEnabled ? (safeZone?.safeMarginSpine ?? 0) : 0;
    const safeTop = marginEnabled ? (safeZone?.safeMarginTop ?? 0) : 0;
    const safeBottom = marginEnabled ? (safeZone?.safeMarginBottom ?? 0) : 0;
    const hasSafeZone =
      marginEnabled && (safeOutside > 0 || safeSpine > 0 || safeTop > 0 || safeBottom > 0);

    const spreadH = safeZone?.spreadHeight || 300;
    const spreadW = safeZone?.spreadWidth || pageWidth * 2 + gutterWidth;

    let safeMinX = 0;
    let safeMaxX = spreadW;
    let safeMinY = 0;
    let safeMaxY = spreadH;

    if (hasSafeZone) {
      safeMinY = safeTop;
      safeMaxY = spreadH - safeBottom;
      if (hasSpanningPhoto) {
        safeMinX = safeOutside;
        safeMaxX = spreadW - safeOutside;
      } else if (isLeftCluster) {
        safeMinX = safeOutside;
        safeMaxX = pageWidth - safeSpine;
      } else {
        safeMinX = pageWidth + gutterWidth + safeSpine;
        safeMaxX = pageWidth + gutterWidth + pageWidth - safeOutside;
      }
    }

    const rawMinX = Math.min(...cluster.map((f) => f.x));
    const rawMinY = Math.min(...cluster.map((f) => f.y));
    const rawMaxX = Math.max(...cluster.map((f) => f.x + f.width));
    const rawMaxY = Math.max(...cluster.map((f) => f.y + f.height));

    const minX = hasSafeZone ? Math.max(safeMinX, rawMinX) : rawMinX;
    const minY = hasSafeZone ? Math.max(safeMinY, rawMinY) : rawMinY;
    const maxX = hasSafeZone ? Math.min(safeMaxX, rawMaxX) : rawMaxX;
    const maxY = hasSafeZone ? Math.min(safeMaxY, rawMaxY) : rawMaxY;

    const totalW = maxX - minX;
    const totalH = maxY - minY;

    if (totalW <= 0 || totalH <= 0) {
      for (const f of cluster) updatedFramesMap.set(f.id, f);
      continue;
    }

    // 1. Build Spatial Neighbor Relations
    const leftNeighbors = new Map<string, { neighborId: string; gap: number }>();
    const rightNeighbors = new Map<string, string[]>();
    for (const b of cluster) {
      let closestA: PhotoFrameElement | null = null;
      let maxRightEdge = -Infinity;
      for (const a of cluster) {
        if (a.id === b.id) continue;
        const rightA = a.x + a.width;
        if (rightA <= b.x + 0.5) {
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapY > 0.5) {
            if (rightA > maxRightEdge) {
              maxRightEdge = rightA;
              closestA = a;
            }
          }
        }
      }
      if (closestA) {
        const gap = Math.max(0, b.x - (closestA.x + closestA.width));
        leftNeighbors.set(b.id, { neighborId: closestA.id, gap });
        const list = rightNeighbors.get(closestA.id) || [];
        list.push(b.id);
        rightNeighbors.set(closestA.id, list);
      }
    }

    const topNeighbors = new Map<string, { neighborId: string; gap: number }>();
    const bottomNeighbors = new Map<string, string[]>();
    for (const b of cluster) {
      let closestC: PhotoFrameElement | null = null;
      let maxBottomEdge = -Infinity;
      for (const c of cluster) {
        if (c.id === b.id) continue;
        const bottomC = c.y + c.height;
        if (bottomC <= b.y + 0.5) {
          const overlapX = Math.min(c.x + c.width, b.x + b.width) - Math.max(c.x, b.x);
          if (overlapX > 0.5) {
            if (bottomC > maxBottomEdge) {
              maxBottomEdge = bottomC;
              closestC = c;
            }
          }
        }
      }
      if (closestC) {
        const gap = Math.max(0, b.y - (closestC.y + closestC.height));
        topNeighbors.set(b.id, { neighborId: closestC.id, gap });
        const list = bottomNeighbors.get(closestC.id) || [];
        list.push(b.id);
        bottomNeighbors.set(closestC.id, list);
      }
    }

    // 2. Measure max column depth and max row depth along paths
    let maxColDepth = 0;
    let maxOldGapX = 0;
    for (const frame of cluster) {
      let depth = 0;
      let curGap = 0;
      let curId = frame.id;
      const visited = new Set<string>();
      while (leftNeighbors.has(curId) && !visited.has(curId)) {
        visited.add(curId);
        depth++;
        curGap += leftNeighbors.get(curId)!.gap;
        curId = leftNeighbors.get(curId)!.neighborId;
      }
      maxColDepth = Math.max(maxColDepth, depth);
      maxOldGapX = Math.max(maxOldGapX, curGap);
    }

    let maxRowDepth = 0;
    let maxOldGapY = 0;
    for (const frame of cluster) {
      let depth = 0;
      let curGap = 0;
      let curId = frame.id;
      const visited = new Set<string>();
      while (topNeighbors.has(curId) && !visited.has(curId)) {
        visited.add(curId);
        depth++;
        curGap += topNeighbors.get(curId)!.gap;
        curId = topNeighbors.get(curId)!.neighborId;
      }
      maxRowDepth = Math.max(maxRowDepth, depth);
      maxOldGapY = Math.max(maxOldGapY, curGap);
    }

    // 3. Compute scale factors for frames that participate in multi-column / multi-row paths
    const oldSpanX = Math.max(1, totalW - maxOldGapX);
    const newGapTotalX = maxColDepth * targetGapInCanvasUnit;
    const newSpanX = Math.max(1, totalW - newGapTotalX);
    const scaleX = maxColDepth > 0 ? Math.max(0.05, newSpanX / oldSpanX) : 1.0;

    const oldSpanY = Math.max(1, totalH - maxOldGapY);
    const newGapTotalY = maxRowDepth * targetGapInCanvasUnit;
    const newSpanY = Math.max(1, totalH - newGapTotalY);
    const scaleY = maxRowDepth > 0 ? Math.max(0.05, newSpanY / oldSpanY) : 1.0;

    // 4. Compute dimensions
    const newWidths = new Map<string, number>();
    const newHeights = new Map<string, number>();

    for (const f of cluster) {
      if (f.locked) {
        newWidths.set(f.id, f.width);
        newHeights.set(f.id, f.height);
        continue;
      }

      const hasLeft = leftNeighbors.has(f.id);
      const hasRight = (rightNeighbors.get(f.id)?.length || 0) > 0;
      const hasTop = topNeighbors.has(f.id);
      const hasBottom = (bottomNeighbors.get(f.id)?.length || 0) > 0;

      if (!hasLeft && !hasRight && f.width >= totalW * 0.9) {
        newWidths.set(f.id, totalW);
      } else {
        newWidths.set(f.id, Math.max(1, Math.round(f.width * scaleX * 100) / 100));
      }

      if (!hasTop && !hasBottom && f.height >= totalH * 0.9) {
        newHeights.set(f.id, totalH);
      } else {
        newHeights.set(f.id, Math.max(1, Math.round(f.height * scaleY * 100) / 100));
      }
    }

    // 5. Compute topologically sorted positions
    const newPositionsX = new Map<string, number>();
    const sortedByX = [...cluster].sort((a, b) => a.x - b.x);

    for (const f of sortedByX) {
      if (f.locked) {
        newPositionsX.set(f.id, f.x);
        continue;
      }

      const leftEdge = leftNeighbors.get(f.id);
      let posX: number;
      if (leftEdge && newPositionsX.has(leftEdge.neighborId)) {
        const leftId = leftEdge.neighborId;
        const leftX = newPositionsX.get(leftId)!;
        const leftW = newWidths.get(leftId)!;
        posX = Math.round((leftX + leftW + targetGapInCanvasUnit) * 100) / 100;
      } else {
        posX = Math.round((minX + (f.x - rawMinX) * scaleX) * 100) / 100;
      }

      if (hasSafeZone) {
        posX = Math.max(safeMinX, posX);
        const fW = newWidths.get(f.id) || f.width;
        if (posX + fW > safeMaxX) {
          const clampedW = Math.max(1, Math.round((safeMaxX - posX) * 100) / 100);
          newWidths.set(f.id, clampedW);
        }
      }

      newPositionsX.set(f.id, posX);
    }

    const newPositionsY = new Map<string, number>();
    const sortedByY = [...cluster].sort((a, b) => a.y - b.y);

    for (const f of sortedByY) {
      if (f.locked) {
        newPositionsY.set(f.id, f.y);
        continue;
      }

      const topEdge = topNeighbors.get(f.id);
      let posY: number;
      if (topEdge && newPositionsY.has(topEdge.neighborId)) {
        const topId = topEdge.neighborId;
        const topY = newPositionsY.get(topId)!;
        const topH = newHeights.get(topId)!;
        posY = Math.round((topY + topH + targetGapInCanvasUnit) * 100) / 100;
      } else {
        posY = Math.round((minY + (f.y - rawMinY) * scaleY) * 100) / 100;
      }

      if (hasSafeZone) {
        posY = Math.max(safeMinY, posY);
        const fH = newHeights.get(f.id) || f.height;
        if (posY + fH > safeMaxY) {
          const clampedH = Math.max(1, Math.round((safeMaxY - posY) * 100) / 100);
          newHeights.set(f.id, clampedH);
        }
      }

      newPositionsY.set(f.id, posY);
    }

    for (const f of cluster) {
      updatedFramesMap.set(f.id, {
        ...f,
        x: newPositionsX.get(f.id) ?? f.x,
        y: newPositionsY.get(f.id) ?? f.y,
        width: newWidths.get(f.id) ?? f.width,
        height: newHeights.get(f.id) ?? f.height,
      });
    }
  }

  // Preserve original element order and text elements
  return elements.map((el) => (el.type === 'photo' ? (updatedFramesMap.get(el.id) || el) : el));
}
