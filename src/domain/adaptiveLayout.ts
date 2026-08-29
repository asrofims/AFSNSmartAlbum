import { PhotoFrameElement } from './editor';
import { RectBounds, getUsableAreas, TemplateParams } from './templates';

export interface AdaptivePhoto {
  id?: string;
  photoId?: string | null;
  filePath: string;
  fileName: string;
  previewPath?: string;
  thumbnailPath?: string;
  photoAspect?: number; // width / height
  originalWidth?: number;
  originalHeight?: number;
}

export interface AdaptiveLayoutVariation {
  id: string;
  name: string;
  description: string;
  photoCount: number;
  rects: RectBounds[];
  tags?: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generates dynamic, orientation-aware layout variations specifically tailored
 * for the exact N photos on the canvas.
 */
export function generateAdaptiveLayoutVariations(
  params: TemplateParams,
  photos: AdaptivePhoto[]
): AdaptiveLayoutVariation[] {
  const count = photos.length;
  if (count === 0) return [];

  const { spreadArea, leftPageArea, rightPageArea } = getUsableAreas(params);
  const { spacing, isSpread, spreadWidth, spreadHeight } = params;
  const variations: AdaptiveLayoutVariation[] = [];

  // -------------------------------------------------------------
  // 1 PHOTO VARIATIONS
  // -------------------------------------------------------------
  if (count === 1) {
    if (isSpread) {
      variations.push({
        id: '1p_full_spread_bleed',
        name: 'Full Bleed Spread Hero',
        description: 'Edge-to-edge panoramic statement photograph across the entire spread.',
        photoCount: 1,
        rects: [{ x: 0, y: 0, width: round2(spreadWidth), height: round2(spreadHeight) }],
      });
      variations.push({
        id: '1p_spread_margins',
        name: 'Full Spread in Safe Margins',
        description: 'Large panorama cleanly confined within safe margins and gutter space.',
        photoCount: 1,
        rects: [{ ...spreadArea }],
      });
      variations.push({
        id: '1p_left_page_fit',
        name: 'Left Page Hero (Clean Right)',
        description: 'Framed hero on the left page with minimalist right page breathing room.',
        photoCount: 1,
        rects: [{ ...leftPageArea }],
      });
      variations.push({
        id: '1p_right_page_fit',
        name: 'Right Page Hero (Clean Left)',
        description: 'Framed hero on the right page with minimalist left page breathing room.',
        photoCount: 1,
        rects: [{ ...rightPageArea }],
      });
    }

    const fineArtW = round2(spreadArea.width * 0.7);
    const fineArtH = round2(spreadArea.height * 0.8);
    variations.push({
      id: '1p_fine_art_centered',
      name: 'Classic Fine-Art Centered',
      description: 'Generous white space with balanced centered focal presentation.',
      photoCount: 1,
      rects: [
        {
          x: round2(spreadArea.x + (spreadArea.width - fineArtW) / 2),
          y: round2(spreadArea.y + (spreadArea.height - fineArtH) / 2),
          width: fineArtW,
          height: fineArtH,
        },
      ],
    });
  }

  // -------------------------------------------------------------
  // 2 PHOTOS VARIATIONS
  // -------------------------------------------------------------
  else if (count === 2) {
    if (isSpread) {
      // Facing Diptych
      variations.push({
        id: '2p_facing_diptych',
        name: 'Facing Page Diptych (Left + Right)',
        description: 'Balanced presentation with one photo per facing page honoring margins.',
        photoCount: 2,
        rects: [{ ...leftPageArea }, { ...rightPageArea }],
      });

      // Left Hero + Right Inset
      const rightW = round2(rightPageArea.width * 0.82);
      const rightH = round2(rightPageArea.height * 0.85);
      variations.push({
        id: '2p_left_hero_right_inset',
        name: 'Left Hero + Right Fine-Art',
        description: 'Prominent left page lead with an elegant centered right page portrait.',
        photoCount: 2,
        rects: [
          { ...leftPageArea },
          {
            x: round2(rightPageArea.x + (rightPageArea.width - rightW) / 2),
            y: round2(rightPageArea.y + (rightPageArea.height - rightH) / 2),
            width: rightW,
            height: rightH,
          },
        ],
      });

      // Right Hero + Left Inset
      const leftW = round2(leftPageArea.width * 0.82);
      const leftH = round2(leftPageArea.height * 0.85);
      variations.push({
        id: '2p_right_hero_left_inset',
        name: 'Left Fine-Art + Right Hero',
        description: 'Centered left portrait leading into a full-height right page hero.',
        photoCount: 2,
        rects: [
          {
            x: round2(leftPageArea.x + (leftPageArea.width - leftW) / 2),
            y: round2(leftPageArea.y + (leftPageArea.height - leftH) / 2),
            width: leftW,
            height: leftH,
          },
          { ...rightPageArea },
        ],
      });

      // 2 Stacked on Right Page
      const rStackH = round2((rightPageArea.height - spacing) / 2);
      variations.push({
        id: '2p_right_page_stack',
        name: 'Stacked Dual Photos (Right Page)',
        description: 'Two horizontal photos stacked vertically on right page.',
        photoCount: 2,
        rects: [
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rStackH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rStackH + spacing), width: rightPageArea.width, height: rStackH },
        ],
      });
    }

    // Horizontal Split across usable spread
    const hSplit = round2((spreadArea.height - spacing) / 2);
    variations.push({
      id: '2p_horizontal_stack',
      name: 'Horizontal Dual Stack',
      description: 'Two panoramic landscape photos stacked vertically with exact gap.',
      photoCount: 2,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: hSplit },
        { x: spreadArea.x, y: round2(spreadArea.y + hSplit + spacing), width: spreadArea.width, height: hSplit },
      ],
    });

    // Vertical Split (Side by Side in spreadArea)
    const vSplit = round2((spreadArea.width - spacing) / 2);
    variations.push({
      id: '2p_vertical_columns',
      name: 'Dual Vertical Columns',
      description: 'Two tall portrait photos side-by-side with exact physical gap.',
      photoCount: 2,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: vSplit, height: spreadArea.height },
        { x: round2(spreadArea.x + vSplit + spacing), y: spreadArea.y, width: vSplit, height: spreadArea.height },
      ],
    });
  }

  // -------------------------------------------------------------
  // 3 PHOTOS VARIATIONS
  // -------------------------------------------------------------
  else if (count === 3) {
    if (isSpread) {
      // 1 Left Hero + 2 Right Stack
      const rStackH = round2((rightPageArea.height - spacing) / 2);
      variations.push({
        id: '3p_left_hero_right_stack',
        name: '1 Left Hero + 2 Right Stacked',
        description: 'Full-height story leader on left page with 2 stacked detail photos on right page.',
        photoCount: 3,
        rects: [
          { ...leftPageArea },
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rStackH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rStackH + spacing), width: rightPageArea.width, height: rStackH },
        ],
      });

      // 2 Left Stack + 1 Right Hero
      const lStackH = round2((leftPageArea.height - spacing) / 2);
      variations.push({
        id: '3p_2left_stack_1right_hero',
        name: '2 Left Stacked + 1 Right Hero',
        description: 'Two detail shots on the left page leading into a major right page hero.',
        photoCount: 3,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lStackH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lStackH + spacing), width: leftPageArea.width, height: lStackH },
          { ...rightPageArea },
        ],
      });
    }

    // 3 Equal Columns (Triptych)
    const tripW = round2((spreadArea.width - spacing * 2) / 3);
    variations.push({
      id: '3p_symmetrical_triptych',
      name: 'Symmetrical 3-Column Triptych',
      description: 'Three equal portrait columns spanning the layout with consistent gaps.',
      photoCount: 3,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: tripW, height: spreadArea.height },
        { x: round2(spreadArea.x + tripW + spacing), y: spreadArea.y, width: tripW, height: spreadArea.height },
        { x: round2(spreadArea.x + (tripW + spacing) * 2), y: spreadArea.y, width: tripW, height: spreadArea.height },
      ],
    });

    // 1 Top Wide + 2 Bottom Columns
    const topH = round2((spreadArea.height - spacing) * 0.55);
    const botH = round2(spreadArea.height - spacing - topH);
    const botW = round2((spreadArea.width - spacing) / 2);
    variations.push({
      id: '3p_1top_2bot',
      name: '1 Top Panorama + 2 Bottom Grid',
      description: 'Wide cinematic photo on top with two balanced supporting photos below.',
      photoCount: 3,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: topH },
        { x: spreadArea.x, y: round2(spreadArea.y + topH + spacing), width: botW, height: botH },
        { x: round2(spreadArea.x + botW + spacing), y: round2(spreadArea.y + topH + spacing), width: botW, height: botH },
      ],
    });

    // 3 Horizontal Panoramic Rows
    const rowH = round2((spreadArea.height - spacing * 2) / 3);
    variations.push({
      id: '3p_3_horizontal_rows',
      name: '3-Row Cinematic Panoramas',
      description: 'Three horizontal cinema stripes stacked vertically.',
      photoCount: 3,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: rowH },
        { x: spreadArea.x, y: round2(spreadArea.y + rowH + spacing), width: spreadArea.width, height: rowH },
        { x: spreadArea.x, y: round2(spreadArea.y + (rowH + spacing) * 2), width: spreadArea.width, height: rowH },
      ],
    });
  }

  // -------------------------------------------------------------
  // 4 PHOTOS VARIATIONS
  // -------------------------------------------------------------
  else if (count === 4) {
    // 2x2 Balanced Grid
    const gridW = round2((spreadArea.width - spacing) / 2);
    const gridH = round2((spreadArea.height - spacing) / 2);
    variations.push({
      id: '4p_balanced_2x2',
      name: 'Balanced 2x2 Grid',
      description: 'Four equal quadrant frames with exact horizontal and vertical gaps.',
      photoCount: 4,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: gridW, height: gridH },
        { x: round2(spreadArea.x + gridW + spacing), y: spreadArea.y, width: gridW, height: gridH },
        { x: spreadArea.x, y: round2(spreadArea.y + gridH + spacing), width: gridW, height: gridH },
        { x: round2(spreadArea.x + gridW + spacing), y: round2(spreadArea.y + gridH + spacing), width: gridW, height: gridH },
      ],
    });

    if (isSpread) {
      // Facing 2+2 Stacks (Both Pages)
      const lH = round2((leftPageArea.height - spacing) / 2);
      const rH = round2((rightPageArea.height - spacing) / 2);
      variations.push({
        id: '4p_facing_2plus2',
        name: 'Facing 2+2 Stacks (Both Pages)',
        description: 'Two stacked landscape photos per page, respecting the center spine crease.',
        photoCount: 4,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lH + spacing), width: leftPageArea.width, height: lH },
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rH + spacing), width: rightPageArea.width, height: rH },
        ],
      });

      // 1 Left Lead Hero + 3 Right Strip
      const stripW = round2((rightPageArea.width - spacing * 2) / 3);
      variations.push({
        id: '4p_1lead_3strip',
        name: '1 Left Hero + 3 Right Triptych Strip',
        description: 'Large showcase photo on left page with 3 vertical strip detail photos on right page.',
        photoCount: 4,
        rects: [
          { ...leftPageArea },
          { x: rightPageArea.x, y: rightPageArea.y, width: stripW, height: rightPageArea.height },
          { x: round2(rightPageArea.x + stripW + spacing), y: rightPageArea.y, width: stripW, height: rightPageArea.height },
          { x: round2(rightPageArea.x + (stripW + spacing) * 2), y: rightPageArea.y, width: stripW, height: rightPageArea.height },
        ],
      });
    }

    // 4 Vertical Columns
    const col4W = round2((spreadArea.width - spacing * 3) / 4);
    variations.push({
      id: '4p_4_columns',
      name: '4-Column Modern Sequence',
      description: 'Four slender vertical portrait columns aligned with equal gaps.',
      photoCount: 4,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: col4W, height: spreadArea.height },
        { x: round2(spreadArea.x + col4W + spacing), y: spreadArea.y, width: col4W, height: spreadArea.height },
        { x: round2(spreadArea.x + (col4W + spacing) * 2), y: spreadArea.y, width: col4W, height: spreadArea.height },
        { x: round2(spreadArea.x + (col4W + spacing) * 3), y: spreadArea.y, width: col4W, height: spreadArea.height },
      ],
    });
  }

  // -------------------------------------------------------------
  // 5 PHOTOS VARIATIONS
  // -------------------------------------------------------------
  else if (count === 5) {
    if (isSpread) {
      // 1 Right Hero + 4 Left 2x2 Grid
      const gridW = round2((leftPageArea.width - spacing) / 2);
      const gridH = round2((leftPageArea.height - spacing) / 2);
      variations.push({
        id: '5p_1right_hero_4left_grid',
        name: '4 Left Grid + 1 Right Hero',
        description: 'Four detail corner photos on left page paired with 1 major portrait hero on right page.',
        photoCount: 5,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: gridW, height: gridH },
          { x: round2(leftPageArea.x + gridW + spacing), y: leftPageArea.y, width: gridW, height: gridH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + gridH + spacing), width: gridW, height: gridH },
          { x: round2(leftPageArea.x + gridW + spacing), y: round2(leftPageArea.y + gridH + spacing), width: gridW, height: gridH },
          { ...rightPageArea },
        ],
      });

      // 2 Left Stack + 3 Right Triptych
      const lH = round2((leftPageArea.height - spacing) / 2);
      const rW = round2((rightPageArea.width - spacing * 2) / 3);
      variations.push({
        id: '5p_2left_3right',
        name: '2 Left Stacks + 3 Right Columns',
        description: 'Two landscapes on left page accompanied by three portrait columns on right page.',
        photoCount: 5,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lH + spacing), width: leftPageArea.width, height: lH },
          { x: rightPageArea.x, y: rightPageArea.y, width: rW, height: rightPageArea.height },
          { x: round2(rightPageArea.x + rW + spacing), y: rightPageArea.y, width: rW, height: rightPageArea.height },
          { x: round2(rightPageArea.x + (rW + spacing) * 2), y: rightPageArea.y, width: rW, height: rightPageArea.height },
        ],
      });
    }

    // 1 Top Wide + 4 Bottom Grid across spread
    const top5H = round2((spreadArea.height - spacing) * 0.52);
    const bot5H = round2(spreadArea.height - spacing - top5H);
    const bot5W = round2((spreadArea.width - spacing * 3) / 4);
    variations.push({
      id: '5p_1top_4bot',
      name: '1 Master Top Banner + 4 Bottom Grid',
      description: 'One wide banner hero above 4 equal thumbnail detail boxes.',
      photoCount: 5,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: top5H },
        { x: spreadArea.x, y: round2(spreadArea.y + top5H + spacing), width: bot5W, height: bot5H },
        { x: round2(spreadArea.x + bot5W + spacing), y: round2(spreadArea.y + top5H + spacing), width: bot5W, height: bot5H },
        { x: round2(spreadArea.x + (bot5W + spacing) * 2), y: round2(spreadArea.y + top5H + spacing), width: bot5W, height: bot5H },
        { x: round2(spreadArea.x + (bot5W + spacing) * 3), y: round2(spreadArea.y + top5H + spacing), width: bot5W, height: bot5H },
      ],
    });
  }

  // -------------------------------------------------------------
  // 6 PHOTOS VARIATIONS
  // -------------------------------------------------------------
  else if (count === 6) {
    // 2x3 Classic Grid (6 Equal)
    const col3W = round2((spreadArea.width - spacing * 2) / 3);
    const row2H = round2((spreadArea.height - spacing) / 2);
    const rects2x3: RectBounds[] = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        rects2x3.push({
          x: round2(spreadArea.x + c * (col3W + spacing)),
          y: round2(spreadArea.y + r * (row2H + spacing)),
          width: col3W,
          height: row2H,
        });
      }
    }
    variations.push({
      id: '6p_2x3_grid',
      name: '2x3 Storyboard Grid (6 Equal)',
      description: 'Six equal photographs in a balanced 2-row by 3-column configuration.',
      photoCount: 6,
      rects: rects2x3,
    });

    if (isSpread) {
      // Facing 3+3 Storyboard (1 Top Wide + 2 Bot on each page)
      const lTopH = round2((leftPageArea.height - spacing) * 0.55);
      const lBotH = round2(leftPageArea.height - spacing - lTopH);
      const lBotW = round2((leftPageArea.width - spacing) / 2);

      const rTopH = round2((rightPageArea.height - spacing) * 0.55);
      const rBotH = round2(rightPageArea.height - spacing - rTopH);
      const rBotW = round2((rightPageArea.width - spacing) / 2);

      variations.push({
        id: '6p_facing_3plus3',
        name: 'Facing 3+3 Narrative Storyboard',
        description: 'Balanced sequence of 3 photos on left page and 3 photos on right page.',
        photoCount: 6,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lTopH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lTopH + spacing), width: lBotW, height: lBotH },
          { x: round2(leftPageArea.x + lBotW + spacing), y: round2(leftPageArea.y + lTopH + spacing), width: lBotW, height: lBotH },
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rTopH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rTopH + spacing), width: rBotW, height: rBotH },
          { x: round2(rightPageArea.x + rBotW + spacing), y: round2(rightPageArea.y + rTopH + spacing), width: rBotW, height: rBotH },
        ],
      });

      // 1 Left Hero + 5 Right Gallery Strip
      const r5TopH = round2((rightPageArea.height - spacing) * 0.5);
      const r5BotH = round2(rightPageArea.height - spacing - r5TopH);
      const r5TopW = round2((rightPageArea.width - spacing) / 2);
      const r5BotW = round2((rightPageArea.width - spacing * 2) / 3);
      variations.push({
        id: '6p_1hero_5gallery',
        name: '1 Left Hero + 5 Right Gallery Grid',
        description: 'Prominent lead portrait on left page with 5 supporting gallery tiles on right page.',
        photoCount: 6,
        rects: [
          { ...leftPageArea },
          { x: rightPageArea.x, y: rightPageArea.y, width: r5TopW, height: r5TopH },
          { x: round2(rightPageArea.x + r5TopW + spacing), y: rightPageArea.y, width: r5TopW, height: r5TopH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + r5TopH + spacing), width: r5BotW, height: r5BotH },
          { x: round2(rightPageArea.x + r5BotW + spacing), y: round2(rightPageArea.y + r5TopH + spacing), width: r5BotW, height: r5BotH },
          { x: round2(rightPageArea.x + (r5BotW + spacing) * 2), y: round2(rightPageArea.y + r5TopH + spacing), width: r5BotW, height: r5BotH },
        ],
      });
    }
  }

  // -------------------------------------------------------------
  // 7+ PHOTOS VARIATIONS (N >= 7)
  // -------------------------------------------------------------
  else {
    // Determine columns & rows dynamically
    const cols = count <= 8 ? 4 : count <= 10 ? 5 : 6;
    const rows = Math.ceil(count / cols);
    const colW = round2((spreadArea.width - spacing * (cols - 1)) / cols);
    const rowH = round2((spreadArea.height - spacing * (rows - 1)) / rows);

    const genericGridRects: RectBounds[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      genericGridRects.push({
        x: round2(spreadArea.x + c * (colW + spacing)),
        y: round2(spreadArea.y + r * (rowH + spacing)),
        width: colW,
        height: rowH,
      });
    }

    variations.push({
      id: `${count}p_balanced_grid`,
      name: `${count}-Photo Balanced Grid (${cols}x${rows})`,
      description: `Harmonious ${cols}-column grid fitting all ${count} photos within safe margins.`,
      photoCount: count,
      rects: genericGridRects,
    });

    if (isSpread && count >= 7 && count <= 8) {
      // 1 Left Lead Hero + Remaining Right Grid
      const remaining = count - 1;
      const rCols = remaining === 6 ? 3 : 2;
      const rRows = Math.ceil(remaining / rCols);
      const rGridW = round2((rightPageArea.width - spacing * (rCols - 1)) / rCols);
      const rGridH = round2((rightPageArea.height - spacing * (rRows - 1)) / rRows);

      const heroAndGridRects: RectBounds[] = [{ ...leftPageArea }];
      for (let i = 0; i < remaining; i++) {
        const r = Math.floor(i / rCols);
        const c = i % rCols;
        heroAndGridRects.push({
          x: round2(rightPageArea.x + c * (rGridW + spacing)),
          y: round2(rightPageArea.y + r * (rGridH + spacing)),
          width: rGridW,
          height: rGridH,
        });
      }

      variations.push({
        id: `${count}p_1hero_grid`,
        name: `1 Left Hero + ${remaining} Right Gallery`,
        description: `Full-height hero on left page with ${remaining} photos in balanced grid on right page.`,
        photoCount: count,
        rects: heroAndGridRects,
      });
    }
  }

  return variations;
}

/**
 * Smart Orientation Assignment Algorithm:
 * Pairs each photo with the best matching frame rectangle (minimizing aspect ratio distortion).
 */
export function matchPhotosToRects(
  photos: AdaptivePhoto[],
  rects: RectBounds[]
): Array<{ photo: AdaptivePhoto; rect: RectBounds }> {
  if (photos.length !== rects.length) {
    return rects.map((rect, i) => ({
      photo: photos[i] || { filePath: '', fileName: '' },
      rect,
    }));
  }

  // Calculate aspect ratios
  const photoAspects = photos.map((p) => p.photoAspect ?? (p.originalWidth && p.originalHeight ? p.originalWidth / p.originalHeight : 1.5));
  const rectAspects = rects.map((r) => r.width / r.height);

  // Greedy orientation matching: Sort both by aspect ratio to pair landscape with wide, portrait with tall
  const indexedPhotos = photos.map((p, idx) => ({ photo: p, aspect: photoAspects[idx] ?? 1.5, originalIdx: idx }));
  const indexedRects = rects.map((r, idx) => ({ rect: r, aspect: rectAspects[idx] ?? 1.5, rectIdx: idx }));

  // Sort photos from most portrait (smallest aspect) to most landscape (largest aspect)
  const sortedPhotos = [...indexedPhotos].sort((a, b) => a.aspect - b.aspect);
  // Sort rects from most portrait to most landscape
  const sortedRects = [...indexedRects].sort((a, b) => a.aspect - b.aspect);

  // Assign pairings
  const result: Array<{ photo: AdaptivePhoto; rect: RectBounds }> = [];

  for (let i = 0; i < sortedPhotos.length; i++) {
    const pItem = sortedPhotos[i];
    const rItem = sortedRects[i];
    if (pItem && rItem) {
      result[rItem.rectIdx] = {
        photo: pItem.photo,
        rect: rItem.rect,
      };
    }
  }

  // Ensure all slots filled
  for (let i = 0; i < rects.length; i++) {
    if (!result[i]) {
      result[i] = {
        photo: photos[i] || { filePath: '', fileName: '' },
        rect: rects[i]!,
      };
    }
  }

  return result;
}

/**
 * Converts an Adaptive Layout Variation + Photos into full PhotoFrameElements for a spread.
 */
export function buildSpreadElementsFromVariation(
  variation: AdaptiveLayoutVariation,
  photos: AdaptivePhoto[],
  defaultBorderEnabled = false,
  defaultBorderWidth = 1,
  defaultBorderColor = '#FFFFFF'
): PhotoFrameElement[] {
  const pairings = matchPhotosToRects(photos, variation.rects);

  return pairings.map((pair, index) => {
    const { photo, rect } = pair;
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
 * Shuffles photo assignments among existing frame geometries.
 */
export function shuffleElementsPhotos(elements: PhotoFrameElement[]): PhotoFrameElement[] {
  if (elements.length <= 1) return elements;

  // Extract photo payloads
  const photos = elements.map((el) => ({
    photoId: el.photoId,
    filePath: el.filePath,
    fileName: el.fileName,
    previewPath: el.previewPath,
    thumbnailPath: el.thumbnailPath,
    photoAspect: el.photoAspect,
  }));

  // Rotate / Fisher-Yates shuffle photos
  const shuffled = [...photos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }

  // If shuffle resulted in identical order, simply rotate by 1
  if (shuffled.every((p, idx) => p.filePath === (photos[idx]?.filePath ?? ''))) {
    const first = shuffled.shift();
    if (first) shuffled.push(first);
  }

  return elements.map((el, index) => {
    const p = shuffled[index] || photos[index]!;
    return {
      ...el,
      photoId: p.photoId,
      filePath: p.filePath,
      fileName: p.fileName,
      previewPath: p.previewPath,
      thumbnailPath: p.thumbnailPath,
      photoAspect: p.photoAspect || el.photoAspect,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
    };
  });
}
