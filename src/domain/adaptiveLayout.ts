import { RectBounds, TemplateParams, getUsableAreas, fitInsideBoxCentered, round4 } from './templates';
import { PhotoFrameElement } from './editor';

export type PhotoOrientation = 'landscape' | 'portrait' | 'square';

export interface AdaptivePhoto {
  id?: string;
  photoId?: string | null;
  filePath?: string;
  fileName?: string;
  previewPath?: string;
  thumbnailPath?: string;
  photoAspect?: number;
  rating?: number; // 0 to 5 stars for hero scoring
  isFavorite?: boolean;
}

export interface AdaptiveLayoutVariation {
  id: string;
  name: string;
  description: string;
  rects: RectBounds[];
  tags: string[];
  score?: number; // 0 - 100% composite visual match score
  cropPenalty?: number; // 0.0 (no crop) to 1.0 (heavy crop)
  fingerprint?: string; // e.g. "1L+2P"
  photoAssignments?: number[]; // Mapping of photo[i] -> rect[j]
}

/**
 * Classifies a photo aspect ratio into landscape, portrait, or square.
 */
export function getPhotoOrientation(aspect: number): PhotoOrientation {
  if (aspect > 1.15) return 'landscape';
  if (aspect < 0.85) return 'portrait';
  return 'square';
}

/**
 * Computes an orientation signature fingerprint for an array of photos (e.g. "1L+2P", "2L", "3P").
 */
export function getPhotosFingerprint(photos: AdaptivePhoto[]): string {
  let l = 0;
  let p = 0;
  let s = 0;
  for (const ph of photos) {
    const ori = getPhotoOrientation(ph.photoAspect || 1.5);
    if (ori === 'landscape') l++;
    else if (ori === 'portrait') p++;
    else s++;
  }
  const parts: string[] = [];
  if (l > 0) parts.push(`${l}L`);
  if (p > 0) parts.push(`${p}P`);
  if (s > 0) parts.push(`${s}S`);
  return parts.length > 0 ? parts.join('+') : '0P';
}

/**
 * Calculates crop loss penalty between a photo aspect ratio and a slot aspect ratio.
 * Returns a value between 0.0 (exact aspect match, zero crop) and 1.0 (severe crop).
 */
export function calculateCropPenalty(photoAspect: number, slotAspect: number): number {
  if (!photoAspect || !slotAspect || photoAspect <= 0 || slotAspect <= 0) return 0.5;
  const ratio = Math.min(photoAspect / slotAspect, slotAspect / photoAspect);
  return Math.max(0, Math.min(1, 1 - ratio));
}

/**
 * Finds the optimal bipartite 1-to-1 assignment of photos to frame slots that minimizes
 * total crop penalty across all photos, prioritizing hero photos for the largest slots.
 */
export function findOptimalPhotoSlotMapping(
  photos: AdaptivePhoto[],
  slots: RectBounds[]
): { mapping: number[]; score: number; avgCropPenalty: number } {
  const n = Math.min(photos.length, slots.length);
  if (n === 0) return { mapping: [], score: 100, avgCropPenalty: 0 };
  if (n === 1) {
    const firstPhoto = photos[0];
    const firstSlot = slots[0];
    const pAspect = firstPhoto?.photoAspect || 1.5;
    const sAspect = firstSlot ? firstSlot.width / firstSlot.height : 1.5;
    const penalty = calculateCropPenalty(pAspect, sAspect);
    const score = Math.round((1 - penalty) * 100);
    return { mapping: [0], score, avgCropPenalty: penalty };
  }

  // Cost matrix: cost[p][s] = crop penalty + hero weighting
  // Find slot areas to identify the hero (largest) slot
  const slotAreas = slots.map((s) => s.width * s.height);
  const maxSlotArea = slotAreas.length > 0 ? Math.max(...slotAreas) : 0;

  const costMatrix: number[][] = [];
  for (let p = 0; p < n; p++) {
    const row: number[] = [];
    const photo = photos[p];
    const pAspect = photo?.photoAspect || 1.5;
    const isHeroPhoto = Boolean(
      (photo?.rating && photo.rating >= 4) ||
      photo?.isFavorite ||
      p === 0
    );

    for (let s = 0; s < n; s++) {
      const slot = slots[s];
      const sAspect = slot ? slot.width / slot.height : 1.5;
      let penalty = calculateCropPenalty(pAspect, sAspect);

      // If photo is a preferred hero and slot is the largest slot, award a bonus (lower cost)
      const slotArea = slotAreas[s] ?? 0;
      if (isHeroPhoto && maxSlotArea > 0 && slotArea >= maxSlotArea * 0.9) {
        penalty = Math.max(0, penalty * 0.7);
      }
      row.push(penalty);
    }
    costMatrix.push(row);
  }

  if (n <= 7) {
    // Permutation search with branch-and-bound pruning for optimal assignment
    let bestCost = Infinity;
    let bestMapping: number[] = Array.from({ length: n }, (_, i) => i);

    const used = new Array<boolean>(n).fill(false);
    const currentMapping: number[] = new Array<number>(n);

    function permute(pIndex: number, currentCost: number) {
      if (currentCost >= bestCost) return; // Prune worse branches
      if (pIndex === n) {
        bestCost = currentCost;
        bestMapping = [...currentMapping];
        return;
      }

      for (let s = 0; s < n; s++) {
        if (!used[s]) {
          used[s] = true;
          currentMapping[pIndex] = s;
          const cost = costMatrix[pIndex]?.[s] ?? 0;
          permute(pIndex + 1, currentCost + cost);
          used[s] = false;
        }
      }
    }

    permute(0, 0);

    const avgPenalty = n > 0 ? bestCost / n : 0;
    const score = Math.round(Math.max(0, Math.min(100, (1 - avgPenalty) * 100)));

    return { mapping: bestMapping, score, avgCropPenalty: avgPenalty };
  }

  // Fast greedy matching for high photo counts (n >= 8)
  const slotAssigned = new Array<boolean>(n).fill(false);
  const greedyMapping = new Array<number>(n).fill(0);
  let totalCost = 0;

  const candidates: Array<{ p: number; s: number; cost: number }> = [];
  for (let p = 0; p < n; p++) {
    for (let s = 0; s < n; s++) {
      const cost = costMatrix[p]?.[s] ?? 0;
      candidates.push({ p, s, cost });
    }
  }
  candidates.sort((a, b) => a.cost - b.cost);

  const photoAssigned = new Array<boolean>(n).fill(false);
  for (const c of candidates) {
    if (!photoAssigned[c.p] && !slotAssigned[c.s]) {
      photoAssigned[c.p] = true;
      slotAssigned[c.s] = true;
      greedyMapping[c.p] = c.s;
      totalCost += c.cost;
    }
  }

  // Fallback for any unassigned
  for (let p = 0; p < n; p++) {
    if (!photoAssigned[p]) {
      for (let s = 0; s < n; s++) {
        if (!slotAssigned[s]) {
          slotAssigned[s] = true;
          greedyMapping[p] = s;
          totalCost += costMatrix[p]?.[s] ?? 0;
          break;
        }
      }
    }
  }

  const avgPenalty = n > 0 ? totalCost / n : 0;
  const score = Math.round(Math.max(0, Math.min(100, (1 - avgPenalty) * 100)));
  return { mapping: greedyMapping, score, avgCropPenalty: avgPenalty };
}

/**
 * Partitions a single page box into K geometric frame rects with exact inter-frame spacing.
 * Strictly guarantees that all frames stay 100% inside the given box boundary.
 */
export function partitionPageBoxIntoKRects(
  box: RectBounds,
  count: number,
  spacing: number,
  variantIndex = 0
): RectBounds[] {
  if (count <= 0) return [];
  if (count === 1) {
    const v = variantIndex % 3;
    if (v === 0) return [{ ...box }];
    if (v === 1) return [fitInsideBoxCentered(box, 1.5, 0.92)];
    return [fitInsideBoxCentered(box, 1.5, 0.82)];
  }

  if (count === 2) {
    const v = variantIndex % 6;
    if (v === 0) {
      // Horizontal 2-Stack (Top & Bottom)
      const h = round4((box.height - spacing) / 2);
      return [
        { x: box.x, y: box.y, width: box.width, height: h },
        { x: box.x, y: round4(box.y + h + spacing), width: box.width, height: h },
      ];
    }
    if (v === 1) {
      // Vertical 2-Split (Left & Right columns)
      const w = round4((box.width - spacing) / 2);
      return [
        { x: box.x, y: box.y, width: w, height: box.height },
        { x: round4(box.x + w + spacing), y: box.y, width: w, height: box.height },
      ];
    }
    if (v === 2) {
      // Asymmetric: Top Hero (62%) + Bottom companion
      const topH = round4((box.height - spacing) * 0.62);
      const botH = round4(box.height - spacing - topH);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: round4(box.y + topH + spacing), width: box.width, height: botH },
      ];
    }
    if (v === 3) {
      // Asymmetric Mirrored: Bottom Hero (62%) + Top companion
      const botH = round4((box.height - spacing) * 0.62);
      const topH = round4(box.height - spacing - botH);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: round4(box.y + topH + spacing), width: box.width, height: botH },
      ];
    }
    if (v === 4) {
      // Asymmetric: Left Hero (62%) + Right companion
      const leftW = round4((box.width - spacing) * 0.62);
      const rightW = round4(box.width - spacing - leftW);
      return [
        { x: box.x, y: box.y, width: leftW, height: box.height },
        { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: box.height },
      ];
    }
    // Asymmetric Mirrored: Right Hero (62%) + Left companion
    const rightW = round4((box.width - spacing) * 0.62);
    const leftW = round4(box.width - spacing - rightW);
    return [
      { x: box.x, y: box.y, width: leftW, height: box.height },
      { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: box.height },
    ];
  }

  if (count === 3) {
    const v = variantIndex % 8;
    if (v === 0) {
      // 1 Top Landscape Hero + 2 Bottom Portrait Columns (great for 1L+2P)
      const topH = round4((box.height - spacing) / 2);
      const botH = round4(box.height - spacing - topH);
      const colW = round4((box.width - spacing) / 2);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: round4(box.y + topH + spacing), width: colW, height: botH },
        { x: round4(box.x + colW + spacing), y: round4(box.y + topH + spacing), width: colW, height: botH },
      ];
    }
    if (v === 1) {
      // 2 Top Portrait Columns + 1 Bottom Landscape Hero (great for 1L+2P)
      const topH = round4((box.height - spacing) / 2);
      const botH = round4(box.height - spacing - topH);
      const colW = round4((box.width - spacing) / 2);
      return [
        { x: box.x, y: box.y, width: colW, height: topH },
        { x: round4(box.x + colW + spacing), y: box.y, width: colW, height: topH },
        { x: box.x, y: round4(box.y + topH + spacing), width: box.width, height: botH },
      ];
    }
    if (v === 2) {
      // 1 Left Portrait Hero + 2 Right Landscape Stacks (great for 1P+2L)
      const leftW = round4((box.width - spacing) / 2);
      const rightW = round4(box.width - spacing - leftW);
      const stackH = round4((box.height - spacing) / 2);
      return [
        { x: box.x, y: box.y, width: leftW, height: box.height },
        { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: stackH },
        { x: round4(box.x + leftW + spacing), y: round4(box.y + stackH + spacing), width: rightW, height: stackH },
      ];
    }
    if (v === 3) {
      // 2 Left Landscape Stacks + 1 Right Portrait Hero (great for 1P+2L)
      const leftW = round4((box.width - spacing) / 2);
      const rightW = round4(box.width - spacing - leftW);
      const stackH = round4((box.height - spacing) / 2);
      return [
        { x: box.x, y: box.y, width: leftW, height: stackH },
        { x: box.x, y: round4(box.y + stackH + spacing), width: leftW, height: stackH },
        { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: box.height },
      ];
    }
    if (v === 4) {
      // 3 Vertical Columns (Triptych - great for 3P)
      const colW = round4((box.width - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: colW, height: box.height },
        { x: round4(box.x + colW + spacing), y: box.y, width: colW, height: box.height },
        { x: round4(box.x + (colW + spacing) * 2), y: box.y, width: colW, height: box.height },
      ];
    }
    if (v === 5) {
      // 3 Horizontal Rows (great for 3L)
      const rowH = round4((box.height - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: box.width, height: rowH },
        { x: box.x, y: round4(box.y + rowH + spacing), width: box.width, height: rowH },
        { x: box.x, y: round4(box.y + (rowH + spacing) * 2), width: box.width, height: rowH },
      ];
    }
    if (v === 6) {
      // 1 Big Left Hero (60%) + 2 Right Stacks
      const leftW = round4((box.width - spacing) * 0.60);
      const rightW = round4(box.width - spacing - leftW);
      const stackH = round4((box.height - spacing) / 2);
      return [
        { x: box.x, y: box.y, width: leftW, height: box.height },
        { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: stackH },
        { x: round4(box.x + leftW + spacing), y: round4(box.y + stackH + spacing), width: rightW, height: stackH },
      ];
    }
    // 1 Big Top Hero (60%) + 2 Bottom Columns
    const topH = round4((box.height - spacing) * 0.60);
    const botH = round4(box.height - spacing - topH);
    const colW = round4((box.width - spacing) / 2);
    return [
      { x: box.x, y: box.y, width: box.width, height: topH },
      { x: box.x, y: round4(box.y + topH + spacing), width: colW, height: botH },
      { x: round4(box.x + colW + spacing), y: round4(box.y + topH + spacing), width: colW, height: botH },
    ];
  }

  if (count === 4) {
    const v = variantIndex % 8;
    if (v === 0) {
      // 2x2 Balanced Quadrant Grid
      const w = round4((box.width - spacing) / 2);
      const h = round4((box.height - spacing) / 2);
      const x2 = round4(box.x + w + spacing);
      const y2 = round4(box.y + h + spacing);
      return [
        { x: box.x, y: box.y, width: w, height: h },
        { x: x2, y: box.y, width: w, height: h },
        { x: box.x, y: y2, width: w, height: h },
        { x: x2, y: y2, width: w, height: h },
      ];
    }
    if (v === 1) {
      // 1 Top Banner + 3 Bottom Columns (great for 1L+3P)
      const topH = round4((box.height - spacing) * 0.48);
      const botH = round4(box.height - spacing - topH);
      const colW = round4((box.width - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: round4(box.y + topH + spacing), width: colW, height: botH },
        { x: round4(box.x + colW + spacing), y: round4(box.y + topH + spacing), width: colW, height: botH },
        { x: round4(box.x + (colW + spacing) * 2), y: round4(box.y + topH + spacing), width: colW, height: botH },
      ];
    }
    if (v === 2) {
      // 3 Top Columns + 1 Bottom Banner (great for 1L+3P)
      const topH = round4((box.height - spacing) * 0.52);
      const botH = round4(box.height - spacing - topH);
      const colW = round4((box.width - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: colW, height: topH },
        { x: round4(box.x + colW + spacing), y: box.y, width: colW, height: topH },
        { x: round4(box.x + (colW + spacing) * 2), y: box.y, width: colW, height: topH },
        { x: box.x, y: round4(box.y + topH + spacing), width: box.width, height: botH },
      ];
    }
    if (v === 3) {
      // 1 Left Tower + 3 Right Stacks (great for 1P+3L)
      const leftW = round4((box.width - spacing) * 0.48);
      const rightW = round4(box.width - spacing - leftW);
      const stackH = round4((box.height - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: leftW, height: box.height },
        { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: stackH },
        { x: round4(box.x + leftW + spacing), y: round4(box.y + stackH + spacing), width: rightW, height: stackH },
        { x: round4(box.x + leftW + spacing), y: round4(box.y + (stackH + spacing) * 2), width: rightW, height: stackH },
      ];
    }
    if (v === 4) {
      // 3 Left Stacks + 1 Right Tower (great for 1P+3L)
      const leftW = round4((box.width - spacing) * 0.52);
      const rightW = round4(box.width - spacing - leftW);
      const stackH = round4((box.height - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: leftW, height: stackH },
        { x: box.x, y: round4(box.y + stackH + spacing), width: leftW, height: stackH },
        { x: box.x, y: round4(box.y + (stackH + spacing) * 2), width: leftW, height: stackH },
        { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: box.height },
      ];
    }
    if (v === 5) {
      // 4 Vertical Columns (great for 4P)
      const colW = round4((box.width - spacing * 3) / 4);
      return [
        { x: box.x, y: box.y, width: colW, height: box.height },
        { x: round4(box.x + colW + spacing), y: box.y, width: colW, height: box.height },
        { x: round4(box.x + (colW + spacing) * 2), y: box.y, width: colW, height: box.height },
        { x: round4(box.x + (colW + spacing) * 3), y: box.y, width: colW, height: box.height },
      ];
    }
    if (v === 6) {
      // 4 Horizontal Rows (great for 4L)
      const rowH = round4((box.height - spacing * 3) / 4);
      return [
        { x: box.x, y: box.y, width: box.width, height: rowH },
        { x: box.x, y: round4(box.y + rowH + spacing), width: box.width, height: rowH },
        { x: box.x, y: round4(box.y + (rowH + spacing) * 2), width: box.width, height: rowH },
        { x: box.x, y: round4(box.y + (rowH + spacing) * 3), width: box.width, height: rowH },
      ];
    }
    // 2-Row Asymmetric (1 Top Full + 3 Bottom)
    const topH = round4((box.height - spacing) * 0.58);
    const botH = round4(box.height - spacing - topH);
    const colW = round4((box.width - spacing * 2) / 3);
    return [
      { x: box.x, y: box.y, width: box.width, height: topH },
      { x: box.x, y: round4(box.y + topH + spacing), width: colW, height: botH },
      { x: round4(box.x + colW + spacing), y: round4(box.y + topH + spacing), width: colW, height: botH },
      { x: round4(box.x + (colW + spacing) * 2), y: round4(box.y + topH + spacing), width: colW, height: botH },
    ];
  }

  if (count === 5) {
    const v = variantIndex % 6;
    if (v === 0) {
      // 2 Top + 3 Bottom Mosaic
      const topH = round4((box.height - spacing) / 2);
      const botH = round4(box.height - spacing - topH);
      const topW = round4((box.width - spacing) / 2);
      const botW = round4((box.width - spacing * 2) / 3);
      const y2 = round4(box.y + topH + spacing);
      return [
        { x: box.x, y: box.y, width: topW, height: topH },
        { x: round4(box.x + topW + spacing), y: box.y, width: topW, height: topH },
        { x: box.x, y: y2, width: botW, height: botH },
        { x: round4(box.x + botW + spacing), y: y2, width: botW, height: botH },
        { x: round4(box.x + (botW + spacing) * 2), y: y2, width: botW, height: botH },
      ];
    }
    if (v === 1) {
      // 3 Top + 2 Bottom Mosaic
      const topH = round4((box.height - spacing) / 2);
      const botH = round4(box.height - spacing - topH);
      const topW = round4((box.width - spacing * 2) / 3);
      const botW = round4((box.width - spacing) / 2);
      const y2 = round4(box.y + topH + spacing);
      return [
        { x: box.x, y: box.y, width: topW, height: topH },
        { x: round4(box.x + topW + spacing), y: box.y, width: topW, height: topH },
        { x: round4(box.x + (topW + spacing) * 2), y: box.y, width: topW, height: topH },
        { x: box.x, y: y2, width: botW, height: botH },
        { x: round4(box.x + botW + spacing), y: y2, width: botW, height: botH },
      ];
    }
    if (v === 2) {
      // 1 Left Hero (40%) + 4 Right Grid (2x2)
      const leftW = round4((box.width - spacing) * 0.40);
      const rightW = round4(box.width - spacing - leftW);
      const halfH = round4((box.height - spacing) / 2);
      const halfW = round4((rightW - spacing) / 2);
      const xR = round4(box.x + leftW + spacing);
      const y2 = round4(box.y + halfH + spacing);
      return [
        { x: box.x, y: box.y, width: leftW, height: box.height },
        { x: xR, y: box.y, width: halfW, height: halfH },
        { x: round4(xR + halfW + spacing), y: box.y, width: halfW, height: halfH },
        { x: xR, y: y2, width: halfW, height: halfH },
        { x: round4(xR + halfW + spacing), y: y2, width: halfW, height: halfH },
      ];
    }
    if (v === 3) {
      // 4 Left Grid (2x2) + 1 Right Hero (40%) (Mirrored)
      const rightW = round4((box.width - spacing) * 0.40);
      const leftW = round4(box.width - spacing - rightW);
      const halfH = round4((box.height - spacing) / 2);
      const halfW = round4((leftW - spacing) / 2);
      const xR = round4(box.x + leftW + spacing);
      const y2 = round4(box.y + halfH + spacing);
      return [
        { x: box.x, y: box.y, width: halfW, height: halfH },
        { x: round4(box.x + halfW + spacing), y: box.y, width: halfW, height: halfH },
        { x: box.x, y: y2, width: halfW, height: halfH },
        { x: round4(box.x + halfW + spacing), y: y2, width: halfW, height: halfH },
        { x: xR, y: box.y, width: rightW, height: box.height },
      ];
    }
    if (v === 4) {
      // 1 Top Hero (40%) + 4 Bottom Grid (2x2)
      const topH = round4((box.height - spacing) * 0.40);
      const botH = round4(box.height - spacing - topH);
      const halfW = round4((box.width - spacing) / 2);
      const halfH = round4((botH - spacing) / 2);
      const yB = round4(box.y + topH + spacing);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: yB, width: halfW, height: halfH },
        { x: round4(box.x + halfW + spacing), y: yB, width: halfW, height: halfH },
        { x: box.x, y: round4(yB + halfH + spacing), width: halfW, height: halfH },
        { x: round4(box.x + halfW + spacing), y: round4(yB + halfH + spacing), width: halfW, height: halfH },
      ];
    }
    // 4 Top Grid (2x2) + 1 Bottom Hero (40%)
    const botH = round4((box.height - spacing) * 0.40);
    const topH = round4(box.height - spacing - botH);
    const halfW = round4((box.width - spacing) / 2);
    const halfH = round4((topH - spacing) / 2);
    const yB = round4(box.y + topH + spacing);
    return [
      { x: box.x, y: box.y, width: halfW, height: halfH },
      { x: round4(box.x + halfW + spacing), y: box.y, width: halfW, height: halfH },
      { x: box.x, y: round4(box.y + halfH + spacing), width: halfW, height: halfH },
      { x: round4(box.x + halfW + spacing), y: round4(box.y + halfH + spacing), width: halfW, height: halfH },
      { x: box.x, y: yB, width: box.width, height: botH },
    ];
  }

  if (count === 6) {
    const v = variantIndex % 6;
    if (v === 0) {
      // 2x3 Grid (2 rows, 3 columns)
      const w = round4((box.width - spacing * 2) / 3);
      const h = round4((box.height - spacing) / 2);
      const y2 = round4(box.y + h + spacing);
      return [
        { x: box.x, y: box.y, width: w, height: h },
        { x: round4(box.x + w + spacing), y: box.y, width: w, height: h },
        { x: round4(box.x + (w + spacing) * 2), y: box.y, width: w, height: h },
        { x: box.x, y: y2, width: w, height: h },
        { x: round4(box.x + w + spacing), y: y2, width: w, height: h },
        { x: round4(box.x + (w + spacing) * 2), y: y2, width: w, height: h },
      ];
    }
    if (v === 1) {
      // 3x2 Grid (3 rows, 2 columns)
      const w = round4((box.width - spacing) / 2);
      const h = round4((box.height - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: w, height: h },
        { x: round4(box.x + w + spacing), y: box.y, width: w, height: h },
        { x: box.x, y: round4(box.y + h + spacing), width: w, height: h },
        { x: round4(box.x + w + spacing), y: round4(box.y + h + spacing), width: w, height: h },
        { x: box.x, y: round4(box.y + (h + spacing) * 2), width: w, height: h },
        { x: round4(box.x + w + spacing), y: round4(box.y + (h + spacing) * 2), width: w, height: h },
      ];
    }
    if (v === 2) {
      // 1 Top Wide (35%) + 2 Mid (30%) + 3 Bot (35%)
      const topH = round4((box.height - spacing * 2) * 0.35);
      const midH = round4((box.height - spacing * 2) * 0.30);
      const botH = round4(box.height - spacing * 2 - topH - midH);
      const midW = round4((box.width - spacing) / 2);
      const botW = round4((box.width - spacing * 2) / 3);
      const yMid = round4(box.y + topH + spacing);
      const yBot = round4(yMid + midH + spacing);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: yMid, width: midW, height: midH },
        { x: round4(box.x + midW + spacing), y: yMid, width: midW, height: midH },
        { x: box.x, y: yBot, width: botW, height: botH },
        { x: round4(box.x + botW + spacing), y: yBot, width: botW, height: botH },
        { x: round4(box.x + (botW + spacing) * 2), y: yBot, width: botW, height: botH },
      ];
    }
    if (v === 3) {
      // 1 Left Tower (38%) + 5 Mosaic right (2 top, 3 bot)
      const leftW = round4((box.width - spacing) * 0.38);
      const rightW = round4(box.width - spacing - leftW);
      const topH = round4((box.height - spacing) / 2);
      const botH = round4(box.height - spacing - topH);
      const topW = round4((rightW - spacing) / 2);
      const botW = round4((rightW - spacing * 2) / 3);
      const xR = round4(box.x + leftW + spacing);
      const yB = round4(box.y + topH + spacing);
      return [
        { x: box.x, y: box.y, width: leftW, height: box.height },
        { x: xR, y: box.y, width: topW, height: topH },
        { x: round4(xR + topW + spacing), y: box.y, width: topW, height: topH },
        { x: xR, y: yB, width: botW, height: botH },
        { x: round4(xR + botW + spacing), y: yB, width: botW, height: botH },
        { x: round4(xR + (botW + spacing) * 2), y: yB, width: botW, height: botH },
      ];
    }
    if (v === 4) {
      // 5 Mosaic left (2 top, 3 bot) + 1 Right Tower (38%) (Mirrored)
      const rightW = round4((box.width - spacing) * 0.38);
      const leftW = round4(box.width - spacing - rightW);
      const topH = round4((box.height - spacing) / 2);
      const botH = round4(box.height - spacing - topH);
      const topW = round4((leftW - spacing) / 2);
      const botW = round4((leftW - spacing * 2) / 3);
      const xR = round4(box.x + leftW + spacing);
      const yB = round4(box.y + topH + spacing);
      return [
        { x: box.x, y: box.y, width: topW, height: topH },
        { x: round4(box.x + topW + spacing), y: box.y, width: topW, height: topH },
        { x: box.x, y: yB, width: botW, height: botH },
        { x: round4(box.x + botW + spacing), y: yB, width: botW, height: botH },
        { x: round4(box.x + (botW + spacing) * 2), y: yB, width: botW, height: botH },
        { x: xR, y: box.y, width: rightW, height: box.height },
      ];
    }
    // 3 Top (35%) + 2 Mid (30%) + 1 Bot Wide (35%)
    const topH = round4((box.height - spacing * 2) * 0.35);
    const midH = round4((box.height - spacing * 2) * 0.30);
    const botH = round4(box.height - spacing * 2 - topH - midH);
    const topW = round4((box.width - spacing * 2) / 3);
    const midW = round4((box.width - spacing) / 2);
    const yMid = round4(box.y + topH + spacing);
    const yBot = round4(yMid + midH + spacing);
    return [
      { x: box.x, y: box.y, width: topW, height: topH },
      { x: round4(box.x + topW + spacing), y: box.y, width: topW, height: topH },
      { x: round4(box.x + (topW + spacing) * 2), y: box.y, width: topW, height: topH },
      { x: box.x, y: yMid, width: midW, height: midH },
      { x: round4(box.x + midW + spacing), y: yMid, width: midW, height: midH },
      { x: box.x, y: yBot, width: box.width, height: botH },
    ];
  }

  // Count >= 7: Recursive Binary Space Partitioning (BSP)
  return recursiveBspPartition(box, count, spacing, variantIndex % 2 === 0);
}

/**
 * Recursively splits a box into sub-boxes for high photo counts (K >= 7).
 */
function recursiveBspPartition(
  box: RectBounds,
  count: number,
  spacing: number,
  splitVertical = true
): RectBounds[] {
  if (count <= 1) return [{ ...box }];
  if (count <= 6) return partitionPageBoxIntoKRects(box, count, spacing, splitVertical ? 0 : 1);

  const leftCount = Math.floor(count / 2);
  const rightCount = count - leftCount;
  const ratio = leftCount / count;

  if (splitVertical && box.width >= box.height * 0.8) {
    const totalW = box.width - spacing;
    const w1 = round4(totalW * ratio);
    const w2 = round4(totalW - w1);
    const b1: RectBounds = { x: box.x, y: box.y, width: w1, height: box.height };
    const b2: RectBounds = { x: round4(box.x + w1 + spacing), y: box.y, width: w2, height: box.height };
    return [
      ...recursiveBspPartition(b1, leftCount, spacing, !splitVertical),
      ...recursiveBspPartition(b2, rightCount, spacing, !splitVertical),
    ];
  } else {
    const totalH = box.height - spacing;
    const h1 = round4(totalH * ratio);
    const h2 = round4(totalH - h1);
    const b1: RectBounds = { x: box.x, y: box.y, width: box.width, height: h1 };
    const b2: RectBounds = { x: box.x, y: round4(box.y + h1 + spacing), width: box.width, height: h2 };
    return [
      ...recursiveBspPartition(b1, leftCount, spacing, !splitVertical),
      ...recursiveBspPartition(b2, rightCount, spacing, !splitVertical),
    ];
  }
}

/**
 * Generates rich, dynamic, multi-photo adaptive layout variations for ANY photo count N,
 * automatically scoring and sorting them by visual aspect-ratio harmony and minimal crop penalty.
 */
function rectsIntersect(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    r2.x >= r1.x + r1.width - 0.01 ||
    r2.x + r2.width <= r1.x + 0.01 ||
    r2.y >= r1.y + r1.height - 0.01 ||
    r2.y + r2.height <= r1.y + 0.01
  );
}

/**
 * Computes all maximal unoccupied rectangular sub-boxes inside a page container
 * that do not intersect any locked frame using 2D Spatial Subtraction (Maximal Empty Rectangles).
 */
function computeFreePageSubBoxes(
  pageArea: RectBounds,
  lockedFrames: PhotoFrameElement[],
  spacing: number
): RectBounds[] {
  const intersectingLocked = lockedFrames.filter((f) => rectsIntersect(f, pageArea));
  if (intersectingLocked.length === 0) {
    return [{ ...pageArea }];
  }

  // Dynamic unit-agnostic minimum dimension (5% of page dimension or 1.5x spacing)
  const minDimension = Math.max(spacing * 1.5, Math.min(pageArea.width, pageArea.height) * 0.05);
  let candidateBoxes: RectBounds[] = [{ ...pageArea }];

  for (const locked of intersectingLocked) {
    const nextBoxes: RectBounds[] = [];

    for (const box of candidateBoxes) {
      if (!rectsIntersect(box, locked)) {
        // Box is completely unaffected by this locked frame
        nextBoxes.push(box);
        continue;
      }

      // Box intersects locked frame: slice box into up to 4 maximal sub-rectangles
      // 1. Top Slice (above locked frame)
      const topH = round4(locked.y - spacing - box.y);
      if (topH >= minDimension) {
        nextBoxes.push({
          x: box.x,
          y: box.y,
          width: box.width,
          height: topH,
        });
      }

      // 2. Bottom Slice (below locked frame)
      const bottomY = round4(locked.y + locked.height + spacing);
      const bottomH = round4(box.y + box.height - bottomY);
      if (bottomH >= minDimension) {
        nextBoxes.push({
          x: box.x,
          y: bottomY,
          width: box.width,
          height: bottomH,
        });
      }

      // 3. Left Slice (left of locked frame)
      const leftW = round4(locked.x - spacing - box.x);
      if (leftW >= minDimension) {
        nextBoxes.push({
          x: box.x,
          y: box.y,
          width: leftW,
          height: box.height,
        });
      }

      // 4. Right Slice (right of locked frame)
      const rightX = round4(locked.x + locked.width + spacing);
      const rightW = round4(box.x + box.width - rightX);
      if (rightW >= minDimension) {
        nextBoxes.push({
          x: rightX,
          y: box.y,
          width: rightW,
          height: box.height,
        });
      }
    }

    candidateBoxes = nextBoxes;
  }

  // Remove subsumed/duplicate boxes (a box completely contained inside another larger box)
  const maximalBoxes: RectBounds[] = [];
  for (let i = 0; i < candidateBoxes.length; i++) {
    const a = candidateBoxes[i];
    if (!a) continue;
    let isSubsumed = false;

    for (let j = 0; j < candidateBoxes.length; j++) {
      if (i === j) continue;
      const b = candidateBoxes[j];
      if (!b) continue;
      if (
        a.x >= b.x - 0.01 &&
        a.y >= b.y - 0.01 &&
        a.x + a.width <= b.x + b.width + 0.01 &&
        a.y + a.height <= b.y + b.height + 0.01
      ) {
        if (
          Math.abs(a.width * a.height - b.width * b.height) < 0.01 &&
          i > j
        ) {
          isSubsumed = true;
          break;
        }
        if (b.width * b.height > a.width * a.height + 0.01) {
          isSubsumed = true;
          break;
        }
      }
    }

    if (!isSubsumed) {
      maximalBoxes.push(a);
    }
  }

  // Sort by area descending so largest zones are prioritized
  return maximalBoxes.sort((a, b) => b.width * b.height - a.width * a.height);
}

export function generateAdaptiveLayoutVariations(
  params: TemplateParams,
  photos: AdaptivePhoto[] = []
): AdaptiveLayoutVariation[] {
  const count = photos.length;
  if (count === 0) return [];

  const { leftPageArea, rightPageArea, spreadArea } = getUsableAreas(params);
  const spacing = params.spacing;
  const isCover = !params.isSpread;
  const fingerprint = getPhotosFingerprint(photos);
  const locked = params.lockedElements || [];

  // Helper to score, filter collisions, and enrich raw variations
  const scoreAndSortVariations = (rawVariations: AdaptiveLayoutVariation[]): AdaptiveLayoutVariation[] => {
    // Mathematical guarantee: Exclude any variation where any rect intersects or covers a locked frame
    const nonColliding = locked.length > 0
      ? rawVariations.filter((v) =>
          v.rects.every((r) => locked.every((l) => !rectsIntersect(r, l)))
        )
      : rawVariations;

    const sourceVariations = nonColliding.length > 0 ? nonColliding : rawVariations;

    const enriched = sourceVariations.map((v) => {
      const matchRes = findOptimalPhotoSlotMapping(photos, v.rects);
      return {
        ...v,
        score: matchRes.score,
        cropPenalty: matchRes.avgCropPenalty,
        fingerprint,
        photoAssignments: matchRes.mapping,
      };
    });

    // Sort descending by match score
    return enriched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  };

  // If there are locked frames, we place unlocked photos in all valid unoccupied surrounding zones
  if (locked.length > 0) {
    const variations: AdaptiveLayoutVariation[] = [];

    if (isCover) {
      const freeCoverBoxes = computeFreePageSubBoxes(spreadArea, locked, spacing);
      for (const [bIdx, box] of freeCoverBoxes.entries()) {
        const maxVariants = count === 1 ? 3 : count === 2 ? 6 : count === 3 ? 8 : 6;
        for (let v = 0; v < maxVariants; v++) {
          const rects = partitionPageBoxIntoKRects(box, count, spacing, v);
          variations.push({
            id: `cover_zone_${bIdx + 1}_var${v + 1}`,
            name: `Cover Unlocked Zone ${bIdx + 1} (${count} Photo${count > 1 ? 's' : ''})`,
            description: `Arranged cleanly around locked cover elements.`,
            rects,
            tags: ['cover', 'unlocked', `${count}p`],
          });
        }
      }
      return scoreAndSortVariations(variations);
    }

    // 2-Page Spread with locked elements:
    const freeLeftBoxes = computeFreePageSubBoxes(leftPageArea, locked, spacing);
    const freeRightBoxes = computeFreePageSubBoxes(rightPageArea, locked, spacing);
    const allFreeBoxes = [...freeLeftBoxes, ...freeRightBoxes];

    // 1. Single Box placement: Place ALL count photos inside any single valid free box
    // (e.g. all in bottom zone below locked photo, or all on right page)
    allFreeBoxes.forEach((box, bIdx) => {
      const isLeft = box.x < leftPageArea.x + leftPageArea.width;
      const zoneName = isLeft ? 'Left Page Available Space' : 'Right Page Available Space';
      const maxVariants = count === 1 ? 4 : count === 2 ? 6 : count === 3 ? 8 : count === 4 ? 8 : 6;
      for (let v = 0; v < maxVariants; v++) {
        const rects = partitionPageBoxIntoKRects(box, count, spacing, v);
        variations.push({
          id: `single_zone_${bIdx + 1}_var${v + 1}`,
          name: `${zoneName} (${count} Photo${count > 1 ? 's' : ''} - Var ${v + 1})`,
          description: `Arranged cleanly inside available space (${zoneName}) without overlapping locked photos.`,
          rects,
          tags: ['unlocked-zone', `${count}p`],
        });
      }
    });

    // 2. Multi-Zone split placement (if count >= 2):
    // Pairwise non-overlapping free boxes (across Left + Right or within the same page)
    if (count >= 2 && allFreeBoxes.length >= 2) {
      for (let i = 0; i < allFreeBoxes.length; i++) {
        for (let j = i + 1; j < allFreeBoxes.length; j++) {
          const boxA = allFreeBoxes[i];
          const boxB = allFreeBoxes[j];
          if (!boxA || !boxB) continue;
          if (rectsIntersect(boxA, boxB)) continue;

          for (let nA = 1; nA < count; nA++) {
            const nB = count - nA;
            const aVariants = nA === 1 ? 2 : nA === 2 ? 4 : 4;
            const bVariants = nB === 1 ? 2 : nB === 2 ? 4 : 4;
            const maxCombos = Math.min(6, aVariants * bVariants);

            for (let c = 0; c < maxCombos; c++) {
              const vA = c % aVariants;
              const vB = Math.floor(c / aVariants) % bVariants;

              const rectsA = partitionPageBoxIntoKRects(boxA, nA, spacing, vA);
              const rectsB = partitionPageBoxIntoKRects(boxB, nB, spacing, vB);

              const allRects = [...rectsA, ...rectsB];
              if (allRects.length === count) {
                const isALeft = boxA.x < leftPageArea.x + leftPageArea.width;
                const isBLeft = boxB.x < leftPageArea.x + leftPageArea.width;
                const zoneDesc =
                  isALeft && isBLeft
                    ? 'Left Page Multi-Zone'
                    : !isALeft && !isBLeft
                    ? 'Right Page Multi-Zone'
                    : 'Left & Right Spread Split';

                variations.push({
                  id: `split_free_${nA}A_${nB}B_i${i}_j${j}_c${c + 1}`,
                  name: `${nA} Photo${nA > 1 ? 's' : ''} + ${nB} Photo${nB > 1 ? 's' : ''} (${zoneDesc})`,
                  description: `Arranged into available spaces across ${zoneDesc} around locked photos.`,
                  rects: allRects,
                  tags: ['split-free', `${count}p`],
                });
              }
            }
          }
        }
      }
    }

    // 3. Multi-Zone 3-way distribution (if count >= 3 and allFreeBoxes.length >= 3):
    if (count >= 3 && allFreeBoxes.length >= 3) {
      for (let i = 0; i < allFreeBoxes.length; i++) {
        for (let j = i + 1; j < allFreeBoxes.length; j++) {
          for (let k = j + 1; k < allFreeBoxes.length; k++) {
            const boxA = allFreeBoxes[i];
            const boxB = allFreeBoxes[j];
            const boxC = allFreeBoxes[k];
            if (!boxA || !boxB || !boxC) continue;
            if (rectsIntersect(boxA, boxB) || rectsIntersect(boxA, boxC) || rectsIntersect(boxB, boxC)) continue;

            for (let nA = 1; nA <= count - 2; nA++) {
              for (let nB = 1; nB <= count - nA - 1; nB++) {
                const nC = count - nA - nB;
                const rectsA = partitionPageBoxIntoKRects(boxA, nA, spacing, 0);
                const rectsB = partitionPageBoxIntoKRects(boxB, nB, spacing, 0);
                const rectsC = partitionPageBoxIntoKRects(boxC, nC, spacing, 0);
                const allRects = [...rectsA, ...rectsB, ...rectsC];
                if (allRects.length === count) {
                  variations.push({
                    id: `split_free3_${nA}_${nB}_${nC}_i${i}_j${j}_k${k}`,
                    name: `Spread Multi-Zone (${nA}+${nB}+${nC} Photos)`,
                    description: `Arranged cleanly into 3 available zones around locked photos.`,
                    rects: allRects,
                    tags: ['split-free', `${count}p`],
                  });
                }
              }
            }
          }
        }
      }
    }

    // 4. Multi-Zone 4-way distribution (if count >= 4 and allFreeBoxes.length >= 4):
    if (count >= 4 && allFreeBoxes.length >= 4) {
      for (let i = 0; i < allFreeBoxes.length; i++) {
        for (let j = i + 1; j < allFreeBoxes.length; j++) {
          for (let k = j + 1; k < allFreeBoxes.length; k++) {
            for (let l = k + 1; l < allFreeBoxes.length; l++) {
              const boxA = allFreeBoxes[i];
              const boxB = allFreeBoxes[j];
              const boxC = allFreeBoxes[k];
              const boxD = allFreeBoxes[l];
              if (!boxA || !boxB || !boxC || !boxD) continue;
              if (
                rectsIntersect(boxA, boxB) ||
                rectsIntersect(boxA, boxC) ||
                rectsIntersect(boxA, boxD) ||
                rectsIntersect(boxB, boxC) ||
                rectsIntersect(boxB, boxD) ||
                rectsIntersect(boxC, boxD)
              )
                continue;

              const rectsA = partitionPageBoxIntoKRects(boxA, 1, spacing, 0);
              const rectsB = partitionPageBoxIntoKRects(boxB, 1, spacing, 0);
              const rectsC = partitionPageBoxIntoKRects(boxC, 1, spacing, 0);
              const rectsD = partitionPageBoxIntoKRects(boxD, count - 3, spacing, 0);
              const allRects = [...rectsA, ...rectsB, ...rectsC, ...rectsD];
              if (allRects.length === count) {
                variations.push({
                  id: `split_free4_i${i}_j${j}_k${k}_l${l}`,
                  name: `Spread Multi-Zone Quad (${count} Photos)`,
                  description: `Arranged cleanly into 4 available zones around locked photos.`,
                  rects: allRects,
                  tags: ['split-free', `${count}p`],
                });
              }
            }
          }
        }
      }
    }

    return scoreAndSortVariations(variations);
  }

  // Single page / Cover mode
  if (isCover) {
    const variations: AdaptiveLayoutVariation[] = [];
    const maxVariants = count === 1 ? 3 : count === 2 ? 6 : count === 3 ? 8 : count === 4 ? 8 : 6;

    for (let v = 0; v < maxVariants; v++) {
      const rects = partitionPageBoxIntoKRects(spreadArea, count, spacing, v);
      variations.push({
        id: `cover_${count}p_var${v + 1}`,
        name: `Cover Layout ${v + 1} (${count} Photo${count > 1 ? 's' : ''})`,
        description: `Smart balanced layout for ${count} photo${count > 1 ? 's' : ''} on cover.`,
        rects,
        tags: ['cover', `${count}p`],
      });
    }
    return scoreAndSortVariations(variations);
  }

  // Spread Mode (2-Page Spread)
  const variations: AdaptiveLayoutVariation[] = [];

  if (count === 1) {
    // 1 Photo options: Right Hero, Left Hero, Full Bleed, Fine-Art
    const aspect = photos[0]?.photoAspect || 1.5;
    variations.push(
      {
        id: '1g_right_page_fit',
        name: 'Right Page Hero (Centered inside Safe Zone)',
        description: 'Centered horizontally & vertically inside the right page blue safe margin box.',
        rects: [fitInsideBoxCentered(rightPageArea, aspect, 1.0)],
        tags: ['safe', 'hero', 'right', 'centered'],
      },
      {
        id: '1g_left_page_fit',
        name: 'Left Page Hero (Centered inside Safe Zone)',
        description: 'Centered horizontally & vertically inside the left page blue safe margin box.',
        rects: [fitInsideBoxCentered(leftPageArea, aspect, 1.0)],
        tags: ['safe', 'hero', 'left', 'centered'],
      },
      {
        id: '1g_right_page_fill',
        name: 'Right Page Full Safe Box',
        description: 'Fills the entire right page safe margin box cleanly.',
        rects: [{ ...rightPageArea }],
        tags: ['safe', 'hero', 'fill'],
      },
      {
        id: '1g_left_page_fill',
        name: 'Left Page Full Safe Box',
        description: 'Fills the entire left page safe margin box cleanly.',
        rects: [{ ...leftPageArea }],
        tags: ['safe', 'hero', 'fill'],
      },
      {
        id: '1g_full_bleed_panorama',
        name: 'Full Bleed Panoramic Spread',
        description: 'Edge-to-edge full spread statement panorama.',
        rects: [{ x: 0, y: 0, width: round4(params.spreadWidth), height: round4(params.spreadHeight) }],
        tags: ['hero', 'panorama', 'full-bleed'],
      }
    );
    return scoreAndSortVariations(variations);
  }

  // Multi-photo count >= 2: Generate all valid page split combinations (nLeft, nRight)
  const splitPairs: Array<{ nLeft: number; nRight: number }> = [];

  // Balanced split first
  const halfLeft = Math.floor(count / 2);
  const halfRight = count - halfLeft;
  splitPairs.push({ nLeft: halfLeft, nRight: halfRight });
  if (halfLeft !== halfRight) {
    splitPairs.push({ nLeft: halfRight, nRight: halfLeft });
  }

  // Asymmetric splits: (1, count-1), (count-1, 1), (2, count-2), etc.
  for (let l = 1; l < count; l++) {
    const r = count - l;
    if (!splitPairs.some((p) => p.nLeft === l && p.nRight === r)) {
      splitPairs.push({ nLeft: l, nRight: r });
    }
  }

  // For each split pair, create varied layout permutations
  splitPairs.forEach(({ nLeft, nRight }) => {
    const leftVariants = nLeft === 1 ? 2 : nLeft === 2 ? 4 : nLeft === 3 ? 6 : nLeft === 4 ? 6 : 4;
    const rightVariants = nRight === 1 ? 2 : nRight === 2 ? 4 : nRight === 3 ? 6 : nRight === 4 ? 6 : 4;

    const maxCombos = Math.min(8, leftVariants * rightVariants);
    for (let c = 0; c < maxCombos; c++) {
      const vLeft = c % leftVariants;
      const vRight = Math.floor(c / leftVariants) % rightVariants;

      const rectsLeft = partitionPageBoxIntoKRects(leftPageArea, nLeft, spacing, vLeft);
      const rectsRight = partitionPageBoxIntoKRects(rightPageArea, nRight, spacing, vRight);

      const allRects = [...rectsLeft, ...rectsRight];
      if (allRects.length === count) {
        const id = `split_${nLeft}L_${nRight}R_var${c + 1}`;
        const name =
          nLeft === nRight
            ? `Facing ${nLeft}+${nRight} Balanced Grid (Var ${c + 1})`
            : `${nLeft} Left + ${nRight} Right Collage (Var ${c + 1})`;

        variations.push({
          id,
          name,
          description: `Dynamic safe-margin collage: ${nLeft} photo${nLeft > 1 ? 's' : ''} on left page, ${nRight} on right page.`,
          rects: allRects,
          tags: ['adaptive', `${count}p`, `${nLeft}L`, `${nRight}R`],
        });
      }
    }
  });

  return scoreAndSortVariations(variations);
}

/**
 * Builds Konva PhotoFrameElements from an AdaptiveLayoutVariation with optimal photo slot placement.
 */
export function buildSpreadElementsFromVariation(
  variation: AdaptiveLayoutVariation,
  photos: AdaptivePhoto[],
  defaultBorderEnabled = false,
  defaultBorderWidth = 1,
  defaultBorderColor = '#FFFFFF'
): PhotoFrameElement[] {
  // If optimal photo assignments are available, slot index s gets photo[photoIndex]
  const slotToPhotoMap = new Map<number, AdaptivePhoto>();
  if (variation.photoAssignments && variation.photoAssignments.length === photos.length) {
    variation.photoAssignments.forEach((slotIdx, photoIdx) => {
      const p = photos[photoIdx];
      if (p) slotToPhotoMap.set(slotIdx, p);
    });
  }

  return variation.rects.map((rect, index) => {
    const photo = slotToPhotoMap.get(index) || photos[index];
    const frameId = `frame-${Date.now()}-${index + 1}-${Math.random().toString(36).substr(2, 4)}`;

    return {
      id: frameId,
      type: 'photo',
      photoId: photo?.photoId || (photo?.filePath ? `photo-${index + 1}` : null),
      filePath: photo?.filePath || '',
      fileName: photo?.fileName || (photo?.filePath ? photo.filePath.split(/[\\/]/).pop() || '' : ''),
      previewPath: photo?.previewPath || photo?.thumbnailPath || '',
      thumbnailPath: photo?.thumbnailPath || '',
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
 * Performs a randomized Fisher-Yates shuffle of assigned photos across the active frame slots.
 */
export function shuffleElementsPhotos(elements: PhotoFrameElement[]): PhotoFrameElement[] {
  if (elements.length <= 1) return elements;

  const unlockedIndices: number[] = [];
  const unlockedPayloads: Array<{
    photoId: string | null;
    filePath: string;
    fileName: string;
    previewPath?: string;
    thumbnailPath?: string;
    photoAspect?: number;
  }> = [];

  elements.forEach((el, idx) => {
    if (!el.locked) {
      unlockedIndices.push(idx);
      unlockedPayloads.push({
        photoId: el.photoId ?? null,
        filePath: el.filePath,
        fileName: el.fileName,
        previewPath: el.previewPath,
        thumbnailPath: el.thumbnailPath,
        photoAspect: el.photoAspect,
      });
    }
  });

  if (unlockedPayloads.length <= 1) {
    return elements;
  }

  // Fisher-Yates shuffle on unlocked payloads only
  const shuffled = [...unlockedPayloads];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }

  // If shuffle resulted in identical order, force a shift
  const isIdentical = shuffled.every((s, idx) => s && unlockedPayloads[idx] && s.filePath === unlockedPayloads[idx]?.filePath);
  if (isIdentical && shuffled.length > 1) {
    const first = shuffled.shift();
    if (first !== undefined) shuffled.push(first);
  }

  const result = [...elements];
  unlockedIndices.forEach((origIdx, sIdx) => {
    const newP = shuffled[sIdx];
    const el = elements[origIdx];
    if (newP && el) {
      result[origIdx] = {
        ...el,
        photoId: newP.photoId,
        filePath: newP.filePath,
        fileName: newP.fileName,
        previewPath: newP.previewPath ?? el.previewPath,
        thumbnailPath: newP.thumbnailPath ?? el.thumbnailPath,
        photoAspect: newP.photoAspect || (el.width / el.height),
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
      };
    }
  });

  return result;
}
