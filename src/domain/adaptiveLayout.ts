import { PhotoFrameElement } from './editor';
import { RectBounds, getUsableAreas, TemplateParams, fitInsideBoxCentered, round2 } from './templates';

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

/**
 * Generates dynamic, orientation-aware Visual Grid Blueprint variations strictly confined
 * within the Left and Right Page Safe Margin Boxes, centered horizontally and vertically.
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
  // 1 PHOTO VARIATIONS (Centered & Middled on Page / Safe Box)
  // -------------------------------------------------------------
  if (count === 1) {
    const aspect0 = photos[0]?.photoAspect || 1.5;

    if (isSpread) {
      // 1. Right Page Safe Hero (Fit - Centered & Middled inside Right Safe Box)
      variations.push({
        id: '1g_right_page_hero_fit',
        name: 'Right Page Hero (Centered in Safe Box)',
        description: 'Single focal photograph centered in middle of right page inside blue safe lines.',
        photoCount: 1,
        rects: [fitInsideBoxCentered(rightPageArea, aspect0, 1.0)],
      });

      // 2. Left Page Safe Hero (Fit - Centered & Middled inside Left Safe Box)
      variations.push({
        id: '1g_left_page_hero_fit',
        name: 'Left Page Hero (Centered in Safe Box)',
        description: 'Single focal photograph centered in middle of left page inside blue safe lines.',
        photoCount: 1,
        rects: [fitInsideBoxCentered(leftPageArea, aspect0, 1.0)],
      });

      // 3. Right Page Full Safe Box (Fill)
      variations.push({
        id: '1g_right_page_safe_fill',
        name: 'Right Page Full Safe Box',
        description: 'Fills the entire right page safe margin box cleanly.',
        photoCount: 1,
        rects: [{ ...rightPageArea }],
      });

      // 4. Left Page Full Safe Box (Fill)
      variations.push({
        id: '1g_left_page_safe_fill',
        name: 'Left Page Full Safe Box',
        description: 'Fills the entire left page safe margin box cleanly.',
        photoCount: 1,
        rects: [{ ...leftPageArea }],
      });

      // 5. Centered in Spread Safe Area
      variations.push({
        id: '1g_spread_safe_centered',
        name: 'Full Spread Safe Centered',
        description: 'Panoramic statement photograph centered within the spread safe area.',
        photoCount: 1,
        rects: [fitInsideBoxCentered(spreadArea, aspect0, 1.0)],
      });

      // 6. Full Bleed Panoramic (Edge-to-Edge)
      variations.push({
        id: '1g_full_bleed',
        name: 'Full Bleed Panoramic (Edge to Edge)',
        description: 'Edge-to-edge full bleed photograph spanning the entire spread canvas.',
        photoCount: 1,
        rects: [{ x: 0, y: 0, width: round2(spreadWidth), height: round2(spreadHeight) }],
      });
    } else {
      variations.push({
        id: '1g_single_page_hero_fit',
        name: 'Page Hero (Centered in Safe Box)',
        description: 'Centered focal photograph strictly inside safe margin box.',
        photoCount: 1,
        rects: [fitInsideBoxCentered(spreadArea, aspect0, 1.0)],
      });
      variations.push({
        id: '1g_single_page_safe_fill',
        name: 'Full Page Safe Box',
        description: 'Fills the entire safe margin box.',
        photoCount: 1,
        rects: [{ ...spreadArea }],
      });
    }
  }

  // -------------------------------------------------------------
  // 2 PHOTOS VARIATIONS (Facing Diptych / Stacks)
  // -------------------------------------------------------------
  else if (count === 2) {
    const aspect0 = photos[0]?.photoAspect || 1.5;
    const aspect1 = photos[1]?.photoAspect || 1.5;

    if (isSpread) {
      // 1. Facing Diptych (Fit & Centered on each page)
      variations.push({
        id: '2g_facing_diptych_fit',
        name: 'Facing Diptych (Centered in Safe Boxes)',
        description: 'Two photographs centered in the middle of left & right safe margin boxes.',
        photoCount: 2,
        rects: [
          fitInsideBoxCentered(leftPageArea, aspect0, 1.0),
          fitInsideBoxCentered(rightPageArea, aspect1, 1.0),
        ],
      });

      // 2. Facing Diptych (Fill Full Safe Boxes)
      variations.push({
        id: '2g_facing_diptych_fill',
        name: 'Facing Diptych (Full Safe Boxes)',
        description: 'Two full-bleed-to-margin photographs filling left and right safe boxes.',
        photoCount: 2,
        rects: [{ ...leftPageArea }, { ...rightPageArea }],
      });

      // 3. Right Page 2 Stacks
      const rStackH = round2((rightPageArea.height - spacing) / 2);
      variations.push({
        id: '2g_right_page_stack',
        name: 'Right Page 2-Photo Stack',
        description: 'Two horizontal photos stacked vertically inside the right page safe box.',
        photoCount: 2,
        rects: [
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rStackH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rStackH + spacing), width: rightPageArea.width, height: rStackH },
        ],
      });

      // 4. Left Page 2 Stacks
      const lStackH = round2((leftPageArea.height - spacing) / 2);
      variations.push({
        id: '2g_left_page_stack',
        name: 'Left Page 2-Photo Stack',
        description: 'Two photos stacked vertically inside the left page safe box.',
        photoCount: 2,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lStackH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lStackH + spacing), width: leftPageArea.width, height: lStackH },
        ],
      });

      // 5. Left Hero + Right Inset
      variations.push({
        id: '2g_left_hero_right_inset',
        name: 'Left Safe Hero + Right Fine-Art',
        description: 'Full left safe box hero with a centered fine-art portrait on the right page.',
        photoCount: 2,
        rects: [
          { ...leftPageArea },
          fitInsideBoxCentered(rightPageArea, aspect1, 0.82),
        ],
      });
    }

    // Horizontal Split across usable spread
    const hSplit = round2((spreadArea.height - spacing) / 2);
    variations.push({
      id: '2g_horizontal_stack',
      name: 'Horizontal Dual Panorama Stack',
      description: 'Two panoramic landscape photos stacked vertically with exact gap.',
      photoCount: 2,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: hSplit },
        { x: spreadArea.x, y: round2(spreadArea.y + hSplit + spacing), width: spreadArea.width, height: hSplit },
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
        id: '3g_left_hero_right_stack',
        name: '1 Left Hero + 2 Right Stacked',
        description: 'Full-height story leader on left page with 2 stacked photos inside right safe box.',
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
        id: '3g_2left_stack_1right_hero',
        name: '2 Left Stacked + 1 Right Hero',
        description: 'Two detail shots inside left safe box leading into a major right page hero.',
        photoCount: 3,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lStackH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lStackH + spacing), width: leftPageArea.width, height: lStackH },
          { ...rightPageArea },
        ],
      });

      // 1 Left Hero + 2 Right Portrait Columns
      const colW = round2((rightPageArea.width - spacing) / 2);
      variations.push({
        id: '3g_left_hero_right_2columns',
        name: '1 Left Hero + 2 Right Columns',
        description: 'Left safe hero with two vertical portrait columns on right page.',
        photoCount: 3,
        rects: [
          { ...leftPageArea },
          { x: rightPageArea.x, y: rightPageArea.y, width: colW, height: rightPageArea.height },
          { x: round2(rightPageArea.x + colW + spacing), y: rightPageArea.y, width: colW, height: rightPageArea.height },
        ],
      });

      // 2 Left Portrait Columns + 1 Right Hero
      const lColW = round2((leftPageArea.width - spacing) / 2);
      variations.push({
        id: '3g_2columns_left_right_hero',
        name: '2 Left Columns + 1 Right Hero',
        description: 'Two vertical portrait columns on left page with right safe hero.',
        photoCount: 3,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: lColW, height: leftPageArea.height },
          { x: round2(leftPageArea.x + lColW + spacing), y: leftPageArea.y, width: lColW, height: leftPageArea.height },
          { ...rightPageArea },
        ],
      });
    }

    // 1 Top Wide + 2 Bottom Columns (Spread Safe Area)
    const topH = round2((spreadArea.height - spacing) * 0.55);
    const botH = round2(spreadArea.height - spacing - topH);
    const botW = round2((spreadArea.width - spacing) / 2);
    variations.push({
      id: '3g_1top_2bot',
      name: '1 Top Panorama + 2 Bottom Grid',
      description: 'Wide cinematic photo on top with two balanced supporting photos below.',
      photoCount: 3,
      rects: [
        { x: spreadArea.x, y: spreadArea.y, width: spreadArea.width, height: topH },
        { x: spreadArea.x, y: round2(spreadArea.y + topH + spacing), width: botW, height: botH },
        { x: round2(spreadArea.x + botW + spacing), y: round2(spreadArea.y + topH + spacing), width: botW, height: botH },
      ],
    });
  }

  // -------------------------------------------------------------
  // 4 PHOTOS VARIATIONS
  // -------------------------------------------------------------
  else if (count === 4) {
    if (isSpread) {
      // Facing 2+2 Stacks (Both Pages)
      const lH = round2((leftPageArea.height - spacing) / 2);
      const rH = round2((rightPageArea.height - spacing) / 2);
      variations.push({
        id: '4g_facing_2plus2',
        name: 'Facing 2+2 Stacks (Both Pages)',
        description: 'Two stacked photos on left page and two stacked photos on right page.',
        photoCount: 4,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lH + spacing), width: leftPageArea.width, height: lH },
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rH + spacing), width: rightPageArea.width, height: rH },
        ],
      });

      // 1 Left Hero + 3 Right Strip Columns
      const stripW = round2((rightPageArea.width - spacing * 2) / 3);
      variations.push({
        id: '4g_1lead_3strip',
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

      // 1 Left Hero + 3 Right Mosaic (1 Top + 2 Bot)
      const rTopH = round2((rightPageArea.height - spacing) * 0.55);
      const rBotH = round2(rightPageArea.height - spacing - rTopH);
      const rBotW = round2((rightPageArea.width - spacing) / 2);
      variations.push({
        id: '4g_1hero_left_3mosaic_right',
        name: '1 Left Hero + 3 Right Mosaic',
        description: '1 full left hero paired with 1 top wide and 2 bottom grid photos on right page.',
        photoCount: 4,
        rects: [
          { ...leftPageArea },
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: rTopH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rTopH + spacing), width: rBotW, height: rBotH },
          { x: round2(rightPageArea.x + rBotW + spacing), y: round2(rightPageArea.y + rTopH + spacing), width: rBotW, height: rBotH },
        ],
      });
    }

    // 2x2 Balanced Grid (Spread Area)
    const gridW = round2((spreadArea.width - spacing) / 2);
    const gridH = round2((spreadArea.height - spacing) / 2);
    variations.push({
      id: '4g_balanced_2x2',
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
  }

  // -------------------------------------------------------------
  // 5 PHOTOS VARIATIONS
  // -------------------------------------------------------------
  else if (count === 5) {
    if (isSpread) {
      // 4 Left 2x2 Grid + 1 Right Hero
      const gridW = round2((leftPageArea.width - spacing) / 2);
      const gridH = round2((leftPageArea.height - spacing) / 2);
      variations.push({
        id: '5g_4left_grid_1right_hero',
        name: '4 Left 2x2 Grid + 1 Right Hero',
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

      // 1 Left Hero + 4 Right 2x2 Grid
      const rGridW = round2((rightPageArea.width - spacing) / 2);
      const rGridH = round2((rightPageArea.height - spacing) / 2);
      variations.push({
        id: '5g_1left_hero_4right_grid',
        name: '1 Left Hero + 4 Right 2x2 Grid',
        description: '1 major left page hero paired with four corner detail grid photos on right page.',
        photoCount: 5,
        rects: [
          { ...leftPageArea },
          { x: rightPageArea.x, y: rightPageArea.y, width: rGridW, height: rGridH },
          { x: round2(rightPageArea.x + rGridW + spacing), y: rightPageArea.y, width: rGridW, height: rGridH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rGridH + spacing), width: rGridW, height: rGridH },
          { x: round2(rightPageArea.x + rGridW + spacing), y: round2(rightPageArea.y + rGridH + spacing), width: rGridW, height: rGridH },
        ],
      });

      // 2 Left Stack + 3 Right Columns
      const lH = round2((leftPageArea.height - spacing) / 2);
      const rW = round2((rightPageArea.width - spacing * 2) / 3);
      variations.push({
        id: '5g_2left_3right',
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
      id: '5g_1top_4bot',
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
    if (isSpread) {
      // Facing 3+3 Storyboard (1 Top Wide + 2 Bot on each page)
      const lTopH = round2((leftPageArea.height - spacing) * 0.55);
      const lBotH = round2(leftPageArea.height - spacing - lTopH);
      const lBotW = round2((leftPageArea.width - spacing) / 2);

      const rTopH = round2((rightPageArea.height - spacing) * 0.55);
      const rBotH = round2(rightPageArea.height - spacing - rTopH);
      const rBotW = round2((rightPageArea.width - spacing) / 2);

      variations.push({
        id: '6g_facing_3plus3',
        name: 'Facing 3+3 Storyboard (Both Pages)',
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

      // 1 Left Hero + 5 Right Gallery Grid
      const r5TopH = round2((rightPageArea.height - spacing) * 0.5);
      const r5BotH = round2(rightPageArea.height - spacing - r5TopH);
      const r5TopW = round2((rightPageArea.width - spacing) / 2);
      const r5BotW = round2((rightPageArea.width - spacing * 2) / 3);
      variations.push({
        id: '6g_1hero_5gallery',
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

      // Facing 3 Stacks on each page
      const l3H = round2((leftPageArea.height - spacing * 2) / 3);
      const r3H = round2((rightPageArea.height - spacing * 2) / 3);
      variations.push({
        id: '6g_facing_3stacks',
        name: 'Facing 3+3 Horizontal Rows',
        description: 'Three stacked horizontal panoramic rows per page.',
        photoCount: 6,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: l3H },
          { x: leftPageArea.x, y: round2(leftPageArea.y + l3H + spacing), width: leftPageArea.width, height: l3H },
          { x: leftPageArea.x, y: round2(leftPageArea.y + (l3H + spacing) * 2), width: leftPageArea.width, height: l3H },
          { x: rightPageArea.x, y: rightPageArea.y, width: rightPageArea.width, height: r3H },
          { x: rightPageArea.x, y: round2(rightPageArea.y + r3H + spacing), width: rightPageArea.width, height: r3H },
          { x: rightPageArea.x, y: round2(rightPageArea.y + (r3H + spacing) * 2), width: rightPageArea.width, height: r3H },
        ],
      });
    }

    // 2x3 Classic Grid (Spread Area)
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
      id: '6g_2x3_grid',
      name: '2x3 Storyboard Grid (6 Equal)',
      description: 'Six equal photographs in a balanced 2-row by 3-column configuration.',
      photoCount: 6,
      rects: rects2x3,
    });
  }

  // -------------------------------------------------------------
  // 7+ PHOTOS VARIATIONS (N >= 7)
  // -------------------------------------------------------------
  else {
    if (isSpread && count === 7) {
      // 3 Left Stack + 4 Right 2x2 Grid
      const lH = round2((leftPageArea.height - spacing * 2) / 3);
      const rGridW = round2((rightPageArea.width - spacing) / 2);
      const rGridH = round2((rightPageArea.height - spacing) / 2);

      variations.push({
        id: '7g_3left_stack_4right_grid',
        name: '3 Left Stacks + 4 Right 2x2 Grid',
        description: '3 stacked landscape rows on left page and 4 corner detail grid tiles on right page.',
        photoCount: 7,
        rects: [
          { x: leftPageArea.x, y: leftPageArea.y, width: leftPageArea.width, height: lH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lH + spacing), width: leftPageArea.width, height: lH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + (lH + spacing) * 2), width: leftPageArea.width, height: lH },
          { x: rightPageArea.x, y: rightPageArea.y, width: rGridW, height: rGridH },
          { x: round2(rightPageArea.x + rGridW + spacing), y: rightPageArea.y, width: rGridW, height: rGridH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rGridH + spacing), width: rGridW, height: rGridH },
          { x: round2(rightPageArea.x + rGridW + spacing), y: round2(rightPageArea.y + rGridH + spacing), width: rGridW, height: rGridH },
        ],
      });
    }

    if (isSpread && count === 8) {
      // Facing 4+4 Grids (2x2 each page)
      const lGridW = round2((leftPageArea.width - spacing) / 2);
      const lGridH = round2((leftPageArea.height - spacing) / 2);
      const rGridW = round2((rightPageArea.width - spacing) / 2);
      const rGridH = round2((rightPageArea.height - spacing) / 2);

      variations.push({
        id: '8g_facing_4plus4_grids',
        name: 'Facing 4+4 Storyboard (2x2 on Both Pages)',
        description: 'Four corner photos on left page and four corner photos on right page (2x2 each).',
        photoCount: 8,
        rects: [
          // Left 2x2
          { x: leftPageArea.x, y: leftPageArea.y, width: lGridW, height: lGridH },
          { x: round2(leftPageArea.x + lGridW + spacing), y: leftPageArea.y, width: lGridW, height: lGridH },
          { x: leftPageArea.x, y: round2(leftPageArea.y + lGridH + spacing), width: lGridW, height: lGridH },
          { x: round2(leftPageArea.x + lGridW + spacing), y: round2(leftPageArea.y + lGridH + spacing), width: lGridW, height: lGridH },
          // Right 2x2
          { x: rightPageArea.x, y: rightPageArea.y, width: rGridW, height: rGridH },
          { x: round2(rightPageArea.x + rGridW + spacing), y: rightPageArea.y, width: rGridW, height: rGridH },
          { x: rightPageArea.x, y: round2(rightPageArea.y + rGridH + spacing), width: rGridW, height: rGridH },
          { x: round2(rightPageArea.x + rGridW + spacing), y: round2(rightPageArea.y + rGridH + spacing), width: rGridW, height: rGridH },
        ],
      });
    }

    // Generic Balanced Grid across spreadArea
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
      id: `${count}g_balanced_grid`,
      name: `${count}-Photo Balanced Grid (${cols}x${rows})`,
      description: `Harmonious ${cols}-column grid fitting all ${count} photos strictly inside safe margins.`,
      photoCount: count,
      rects: genericGridRects,
    });
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

  const photoAspects = photos.map((p) => p.photoAspect ?? (p.originalWidth && p.originalHeight ? p.originalWidth / p.originalHeight : 1.5));
  const rectAspects = rects.map((r) => r.width / r.height);

  const indexedPhotos = photos.map((p, idx) => ({ photo: p, aspect: photoAspects[idx] ?? 1.5, originalIdx: idx }));
  const indexedRects = rects.map((r, idx) => ({ rect: r, aspect: rectAspects[idx] ?? 1.5, rectIdx: idx }));

  const sortedPhotos = [...indexedPhotos].sort((a, b) => a.aspect - b.aspect);
  const sortedRects = [...indexedRects].sort((a, b) => a.aspect - b.aspect);

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
 * Converts a Visual Grid Blueprint + Photos into full PhotoFrameElements for a spread.
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
 * Randomizes photo assignments across the active grid slots (Fisher-Yates random shuffle).
 */
export function shuffleElementsPhotos(elements: PhotoFrameElement[]): PhotoFrameElement[] {
  if (elements.length <= 1) return elements;

  const photos = elements.map((el) => ({
    photoId: el.photoId,
    filePath: el.filePath,
    fileName: el.fileName,
    previewPath: el.previewPath,
    thumbnailPath: el.thumbnailPath,
    photoAspect: el.photoAspect,
  }));

  const shuffled = [...photos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }

  // If shuffle resulted in identical sequence, rotate by 1 to guarantee a fresh permutation
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
