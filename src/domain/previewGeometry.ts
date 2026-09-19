export type PreviewViewMode = 'spread' | 'left-page' | 'right-page';

export interface PreviewProjection {
  scale: number;
  width: number;
  height: number;
  bleed: number;
  bleedPx: number;
  bleedLeftPx: number;
  bleedRightPx: number;
  viewOffsetX: number;
  spineX: number;
  rightPageX: number;
}

/** Keep every preview edge in the same physical coordinate system as the canvas. */
export function calculatePreviewProjection(
  pageWidth: number,
  pageHeight: number,
  gutterWidth: number,
  boxWidth: number,
  boxHeight: number,
  viewMode: PreviewViewMode = 'spread',
  bleed = 0,
): PreviewProjection {
  const contentWidth = viewMode === 'spread' ? pageWidth * 2 + gutterWidth : pageWidth;
  const viewOffsetX = viewMode === 'right-page' ? pageWidth + gutterWidth : 0;
  // Split-page exports are sliced at the spine. Each page retains bleed only
  // at its outside edge; the inner edge has no extra strip.
  const bleedLeft = viewMode === 'right-page' ? 0 : bleed;
  const bleedRight = viewMode === 'left-page' ? 0 : bleed;
  const scale = Math.min(boxWidth / (contentWidth + bleedLeft + bleedRight), boxHeight / (pageHeight + bleed * 2));
  return {
    scale,
    width: (contentWidth + bleedLeft + bleedRight) * scale,
    height: (pageHeight + bleed * 2) * scale,
    bleed,
    bleedPx: bleed * scale,
    bleedLeftPx: bleedLeft * scale,
    bleedRightPx: bleedRight * scale,
    viewOffsetX,
    spineX: (pageWidth - viewOffsetX + bleedLeft) * scale,
    rightPageX: (pageWidth + gutterWidth - viewOffsetX + bleedLeft) * scale,
  };
}

export function projectPreviewRect(
  rect: { x: number; y: number; width: number; height: number },
  projection: PreviewProjection,
) {
  return {
    x: (rect.x - projection.viewOffsetX) * projection.scale + projection.bleedLeftPx,
    y: (rect.y + projection.bleed) * projection.scale,
    width: rect.width * projection.scale,
    height: rect.height * projection.scale,
  };
}

export interface PreviewAlignedBounds<T = any> {
  element: T;
  renderX: number;
  renderY: number;
  renderW: number;
  renderH: number;
}

export interface PreviewAlignmentOptions<T = any> {
  elements: T[];
  projection: PreviewProjection;
  singlePageW: number;
  singlePageH: number;
  gutterW: number;
  spacing: number;
  viewMode: PreviewViewMode;
  includeBleed: boolean;
}

/**
 * Normalizes preview frame bounds across the 2D Topological Spatial Neighbor Graph.
 * Guarantees that all inter-frame gaps representing project default photo spacing
 * render with 100% uniform, identical screen pixel thickness in both horizontal and
 * vertical directions, eliminating subpixel rasterization asymmetry.
 */
export function alignPreviewElementBounds<
  T extends {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    type?: string;
    borderEnabled?: boolean;
    borderWidth?: number;
  }
>(options: PreviewAlignmentOptions<T>): PreviewAlignedBounds<T>[] {
  const {
    elements,
    projection,
    singlePageW,
    singlePageH,
    gutterW,
    spacing,
    viewMode,
    includeBleed,
  } = options;

  const {
    scale,
    width: containerW,
    height: containerH,
    bleedPx,
    bleedLeftPx,
    spineX: spinePx,
    rightPageX: rightPageStartPx,
    viewOffsetX,
  } = projection;

  const baseSpreadW = singlePageW * 2 + gutterW;
  const baseSpreadH = singlePageH;
  const viewContentWidth = viewMode === 'spread' ? baseSpreadW : singlePageW;
  const viewLeft = viewOffsetX;
  const tol = 0.15;

  // Compute uniform integer pixel gap for the configured project spacing
  const targetGapPx = spacing > 0 ? Math.max(1, Math.round(spacing * scale)) : 0;

  // 1. Initial 1:1 projection
  const projected = elements.map((el) => {
    const proj = projectPreviewRect(el, projection);
    return {
      element: el,
      renderX: proj.x,
      renderY: proj.y,
      renderW: proj.width,
      renderH: proj.height,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      rot: el.rotation || 0,
    };
  });

  // 2. 2D Topological Neighbor Graph for Unrotated Elements:
  // Enforce consistent uniform targetGapPx across adjacent frames sharing standard project spacing
  const unrotated = projected.filter((p) => !p.rot);

  // Sort by X ascending to process topological chains from left to right
  const sortedByX = [...unrotated].sort((a, b) => a.origX - b.origX);
  for (const b of sortedByX) {
    let bestA: typeof b | null = null;
    let bestRight = -Infinity;

    for (const a of sortedByX) {
      if (a.element.id === b.element.id) continue;
      const rightA = a.origX + a.origW;
      if (rightA <= b.origX + tol) {
        const overlapY = Math.min(a.origY + a.origH, b.origY + b.origH) - Math.max(a.origY, b.origY);
        if (overlapY > 0.5) {
          if (rightA > bestRight) {
            bestRight = rightA;
            bestA = a;
          }
        }
      }
    }

    if (bestA && spacing > 0) {
      const physGapX = b.origX - (bestA.origX + bestA.origW);
      if (Math.abs(physGapX - spacing) <= 0.5) {
        const currentScreenGap = b.renderX - (bestA.renderX + bestA.renderW);
        const diff = targetGapPx - currentScreenGap;
        b.renderX += diff;
        b.renderW -= diff;
      }
    }
  }

  // Sort by Y ascending to process topological chains from top to bottom
  const sortedByY = [...unrotated].sort((a, b) => a.origY - b.origY);
  for (const b of sortedByY) {
    let bestC: typeof b | null = null;
    let bestBottom = -Infinity;

    for (const c of sortedByY) {
      if (c.element.id === b.element.id) continue;
      const bottomC = c.origY + c.origH;
      if (bottomC <= b.origY + tol) {
        const overlapX = Math.min(c.origX + c.origW, b.origX + b.origW) - Math.max(c.origX, b.origX);
        if (overlapX > 0.5) {
          if (bottomC > bestBottom) {
            bestBottom = bottomC;
            bestC = c;
          }
        }
      }
    }

    if (bestC && spacing > 0) {
      const physGapY = b.origY - (bestC.origY + bestC.origH);
      if (Math.abs(physGapY - spacing) <= 0.5) {
        const currentScreenGap = b.renderY - (bestC.renderY + bestC.renderH);
        const diff = targetGapPx - currentScreenGap;
        b.renderY += diff;
        b.renderH -= diff;
      }
    }
  }

  // 3. Boundary snapping and Center Spine Snapping
  for (const p of unrotated) {
    const el = p.element;
    const isPhotoBorder = el.type === 'photo' && Boolean(el.borderEnabled && (el.borderWidth || 0) > 0);

    const touchesLeft = (el.x - viewLeft) <= tol || p.renderX <= 1.5;
    const touchesTop = el.y <= tol || p.renderY <= 1.5;
    const touchesRight = (el.x + el.width - viewOffsetX) >= (viewContentWidth - tol)
      || (p.renderX + p.renderW >= containerW - 1.5);
    const touchesBottom = (el.y + el.height) >= (baseSpreadH - tol)
      || (p.renderY + p.renderH >= containerH - 1.5);

    if (touchesLeft) {
      p.renderX = 0;
      if (includeBleed && bleedLeftPx > 0 && viewMode !== 'right-page' && el.x <= tol) {
        p.renderW += bleedLeftPx;
      }
    }

    if (touchesTop) {
      p.renderY = 0;
      if (includeBleed && bleedPx > 0 && el.y <= tol) {
        p.renderH += bleedPx;
      }
    }

    if (touchesRight) {
      p.renderW = Math.max(p.renderW, containerW - p.renderX + 1);
    }

    if (touchesBottom) {
      p.renderH = Math.max(p.renderH, containerH - p.renderY + 1);
    }

    if (viewMode === 'spread') {
      const rightPageStartX = singlePageW + gutterW;

      // 1. Frame on Left Page touching center spine fold
      const touchesSpineFromLeft = Math.abs(el.x + el.width - singlePageW) <= tol
        || Math.abs(p.renderX + p.renderW - spinePx) <= 1.5;

      if (touchesSpineFromLeft) {
        const overlap = (gutterW === 0 && !isPhotoBorder) ? 1 : 0;
        p.renderW = Math.max(p.renderW, spinePx - p.renderX + overlap);
      }

      // 2. Frame on Right Page touching center spine fold
      const touchesSpineFromRight = Math.abs(el.x - rightPageStartX) <= tol
        || Math.abs(p.renderX - rightPageStartPx) <= 1.5;

      if (touchesSpineFromRight) {
        const shift = p.renderX - rightPageStartPx;
        p.renderX = rightPageStartPx;
        p.renderW += shift;
      }
    }
  }

  return projected.map((p) => ({
    element: p.element,
    renderX: p.renderX,
    renderY: p.renderY,
    renderW: p.renderW,
    renderH: p.renderH,
  }));
}

