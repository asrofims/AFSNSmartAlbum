import type { Photo } from './photo';

export interface PhotoPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Place a filmstrip batch around the drop point without overlapping frames. */
export function calculatePhotoBatchPlacement(
  photos: Photo[],
  pageWidth: number,
  pageHeight: number,
  gutterWidth: number,
  safeMargin: number,
  spacing: number,
  target?: { x: number; y: number },
): PhotoPlacement[] {
  if (photos.length === 0) return [];
  const margin = Math.max(0, Math.min(safeMargin, pageWidth / 3, pageHeight / 3));
  const safeW = Math.max(1, pageWidth - margin * 2);
  const safeH = Math.max(1, pageHeight - margin * 2);
  const pageStart = target && target.x >= pageWidth + gutterWidth / 2 ? pageWidth + gutterWidth : 0;
  const columns = Math.max(1, Math.min(photos.length, Math.ceil(Math.sqrt(photos.length * safeW / safeH))));
  const rows = Math.ceil(photos.length / columns);
  const groupW = safeW * 0.8;
  const groupH = safeH * 0.8;
  const gap = Math.max(0, Math.min(spacing, groupW / (columns * 3), groupH / (rows * 3)));
  const cellW = (groupW - gap * (columns - 1)) / columns;
  const cellH = (groupH - gap * (rows - 1)) / rows;
  const centerX = Math.max(pageStart + margin + groupW / 2,
    Math.min(target?.x ?? pageStart + pageWidth / 2, pageStart + pageWidth - margin - groupW / 2));
  const centerY = Math.max(margin + groupH / 2,
    Math.min(target?.y ?? pageHeight / 2, pageHeight - margin - groupH / 2));
  const groupX = centerX - groupW / 2;
  const groupY = centerY - groupH / 2;

  return photos.map((photo, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const itemsInRow = Math.min(columns, photos.length - row * columns);
    const rowW = itemsInRow * cellW + (itemsInRow - 1) * gap;
    const cellX = groupX + (groupW - rowW) / 2 + column * (cellW + gap);
    const cellY = groupY + row * (cellH + gap);
    const aspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
    const width = Math.min(cellW, cellH * aspect);
    const height = width / aspect;
    return { x: cellX + (cellW - width) / 2, y: cellY + (cellH - height) / 2, width, height };
  });
}
