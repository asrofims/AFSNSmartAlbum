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
