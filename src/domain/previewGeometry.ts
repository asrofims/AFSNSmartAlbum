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
