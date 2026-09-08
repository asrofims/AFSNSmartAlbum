import { Unit, convertUnit, convertPtToUnit, convertUnitToPt } from './units';
import { parseRichTextRuns } from './richTextParser';
import { rangesToTextRuns, StyledRange } from './styledRanges';
import { layoutRichText } from './richTextRenderer';

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
  autoSize?: 'off' | 'height';
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
  autoSize: 'off',
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
  { value: 'Century Gothic', label: 'Century Gothic (Modern Geometric)', fallback: '"Century Gothic", "Segoe UI", sans-serif' },
  { value: 'Palatino Linotype', label: 'Palatino Linotype (Classic Serif)', fallback: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { value: 'Gabriola', label: 'Gabriola (Flourished Script)', fallback: 'Gabriola, "Segoe Script", cursive, serif' },
  { value: 'Segoe Script', label: 'Segoe Script (Romantic Cursive)', fallback: '"Segoe Script", "Brush Script MT", cursive' },
  { value: 'Georgia', label: 'Georgia (Warm Editorial Serif)', fallback: 'Georgia, serif' },
  { value: 'Times New Roman', label: 'Times New Roman (Classic Formal)', fallback: '"Times New Roman", Times, serif' },
  { value: 'Constantia', label: 'Constantia (Sophisticated Book Serif)', fallback: 'Constantia, Georgia, serif' },
  { value: 'Garamond', label: 'Garamond (Renaissance Serif)', fallback: 'Garamond, "Times New Roman", serif' },
  { value: 'Lucida Calligraphy', label: 'Lucida Calligraphy (Formal Script)', fallback: '"Lucida Calligraphy", "Monotype Corsiva", cursive' },
  { value: 'Monotype Corsiva', label: 'Monotype Corsiva (Swash Italic)', fallback: '"Monotype Corsiva", "Lucida Calligraphy", cursive' },
  { value: 'Segoe UI', label: 'Segoe UI (Clean Neutral Sans)', fallback: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif' },
  { value: 'Arial', label: 'Arial (Universal Sans)', fallback: 'Arial, Helvetica, sans-serif' },
  { value: 'Calibri', label: 'Calibri (Contemporary Sans)', fallback: 'Calibri, "Segoe UI", sans-serif' },
  { value: 'Bahnschrift', label: 'Bahnschrift (Geometric DIN Sans)', fallback: 'Bahnschrift, "Arial Narrow", sans-serif' },
  { value: 'Playfair Display', label: 'Playfair Display (Serif Elegant)', fallback: 'Georgia, serif' },
  { value: 'Cinzel', label: 'Cinzel (Classical Roman)', fallback: '"Times New Roman", serif' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond (Editorial)', fallback: 'Garamond, serif' },
  { value: 'Great Vibes', label: 'Great Vibes (Romantic Script)', fallback: '"Segoe Script", "Brush Script MT", cursive' },
  { value: 'Montserrat', label: 'Montserrat (Modern Geometric)', fallback: '"Century Gothic", Arial, sans-serif' },
  { value: 'Inter', label: 'Inter (Clean Neutral)', fallback: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif' },
];

/**
 * Resolves a font family name into a robust CSS font-family string with appropriate system fallbacks.
 */
export function resolveCssFontFamily(fontFamily?: string | null): string {
  if (!fontFamily || !fontFamily.trim()) {
    return 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
  }
  const cleanFamily = fontFamily.trim();
  const matched = ALBUM_FONT_FAMILIES.find(
    (f) => f.value.toLowerCase() === cleanFamily.toLowerCase()
  );
  if (matched && matched.fallback) {
    return `"${matched.value}", ${matched.fallback}`;
  }
  return `"${cleanFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

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
  maxAllowedWidth?: number,
  styledRanges?: import('./styledRanges').StyledRange[]
): { width: number; height: number; lineCount: number } {
  const fullStyle = { ...DEFAULT_TEXT_STYLE, ...style };
  const widthLimit = convertUnitToPt(maxAllowedWidth ?? convertPtToUnit(2267.716535, unit, dpi), unit, dpi);
  const columnWidth = targetWidth === undefined ? widthLimit : Math.min(convertUnitToPt(targetWidth, unit, dpi), widthLimit);
  const runs = getTextRuns(text, fullStyle, styledRanges);
  // Canonical layout coordinates are typographic points, independent of project units/zoom.
  const layout = layoutRichText(runs, fullStyle, Math.max(0.01, columnWidth), 1e7, 72, 'inch', dpi);
  const padding = Math.max(0, fullStyle.padding);
  const widthPt = Math.min(widthLimit, Math.max(0.01, layout.totalWidth + padding * 2));
  const heightPt = Math.max(0.01, layout.totalHeight + padding * 2);
  // Round in points, never in canvas units (0.01 inch is not 0.01 mm).
  const ceilPt = (value: number) => Math.ceil((value - 1e-7) * 10000) / 10000;
  return {
    width: convertPtToUnit(ceilPt(widthPt), unit, dpi),
    height: convertPtToUnit(ceilPt(heightPt), unit, dpi),
    lineCount: layout.lines.length,
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
  dpi: number = 300,
  styledRanges?: import('./styledRanges').StyledRange[]
): number {
  const fitted = calculateTextFitDimensions(text, style, unit, dpi, boxWidth, undefined, styledRanges);
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
    dpi,
    element.styledRanges
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
    textRuns: getTextRuns(element.text, element.style, element.styledRanges),
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

/** Plain text and styled text use the same layout engine. */
export function getTextRuns(text: string, style: TextStyle, ranges?: StyledRange[]): TextRun[] {
  return ranges?.length ? rangesToTextRuns(text, ranges, style) : parseRichTextRuns(text, style);
}

/** Keep the alignment reference point fixed in spread coordinates. */
export function resizeTextFrame(element: TextNodeElement, width: number, height: number): Partial<TextNodeElement> {
  const horizontal = element.style.align === 'right' ? 1 : element.style.align === 'center' ? 0.5 : 0;
  const vertical = element.style.verticalAlign === 'bottom' ? 1 : element.style.verticalAlign === 'middle' ? 0.5 : 0;
  const dx = (element.width - width) * horizontal;
  const dy = (element.height - height) * vertical;
  const radians = element.rotation * Math.PI / 180;
  return {
    width, height,
    x: element.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: element.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

export function fitTextFrame(element: TextNodeElement, mode: 'height' | 'content', unit: Unit, dpi: number, maxWidth?: number): Partial<TextNodeElement> {
  if (element.locked) return {};
  const fit = calculateTextFitDimensions(element.text, element.style, unit, dpi, element.width,
    mode === 'content' ? maxWidth : undefined, element.styledRanges);
  return resizeTextFrame(element, mode === 'height' ? element.width : fit.width, fit.height);
}

/** Auto size is an explicit document operation, never a render side effect. */
export function updateTextNode(element: TextNodeElement, updates: Omit<Partial<TextNodeElement>, 'style'> & { style?: Partial<TextStyle> }, unit: Unit, dpi: number): TextNodeElement {
  if (element.locked) return element;
  let next = { ...element, ...updates, style: { ...element.style, ...updates.style } };
  if (next.style.autoSize === 'height') {
    const height = calculateTextFitHeight(next.text, next.style, next.width, unit, dpi, next.styledRanges);
    next = { ...next, ...resizeTextFrame(next, next.width, height) };
  }
  return next;
}
