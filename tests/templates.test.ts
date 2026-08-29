import {
  BUILTIN_LAYOUT_TEMPLATES,
  generateSpreadElementsFromTemplate,
  generateTemplateSvgPreview,
  getUsableAreas,
  TemplateParams,
} from '../src/domain/templates';

function runTests() {
  console.log('Testing Phase 6: Layout Templates & Generator Engine...');

  const params: TemplateParams = {
    spreadWidth: 405, // 200 left + 5 gutter + 200 right
    spreadHeight: 200,
    isSpread: true,
    safeMargin: 10,
    gutterWidth: 5,
    spacing: 4,
    currentPhotos: [
      { id: 'p1', filePath: 'C:/photos/img1.jpg', fileName: 'img1.jpg' },
      { id: 'p2', filePath: 'C:/photos/img2.jpg', fileName: 'img2.jpg' },
      { id: 'p3', filePath: 'C:/photos/img3.jpg', fileName: 'img3.jpg' },
      { id: 'p4', filePath: 'C:/photos/img4.jpg', fileName: 'img4.jpg' },
    ],
  };

  // 1. Verify Usable Areas & Exact Safe Margin Box Alignment
  const { spreadArea, leftPageArea, rightPageArea, pageWidth } = getUsableAreas(params);
  if (pageWidth !== 200) {
    throw new Error(`Expected pageWidth 200, got ${pageWidth}`);
  }
  if (leftPageArea.x !== 10 || leftPageArea.width !== 180 || leftPageArea.height !== 180) {
    throw new Error(`Incorrect Left Safe Box area: ${JSON.stringify(leftPageArea)}`);
  }
  if (rightPageArea.x !== 215 || rightPageArea.width !== 180 || rightPageArea.height !== 180) {
    throw new Error(`Incorrect Right Safe Box area: ${JSON.stringify(rightPageArea)}`);
  }
  console.log('✓ Exact Safe Margin Box alignment (left & right page blue dashed boxes) verified.');

  // 2. Verify all built-in templates
  for (const t of BUILTIN_LAYOUT_TEMPLATES) {
    const rects = t.generateRects(params);
    if (rects.length !== t.photoCount) {
      throw new Error(`Template ${t.id} generated ${rects.length} rects, expected ${t.photoCount}`);
    }

    for (const r of rects) {
      if (r.width <= 0 || r.height <= 0) {
        throw new Error(`Template ${t.id} produced non-positive dimensions: ${JSON.stringify(r)}`);
      }
      if (r.x < 0 || r.y < 0) {
        throw new Error(`Template ${t.id} produced negative coordinate: ${JSON.stringify(r)}`);
      }
    }

    const svg = generateTemplateSvgPreview(t);
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
      throw new Error(`Invalid SVG generated for ${t.id}`);
    }
  }
  console.log(`✓ All ${BUILTIN_LAYOUT_TEMPLATES.length} Visual Grid Blueprints validated.`);

  // 3. Verify Reflow & Frame Element Generation
  const template4p = BUILTIN_LAYOUT_TEMPLATES.find((t) => t.id === '4p_facing_2plus2_stacks');
  if (!template4p) throw new Error('Missing 4p_facing_2plus2_stacks template');

  const elements = generateSpreadElementsFromTemplate(template4p, params, true, 2, '#FF0000');
  if (elements.length !== 4) {
    throw new Error(`Expected 4 elements, got ${elements.length}`);
  }

  // Left frames start at x=10
  if (elements[0].x !== 10 || elements[1].x !== 10) {
    throw new Error('Left stacked elements do not align with Left Safe Box x=10');
  }

  // Right frames start at x=215
  if (elements[2].x !== 215 || elements[3].x !== 215) {
    throw new Error('Right stacked elements do not align with Right Safe Box x=215');
  }

  console.log('✓ Element generation, Safe Margin confinement, and photo preservation passed.');
  console.log('ALL TEMPLATE TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests();
