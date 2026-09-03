import { TextStyle, TextRun } from './text';

export interface StyledRange {
  id: string;
  start: number; // 0-based character index start (inclusive)
  end: number;   // 0-based character index end (exclusive)
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  fill?: string;
  highlight?: string;
}

let rangeCounter = 0;
export function generateRangeId(): string {
  rangeCounter += 1;
  return `range_${Date.now()}_${rangeCounter}`;
}

/**
 * Converts pure clean plain text and a list of StyledRange into non-overlapping TextRun tokens
 * for the Canvas2D layout and rendering engine.
 */
export function rangesToTextRuns(
  text: string,
  ranges: StyledRange[] | undefined,
  baseStyle: TextStyle
): TextRun[] {
  if (!text) return [];
  if (!ranges || ranges.length === 0) {
    return [
      {
        text,
        fontFamily: baseStyle.fontFamily,
        fontSize: baseStyle.fontSize,
        fontWeight: baseStyle.fontWeight,
        fontStyle: baseStyle.fontStyle,
        textDecoration: baseStyle.textDecoration,
        fill: baseStyle.fill,
      },
    ];
  }

  // Collect and sort all boundary points
  const len = text.length;
  const boundarySet = new Set<number>([0, len]);

  for (const r of ranges) {
    const s = Math.max(0, Math.min(len, r.start));
    const e = Math.max(0, Math.min(len, r.end));
    if (s < e) {
      boundarySet.add(s);
      boundarySet.add(e);
    }
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
  const rawRuns: TextRun[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const s = boundaries[i] ?? 0;
    const e = boundaries[i + 1] ?? len;
    if (s >= e) continue;

    const sliceText = text.slice(s, e);
    if (!sliceText) continue;

    // Find all ranges covering this character slice
    const activeRanges = ranges.filter((r) => r.start <= s && r.end >= e);

    let fFamily = baseStyle.fontFamily;
    let fSize = baseStyle.fontSize;
    let fWeight = baseStyle.fontWeight;
    let fStyle = baseStyle.fontStyle;
    let tDec = baseStyle.textDecoration;
    let fill = baseStyle.fill;
    let highlight: string | undefined = undefined;

    for (const r of activeRanges) {
      if (r.fontFamily) fFamily = r.fontFamily;
      if (r.fontSize) fSize = r.fontSize;
      if (r.fontWeight) fWeight = r.fontWeight;
      if (r.fontStyle) fStyle = r.fontStyle;
      if (r.textDecoration) tDec = r.textDecoration;
      if (r.fill) fill = r.fill;
      if (r.highlight) highlight = r.highlight;
    }

    rawRuns.push({
      text: sliceText,
      fontFamily: fFamily,
      fontSize: fSize,
      fontWeight: fWeight,
      fontStyle: fStyle,
      textDecoration: tDec,
      fill,
      highlight,
    });
  }

  // Merge contiguous adjacent runs with identical styling properties
  const merged: TextRun[] = [];
  for (const run of rawRuns) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.fontFamily === run.fontFamily &&
      prev.fontSize === run.fontSize &&
      prev.fontWeight === run.fontWeight &&
      prev.fontStyle === run.fontStyle &&
      prev.textDecoration === run.textDecoration &&
      prev.fill === run.fill &&
      prev.highlight === run.highlight
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }

  return merged;
}

/**
 * Applies or updates a styled character range on an element without altering text content.
 */
export function applyStyleToRange(
  existingRanges: StyledRange[] | undefined,
  start: number,
  end: number,
  patch: Partial<Omit<StyledRange, 'id' | 'start' | 'end'>>
): StyledRange[] {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  if (s === e) return existingRanges ? [...existingRanges] : [];

  const current = existingRanges ? [...existingRanges] : [];

  // Check if an existing range exactly matches this selection
  const exactIndex = current.findIndex((r) => r.start === s && r.end === e);
  if (exactIndex >= 0) {
    const existing = current[exactIndex];
    if (!existing) return current;

    // Check if toggle off (e.g. bold -> normal)
    const isTogglingOff = Object.entries(patch).every(([key, val]) => {
      return (existing as any)[key] === val;
    });

    if (isTogglingOff) {
      // Remove or reset matching attributes
      const updated: StyledRange = { ...existing };
      for (const k of Object.keys(patch) as Array<keyof typeof patch>) {
        delete (updated as any)[k];
      }
      // If no style attributes remain, delete range
      const keys = Object.keys(updated).filter((k) => !['id', 'start', 'end'].includes(k));
      if (keys.length === 0) {
        current.splice(exactIndex, 1);
        return current;
      }
      current[exactIndex] = {
        ...updated,
        id: existing.id,
        start: existing.start,
        end: existing.end,
      };
      return current;
    }

    current[exactIndex] = {
      ...existing,
      ...patch,
      id: existing.id,
      start: existing.start,
      end: existing.end,
    };
    return current;
  }

  // Add new range
  current.push({
    id: generateRangeId(),
    start: s,
    end: e,
    ...patch,
  });

  return current.sort((a, b) => a.start - b.start);
}

/**
 * Removes a styled range by id, reverting the words to default base style.
 */
export function removeStyleRange(
  ranges: StyledRange[] | undefined,
  rangeId: string
): StyledRange[] {
  if (!ranges) return [];
  return ranges.filter((r) => r.id !== rangeId);
}

/**
 * Adjusts character range indexes after user inserts or deletes text in the clean textarea.
 */
export function shiftRangesOnTextEdit(
  ranges: StyledRange[] | undefined,
  changeStart: number,
  removedLength: number,
  insertedLength: number
): StyledRange[] {
  if (!ranges || ranges.length === 0) return [];
  const delta = insertedLength - removedLength;
  if (delta === 0) return ranges;

  const updated: StyledRange[] = [];

  for (const r of ranges) {
    if (r.end <= changeStart) {
      // Before edit zone: unchanged
      updated.push(r);
    } else if (r.start >= changeStart + removedLength) {
      // After edit zone: shift both start and end by delta
      updated.push({
        ...r,
        start: Math.max(0, r.start + delta),
        end: Math.max(0, r.end + delta),
      });
    } else {
      // Overlaps with edit zone: clamp bounds
      const newStart = Math.min(r.start, changeStart);
      const newEnd = Math.max(newStart, r.end + delta);
      if (newEnd > newStart) {
        updated.push({
          ...r,
          start: newStart,
          end: newEnd,
        });
      }
    }
  }

  return updated;
}
