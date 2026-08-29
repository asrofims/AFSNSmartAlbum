import { PhotoFrameElement } from './editor';

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
  safeMargin: number;
  gutterWidth: number;
  spacing: number;
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

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Computes exact printable and designable Safe Margin boxes for Left Page and Right Page.
 * Conforms 100% with the Blue Dashed Safe Guide Lines on the canvas.
 */
export function getUsableAreas(params: TemplateParams): {
  spreadArea: RectBounds;
  leftPageArea: RectBounds;
  rightPageArea: RectBounds;
  pageWidth: number;
  gutterWidth: number;
} {
  const { spreadWidth, spreadHeight, isSpread, safeMargin, gutterWidth } = params;

  if (!isSpread) {
    const singleArea: RectBounds = {
      x: safeMargin,
      y: safeMargin,
      width: Math.max(10, round2(spreadWidth - safeMargin * 2)),
      height: Math.max(10, round2(spreadHeight - safeMargin * 2)),
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
  const pageWidth = round2((spreadWidth - gutterWidth) / 2);

  // Left Page Safe Box (starts at safeMargin, ends safeMargin before spine gutter)
  const leftPageArea: RectBounds = {
    x: safeMargin,
    y: safeMargin,
    width: Math.max(10, round2(pageWidth - safeMargin * 2)),
    height: Math.max(10, round2(spreadHeight - safeMargin * 2)),
  };

  // Right Page Safe Box (starts safeMargin after spine gutter, ends safeMargin before outer right edge)
  const rightPageArea: RectBounds = {
    x: round2(pageWidth + gutterWidth + safeMargin),
    y: safeMargin,
    width: Math.max(10, round2(pageWidth - safeMargin * 2)),
    height: Math.max(10, round2(spreadHeight - safeMargin * 2)),
  };

  // Full Spread Safe Box (across both pages)
  const spreadArea: RectBounds = {
    x: safeMargin,
    y: safeMargin,
    width: Math.max(10, round2(spreadWidth - safeMargin * 2)),
    height: Math.max(10, round2(spreadHeight - safeMargin * 2)),
  };

  return { spreadArea, leftPageArea, rightPageArea, pageWidth, gutterWidth };
}

// ==============================================================
// 25+ CURATED PROFESSIONAL VISUAL GRID BLUEPRINTS
// ==============================================================

export const BUILTIN_LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // --- 1 PHOTO ---
  {
    id: '1p_left_page_safe_hero',
    name: 'Left Page Safe Hero',
    photoCount: 1,
    category: 'spread',
    description: 'Perfect alignment within the left page blue safe margin box.',
    tags: ['safe', 'hero', 'left'],
    generateRects: (p) => [{ ...getUsableAreas(p).leftPageArea }],
  },
  {
    id: '1p_right_page_safe_hero',
    name: 'Right Page Safe Hero',
    photoCount: 1,
    category: 'spread',
    description: 'Perfect alignment within the right page blue safe margin box.',
    tags: ['safe', 'hero', 'right'],
    generateRects: (p) => [{ ...getUsableAreas(p).rightPageArea }],
  },
  {
    id: '1p_full_spread_bleed',
    name: 'Full Bleed Panoramic Hero',
    photoCount: 1,
    category: 'spread',
    description: 'Panoramic edge-to-edge full spread statement photograph.',
    tags: ['hero', 'panorama', 'full-bleed'],
    generateRects: (p) => [
      { x: 0, y: 0, width: round2(p.spreadWidth), height: round2(p.spreadHeight) },
    ],
  },
  {
    id: '1p_classic_centered',
    name: 'Classic Centered Fine-Art',
    photoCount: 1,
    category: 'both',
    description: 'Generous white borders with a balanced centered focal photo.',
    tags: ['classic', 'minimal', 'fine-art'],
    generateRects: (p) => {
      const { spreadArea } = getUsableAreas(p);
      const w = round2(spreadArea.width * 0.72);
      const h = round2(spreadArea.height * 0.82);
      return [
        {
          x: round2(spreadArea.x + (spreadArea.width - w) / 2),
          y: round2(spreadArea.y + (spreadArea.height - h) / 2),
          width: w,
          height: h,
        },
      ];
    },
  },

  // --- 2 PHOTOS ---
  {
    id: '2p_facing_diptych',
    name: 'Facing Page Diptych (Left + Right)',
    photoCount: 2,
    category: 'spread',
    description: 'Symmetrical alignment hugging the safe margin boxes of both pages.',
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
      const h = round2((rightPageArea.height - p.spacing) / 2);
      return [
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: h },
        { x: rightPageArea.x, y: round2(rightPageArea.y + h + p.spacing), width: rightPageArea.width, height: h },
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
      const rightW = round2(rightPageArea.width * 0.82);
      const rightH = round2(rightPageArea.height * 0.85);
      return [
        { ...leftPageArea },
        {
          x: round2(rightPageArea.x + (rightPageArea.width - rightW) / 2),
          y: round2(rightPageArea.y + (rightPageArea.height - rightH) / 2),
          width: rightW,
          height: rightH,
        },
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
      const stackH = round2((rightPageArea.height - p.spacing) / 2);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: stackH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + stackH + p.spacing), width: rightPageArea.width, height: stackH },
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
      const stackH = round2((leftPageArea.height - p.spacing) / 2);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: stackH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + stackH + p.spacing), width: leftPageArea.width, height: stackH },
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
      const colW = round2((rightPageArea.width - p.spacing) / 2);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: colW, height: rightPageArea.height },
        { x: round2(rightPageArea.x + colW + p.spacing), y: rightPageArea.y, width: colW, height: rightPageArea.height },
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
      const leftH = round2((leftPageArea.height - p.spacing) / 2);
      const rightH = round2((rightPageArea.height - p.spacing) / 2);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftH + p.spacing), width: leftPageArea.width, height: leftH },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rightH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + rightH + p.spacing), width: rightPageArea.width, height: rightH },
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
      const stripW = round2((rightPageArea.width - p.spacing * 2) / 3);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: stripW, height: rightPageArea.height },
        { x: round2(rightPageArea.x + stripW + p.spacing), y: rightPageArea.y, width: stripW, height: rightPageArea.height },
        { x: round2(rightPageArea.x + (stripW + p.spacing) * 2), y: rightPageArea.y, width: stripW, height: rightPageArea.height },
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
      const w = round2((spreadArea.width - p.spacing) / 2);
      const h = round2((spreadArea.height - p.spacing) / 2);
      const x2 = round2(spreadArea.x + w + p.spacing);
      const y2 = round2(spreadArea.y + h + p.spacing);
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
      const gridW = round2((leftPageArea.width - p.spacing) / 2);
      const gridH = round2((leftPageArea.height - p.spacing) / 2);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: gridW, height: gridH },
        { x: round2(leftPageArea.x + gridW + p.spacing), y: leftPageArea.y, width: gridW, height: gridH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
        { x: round2(leftPageArea.x + gridW + p.spacing), y: round2(leftPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
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
      const gridW = round2((rightPageArea.width - p.spacing) / 2);
      const gridH = round2((rightPageArea.height - p.spacing) / 2);
      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: gridW, height: gridH },
        { x: round2(rightPageArea.x + gridW + p.spacing), y: rightPageArea.y, width: gridW, height: gridH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
        { x: round2(rightPageArea.x + gridW + p.spacing), y: round2(rightPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
      ];
    },
  },
  {
    id: '5p_2left_3right_story',
    name: '2 Left Stacks + 3 Right Columns',
    photoCount: 5,
    category: 'spread',
    description: 'Two landscapes on left page accompanied by three portrait columns on right page.',
    tags: ['story', 'editorial', 'rich'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const leftH = round2((leftPageArea.height - p.spacing) / 2);
      const rightW = round2((rightPageArea.width - p.spacing * 2) / 3);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftH + p.spacing), width: leftPageArea.width, height: leftH },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightW, height: rightPageArea.height },
        { x: round2(rightPageArea.x + rightW + p.spacing), y: rightPageArea.y, width: rightW, height: rightPageArea.height },
        { x: round2(rightPageArea.x + (rightW + p.spacing) * 2), y: rightPageArea.y, width: rightW, height: rightPageArea.height },
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
      const leftTopH = round2((leftPageArea.height - p.spacing) * 0.55);
      const leftBotH = round2(leftPageArea.height - p.spacing - leftTopH);
      const leftBotW = round2((leftPageArea.width - p.spacing) / 2);

      const rightTopH = round2((rightPageArea.height - p.spacing) * 0.55);
      const rightBotH = round2(rightPageArea.height - p.spacing - rightTopH);
      const rightBotW = round2((rightPageArea.width - p.spacing) / 2);

      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftTopH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftTopH + p.spacing), width: leftBotW, height: leftBotH },
        { x: round2(leftPageArea.x + leftBotW + p.spacing), y: round2(leftPageArea.y + leftTopH + p.spacing), width: leftBotW, height: leftBotH },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rightTopH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + rightTopH + p.spacing), width: rightBotW, height: rightBotH },
        { x: round2(rightPageArea.x + rightBotW + p.spacing), y: round2(rightPageArea.y + rightTopH + p.spacing), width: rightBotW, height: rightBotH },
      ];
    },
  },
  {
    id: '6p_hero_plus_5_thumbnails',
    name: '1 Left Hero + 5 Right Gallery Grid',
    photoCount: 6,
    category: 'spread',
    description: 'Major showcase hero on left page with 5 supporting gallery photos on right page.',
    tags: ['gallery', 'hero', 'wedding'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const topH = round2((rightPageArea.height - p.spacing) * 0.5);
      const botH = round2(rightPageArea.height - p.spacing - topH);
      const topW = round2((rightPageArea.width - p.spacing) / 2);
      const botW = round2((rightPageArea.width - p.spacing * 2) / 3);

      return [
        { ...leftPageArea },
        { x: rightPageArea.x, y: rightPageArea.y, width: topW, height: topH },
        { x: round2(rightPageArea.x + topW + p.spacing), y: rightPageArea.y, width: topW, height: topH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + topH + p.spacing), width: botW, height: botH },
        { x: round2(rightPageArea.x + botW + p.spacing), y: round2(rightPageArea.y + topH + p.spacing), width: botW, height: botH },
        { x: round2(rightPageArea.x + (botW + p.spacing) * 2), y: round2(rightPageArea.y + topH + p.spacing), width: botW, height: botH },
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
      const leftH = round2((leftPageArea.height - p.spacing * 2) / 3);
      const rightGridW = round2((rightPageArea.width - p.spacing) / 2);
      const rightGridH = round2((rightPageArea.height - p.spacing) / 2);

      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftH + p.spacing), width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + (leftH + p.spacing) * 2), width: leftPageArea.width, height: leftH },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: round2(rightPageArea.x + rightGridW + p.spacing), y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
        { x: round2(rightPageArea.x + rightGridW + p.spacing), y: round2(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
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
      const leftGridW = round2((leftPageArea.width - p.spacing) / 2);
      const leftGridH = round2((leftPageArea.height - p.spacing) / 2);
      const rightGridW = round2((rightPageArea.width - p.spacing) / 2);
      const rightGridH = round2((rightPageArea.height - p.spacing) / 2);

      return [
        // Left 2x2
        { x: leftPageArea.x, y: leftPageArea.y, width: leftGridW, height: leftGridH },
        { x: round2(leftPageArea.x + leftGridW + p.spacing), y: leftPageArea.y, width: leftGridW, height: leftGridH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftGridH + p.spacing), width: leftGridW, height: leftGridH },
        { x: round2(leftPageArea.x + leftGridW + p.spacing), y: round2(leftPageArea.y + leftGridH + p.spacing), width: leftGridW, height: leftGridH },
        // Right 2x2
        { x: rightPageArea.x, y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: round2(rightPageArea.x + rightGridW + p.spacing), y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
        { x: round2(rightPageArea.x + rightGridW + p.spacing), y: round2(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
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
