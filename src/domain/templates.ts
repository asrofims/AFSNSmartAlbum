import { PhotoFrameElement } from './editor';
import { Unit, convertUnit } from './units';
import { Project } from './project';
import { Spread } from './album';

export type TemplateCategory = 'all' | '1_photo' | '2_photos' | '3_photos' | '4_photos' | '5+_photos' | 'custom';

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

export interface LayoutTemplate {
  id: string;
  name: string;
  photoCount: number;
  category: 'single_page' | 'spread' | 'both';
  description: string;
  tags: string[];
  generateRects: (params: TemplateParams) => RectBounds[];
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

  // Gutter: convert from spread.gutterUnit (or project.canvasUnit) to project.canvasUnit
  const rawGutter = spread?.gutterWidth ?? 0;
  const gutterUnit = spread?.gutterUnit || unit;
  const gutterWidth = round4(convertUnit(rawGutter, gutterUnit, unit, dpi, 4));

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

// ==============================================================
// 25+ CURATED PROFESSIONAL VISUAL GRID BLUEPRINTS
// ==============================================================

export const BUILTIN_LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // --- 1 PHOTO ---
  {
    id: '1p_right_page_safe_hero',
    name: 'Right Page Hero (Centered inside Safe Zone)',
    photoCount: 1,
    category: 'spread',
    description: 'Perfect center & middle alignment within the right page blue safe margin box.',
    tags: ['safe', 'hero', 'right', 'centered'],
    generateRects: (p) => {
      const { rightPageArea } = getUsableAreas(p);
      const aspect = p.currentPhotos?.[0]?.photoAspect || 1.5;
      return [fitInsideBoxCentered(rightPageArea, aspect, 1.0)];
    },
  },
  {
    id: '1p_left_page_safe_hero',
    name: 'Left Page Hero (Centered inside Safe Zone)',
    photoCount: 1,
    category: 'spread',
    description: 'Perfect center & middle alignment within the left page blue safe margin box.',
    tags: ['safe', 'hero', 'left', 'centered'],
    generateRects: (p) => {
      const { leftPageArea } = getUsableAreas(p);
      const aspect = p.currentPhotos?.[0]?.photoAspect || 1.5;
      return [fitInsideBoxCentered(leftPageArea, aspect, 1.0)];
    },
  },
  {
    id: '1p_right_page_safe_fill',
    name: 'Right Page Full Safe Box',
    photoCount: 1,
    category: 'spread',
    description: 'Fills the entire right page safe margin box cleanly.',
    tags: ['safe', 'hero', 'fill'],
    generateRects: (p) => [{ ...getUsableAreas(p).rightPageArea }],
  },
  {
    id: '1p_left_page_safe_fill',
    name: 'Left Page Full Safe Box',
    photoCount: 1,
    category: 'spread',
    description: 'Fills the entire left page safe margin box cleanly.',
    tags: ['safe', 'hero', 'fill'],
    generateRects: (p) => [{ ...getUsableAreas(p).leftPageArea }],
  },
  {
    id: '1p_classic_centered',
    name: 'Classic Centered Fine-Art',
    photoCount: 1,
    category: 'both',
    description: 'Generous white borders with a balanced centered focal photo.',
    tags: ['classic', 'minimal', 'fine-art'],
    generateRects: (p) => {
      const { spreadArea, rightPageArea } = getUsableAreas(p);
      const targetBox = p.isSpread ? rightPageArea : spreadArea;
      const aspect = p.currentPhotos?.[0]?.photoAspect || 1.5;
      return [fitInsideBoxCentered(targetBox, aspect, 0.82)];
    },
  },
  {
    id: '1p_full_spread_bleed',
    name: 'Full Bleed Panoramic Hero',
    photoCount: 1,
    category: 'spread',
    description: 'Panoramic edge-to-edge full spread statement photograph.',
    tags: ['hero', 'panorama', 'full-bleed'],
    generateRects: (p) => [
      { x: 0, y: 0, width: round4(p.spreadWidth), height: round4(p.spreadHeight) },
    ],
  },

  // --- 2 PHOTOS ---
  {
    id: '2p_facing_diptych_fit',
    name: 'Facing Diptych (Centered in Safe Boxes)',
    photoCount: 2,
    category: 'spread',
    description: 'Two balanced photographs centered in middle of left & right safe margin boxes.',
    tags: ['diptych', 'centered', 'fit'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const aspect0 = p.currentPhotos?.[0]?.photoAspect || 1.5;
      const aspect1 = p.currentPhotos?.[1]?.photoAspect || 1.5;
      return [
        fitInsideBoxCentered(leftPageArea, aspect0, 1.0),
        fitInsideBoxCentered(rightPageArea, aspect1, 1.0),
      ];
    },
  },
  {
    id: '2p_facing_diptych',
    name: 'Facing Page Diptych (Full Safe Boxes)',
    photoCount: 2,
    category: 'spread',
    description: 'Symmetrical alignment filling the safe margin boxes of both pages.',
    tags: ['diptych', 'balanced', 'safe'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      return [{ ...leftPageArea }, { ...rightPageArea }];
    },
  },
  {
    id: '2p_right_page_stack',
    name: 'Stacked Dual Photos (Right Page)',
    photoCount: 2,
    category: 'spread',
    description: 'Two horizontal photos stacked vertically inside the right page safe box.',
    tags: ['stack', 'vertical', 'right'],
    generateRects: (p) => {
      const { rightPageArea } = getUsableAreas(p);
      const h = round4((rightPageArea.height - p.spacing) / 2);
      return [
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: h },
        { x: rightPageArea.x, y: round4(rightPageArea.y + h + p.spacing), width: rightPageArea.width, height: h },
      ];
    },
  },
  {
    id: '2p_left_hero_right_companion',
    name: 'Left Safe Hero + Right Fine-Art',
    photoCount: 2,
    category: 'spread',
    description: 'Full left safe box hero with a centered fine-art portrait on the right page.',
    tags: ['hero', 'asymmetric', 'portrait'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const aspect1 = p.currentPhotos?.[1]?.photoAspect || 1.5;
      return [
        { ...leftPageArea },
        fitInsideBoxCentered(rightPageArea, aspect1, 0.82),
      ];
    },
  },

  // --- 3 PHOTOS ---
  {
    id: '3p_left_hero_right_stack',
    name: '1 Left Hero + 2 Right Stacked',
    photoCount: 3,
    category: 'spread',
    description: 'Full left page hero with two stacked photos inside the right page safe box.',
    tags: ['hero', 'stack', 'popular'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const stackH = round4((rightPageArea.height - p.spacing) / 2);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: stackH },
        { x: rightPageArea.x, y: round4(rightPageArea.y + stackH + p.spacing), width: rightPageArea.width, height: stackH },
      ];
    },
  },
  {
    id: '3p_2left_stack_1right_hero',
    name: '2 Left Stacked + 1 Right Hero',
    photoCount: 3,
    category: 'spread',
    description: 'Two stacked photos inside the left safe box leading into a full right hero.',
    tags: ['hero', 'stack', 'editorial'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const stackH = round4((leftPageArea.height - p.spacing) / 2);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: stackH },
        { x: leftPageArea.x, y: round4(leftPageArea.y + stackH + p.spacing), width: leftPageArea.width, height: stackH },
        { ...rightPageArea },
      ];
    },
  },
  {
    id: '3p_left_hero_right_2columns',
    name: '1 Left Hero + 2 Right Portrait Columns',
    photoCount: 3,
    category: 'spread',
    description: 'Left safe hero with two vertical portrait columns on the right page.',
    tags: ['hero', 'columns', 'portraits'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const colW = round4((rightPageArea.width - p.spacing) / 2);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: colW, height: rightPageArea.height },
        { x: round4(rightPageArea.x + colW + p.spacing), y: rightPageArea.y, width: colW, height: rightPageArea.height },
      ];
    },
  },

  // --- 4 PHOTOS ---
  {
    id: '4p_facing_2plus2_stacks',
    name: 'Facing 2+2 Stacks (Both Pages)',
    photoCount: 4,
    category: 'spread',
    description: 'Two stacked photos on left page and two stacked photos on right page.',
    tags: ['diptych', 'grid', 'safe'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const leftH = round4((leftPageArea.height - p.spacing) / 2);
      const rightH = round4((rightPageArea.height - p.spacing) / 2);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round4(leftPageArea.y + leftH + p.spacing), width: leftPageArea.width, height: leftH },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rightH },
        { x: rightPageArea.x, y: round4(rightPageArea.y + rightH + p.spacing), width: rightPageArea.width, height: rightH },
      ];
    },
  },
  {
    id: '4p_lead_hero_3_sidebar',
    name: '1 Left Hero + 3 Right Strip Columns',
    photoCount: 4,
    category: 'spread',
    description: 'Dominant left page safe hero with 3 vertical detail columns on right page.',
    tags: ['hero', 'details', 'editorial'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const stripW = round4((rightPageArea.width - p.spacing * 2) / 3);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: stripW, height: rightPageArea.height },
        { x: round4(rightPageArea.x + stripW + p.spacing), y: rightPageArea.y, width: stripW, height: rightPageArea.height },
        { x: round4(rightPageArea.x + (stripW + p.spacing) * 2), y: rightPageArea.y, width: stripW, height: rightPageArea.height },
      ];
    },
  },
  {
    id: '4p_balanced_2x2_grid',
    name: 'Balanced 2x2 Grid',
    photoCount: 4,
    category: 'both',
    description: 'Four equal quadrant frames respecting margin boundaries.',
    tags: ['grid', 'balanced', 'classic'],
    generateRects: (p) => {
      const { spreadArea } = getUsableAreas(p);
      const w = round4((spreadArea.width - p.spacing) / 2);
      const h = round4((spreadArea.height - p.spacing) / 2);
      const x2 = round4(spreadArea.x + w + p.spacing);
      const y2 = round4(spreadArea.y + h + p.spacing);
      return [
        { x: spreadArea.x, y: spreadArea.y, width: w, height: h },
        { x: x2, y: spreadArea.y, width: w, height: h },
        { x: spreadArea.x, y: y2, width: w, height: h },
        { x: x2, y: y2, width: w, height: h },
      ];
    },
  },

  // --- 5 PHOTOS ---
  {
    id: '5p_left_4grid_right_hero',
    name: '4 Left 2x2 Grid + 1 Right Hero',
    photoCount: 5,
    category: 'spread',
    description: 'Four corner detail grid photos on left page paired with 1 major right page hero.',
    tags: ['hero', 'grid', 'wedding'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const gridW = round4((leftPageArea.width - p.spacing) / 2);
      const gridH = round4((leftPageArea.height - p.spacing) / 2);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: gridW, height: gridH },
        { x: round4(leftPageArea.x + gridW + p.spacing), y: leftPageArea.y, width: gridW, height: gridH },
        { x: leftPageArea.x, y: round4(leftPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
        { x: round4(leftPageArea.x + gridW + p.spacing), y: round4(leftPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
        { ...rightPageArea },
      ];
    },
  },
  {
    id: '5p_left_hero_right_4grid',
    name: '1 Left Hero + 4 Right 2x2 Grid',
    photoCount: 5,
    category: 'spread',
    description: '1 major left page hero paired with four corner detail grid photos on right page.',
    tags: ['hero', 'grid', 'wedding'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const gridW = round4((rightPageArea.width - p.spacing) / 2);
      const gridH = round4((rightPageArea.height - p.spacing) / 2);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: gridW, height: gridH },
        { x: round4(rightPageArea.x + gridW + p.spacing), y: rightPageArea.y, width: gridW, height: gridH },
        { x: rightPageArea.x, y: round4(rightPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
        { x: round4(rightPageArea.x + gridW + p.spacing), y: round4(rightPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
      ];
    },
  },

  // --- 6 PHOTOS ---
  {
    id: '6p_facing_3plus3_grids',
    name: 'Facing 3+3 Storyboard (Both Pages)',
    photoCount: 6,
    category: 'spread',
    description: 'Three photos on left page and three photos on right page for detailed sequence storytelling.',
    tags: ['storyboard', 'narrative', 'detailed'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const leftTopH = round4((leftPageArea.height - p.spacing) * 0.55);
      const leftBotH = round4(leftPageArea.height - p.spacing - leftTopH);
      const leftBotW = round4((leftPageArea.width - p.spacing) / 2);

      const rightTopH = round4((rightPageArea.height - p.spacing) * 0.55);
      const rightBotH = round4(rightPageArea.height - p.spacing - rightTopH);
      const rightBotW = round4((rightPageArea.width - p.spacing) / 2);

      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftTopH },
        { x: leftPageArea.x, y: round4(leftPageArea.y + leftTopH + p.spacing), width: leftBotW, height: leftBotH },
        { x: round4(leftPageArea.x + leftBotW + p.spacing), y: round4(leftPageArea.y + leftTopH + p.spacing), width: leftBotW, height: leftBotH },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rightTopH },
        { x: rightPageArea.x, y: round4(rightPageArea.y + rightTopH + p.spacing), width: rightBotW, height: rightBotH },
        { x: round4(rightPageArea.x + rightBotW + p.spacing), y: round4(rightPageArea.y + rightTopH + p.spacing), width: rightBotW, height: rightBotH },
      ];
    },
  },

  // --- 7 & 8 PHOTOS ---
  {
    id: '7p_editorial_feature',
    name: '3 Left Stacks + 4 Right 2x2 Grid',
    photoCount: 7,
    category: 'spread',
    description: '3 stacked landscape rows on left page and 4 corner detail grid tiles on right page.',
    tags: ['editorial', 'mosaic', 'large'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const leftH = round4((leftPageArea.height - p.spacing * 2) / 3);
      const rightGridW = round4((rightPageArea.width - p.spacing) / 2);
      const rightGridH = round4((rightPageArea.height - p.spacing) / 2);

      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round4(leftPageArea.y + leftH + p.spacing), width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round4(leftPageArea.y + (leftH + p.spacing) * 2), width: leftPageArea.width, height: leftH },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: round4(rightPageArea.x + rightGridW + p.spacing), y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: rightPageArea.x, y: round4(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
        { x: round4(rightPageArea.x + rightGridW + p.spacing), y: round4(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
      ];
    },
  },
  {
    id: '8p_facing_4plus4_grids',
    name: 'Facing 4+4 Storyboard (Both Pages)',
    photoCount: 8,
    category: 'spread',
    description: 'Four corner photos on left page and four corner photos on right page (2x2 each).',
    tags: ['grid', 'summary', 'reception'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const leftGridW = round4((leftPageArea.width - p.spacing) / 2);
      const leftGridH = round4((leftPageArea.height - p.spacing) / 2);
      const rightGridW = round4((rightPageArea.width - p.spacing) / 2);
      const rightGridH = round4((rightPageArea.height - p.spacing) / 2);

      return [
        // Left 2x2
        { x: leftPageArea.x, y: leftPageArea.y, width: leftGridW, height: leftGridH },
        { x: round4(leftPageArea.x + leftGridW + p.spacing), y: leftPageArea.y, width: leftGridW, height: leftGridH },
        { x: leftPageArea.x, y: round4(leftPageArea.y + leftGridH + p.spacing), width: leftGridW, height: leftGridH },
        { x: round4(leftPageArea.x + leftGridW + p.spacing), y: round4(leftPageArea.y + leftGridH + p.spacing), width: leftGridW, height: leftGridH },
        // Right 2x2
        { x: rightPageArea.x, y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: round4(rightPageArea.x + rightGridW + p.spacing), y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: rightPageArea.x, y: round4(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
        { x: round4(rightPageArea.x + rightGridW + p.spacing), y: round4(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
      ];
    },
  },
];

export function generateSpreadElementsFromTemplate(
  template: LayoutTemplate,
  params: TemplateParams,
  defaultBorderEnabled = false,
  defaultBorderWidth = 1,
  defaultBorderColor = '#FFFFFF'
): PhotoFrameElement[] {
  const rects = template.generateRects(params);
  const currentPhotos = params.currentPhotos || [];

  return rects.map((rect, index) => {
    const photo = currentPhotos[index];
    const frameId = `frame-${Date.now()}-${index + 1}-${Math.random().toString(36).substr(2, 4)}`;

    return {
      id: frameId,
      type: 'photo',
      photoId: photo?.photoId || (photo?.filePath ? `photo-${index + 1}` : null),
      filePath: photo?.filePath || '',
      fileName: photo?.fileName || (photo?.filePath ? photo.filePath.split(/[\\/]/).pop() || '' : ''),
      previewPath: photo?.previewPath || photo?.filePath || '',
      thumbnailPath: photo?.thumbnailPath || photo?.filePath || '',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      rotation: 0,
      zIndex: index + 1,
      photoAspect: photo?.photoAspect || (rect.width / rect.height),
      originalWidth: rect.width,
      originalHeight: rect.height,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
      cropRotation: 0,
      borderEnabled: defaultBorderEnabled,
      borderWidth: defaultBorderWidth,
      borderColor: defaultBorderColor,
      opacity: 1.0,
    };
  });
}

export function generateTemplateSvgPreview(
  template: LayoutTemplate,
  viewWidth = 140,
  viewHeight = 70
): string {
  const params: TemplateParams = {
    spreadWidth: 200,
    spreadHeight: 100,
    isSpread: template.category !== 'single_page',
    safeMargin: 8,
    photoInset: 0,
    gutterWidth: 6,
    spacing: 4,
  };

  const rects = template.generateRects(params);
  const scaleX = viewWidth / 200;
  const scaleY = viewHeight / 100;

  const rectElements = rects
    .map(
      (r) =>
        `<rect x="${(r.x * scaleX).toFixed(1)}" y="${(r.y * scaleY).toFixed(1)}" width="${(r.width * scaleX).toFixed(1)}" height="${(r.height * scaleY).toFixed(1)}" rx="2" fill="var(--color-surface, #27272a)" stroke="var(--color-border, #3f3f46)" stroke-width="1"/>`
    )
    .join('');

  const spine =
    template.category !== 'single_page'
      ? `<line x1="${(viewWidth / 2).toFixed(1)}" y1="4" x2="${(viewWidth / 2).toFixed(1)}" y2="${(viewHeight - 4).toFixed(1)}" stroke="rgba(255,255,255,0.18)" stroke-dasharray="2 2" stroke-width="1"/>`
      : '';

  return `<svg width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="${viewWidth}" height="${viewHeight}" rx="4" fill="var(--color-bg-secondary, #18181b)"/>${spine}${rectElements}</svg>`;
}
