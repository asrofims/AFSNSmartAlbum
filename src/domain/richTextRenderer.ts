import { TextStyle, TextRun, resolveCssFontFamily } from './text';
import { Unit, ptToScreenPx, convertPtToUnit, convertUnitToPt } from './units';

export interface MeasuredToken {
  text: string;
  isSpace: boolean;
  isNewline: boolean;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: string;
  fontStyle: string;
  textDecoration: 'none' | 'underline' | 'line-through';
  fill: string;
  highlight?: string;
  width: number;
  ascent: number;
  descent: number;
  fontStr: string;
  x: number;
  yBaseline: number;
  letterSpacing: number;
}

export interface RenderedLine {
  tokens: MeasuredToken[];
  width: number;
  height: number;
  maxAscent: number;
  maxDescent: number;
  top: number;
  baseline: number;
}

export interface RichTextLayout {
  lines: RenderedLine[];
  totalWidth: number;
  totalHeight: number;
  paddingPx: number;
  boxWidth: number;
  boxHeight: number;
  overflow: boolean;
}

// Offscreen canvas context for measurement
let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  return measureCtx || ({} as CanvasRenderingContext2D);
}

/**
 * Computes layout lines and token positions for rich text runs inside a bounding box.
 */
export function layoutRichText(
  runs: TextRun[],
  baseStyle: TextStyle,
  boxWidth: number,
  boxHeight: number,
  scaleFactor: number,
  canvasUnit: Unit = 'mm',
  dpi: number = 300
): RichTextLayout {
  const ctx = getMeasureContext();
  const paddingPt = Number.isFinite(baseStyle.padding) ? (baseStyle.padding as number) : 4;
  const paddingInUnit = convertPtToUnit(paddingPt, canvasUnit, dpi);
  const paddingPx = Math.max(0, paddingInUnit * scaleFactor);
  const availableWidth = Math.max(0.001, boxWidth - 2 * paddingPx);
  const availableHeight = Math.max(0, boxHeight - 2 * paddingPx);

  const tracking = convertPtToUnit(baseStyle.letterSpacing || 0, canvasUnit, dpi) * scaleFactor;
  // 1. Tokenize runs into atomic words, spaces, and newlines
  const rawTokens: Array<{
    text: string;
    isSpace: boolean;
    isNewline: boolean;
    run: TextRun;
    fontSizePx: number;
    fontStr: string;
    width: number;
    ascent: number;
    descent: number;
  }> = [];

  for (const run of runs) {
    const fontPt = Number.isFinite(run.fontSize) && (run.fontSize || 0) > 0 ? (run.fontSize as number) : (baseStyle.fontSize || 24);
    const rawSize = ptToScreenPx(fontPt, canvasUnit, dpi, scaleFactor);
    const fontSizePx = Math.max(0.001, Number.isFinite(rawSize) ? rawSize : 16);

    const fFamily = run.fontFamily || baseStyle.fontFamily || 'Inter';
    const fWeight = run.fontWeight || baseStyle.fontWeight || 'normal';
    const fStyle = run.fontStyle || baseStyle.fontStyle || 'normal';
    const fontStr = `${fStyle} ${fWeight} ${fontSizePx}px ${resolveCssFontFamily(fFamily)}`;

    if (ctx && ctx.font !== undefined) {
      ctx.font = fontStr;
    }

    // Split run text into words, whitespace, and newlines
    const parts = run.text.replace(/\r\n?/g, '\n').split(/(\n|[^\S\n]+)/);
    for (const part of parts) {
      if (!part) continue;
      const isNewline = part === '\n';
      const isSpace = !isNewline && /^\s+$/.test(part);

      let w = 0;
      let asc = fontSizePx * 0.8;
      let desc = fontSizePx * 0.2;

      if (!isNewline && ctx && ctx.measureText) {
        try {
          ctx.font = fontStr;
          const m = ctx.measureText(part);
          w = m.width;
          if (Number.isFinite(m.actualBoundingBoxAscent) && m.actualBoundingBoxAscent > 0) {
            asc = m.actualBoundingBoxAscent;
          }
          if (Number.isFinite(m.actualBoundingBoxDescent) && m.actualBoundingBoxDescent > 0) {
            desc = m.actualBoundingBoxDescent;
          }
        } catch {
          w = part.length * (fontSizePx * 0.55);
        }
      } else if (!isNewline) {
        w = part.length * (fontSizePx * 0.55);
      }

      if (!isNewline) w = measureTrackedText(ctx, part, fontStr, fontSizePx, tracking);

      rawTokens.push({
        text: part,
        isSpace,
        isNewline,
        run,
        fontSizePx,
        fontStr,
        width: w,
        ascent: asc,
        descent: desc,
      });
    }
  }

  // 2. Break tokens into visual wrapped lines
  const lines: Array<{
    tokens: Array<(typeof rawTokens)[0]>;
    width: number;
    maxAscent: number;
    maxDescent: number;
    maxLineHeight: number;
  }> = [];

  let currentLineTokens: Array<(typeof rawTokens)[0]> = [];
  let currentLineWidth = 0;
  let currentMaxAscent = 0;
  let currentMaxDescent = 0;
  let currentMaxLineHeight = 0;

  const pushCurrentLine = () => {
    if (currentLineTokens.length === 0) {
      // Empty line (e.g. from consecutive newlines)
      const fallbackSize = ptToScreenPx(baseStyle.fontSize || 24, canvasUnit, dpi, scaleFactor);
      lines.push({
        tokens: [],
        width: 0,
        maxAscent: fallbackSize * 0.8,
        maxDescent: fallbackSize * 0.2,
        maxLineHeight: fallbackSize * (baseStyle.lineHeight || 1.3),
      });
      return;
    }

    // Ignore trailing break spaces when aligning the visible line.
    let trimmedWidth = currentLineWidth;
    const lastToken = currentLineTokens[currentLineTokens.length - 1];
    if (lastToken && lastToken.isSpace) {
      trimmedWidth -= lastToken.width;
    }

    lines.push({
      tokens: currentLineTokens,
      width: Math.max(0, trimmedWidth),
      maxAscent: currentMaxAscent,
      maxDescent: currentMaxDescent,
      maxLineHeight: currentMaxLineHeight,
    });

    currentLineTokens = [];
    currentLineWidth = 0;
    currentMaxAscent = 0;
    currentMaxDescent = 0;
    currentMaxLineHeight = 0;
  };

  const append = (token: (typeof rawTokens)[0]) => {
    currentLineTokens.push(token);
    currentLineWidth += token.width + (currentLineTokens.length > 1 ? tracking : 0);
    currentMaxAscent = Math.max(currentMaxAscent, token.ascent);
    currentMaxDescent = Math.max(currentMaxDescent, token.descent);
    currentMaxLineHeight = Math.max(currentMaxLineHeight, token.fontSizePx * (baseStyle.lineHeight || 1.3), token.ascent + token.descent);
  };
  const shouldWrap = baseStyle.wordWrap !== 'none';
  let endsWithNewline = false;
  for (const token of rawTokens) {
    endsWithNewline = token.isNewline;
    if (token.isNewline) {
      pushCurrentLine();
      continue;
    }
    // 0.05 pt layout epsilon accommodates physical unit conversion (mm/inch <-> pt) floating-point drift
    const LAYOUT_EPSILON = 0.05;
    if (shouldWrap && !token.isSpace && currentLineTokens.length > 0 && currentLineWidth + tracking + token.width > availableWidth + LAYOUT_EPSILON) {
      pushCurrentLine();
    }
    if (shouldWrap && !token.isSpace && (baseStyle.wordWrap === 'char' || token.width > availableWidth + LAYOUT_EPSILON)) {
      for (const char of splitGraphemes(token.text)) {
        const width = measureTrackedText(ctx, char, token.fontStr, token.fontSizePx, 0);
        if (currentLineTokens.length > 0 && currentLineWidth + tracking + width > availableWidth + LAYOUT_EPSILON) pushCurrentLine();
        append({ ...token, text: char, width });
      }
    } else {
      append(token);
    }
  }
  if (currentLineTokens.length > 0 || endsWithNewline || lines.length === 0) pushCurrentLine();

  // 3. Compute Vertical Alignment
  let totalContentHeight = 0;
  for (const line of lines) {
    totalContentHeight += line.maxLineHeight;
  }

  const vAlign = baseStyle.verticalAlign || 'middle';
  let startY = paddingPx;
  if (vAlign === 'middle') {
    startY = paddingPx + Math.max(0, (availableHeight - totalContentHeight) / 2);
  } else if (vAlign === 'bottom') {
    startY = paddingPx + Math.max(0, availableHeight - totalContentHeight);
  }

  // 4. Position each line and token with baseline alignment & horizontal alignment
  const renderedLines: RenderedLine[] = [];
  const hAlign = baseStyle.align || 'center';
  let currentTop = startY;

  for (const line of lines) {
    let startX = paddingPx;
    if (hAlign === 'center') {
      startX = paddingPx + Math.max(0, (availableWidth - line.width) / 2);
    } else if (hAlign === 'right') {
      startX = paddingPx + Math.max(0, availableWidth - line.width);
    }

    const baseline = currentTop + line.maxAscent + Math.max(0, (line.maxLineHeight - (line.maxAscent + line.maxDescent)) / 2);

    let tokenX = startX;
    const measuredLineTokens: MeasuredToken[] = [];

    for (const tok of line.tokens) {
      measuredLineTokens.push({
        text: tok.text,
        isSpace: tok.isSpace,
        isNewline: tok.isNewline,
        fontFamily: tok.run.fontFamily || baseStyle.fontFamily || 'Inter',
        fontSizePx: tok.fontSizePx,
        fontWeight: tok.run.fontWeight || baseStyle.fontWeight || 'normal',
        fontStyle: tok.run.fontStyle || baseStyle.fontStyle || 'normal',
        textDecoration: tok.run.textDecoration || baseStyle.textDecoration || 'none',
        fill: tok.run.fill || baseStyle.fill || '#1e293b',
        highlight: tok.run.highlight,
        width: tok.width,
        ascent: tok.ascent,
        descent: tok.descent,
        fontStr: tok.fontStr,
        x: tokenX,
        yBaseline: baseline,
        letterSpacing: tracking,
      });

      tokenX += tok.width + tracking;
    }

    renderedLines.push({
      tokens: measuredLineTokens,
      width: line.width,
      height: line.maxLineHeight,
      maxAscent: line.maxAscent,
      maxDescent: line.maxDescent,
      top: currentTop,
      baseline,
    });

    currentTop += line.maxLineHeight;
  }

  return {
    lines: renderedLines,
    totalWidth: Math.max(...lines.map((l) => l.width), 0),
    totalHeight: totalContentHeight,
    paddingPx,
    boxWidth,
    boxHeight,
    overflow: totalContentHeight > availableHeight + 0.05 || lines.some((line) => line.width > availableWidth + 0.05),
  };
}

/**
 * Draws the calculated rich text layout onto any Canvas 2D rendering context.
 */
export function drawRichTextLayout(ctx: CanvasRenderingContext2D, layout: RichTextLayout): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, layout.boxWidth, layout.boxHeight);
  ctx.clip();

  // 1. Pass 1: Render background highlights for all tokens
  for (const line of layout.lines) {
    for (const tok of line.tokens) {
      if (tok.highlight && !tok.isSpace && !tok.isNewline) {
        ctx.fillStyle = tok.highlight;
        const hlX = tok.x - 2;
        const hlY = tok.yBaseline - tok.ascent - 2;
        const hlW = tok.width + 4;
        const hlH = tok.ascent + tok.descent + 4;

        // Rounded rect for aesthetic pill highlight
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(hlX, hlY, hlW, hlH, 3);
          ctx.fill();
        } else {
          ctx.fillRect(hlX, hlY, hlW, hlH);
        }
      }
    }
  }

  // 2. Pass 2: Render text glyphs and decorations
  for (const line of layout.lines) {
    for (const tok of line.tokens) {
      if (tok.isNewline || tok.isSpace) continue;

      ctx.font = tok.fontStr;
      ctx.fillStyle = tok.fill;
      if (!tok.letterSpacing) {
        ctx.fillText(tok.text, tok.x, tok.yBaseline);
      } else {
        let x = tok.x;
        for (const char of splitGraphemes(tok.text)) {
          ctx.fillText(char, x, tok.yBaseline);
          x += ctx.measureText(char).width + tok.letterSpacing;
        }
      }

      // Text decorations
      if (tok.textDecoration === 'underline') {
        const strokeW = Math.max(1.2, tok.fontSizePx * 0.07);
        ctx.fillRect(tok.x, tok.yBaseline + 2, tok.width, strokeW);
      } else if (tok.textDecoration === 'line-through') {
        const strokeW = Math.max(1.2, tok.fontSizePx * 0.07);
        ctx.fillRect(tok.x, tok.yBaseline - tok.ascent * 0.35, tok.width, strokeW);
      }
    }
  }

  ctx.restore();
}

/**
 * Computes the tight physical height (in canvasUnit) needed to display the rich text runs.
 */
export function calculateRichTextFitHeight(
  runs: TextRun[],
  baseStyle: TextStyle,
  boxWidthInCanvasUnit: number,
  canvasUnit: Unit = 'mm',
  dpi: number = 300,
  scaleFactor: number = 1.0
): number {
  void scaleFactor;
  const widthPt = convertUnitToPt(boxWidthInCanvasUnit, canvasUnit, dpi);
  const layout = layoutRichText(runs, baseStyle, widthPt, 1e7, 72, 'inch', dpi);
  return convertPtToUnit(layout.totalHeight + 2 * layout.paddingPx, canvasUnit, dpi);
}

export function splitGraphemes(text: string): string[] {
  // Intl.Segmenter is present in WebView2; fallback keeps Unicode code points intact.
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: string }) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (item) => item.segment) : Array.from(text);
}

function measureTrackedText(ctx: CanvasRenderingContext2D, text: string, font: string, size: number, tracking: number): number {
  const measure = (value: string) => {
    if (ctx.measureText) { ctx.font = font; return ctx.measureText(value).width; }
    return Array.from(value).length * size * 0.55;
  };
  if (!tracking) return measure(text);
  const chars = splitGraphemes(text);
  return Math.max(0, chars.reduce((width, char) => width + measure(char), 0) + Math.max(0, chars.length - 1) * tracking);
}
