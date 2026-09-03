import { TextStyle, TextRun } from './text';

/**
 * Fast-path check to see if text contains any rich text markdown or attribute tags.
 */
export function hasRichTextMarkup(text?: string | null): boolean {
  if (!text) return false;
  return /(\*\*|(?<!\*)\*(?!\*)|__|~~|\{(?:color|highlight|font|size):[^{}]+\})/.test(text);
}

/**
 * Active style modifier state during parsing
 */
interface StyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color?: string;
  highlight?: string;
  font?: string;
  size?: number;
}

function cloneState(s: StyleState): StyleState {
  return { ...s };
}

/**
 * Parses raw text containing markdown and formatting tags into an array of styled TextRun tokens.
 *
 * Supported syntaxes:
 * - **bold**
 * - *italic*
 * - __underline__
 * - ~~strikethrough~~
 * - {color:#f59e0b}text{/color}
 * - {highlight:#fef08a}text{/highlight}
 * - {font:Playfair Display}text{/font}
 * - {size:32}text{/size}
 */
export function parseRichTextRuns(rawText: string, baseStyle: TextStyle): TextRun[] {
  if (!rawText) return [];

  // Fast path for plain text without any markup
  if (!hasRichTextMarkup(rawText)) {
    return [
      {
        text: rawText,
        fontFamily: baseStyle.fontFamily,
        fontSize: baseStyle.fontSize,
        fontWeight: baseStyle.fontWeight,
        fontStyle: baseStyle.fontStyle,
        textDecoration: baseStyle.textDecoration,
        fill: baseStyle.fill,
      },
    ];
  }

  const runs: TextRun[] = [];
  const state: StyleState = {
    bold: baseStyle.fontWeight === 'bold' || Number(baseStyle.fontWeight) >= 600,
    italic: baseStyle.fontStyle === 'italic',
    underline: baseStyle.textDecoration === 'underline',
    strike: baseStyle.textDecoration === 'line-through',
    color: baseStyle.fill,
    font: baseStyle.fontFamily,
    size: baseStyle.fontSize,
  };

  const stateStack: StyleState[] = [cloneState(state)];
  let i = 0;
  let currentBuffer = '';

  const getCurrentState = (): StyleState => {
    return stateStack[stateStack.length - 1] || state;
  };

  const flushBuffer = () => {
    if (currentBuffer.length === 0) return;
    const currentState = getCurrentState();

    let dec: 'none' | 'underline' | 'line-through' = 'none';
    if (currentState.underline) dec = 'underline';
    else if (currentState.strike) dec = 'line-through';

    runs.push({
      text: currentBuffer,
      fontFamily: currentState.font || baseStyle.fontFamily,
      fontSize: currentState.size ?? baseStyle.fontSize,
      fontWeight: currentState.bold ? 'bold' : 'normal',
      fontStyle: currentState.italic ? 'italic' : 'normal',
      textDecoration: dec,
      fill: currentState.color || baseStyle.fill,
      highlight: currentState.highlight,
    });
    currentBuffer = '';
  };

  while (i < rawText.length) {
    // 1. Check for {color:...}, {highlight:...}, {font:...}, {size:...}
    if (rawText[i] === '{') {
      const openTagMatch = rawText.slice(i).match(/^\{(color|highlight|font|size):([^}]+)\}/);
      if (openTagMatch) {
        flushBuffer();
        const tagType = openTagMatch[1];
        const tagVal = (openTagMatch[2] || '').trim();
        const nextState = cloneState(getCurrentState());

        if (tagType === 'color') nextState.color = tagVal;
        else if (tagType === 'highlight') nextState.highlight = tagVal;
        else if (tagType === 'font') nextState.font = tagVal;
        else if (tagType === 'size') {
          const parsed = parseFloat(tagVal);
          if (Number.isFinite(parsed) && parsed > 0) nextState.size = parsed;
        }

        stateStack.push(nextState);
        i += openTagMatch[0].length;
        continue;
      }

      // Check for closing tags: {/color}, {/highlight}, {/font}, {/size}
      const closeTagMatch = rawText.slice(i).match(/^\{\/(color|highlight|font|size)\}/);
      if (closeTagMatch) {
        flushBuffer();
        if (stateStack.length > 1) {
          stateStack.pop();
        }
        i += closeTagMatch[0].length;
        continue;
      }
    }

    // 2. Check for ** (bold)
    if (rawText.startsWith('**', i)) {
      flushBuffer();
      const nextState = cloneState(getCurrentState());
      nextState.bold = !nextState.bold;
      stateStack.push(nextState);
      i += 2;
      continue;
    }

    // 3. Check for __ (underline)
    if (rawText.startsWith('__', i)) {
      flushBuffer();
      const nextState = cloneState(getCurrentState());
      nextState.underline = !nextState.underline;
      stateStack.push(nextState);
      i += 2;
      continue;
    }

    // 4. Check for ~~ (strikethrough)
    if (rawText.startsWith('~~', i)) {
      flushBuffer();
      const nextState = cloneState(getCurrentState());
      nextState.strike = !nextState.strike;
      stateStack.push(nextState);
      i += 2;
      continue;
    }

    // 5. Check for * (italic) - single asterisk not preceded/followed by another asterisk
    if (rawText[i] === '*' && rawText[i + 1] !== '*' && (i === 0 || rawText[i - 1] !== '*')) {
      flushBuffer();
      const nextState = cloneState(getCurrentState());
      nextState.italic = !nextState.italic;
      stateStack.push(nextState);
      i += 1;
      continue;
    }

    // Standard character
    currentBuffer += rawText[i];
    i += 1;
  }

  flushBuffer();
  return runs;
}

/**
 * Strips all rich text formatting markup tags to obtain pure readable text.
 */
export function stripRichTextMarkup(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')
    .replace(/(?<!\*)\*(?!\*)/g, '')
    .replace(/__/g, '')
    .replace(/~~/g, '')
    .replace(/\{(?:color|highlight|font|size):[^}]+\}/g, '')
    .replace(/\{\/(?:color|highlight|font|size)\}/g, '');
}

/**
 * Helper to wrap or toggle formatting tags around a given selection range in a string.
 */
export function wrapSelectionWithMarkup(
  fullText: string,
  start: number,
  end: number,
  openTag: string,
  closeTag: string
): { newText: string; newStart: number; newEnd: number } {
  const s = Math.min(start, end);
  const e = Math.max(start, end);

  if (s === e) {
    // No text selected: insert tag pair and position cursor inside
    const newText = fullText.slice(0, s) + openTag + closeTag + fullText.slice(e);
    const newCursor = s + openTag.length;
    return { newText, newStart: newCursor, newEnd: newCursor };
  }

  const before = fullText.slice(0, s);
  const selected = fullText.slice(s, e);
  const after = fullText.slice(e);

  // Check if selection itself is already wrapped with this exact tag
  if (selected.startsWith(openTag) && selected.endsWith(closeTag)) {
    const unwrapped = selected.slice(openTag.length, selected.length - closeTag.length);
    const newText = before + unwrapped + after;
    return { newText, newStart: s, newEnd: s + unwrapped.length };
  }

  // Check if the surrounding text is already wrapped with this tag
  if (before.endsWith(openTag) && after.startsWith(closeTag)) {
    const newBefore = before.slice(0, before.length - openTag.length);
    const newAfter = after.slice(closeTag.length);
    const newText = newBefore + selected + newAfter;
    return { newText, newStart: newBefore.length, newEnd: newBefore.length + selected.length };
  }

  // Wrap selection
  const newText = before + openTag + selected + closeTag + after;
  return { newText, newStart: s, newEnd: s + openTag.length + selected.length + closeTag.length };
}
