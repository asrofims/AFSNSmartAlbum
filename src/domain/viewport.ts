import type { RectBounds } from './editor';

/** Use one physical-to-screen scale for the sheet, frames, and page guides. */
export function calculateSpreadViewport(
  spreadWidth: number,
  spreadHeight: number,
  availableWidth: number,
  availableHeight: number,
  zoomScale: number,
): { width: number; height: number; scaleFactor: number } {
  const scaleFactor = Math.min(availableWidth / spreadWidth, availableHeight / spreadHeight) * zoomScale;
  return {
    width: spreadWidth * scaleFactor,
    height: spreadHeight * scaleFactor,
    scaleFactor,
  };
}

export interface PasteboardViewport {
  width: number;
  height: number;
  pageX: number;
  pageY: number;
  viewportWidth: number;
  viewportHeight: number;
  scaleFactor: number;
  spreadWidth: number;
  spreadHeight: number;
}

/** Scrollable workspace extent; only the visible viewport needs a canvas bitmap. */
export function calculatePasteboardViewport(
  spreadWidth: number, spreadHeight: number, scaleFactor: number,
  viewportWidth: number, viewportHeight: number, contentBounds: RectBounds[] = [],
): PasteboardViewport {
  const padX = Math.max(256, viewportWidth * 0.75);
  const padY = Math.max(192, viewportHeight * 0.75);
  let minX = -padX, minY = -padY;
  let maxX = spreadWidth + padX, maxY = spreadHeight + padY;
  for (const bounds of contentBounds) {
    minX = Math.min(minX, bounds.x * scaleFactor - 64);
    minY = Math.min(minY, bounds.y * scaleFactor - 64);
    maxX = Math.max(maxX, (bounds.x + bounds.width) * scaleFactor + 64);
    maxY = Math.max(maxY, (bounds.y + bounds.height) * scaleFactor + 64);
  }
  return { width: maxX - minX, height: maxY - minY, pageX: -minX, pageY: -minY,
    viewportWidth, viewportHeight, scaleFactor, spreadWidth, spreadHeight };
}

/** Preserve the physical point at the viewport center while zoom/extents change. */
export function preservePasteboardView(previous: PasteboardViewport, next: PasteboardViewport, scroll: { x: number; y: number }) {
  const ratio = next.scaleFactor / previous.scaleFactor;
  return {
    x: (scroll.x + previous.viewportWidth / 2 - previous.pageX) * ratio + next.pageX - next.viewportWidth / 2,
    y: (scroll.y + previous.viewportHeight / 2 - previous.pageY) * ratio + next.pageY - next.viewportHeight / 2,
  };
}

export function screenToSpreadPoint(point: { x: number; y: number }, origin: { x: number; y: number }, scaleFactor: number) {
  return { x: (point.x - origin.x) / scaleFactor, y: (point.y - origin.y) / scaleFactor };
}
