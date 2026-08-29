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

/**
 * Normalizes a number to 2 decimal places to avoid floating point math artifacts.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Computes the printable / designable canvas boundaries considering margins & gutter.
 */
export function getUsableAreas(params: TemplateParams): {
  spreadArea: RectBounds;
  leftPageArea: RectBounds;
  rightPageArea: RectBounds;
} {
  const { spreadWidth, spreadHeight, isSpread, safeMargin, gutterWidth } = params;

  if (!isSpread) {
    const singleArea: RectBounds = {
      x: safeMargin,
      y: safeMargin,
      width: Math.max(10, spreadWidth - safeMargin * 2),
      height: Math.max(10, spreadHeight - safeMargin * 2),
    };
    return {
      spreadArea: singleArea,
      leftPageArea: singleArea,
      rightPageArea: singleArea,
    };
  }

  const pageWidth = spreadWidth / 2;
  const halfGutter = gutterWidth / 2;

  const leftPageArea: RectBounds = {
    x: safeMargin,
    y: safeMargin,
    width: Math.max(10, pageWidth - safeMargin - halfGutter),
    height: Math.max(10, spreadHeight - safeMargin * 2),
  };

  const rightPageArea: RectBounds = {
    x: pageWidth + halfGutter,
    y: safeMargin,
    width: Math.max(10, pageWidth - safeMargin - halfGutter),
    height: Math.max(10, spreadHeight - safeMargin * 2),
  };

  const spreadArea: RectBounds = {
    x: safeMargin,
    y: safeMargin,
    width: Math.max(10, spreadWidth - safeMargin * 2),
    height: Math.max(10, spreadHeight - safeMargin * 2),
  };

  return { spreadArea, leftPageArea, rightPageArea };
}

// ==========================================
// 25+ CURATED PROFESSIONAL LAYOUT TEMPLATES
// ==========================================

export const BUILTIN_LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // --- 1 PHOTO TEMPLATES ---
  {
    id: '1p_full_spread_bleed',
    name: 'Full Bleed Spread Hero',
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
      const w = round2(spreadArea.width * 0.75);
      const h = round2(spreadArea.height * 0.85);
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
  {
    id: '1p_left_page_hero',
    name: 'Left Page Hero',
    photoCount: 1,
    category: 'spread',
    description: 'Large showcase photo occupying the left page with right page white breathing room.',
    tags: ['asymmetric', 'editorial', 'left'],
    generateRects: (p) => {
      const { leftPageArea } = getUsableAreas(p);
      return [{ ...leftPageArea }];
    },
  },
  {
    id: '1p_right_page_hero',
    name: 'Right Page Hero',
    photoCount: 1,
    category: 'spread',
    description: 'Large showcase photo occupying the right page with left page white breathing room.',
    tags: ['asymmetric', 'editorial', 'right'],
    generateRects: (p) => {
      const { rightPageArea } = getUsableAreas(p);
      return [{ ...rightPageArea }];
    },
  },

  // --- 2 PHOTOS TEMPLATES ---
  {
    id: '2p_facing_diptych',
    name: 'Facing Page Diptych',
    photoCount: 2,
    category: 'spread',
    description: 'Two balanced full-page photos side by side across the spine crease.',
    tags: ['diptych', 'balanced', 'editorial'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      return [{ ...leftPageArea }, { ...rightPageArea }];
    },
  },
  {
    id: '2p_left_hero_right_companion',
    name: 'Hero & Side Companion',
    photoCount: 2,
    category: 'spread',
    description: 'Large lead photo on left page with a centered elegant portrait on right page.',
    tags: ['hero', 'asymmetric', 'portrait'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const rightW = round2(rightPageArea.width * 0.8);
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
  {
    id: '2p_horizontal_split',
    name: 'Horizontal Landscape Split',
    photoCount: 2,
    category: 'both',
    description: 'Two wide panoramic photos stacked vertically with exact project gap.',
    tags: ['split', 'horizontal', 'panorama'],
    generateRects: (p) => {
      const { spreadArea } = getUsableAreas(p);
      const h = round2((spreadArea.height - p.spacing) / 2);
      return [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: h },
        { x: spreadArea.x, y: round2(spreadArea.y + h + p.spacing), width: spreadArea.width, height: h },
      ];
    },
  },
  {
    id: '2p_single_page_stack',
    name: 'Single Page Stack (Right)',
    photoCount: 2,
    category: 'spread',
    description: 'Two photos stacked vertically on the right page with clean left breathing room.',
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

  // --- 3 PHOTOS TEMPLATES ---
  {
    id: '3p_symmetrical_triptych',
    name: 'Symmetrical Triptych (3 Columns)',
    photoCount: 3,
    category: 'both',
    description: 'Three equal vertical columns spanning the layout with consistent spacing.',
    tags: ['triptych', 'columns', 'symmetrical'],
    generateRects: (p) => {
      const { spreadArea } = getUsableAreas(p);
      const w = round2((spreadArea.width - p.spacing * 2) / 3);
      return [
        { x: spreadArea.x, y: spreadArea.y, width: w, height: spreadArea.height },
        { x: round2(spreadArea.x + w + p.spacing), y: spreadArea.y, width: w, height: spreadArea.height },
        { x: round2(spreadArea.x + (w + p.spacing) * 2), y: spreadArea.y, width: w, height: spreadArea.height },
      ];
    },
  },
  {
    id: '3p_left_hero_right_stack',
    name: '1 Left Hero + 2 Right Stack',
    photoCount: 3,
    category: 'spread',
    description: 'Dominant full-height photo on the left page with 2 complementary stacked photos on the right page.',
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
    id: '3p_right_hero_left_stack',
    name: '2 Left Stack + 1 Right Hero',
    photoCount: 3,
    category: 'spread',
    description: '2 stacked detail photos on the left page leading into a major right page hero photo.',
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
    id: '3p_horizontal_panoramic_trio',
    name: '3-Row Panoramic Stack',
    photoCount: 3,
    category: 'both',
    description: 'Three cinematic horizontal panorama stripes stacked across the layout.',
    tags: ['panorama', 'stripes', 'cinematic'],
    generateRects: (p) => {
      const { spreadArea } = getUsableAreas(p);
      const h = round2((spreadArea.height - p.spacing * 2) / 3);
      return [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: h },
        { x: spreadArea.x, y: round2(spreadArea.y + h + p.spacing), width: spreadArea.width, height: h },
        { x: spreadArea.x, y: round2(spreadArea.y + (h + p.spacing) * 2), width: spreadArea.width, height: h },
      ];
    },
  },

  // --- 4 PHOTOS TEMPLATES ---
  {
    id: '4p_balanced_2x2_grid',
    name: 'Balanced 2x2 Grid',
    photoCount: 4,
    category: 'both',
    description: 'Classic four-photo grid with mathematically equal rows and columns.',
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
  {
    id: '4p_facing_2plus2_stacks',
    name: 'Facing 2+2 Stacks (Both Pages)',
    photoCount: 4,
    category: 'spread',
    description: 'Two stacked photos on the left page and two stacked photos on the right page.',
    tags: ['diptych', 'grid', 'editorial'],
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
    name: '1 Lead Hero + 3 Side Strip',
    photoCount: 4,
    category: 'spread',
    description: 'Dominant left page hero with 3 vertical detail strips on the right page.',
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
    id: '4p_asymmetric_mosaic',
    name: '4-Photo Asymmetric Mosaic',
    photoCount: 4,
    category: 'spread',
    description: '1 large top hero, 1 bottom-left landscape, and 2 right-stacked details.',
    tags: ['mosaic', 'collage', 'modern'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const leftH1 = round2((leftPageArea.height - p.spacing) * 0.6);
      const leftH2 = round2(leftPageArea.height - p.spacing - leftH1);
      const rightH = round2((rightPageArea.height - p.spacing) / 2);
      return [
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftH1 },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftH1 + p.spacing), width: leftPageArea.width, height: leftH2 },
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rightH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + rightH + p.spacing), width: rightPageArea.width, height: rightH },
      ];
    },
  },

  // --- 5 PHOTOS TEMPLATES ---
  {
    id: '5p_center_hero_4_corners',
    name: 'Center Feature + 4 Flanking Corners',
    photoCount: 5,
    category: 'spread',
    description: 'Prominent portrait hero on right page with 4 equal corner grids on left page.',
    tags: ['hero', 'grid', 'wedding'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const gridW = round2((leftPageArea.width - p.spacing) / 2);
      const gridH = round2((leftPageArea.height - p.spacing) / 2);
      return [
        { ...rightPageArea }, // Main Hero
        { x: leftPageArea.x, y: leftPageArea.y, width: gridW, height: gridH },
        { x: round2(leftPageArea.x + gridW + p.spacing), y: leftPageArea.y, width: gridW, height: gridH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
        { x: round2(leftPageArea.x + gridW + p.spacing), y: round2(leftPageArea.y + gridH + p.spacing), width: gridW, height: gridH },
      ];
    },
  },
  {
    id: '5p_2left_3right_story',
    name: '2 Left Stacks + 3 Right Triptych',
    photoCount: 5,
    category: 'spread',
    description: 'Two large landscape photos on left page paired with 3 vertical portraits on right page.',
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

  // --- 6 PHOTOS TEMPLATES ---
  {
    id: '6p_classic_2x3_grid',
    name: '2x3 Storyboard Grid (6 Equal)',
    photoCount: 6,
    category: 'both',
    description: 'Six equal photographs in a balanced 2-row by 3-column configuration.',
    tags: ['grid', 'storyboard', 'events'],
    generateRects: (p) => {
      const { spreadArea } = getUsableAreas(p);
      const colW = round2((spreadArea.width - p.spacing * 2) / 3);
      const rowH = round2((spreadArea.height - p.spacing) / 2);
      const rects: RectBounds[] = [];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          rects.push({
            x: round2(spreadArea.x + col * (colW + p.spacing)),
            y: round2(spreadArea.y + row * (rowH + p.spacing)),
            width: colW,
            height: rowH,
          });
        }
      }
      return rects;
    },
  },
  {
    id: '6p_facing_3plus3_grids',
    name: 'Facing 3+3 Storyboard (Both Pages)',
    photoCount: 6,
    category: 'spread',
    description: 'Three photos on the left page and three photos on the right page for detailed sequence storytelling.',
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
        // Left Page: 1 Top wide, 2 Bottom grid
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftTopH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftTopH + p.spacing), width: leftBotW, height: leftBotH },
        { x: round2(leftPageArea.x + leftBotW + p.spacing), y: round2(leftPageArea.y + leftTopH + p.spacing), width: leftBotW, height: leftBotH },

        // Right Page: 1 Top wide, 2 Bottom grid
        { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rightTopH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + rightTopH + p.spacing), width: rightBotW, height: rightBotH },
        { x: round2(rightPageArea.x + rightBotW + p.spacing), y: round2(rightPageArea.y + rightTopH + p.spacing), width: rightBotW, height: rightBotH },
      ];
    },
  },
  {
    id: '6p_hero_plus_5_thumbnails',
    name: '1 Major Hero + 5 Thumbnail Gallery',
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
        { ...leftPageArea }, // Hero
        // Right top (2 photos)
        { x: rightPageArea.x, y: rightPageArea.y, width: topW, height: topH },
        { x: round2(rightPageArea.x + topW + p.spacing), y: rightPageArea.y, width: topW, height: topH },
        // Right bottom (3 photos)
        { x: rightPageArea.x, y: round2(rightPageArea.y + topH + p.spacing), width: botW, height: botH },
        { x: round2(rightPageArea.x + botW + p.spacing), y: round2(rightPageArea.y + topH + p.spacing), width: botW, height: botH },
        { x: round2(rightPageArea.x + (botW + p.spacing) * 2), y: round2(rightPageArea.y + topH + p.spacing), width: botW, height: botH },
      ];
    },
  },

  // --- 7 & 8 PHOTOS TEMPLATES ---
  {
    id: '7p_editorial_feature',
    name: '7-Photo Editorial Feature',
    photoCount: 7,
    category: 'spread',
    description: '1 full-height hero, 2 medium center stacks, and 4 corner detail grid tiles.',
    tags: ['editorial', 'mosaic', 'large'],
    generateRects: (p) => {
      const { leftPageArea, rightPageArea } = getUsableAreas(p);
      const leftH = round2((leftPageArea.height - p.spacing * 2) / 3);
      const rightGridW = round2((rightPageArea.width - p.spacing) / 2);
      const rightGridH = round2((rightPageArea.height - p.spacing) / 2);

      return [
        // Left 3 vertical stacks
        { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + leftH + p.spacing), width: leftPageArea.width, height: leftH },
        { x: leftPageArea.x, y: round2(leftPageArea.y + (leftH + p.spacing) * 2), width: leftPageArea.width, height: leftH },
        // Right 2x2 grid
        { x: rightPageArea.x, y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: round2(rightPageArea.x + rightGridW + p.spacing), y: rightPageArea.y, width: rightGridW, height: rightGridH },
        { x: rightPageArea.x, y: round2(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
        { x: round2(rightPageArea.x + rightGridW + p.spacing), y: round2(rightPageArea.y + rightGridH + p.spacing), width: rightGridW, height: rightGridH },
      ];
    },
  },
  {
    id: '8p_balanced_2x4_grid',
    name: '8-Photo Balanced Storyboard (2x4)',
    photoCount: 8,
    category: 'both',
    description: 'Eight photos organized across 4 columns and 2 rows for full event summaries.',
    tags: ['grid', 'summary', 'reception'],
    generateRects: (p) => {
      const { spreadArea } = getUsableAreas(p);
      const colW = round2((spreadArea.width - p.spacing * 3) / 4);
      const rowH = round2((spreadArea.height - p.spacing) / 2);
      const rects: RectBounds[] = [];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          rects.push({
            x: round2(spreadArea.x + col * (colW + p.spacing)),
            y: round2(spreadArea.y + row * (rowH + p.spacing)),
            width: colW,
            height: rowH,
          });
        }
      }
      return rects;
    },
  },
];

/**
 * Generates full PhotoFrameElements for a spread by merging layout bounds with current photos.
 */
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

/**
 * Generates an SVG wireframe string representation of a template for mini UI preview cards.
 */
export function generateTemplateSvgPreview(
  template: LayoutTemplate,
  viewWidth = 120,
  viewHeight = 60
): string {
  const params: TemplateParams = {
    spreadWidth: 200,
    spreadHeight: 100,
    isSpread: template.category !== 'single_page',
    safeMargin: 8,
    gutterWidth: 4,
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
      ? `<line x1="${(viewWidth / 2).toFixed(1)}" y1="4" x2="${(viewWidth / 2).toFixed(1)}" y2="${(viewHeight - 4).toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="2 2" stroke-width="1"/>`
      : '';

  return `<svg width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="${viewWidth}" height="${viewHeight}" rx="4" fill="var(--color-bg-secondary, #18181b)"/>${spine}${rectElements}</svg>`;
}
