import { TextStyle, TextRun } from './text';
import { Unit, ptToScreenPx, convertPtToUnit } from './units';

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
  const paddingPt = Number.isFinite(baseStyle.padding) ? baseStyle.padding : 6;
  const rawPaddingPx = ptToScreenPx(paddingPt, canvasUnit, dpi, scaleFactor);
  const paddingPx = Math.max(2, Math.min(Math.floor(boxWidth / 4), Number.isFinite(rawPaddingPx) ? rawPaddingPx : 4));
  const availableWidth = Math.max(10, boxWidth - 2 * paddingPx);
  const availableHeight = Math.max(10, boxHeight - 2 * paddingPx);

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
    const fontSizePx = Math.max(1, Number.isFinite(rawSize) ? rawSize : 16);

    const fFamily = run.fontFamily || baseStyle.fontFamily || 'Inter';
    const fWeight = run.fontWeight || baseStyle.fontWeight || 'normal';
    const fStyle = run.fontStyle || baseStyle.fontStyle || 'normal';
    const fontStr = `${fStyle} ${fWeight} ${fontSizePx}px "${fFamily}", sans-serif`;

    if (ctx && ctx.font !== undefined) {
      ctx.font = fontStr;
    }

    // Split run text into words, whitespace, and newlines
    const parts = run.text.split(/(\n|\s+)/);
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

    // Trim trailing whitespace token width from line width calculation
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

  const shouldWrap = baseStyle.wordWrap !== 'none';

  for (const token of rawTokens) {
    if (token.isNewline) {
      pushCurrentLine();
      continue;
    }

    const tokenLineH = token.fontSizePx * (baseStyle.lineHeight || 1.3);

    if (shouldWrap && currentLineTokens.length > 0 && currentLineWidth + token.width > availableWidth) {
      // Exceeds available width -> break line if not whitespace
      if (!token.isSpace) {
        pushCurrentLine();
      }
    }

    currentLineTokens.push(token);
    currentLineWidth += token.width;
    currentMaxAscent = Math.max(currentMaxAscent, token.ascent);
    currentMaxDescent = Math.max(currentMaxDescent, token.descent);
    currentMaxLineHeight = Math.max(currentMaxLineHeight, tokenLineH);
  }

  if (currentLineTokens.length > 0) {
    pushCurrentLine();
  }

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
      });

      tokenX += tok.width;
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
  };
}

/**
 * Draws the calculated rich text layout onto any Canvas 2D rendering context.
 */
export function drawRichTextLayout(ctx: CanvasRenderingContext2D, layout: RichTextLayout): void {
  ctx.save();

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
      ctx.fillText(tok.text, tok.x, tok.yBaseline);

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
  const pixelW = convertPtToUnit(boxWidthInCanvasUnit, canvasUnit, dpi) * scaleFactor;
  const dummyPixelH = 2000; // ample height for layout
  const layout = layoutRichText(runs, baseStyle, pixelW, dummyPixelH, scaleFactor, canvasUnit, dpi);

  const neededPixelH = layout.totalHeight + 2 * layout.paddingPx;
  // Convert screen px back to canvasUnit
  const pxPerCanvasUnit = convertPtToUnit(1, canvasUnit, dpi) * scaleFactor;
  if (pxPerCanvasUnit <= 0) return boxWidthInCanvasUnit;

  const resultInUnit = neededPixelH / pxPerCanvasUnit;
  return Math.max(10, Math.round(resultInUnit * 10) / 10);
}
