import { RectBounds, TemplateParams, getUsableAreas, fitInsideBoxCentered, round4 } from './templates';
import { PhotoFrameElement } from './editor';

export interface AdaptivePhoto {
  id?: string;
  photoId?: string | null;
  filePath?: string;
  fileName?: string;
  previewPath?: string;
  thumbnailPath?: string;
  photoAspect?: number;
}

export interface AdaptiveLayoutVariation {
  id: string;
  name: string;
  description: string;
  rects: RectBounds[];
  tags: string[];
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
    const v = variantIndex % 4;
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
      // Asymmetric: Top Hero (60%) + Bottom companion
      const topH = round4((box.height - spacing) * 0.62);
      const botH = round4(box.height - spacing - topH);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: round4(box.y + topH + spacing), width: box.width, height: botH },
      ];
    }
    // Asymmetric: Left Hero (60%) + Right companion
    const leftW = round4((box.width - spacing) * 0.62);
    const rightW = round4(box.width - spacing - leftW);
    return [
      { x: box.x, y: box.y, width: leftW, height: box.height },
      { x: round4(box.x + leftW + spacing), y: box.y, width: rightW, height: box.height },
    ];
  }

  if (count === 3) {
    const v = variantIndex % 6;
    if (v === 0) {
      // 1 Top Wide + 2 Bottom Columns
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
      // 2 Top Columns + 1 Bottom Wide
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
      // 1 Left Tall + 2 Right Stacks
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
      // 2 Left Stacks + 1 Right Tall
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
      // 3 Vertical Columns (Triptych)
      const colW = round4((box.width - spacing * 2) / 3);
      return [
        { x: box.x, y: box.y, width: colW, height: box.height },
        { x: round4(box.x + colW + spacing), y: box.y, width: colW, height: box.height },
        { x: round4(box.x + (colW + spacing) * 2), y: box.y, width: colW, height: box.height },
      ];
    }
    // 3 Horizontal Rows
    const rowH = round4((box.height - spacing * 2) / 3);
    return [
      { x: box.x, y: box.y, width: box.width, height: rowH },
      { x: box.x, y: round4(box.y + rowH + spacing), width: box.width, height: rowH },
      { x: box.x, y: round4(box.y + (rowH + spacing) * 2), width: box.width, height: rowH },
    ];
  }

  if (count === 4) {
    const v = variantIndex % 6;
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
      // 1 Top Banner + 3 Bottom Columns
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
      // 3 Top Columns + 1 Bottom Banner
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
      // 1 Left Tower + 3 Right Stacks
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
      // 3 Left Stacks + 1 Right Tower
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
    // 4 Vertical Columns
    const colW = round4((box.width - spacing * 3) / 4);
    return [
      { x: box.x, y: box.y, width: colW, height: box.height },
      { x: round4(box.x + colW + spacing), y: box.y, width: colW, height: box.height },
      { x: round4(box.x + (colW + spacing) * 2), y: box.y, width: colW, height: box.height },
      { x: round4(box.x + (colW + spacing) * 3), y: box.y, width: colW, height: box.height },
    ];
  }

  if (count === 5) {
    const v = variantIndex % 5;
    if (v === 0) {
      // 1 Top Hero (48%) + 4-Grid (2x2 bottom)
      const topH = round4((box.height - spacing) * 0.48);
      const botH = round4(box.height - spacing - topH);
      const gridW = round4((box.width - spacing) / 2);
      const gridH = round4((botH - spacing) / 2);
      const y2 = round4(box.y + topH + spacing);
      return [
        { x: box.x, y: box.y, width: box.width, height: topH },
        { x: box.x, y: y2, width: gridW, height: gridH },
        { x: round4(box.x + gridW + spacing), y: y2, width: gridW, height: gridH },
        { x: box.x, y: round4(y2 + gridH + spacing), width: gridW, height: gridH },
        { x: round4(box.x + gridW + spacing), y: round4(y2 + gridH + spacing), width: gridW, height: gridH },
      ];
    }
    if (v === 1) {
      // 1 Left Tower (48%) + 4-Grid (2x2 right)
      const leftW = round4((box.width - spacing) * 0.48);
      const rightW = round4(box.width - spacing - leftW);
      const gridW = round4((rightW - spacing) / 2);
      const gridH = round4((box.height - spacing) / 2);
      const x2 = round4(box.x + leftW + spacing);
      return [
        { x: box.x, y: box.y, width: leftW, height: box.height },
        { x: x2, y: box.y, width: gridW, height: gridH },
        { x: round4(x2 + gridW + spacing), y: box.y, width: gridW, height: gridH },
        { x: x2, y: round4(box.y + gridH + spacing), width: gridW, height: gridH },
        { x: round4(x2 + gridW + spacing), y: round4(box.y + gridH + spacing), width: gridW, height: gridH },
      ];
    }
    if (v === 2) {
      // 2 Top Columns + 3 Bottom Columns
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
    if (v === 3) {
      // 3 Top Columns + 2 Bottom Columns
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
    // 4-Grid (2x2 top) + 1 Bottom Hero
    const topH = round4((box.height - spacing) * 0.52);
    const botH = round4(box.height - spacing - topH);
    const gridW = round4((box.width - spacing) / 2);
    const gridH = round4((topH - spacing) / 2);
    return [
      { x: box.x, y: box.y, width: gridW, height: gridH },
      { x: round4(box.x + gridW + spacing), y: box.y, width: gridW, height: gridH },
      { x: box.x, y: round4(box.y + gridH + spacing), width: gridW, height: gridH },
      { x: round4(box.x + gridW + spacing), y: round4(box.y + gridH + spacing), width: gridW, height: gridH },
      { x: box.x, y: round4(box.y + topH + spacing), width: box.width, height: botH },
    ];
  }

  if (count === 6) {
    const v = variantIndex % 4;
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
 * Generates rich, dynamic, multi-photo adaptive layout variations for ANY photo count N.
 */
export function generateAdaptiveLayoutVariations(
  params: TemplateParams,
  photos: AdaptivePhoto[] = []
): AdaptiveLayoutVariation[] {
  const count = photos.length;
  if (count === 0) return [];

  const { leftPageArea, rightPageArea, spreadArea } = getUsableAreas(params);
  const spacing = params.spacing;
  const isCover = !params.isSpread;

  // Single page / Cover mode
  if (isCover) {
    const variations: AdaptiveLayoutVariation[] = [];
    const maxVariants = count === 1 ? 3 : count === 2 ? 4 : count === 3 ? 6 : count === 4 ? 6 : 4;

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
    return variations;
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
    return variations;
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
    const leftVariants = nLeft === 1 ? 2 : nLeft === 2 ? 3 : nLeft === 3 ? 4 : nLeft === 4 ? 4 : 2;
    const rightVariants = nRight === 1 ? 2 : nRight === 2 ? 3 : nRight === 3 ? 4 : nRight === 4 ? 4 : 2;

    const maxCombos = Math.min(6, leftVariants * rightVariants);
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

  return variations;
}

/**
 * Builds Konva PhotoFrameElements from an AdaptiveLayoutVariation.
 */
export function buildSpreadElementsFromVariation(
  variation: AdaptiveLayoutVariation,
  photos: AdaptivePhoto[],
  defaultBorderEnabled = false,
  defaultBorderWidth = 1,
  defaultBorderColor = '#FFFFFF'
): PhotoFrameElement[] {
  return variation.rects.map((rect, index) => {
    const photo = photos[index];
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
 * Performs a randomized Fisher-Yates shuffle of assigned photos across the active frame slots.
 */
export function shuffleElementsPhotos(elements: PhotoFrameElement[]): PhotoFrameElement[] {
  if (elements.length <= 1) return elements;

  const photoPayloads = elements.map((el) => ({
    photoId: el.photoId,
    filePath: el.filePath,
    fileName: el.fileName,
    previewPath: el.previewPath,
    thumbnailPath: el.thumbnailPath,
    photoAspect: el.photoAspect,
  }));

  // Fisher-Yates shuffle
  const shuffled = [...photoPayloads];
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
  const isIdentical = shuffled.every((s, idx) => s && photoPayloads[idx] && s.filePath === photoPayloads[idx]?.filePath);
  if (isIdentical && shuffled.length > 1) {
    const first = shuffled.shift();
    if (first !== undefined) shuffled.push(first);
  }

  return elements.map((el, idx) => {
    const newP = shuffled[idx];
    if (!newP) return el;
    return {
      ...el,
      photoId: newP.photoId,
      filePath: newP.filePath,
      fileName: newP.fileName,
      previewPath: newP.previewPath,
      thumbnailPath: newP.thumbnailPath,
      photoAspect: newP.photoAspect || (el.width / el.height),
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
    };
  });
}
