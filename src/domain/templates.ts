import { Unit, convertUnit } from './units';
import { Project } from './project';
import { Spread } from './album';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateParams {
  spreadWidth: number;
  spreadHeight: number;
  isSpread: boolean; // true for 2-page spread, false for single-page cover
  safeMargin: number; // in canvasUnit
  photoInset?: number;
  photoInsetTop?: number;
  photoInsetBottom?: number;
  photoInsetLeft?: number;
  photoInsetRight?: number; // in canvasUnit (extra dynamic breathing room inside safeMargin)
  gutterWidth: number; // in canvasUnit
  spacing: number; // in canvasUnit
  currentPhotos?: Array<{
    id?: string;
    photoId?: string | null;
    filePath?: string;
    fileName?: string;
    previewPath?: string;
    thumbnailPath?: string;
    photoAspect?: number;
  }>;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Extracts and unifies all project & spread physical dimensions into the project's native canvasUnit.
 * This completely prevents unit mismatch bugs (e.g. 10mm margin on an 8 inch canvas).
 */
export function getProjectDimensionsInCanvasUnit(project: Project, spread?: Spread | null): {
  pageWidth: number;
  pageHeight: number;
  unit: Unit;
  dpi: number;
  safeMargin: number;
  photoInset: number;
  photoInsetTop: number;
  photoInsetBottom: number;
  photoInsetLeft: number;
  photoInsetRight: number;
  gutterWidth: number;
  spacing: number;
  bleed: number;
} {
  const unit = project.canvasUnit;
  const dpi = project.canvasDpi || 300;

  const pageWidth = project.canvasWidth;
  const pageHeight = project.canvasHeight;

  // Margin: convert from project.marginUnit (or 'mm') to project.canvasUnit
  const rawMargin = spread?.safeArea ?? project.marginValue ?? 10;
  const marginUnit = project.marginUnit || 'mm';
  const safeMargin = round4(convertUnit(rawMargin, marginUnit, unit, dpi, 4));

  // Inset / Photo Padding: convert from project.photoInsetUnit (or 0) to project.canvasUnit
  const rawInset = spread?.photoInset ?? project.photoInset ?? 0;
  const rawInsetTop = spread?.photoInsetTop ?? project.photoInsetTop ?? rawInset;
  const rawInsetBottom = spread?.photoInsetBottom ?? project.photoInsetBottom ?? rawInset;
  const rawInsetLeft = spread?.photoInsetLeft ?? project.photoInsetLeft ?? rawInset;
  const rawInsetRight = spread?.photoInsetRight ?? project.photoInsetRight ?? rawInset;

  const insetUnit = project.photoInsetUnit || project.marginUnit || 'mm';
  const photoInset = round4(convertUnit(rawInset, insetUnit, unit, dpi, 4));
  const photoInsetTop = round4(convertUnit(rawInsetTop, insetUnit, unit, dpi, 4));
  const photoInsetBottom = round4(convertUnit(rawInsetBottom, insetUnit, unit, dpi, 4));
  const photoInsetLeft = round4(convertUnit(rawInsetLeft, insetUnit, unit, dpi, 4));
  const photoInsetRight = round4(convertUnit(rawInsetRight, insetUnit, unit, dpi, 4));

  // Spacing: convert from project.spacingUnit (or 'mm') to project.canvasUnit
  const rawSpacing = project.spacingValue ?? 4;
  const spacingUnit = project.spacingUnit || 'mm';
  const spacing = round4(convertUnit(rawSpacing, spacingUnit, unit, dpi, 4));

  // Gutter: In layflat photobooks, physical spread width is strictly 2 * pageWidth without spine expansion
  const gutterWidth = 0;

  // Bleed: convert from spread.bleed (or 3mm) to project.canvasUnit
  const rawBleed = spread?.bleed ?? 3;
  const bleed = round4(convertUnit(rawBleed, 'mm', unit, dpi, 4));

  return {
    pageWidth,
    pageHeight,
    unit,
    dpi,
    safeMargin,
    photoInset,
    photoInsetTop,
    photoInsetBottom,
    photoInsetLeft,
    photoInsetRight,
    gutterWidth,
    spacing,
    bleed,
  };
}

/**
 * Fits a photo with given aspect ratio centered horizontally & vertically inside a container box.
 */
export function fitInsideBoxCentered(
  container: RectBounds,
  photoAspect = 1.5,
  coverage = 1.0
): RectBounds {
  const maxW = container.width * coverage;
  const maxH = container.height * coverage;
  const boxAspect = maxW / Math.max(0.001, maxH);

  let w: number;
  let h: number;

  if (photoAspect >= boxAspect) {
    w = maxW;
    h = w / photoAspect;
  } else {
    h = maxH;
    w = h * photoAspect;
  }

  w = round4(w);
  h = round4(h);

  const x = round4(container.x + (container.width - w) / 2);
  const y = round4(container.y + (container.height - h) / 2);

  return { x, y, width: w, height: h };
}

/**
 * Computes exact printable and designable Safe Margin boxes for Left Page and Right Page.
 * Conforms 100% with the Blue Dashed Safe Guide Lines on the canvas + dynamic photoInset.
 */
export function getUsableAreas(params: TemplateParams): {
  spreadArea: RectBounds;
  leftPageArea: RectBounds;
  rightPageArea: RectBounds;
  pageWidth: number;
  gutterWidth: number;
} {
  const {
    spreadWidth,
    spreadHeight,
    isSpread,
    safeMargin,
    photoInset = 0,
    photoInsetTop,
    photoInsetBottom,
    photoInsetLeft,
    photoInsetRight,
    gutterWidth,
  } = params;

  const insetTop = photoInsetTop !== undefined ? photoInsetTop : photoInset;
  const insetBottom = photoInsetBottom !== undefined ? photoInsetBottom : photoInset;
  const insetLeft = photoInsetLeft !== undefined ? photoInsetLeft : photoInset;
  const insetRight = photoInsetRight !== undefined ? photoInsetRight : photoInset;

  if (!isSpread) {
    const singleArea: RectBounds = {
      x: round4(safeMargin + insetLeft),
      y: round4(safeMargin + insetTop),
      width: Math.max(0.1, round4(spreadWidth - safeMargin * 2 - insetLeft - insetRight)),
      height: Math.max(0.1, round4(spreadHeight - safeMargin * 2 - insetTop - insetBottom)),
    };
    return {
      spreadArea: singleArea,
      leftPageArea: singleArea,
      rightPageArea: singleArea,
      pageWidth: spreadWidth,
      gutterWidth: 0,
    };
  }

  // On a 2-page spread: spreadWidth = leftPageWidth + gutterWidth + rightPageWidth
  const pageWidth = round4((spreadWidth - gutterWidth) / 2);

  // Left Page: outer left edge insets by insetLeft, top by insetTop, bottom by insetBottom.
  // Inner spine edge stays anchored at safeMargin before gutter.
  const leftPageArea: RectBounds = {
    x: round4(safeMargin + insetLeft),
    y: round4(safeMargin + insetTop),
    width: Math.max(0.1, round4(pageWidth - safeMargin * 2 - insetLeft)),
    height: Math.max(0.1, round4(spreadHeight - safeMargin * 2 - insetTop - insetBottom)),
  };

  // Right Page: inner spine edge stays anchored at safeMargin after gutter.
  // Outer right edge insets by insetRight, top by insetTop, bottom by insetBottom.
  const rightPageArea: RectBounds = {
    x: round4(pageWidth + gutterWidth + safeMargin),
    y: round4(safeMargin + insetTop),
    width: Math.max(0.1, round4(pageWidth - safeMargin * 2 - insetRight)),
    height: Math.max(0.1, round4(spreadHeight - safeMargin * 2 - insetTop - insetBottom)),
  };

  // Full Spread Area across both pages
  const spreadArea: RectBounds = {
    x: round4(safeMargin + insetLeft),
    y: round4(safeMargin + insetTop),
    width: Math.max(0.1, round4(spreadWidth - safeMargin * 2 - insetLeft - insetRight)),
    height: Math.max(0.1, round4(spreadHeight - safeMargin * 2 - insetTop - insetBottom)),
  };

  return { spreadArea, leftPageArea, rightPageArea, pageWidth, gutterWidth };
}
