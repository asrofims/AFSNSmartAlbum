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
  /** CSS-to-device pixel ratio used by the WebView rasterizer. */
  pixelRatio?: number;
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
    pixelRatio = 1,
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
  const rasterScale = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;

  // All alignment is performed in integer device pixels. Integer CSS pixels are
  // insufficient on displays such as Windows at 125% scale: a 1 CSS px gap is
  // 1.25 device pixels and can therefore rasterize as either one or two pixels
  // depending on its position in the spread.
  const targetGapDevicePx = spacing > 0
    ? Math.max(1, Math.round(spacing * scale * rasterScale))
    : 0;

  // 1. Quantize every projected edge onto the WebView's physical pixel grid.
  const nodes = elements.map((el) => {
    const proj = projectPreviewRect(el, projection);
    const left = Math.round(proj.x * rasterScale);
    const top = Math.round(proj.y * rasterScale);
    const right = Math.round((proj.x + proj.width) * rasterScale);
    const bottom = Math.round((proj.y + proj.height) * rasterScale);
    return {
      element: el,
      left,
      top,
      right,
      bottom,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      rot: el.rotation || 0,
    };
  });

  const unrotated = nodes.filter((n) => !n.rot);

  // 2. Anchor outer boundaries and spine folds first, also in device pixels.
  const spineDevicePx = Math.round(spinePx * rasterScale);
  const rightPageStartDevicePx = Math.round(rightPageStartPx * rasterScale);
  const containerWDevicePx = Math.round(containerW * rasterScale);
  const containerHDevicePx = Math.round(containerH * rasterScale);
  const bleedDevicePx = Math.round(bleedPx * rasterScale);
  const bleedLeftDevicePx = Math.round(bleedLeftPx * rasterScale);

  for (const p of unrotated) {
    const el = p.element;
    const isPhotoBorder = el.type === 'photo' && Boolean(el.borderEnabled && (el.borderWidth || 0) > 0);

    const touchesLeft = (el.x - viewLeft) <= tol;
    const touchesTop = el.y <= tol;
    const touchesRight = (el.x + el.width - viewOffsetX) >= (viewContentWidth - tol);
    const touchesBottom = (el.y + el.height) >= (baseSpreadH - tol);

    if (touchesLeft) {
      p.left = (includeBleed && bleedLeftPx > 0 && viewMode !== 'right-page')
        ? 0
        : (viewMode === 'right-page' ? 0 : bleedLeftDevicePx);
    }
    if (touchesTop) {
      p.top = (includeBleed && bleedPx > 0) ? 0 : bleedDevicePx;
    }
    if (touchesRight) {
      p.right = containerWDevicePx + 1; // One physical pixel overlap for clean clipping.
    }
    if (touchesBottom) {
      p.bottom = containerHDevicePx + 1;
    }

    if (viewMode === 'spread') {
      const rightPageStartX = singlePageW + gutterW;

      // Frame on Left Page physically touching center spine fold
      const touchesSpineFromLeft = Math.abs(el.x + el.width - singlePageW) <= tol;
      if (touchesSpineFromLeft) {
        const overlap = (gutterW === 0 && !isPhotoBorder) ? 1 : 0;
        p.right = spineDevicePx + overlap;
      }

      // Frame on Right Page physically touching center spine fold
      const touchesSpineFromRight = Math.abs(el.x - rightPageStartX) <= tol;
      if (touchesSpineFromRight) {
        const w = p.right - p.left;
        p.left = rightPageStartDevicePx;
        p.right = p.left + w;
      }
    }
  }

  // 3. 2D topological horizontal alignment (left to right).
  // Adjacent configured gaps receive the exact same physical-pixel width.
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

    if (bestA) {
      const physGapX = b.origX - (bestA.origX + bestA.origW);
      const isTargetGap = spacing > 0 && Math.abs(physGapX - spacing) <= Math.max(1.0, spacing * 0.15);
      if (isTargetGap) {
        const touchesRightOrSpine = (viewMode === 'spread' && Math.abs(b.origX + b.origW - singlePageW) <= tol)
          || (b.origX + b.origW - viewOffsetX) >= (viewContentWidth - tol);
        const newLeft = bestA.right + targetGapDevicePx;
        if (touchesRightOrSpine) {
          b.left = newLeft;
        } else {
          const w = b.right - b.left;
          b.left = newLeft;
          b.right = b.left + w;
        }
      } else if (physGapX > 0.5 && b.left <= bestA.right) {
        // Physical gap invariant: non-zero layout gap must never collapse to 0 or overlap in preview
        const touchesRightOrSpine = (viewMode === 'spread' && Math.abs(b.origX + b.origW - singlePageW) <= tol)
          || (b.origX + b.origW - viewOffsetX) >= (viewContentWidth - tol);
        const newLeft = bestA.right + 1;
        if (touchesRightOrSpine) {
          b.left = newLeft;
        } else {
          const w = b.right - b.left;
          b.left = newLeft;
          b.right = b.left + w;
        }
      }
    }
  }

  // 4. 2D topological vertical alignment (top to bottom).
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

    if (bestC) {
      const physGapY = b.origY - (bestC.origY + bestC.origH);
      const isTargetGap = spacing > 0 && Math.abs(physGapY - spacing) <= Math.max(1.0, spacing * 0.15);
      if (isTargetGap) {
        const touchesBottom = (viewMode === 'spread' && (b.origY + b.origH) >= (baseSpreadH - tol))
          || (b.origY + b.origH) >= (baseSpreadH - tol);
        const newTop = bestC.bottom + targetGapDevicePx;
        if (touchesBottom) {
          b.top = newTop;
        } else {
          const h = b.bottom - b.top;
          b.top = newTop;
          b.bottom = b.top + h;
        }
      } else if (physGapY > 0.5 && b.top <= bestC.bottom) {
        // Physical gap invariant: non-zero layout gap must never collapse to 0 or overlap in preview
        const touchesBottom = (b.origY + b.origH) >= (baseSpreadH - tol);
        const newTop = bestC.bottom + 1;
        if (touchesBottom) {
          b.top = newTop;
        } else {
          const h = b.bottom - b.top;
          b.top = newTop;
          b.bottom = b.top + h;
        }
      }
    }
  }

  return nodes.map((p) => ({
    element: p.element,
    renderX: p.left / rasterScale,
    renderY: p.top / rasterScale,
    renderW: Math.max(1, p.right - p.left) / rasterScale,
    renderH: Math.max(1, p.bottom - p.top) / rasterScale,
  }));
}

