import { Unit, convertUnit, convertPtToUnit, convertUnitToPt } from './units';
import { stripRichTextMarkup } from './richTextParser';

export * from './styledRanges';
export * from './richTextParser';
export * from './richTextRenderer';

export interface TextRun {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  fill?: string;
  highlight?: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number; // in canvas physical points / display px
  fontWeight: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  fill: string; // hex or rgba
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number; // multiplier, e.g. 1.25
  letterSpacing: number; // tracking in px
  padding: number;
  wordWrap: 'word' | 'char' | 'none';
  ellipsis: boolean;
}

export interface TextNodeElement {
  id: string;
  type: 'text';
  text: string;
  x: number; // in canvas units
  y: number; // in canvas units
  width: number; // in canvas units
  height: number; // in canvas units
  rotation: number; // degrees
  zIndex?: number;
  locked?: boolean;
  groupId?: string | null;
  groupRotation?: number;
  style: TextStyle;
  styledRanges?: import('./styledRanges').StyledRange[];
  textRuns?: TextRun[];
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 24,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  fill: '#1e293b', // Rich dark slate (or #ffffff for dark themes)
  align: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.3,
  letterSpacing: 0,
  padding: 4,
  wordWrap: 'word',
  ellipsis: false,
};

export type TextPresetKey = 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'quote';

export interface TextPreset {
  key: TextPresetKey;
  label: string;
  description: string;
  defaultText: string;
  style: Partial<TextStyle>;
  defaultWidth: number;
  defaultHeight: number;
}

export const TEXT_PRESETS: Record<TextPresetKey, TextPreset> = {
  title: {
    key: 'title',
    label: 'Album Title',
    description: 'Elegant serif headline for cover or opening spread',
    defaultText: 'Our Wedding Day',
    style: {
      fontFamily: 'Playfair Display',
      fontSize: 38,
      fontWeight: 'bold',
      fontStyle: 'normal',
      fill: '#1e293b',
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.2,
      letterSpacing: 1.5,
      padding: 8,
      wordWrap: 'word',
      ellipsis: false,
    },
    defaultWidth: 160,
    defaultHeight: 24,
  },
  heading: {
    key: 'heading',
    label: 'Section Heading',
    description: 'Strong, stylish section or chapter divider',
    defaultText: 'The Ceremony',
    style: {
      fontFamily: 'Cinzel',
      fontSize: 26,
      fontWeight: 'bold',
      fontStyle: 'normal',
      fill: '#1e293b',
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.25,
      letterSpacing: 2,
      padding: 6,
      wordWrap: 'word',
      ellipsis: false,
    },
    defaultWidth: 140,
    defaultHeight: 18,
  },
  subheading: {
    key: 'subheading',
    label: 'Subheading / Date',
    description: 'Modern spaced subtext for dates or locations',
    defaultText: 'SEPTEMBER 12, 2026 — BALI, INDONESIA',
    style: {
      fontFamily: 'Montserrat',
      fontSize: 13,
      fontWeight: '600',
      fontStyle: 'normal',
      fill: '#64748b',
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.4,
      letterSpacing: 2.5,
      padding: 4,
      wordWrap: 'word',
      ellipsis: false,
    },
    defaultWidth: 130,
    defaultHeight: 14,
  },
  body: {
    key: 'body',
    label: 'Story / Paragraph',
    description: 'Clean readable text block for memories and notes',
    defaultText: 'Surrounded by family and closest friends, every single moment was filled with laughter, tears of joy, and memories we will treasure forever.',
    style: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: 'normal',
      fontStyle: 'normal',
      fill: '#334155',
      align: 'left',
      verticalAlign: 'middle',
      lineHeight: 1.5,
      letterSpacing: 0.2,
      padding: 6,
      wordWrap: 'word',
      ellipsis: false,
    },
    defaultWidth: 130,
    defaultHeight: 32,
  },
  caption: {
    key: 'caption',
    label: 'Photo Caption',
    description: 'Subtle note underneath a photo frame',
    defaultText: 'Villa Plenilunio, Uluwatu',
    style: {
      fontFamily: 'Inter',
      fontSize: 11,
      fontWeight: 'normal',
      fontStyle: 'italic',
      fill: '#64748b',
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.3,
      letterSpacing: 0.5,
      padding: 4,
      wordWrap: 'word',
      ellipsis: false,
    },
    defaultWidth: 90,
    defaultHeight: 12,
  },
  quote: {
    key: 'quote',
    label: 'Calligraphic Quote',
    description: 'Flowing cursive script for romantic quotes',
    defaultText: 'Together is our favorite place to be',
    style: {
      fontFamily: 'Great Vibes',
      fontSize: 32,
      fontWeight: 'normal',
      fontStyle: 'normal',
      fill: '#1e293b',
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.3,
      letterSpacing: 1,
      padding: 6,
      wordWrap: 'word',
      ellipsis: false,
    },
    defaultWidth: 150,
    defaultHeight: 22,
  },
};

/** Popular fonts available for album typography with clean fallbacks */
export const ALBUM_FONT_FAMILIES = [
  { value: 'Playfair Display', label: 'Playfair Display (Serif Elegant)', fallback: 'Georgia, serif' },
  { value: 'Cinzel', label: 'Cinzel (Classical Roman)', fallback: '"Times New Roman", serif' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond (Editorial)', fallback: 'Garamond, serif' },
  { value: 'Great Vibes', label: 'Great Vibes (Romantic Script)', fallback: '"Brush Script MT", cursive' },
  { value: 'Montserrat', label: 'Montserrat (Modern Geometric)', fallback: 'Arial, sans-serif' },
  { value: 'Inter', label: 'Inter (Clean Neutral)', fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { value: 'Georgia', label: 'Georgia (System Serif)', fallback: 'serif' },
  { value: 'Arial', label: 'Arial (System Sans)', fallback: 'sans-serif' },
  { value: 'Times New Roman', label: 'Times New Roman (Classic)', fallback: 'serif' },
];

export function isTextElement(elem: any): elem is TextNodeElement {
  return Boolean(elem && elem.type === 'text');
}

export function createTextNode(options: {
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  preset?: TextPresetKey;
  style?: Partial<TextStyle>;
  zIndex?: number;
  unit?: Unit;
  dpi?: number;
}): TextNodeElement {
  const preset = options.preset ? TEXT_PRESETS[options.preset] : null;
  const mergedStyle: TextStyle = {
    ...DEFAULT_TEXT_STYLE,
    ...(preset ? preset.style : {}),
    ...(options.style || {}),
  };

  const unit = options.unit || 'mm';
  const dpi = options.dpi || 300;

  // Presets default dimensions are in mm; convert them to target canvas unit if specified
  const rawPresetW = preset ? preset.defaultWidth : 120;
  const rawPresetH = preset ? preset.defaultHeight : 28;
  const targetDefaultW = unit === 'mm' ? rawPresetW : Math.round(convertUnit(rawPresetW, 'mm', unit, dpi, 2) * 100) / 100;
  const targetDefaultH = unit === 'mm' ? rawPresetH : Math.round(convertUnit(rawPresetH, 'mm', unit, dpi, 2) * 100) / 100;

  return {
    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'text',
    text: options.text ?? (preset ? preset.defaultText : 'Add your text here'),
    x: options.x ?? 50,
    y: options.y ?? 50,
    width: options.width ?? targetDefaultW,
    height: options.height ?? targetDefaultH,
    rotation: 0,
    zIndex: options.zIndex ?? 10,
    locked: false,
    style: mergedStyle,
  };
}

/**
 * Calculates exact fitting width and height for text content with intelligent word wrapping.
 * - For short text (titles, names, dates): snugly hugs font glyphs horizontally and vertically.
 * - For long text (paragraphs, stories, quotes): automatically wraps words within boundaries
 *   (either established box width or maxAllowedWidth) and expands height cleanly to fit all lines.
 */
export function calculateTextFitDimensions(
  text: string,
  style: Partial<TextStyle>,
  unit: Unit = 'mm',
  dpi: number = 300,
  targetWidth?: number,
  maxAllowedWidth?: number
): { width: number; height: number } {
  const plainText = stripRichTextMarkup(text || ' ');
  const fontSize = style.fontSize || 24;
  const lineHeight = style.lineHeight || 1.3;
  const letterSpacing = style.letterSpacing || 0;
  const paddingPt = Number.isFinite(style.padding) ? Math.min(style.padding as number, 4) : 4;

  const fontFamily = style.fontFamily || 'Inter';
  const fontWeight = style.fontWeight || 'normal';
  const fontStyle = style.fontStyle || 'normal';

  // Determine maximum width boundary in points
  // Default boundary: 150mm (~425pt) if not specified
  const defaultMaxMm = 150;
  const maxBoundaryPt = maxAllowedWidth !== undefined && maxAllowedWidth > 0
    ? convertUnitToPt(maxAllowedWidth, unit, dpi)
    : convertUnitToPt(defaultMaxMm, 'mm', dpi);

  const targetWidthPt = targetWidth !== undefined && targetWidth > 0
    ? convertUnitToPt(targetWidth, unit, dpi)
    : undefined;

  // Measurement context
  let measureFn = (str: string): number => str.length * fontSize * 0.55;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
        measureFn = (str: string) => {
          let w = ctx.measureText(str).width;
          if (letterSpacing > 0 && str.length > 1) {
            w += (str.length - 1) * letterSpacing;
          }
          return w;
        };
      }
    } catch {}
  }

  // 1. First measure unconstrained single-line width of each explicit paragraph (\n)
  const paragraphs = plainText.split('\n');
  let maxParagraphWidthPt = 0;
  for (const para of paragraphs) {
    const w = measureFn(para);
    if (w > maxParagraphWidthPt) {
      maxParagraphWidthPt = w;
    }
  }

  // 2. Decide effective wrapping width limit
  // If targetWidth was explicitly specified (e.g. user-established box width):
  //   Wrap within targetWidth (or maxBoundaryPt).
  // If no targetWidth was specified:
  //   If text is short (< maxBoundaryPt), width hugs the text!
  //   If text is long (> maxBoundaryPt), wrap at maxBoundaryPt!
  let wrapLimitPt: number;
  if (targetWidthPt !== undefined && targetWidthPt > 0) {
    wrapLimitPt = Math.min(targetWidthPt, maxBoundaryPt);
  } else {
    wrapLimitPt = maxBoundaryPt;
  }

  const safetyBufferPt = 6;
  const usableWrapWidthPt = Math.max(30, wrapLimitPt - (paddingPt * 2) - safetyBufferPt);

  // 3. Word-wrap paragraphs if any paragraph exceeds usableWrapWidthPt
  let wrappedLineCount = 0;
  let maxWrappedLineWidthPt = 0;

  for (const para of paragraphs) {
    if (!para || para.trim().length === 0) {
      wrappedLineCount += 1;
      continue;
    }

    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      wrappedLineCount += 1;
      continue;
    }

    let currentLine = '';
    let currentLineWidth = 0;

    for (const word of words) {
      const wordWidth = measureFn(word);
      const spaceWidth = measureFn(' ');

      if (!currentLine) {
        currentLine = word;
        currentLineWidth = wordWidth;
      } else {
        const testWidth = currentLineWidth + spaceWidth + wordWidth;
        if (testWidth <= usableWrapWidthPt) {
          currentLine += ' ' + word;
          currentLineWidth = testWidth;
        } else {
          // Break line!
          wrappedLineCount += 1;
          if (currentLineWidth > maxWrappedLineWidthPt) {
            maxWrappedLineWidthPt = currentLineWidth;
          }
          currentLine = word;
          currentLineWidth = wordWidth;
        }
      }
    }

    if (currentLine) {
      wrappedLineCount += 1;
      if (currentLineWidth > maxWrappedLineWidthPt) {
        maxWrappedLineWidthPt = currentLineWidth;
      }
    }
  }

  // Final fitted width and height:
  // Add 6pt (~2.1mm) safety buffer to guarantee browser sub-pixel antialiasing
  // and DPI rounding NEVER drop the last word to a new line!
  const tightestWidthPt = Math.max(30, maxWrappedLineWidthPt + (paddingPt * 2) + safetyBufferPt);
  const finalWidthPt = Math.min(tightestWidthPt, wrapLimitPt);

  const totalHeightPt = (Math.max(1, wrappedLineCount) * fontSize * lineHeight) + (paddingPt * 2);

  const widthInUnit = convertPtToUnit(finalWidthPt, unit, dpi);
  const heightInUnit = convertPtToUnit(totalHeightPt, unit, dpi);

  return {
    width: Math.max(convertPtToUnit(15, unit, dpi), Math.ceil(widthInUnit * 100) / 100),
    height: Math.max(convertPtToUnit(8, unit, dpi), Math.ceil(heightInUnit * 100) / 100),
  };
}

/**
 * Calculates accurate fitting height for text content so text frames wrap tightly
 * with balanced top and bottom padding without creating huge blank areas.
 */
export function calculateTextFitHeight(
  text: string,
  style: Partial<TextStyle>,
  boxWidth: number,
  unit: Unit = 'mm',
  dpi: number = 300
): number {
  const fitted = calculateTextFitDimensions(text, style, unit, dpi, boxWidth);
  return fitted.height;
}

export function applyTextPreset(
  element: TextNodeElement,
  presetKey: TextPresetKey,
  unit: Unit = 'mm',
  dpi: number = 300
): TextNodeElement {
  const preset = TEXT_PRESETS[presetKey];
  if (!preset) return element;

  const mergedStyle: TextStyle = {
    ...element.style,
    ...preset.style,
    verticalAlign: 'middle',
  };

  const presetW = unit === 'mm' ? preset.defaultWidth : Math.round(convertUnit(preset.defaultWidth, 'mm', unit, dpi, 2) * 100) / 100;
  const targetW = Math.max(element.width, presetW);

  // Auto-fit height directly to the text content under the new preset styling
  // Eliminates giant empty bottom spaces!
  const fittedH = calculateTextFitHeight(
    element.text || preset.defaultText,
    mergedStyle,
    targetW,
    unit,
    dpi
  );

  return {
    ...element,
    width: targetW,
    height: fittedH,
    style: mergedStyle,
  };
}

export function editTextNode(element: TextNodeElement, newText: string): TextNodeElement {
  return {
    ...element,
    text: newText,
  };
}

export function serializeTextPayload(element: TextNodeElement): string {
  return JSON.stringify({
    text: element.text,
    style: element.style,
    styledRanges: element.styledRanges,
    textRuns: element.textRuns,
  });
}

export function deserializeTextPayload(
  rawPayload: string | null | undefined,
  fallbackText: string = ''
): { text: string; style: TextStyle; styledRanges?: import('./styledRanges').StyledRange[]; textRuns?: TextRun[] } {
  if (!rawPayload) {
    return {
      text: fallbackText || 'Double click to edit text',
      style: { ...DEFAULT_TEXT_STYLE },
    };
  }

  try {
    const parsed = JSON.parse(rawPayload);
    return {
      text: typeof parsed.text === 'string' ? parsed.text : (fallbackText || 'Double click to edit text'),
      style: {
        ...DEFAULT_TEXT_STYLE,
        ...(parsed.style || {}),
      },
      styledRanges: Array.isArray(parsed.styledRanges) ? parsed.styledRanges : undefined,
      textRuns: Array.isArray(parsed.textRuns) ? parsed.textRuns : undefined,
    };
  } catch {
    return {
      text: fallbackText || rawPayload,
      style: { ...DEFAULT_TEXT_STYLE },
    };
  }
}
