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
    spreadWidth: 400,
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

  // 1. Verify Usable Areas
  const { spreadArea, leftPageArea, rightPageArea } = getUsableAreas(params);
  if (spreadArea.width !== 380 || spreadArea.height !== 180) {
    throw new Error(`Incorrect spread usable area: ${JSON.stringify(spreadArea)}`);
  }
  if (leftPageArea.width !== 187.5 || rightPageArea.width !== 187.5) {
    throw new Error(`Incorrect page usable area: ${JSON.stringify(leftPageArea)}`);
  }
  console.log('✓ Usable area math (margins & gutter) passed.');

  // 2. Verify all built-in templates
  if (BUILTIN_LAYOUT_TEMPLATES.length < 15) {
    throw new Error(`Expected at least 15 templates, found ${BUILTIN_LAYOUT_TEMPLATES.length}`);
  }

  for (const t of BUILTIN_LAYOUT_TEMPLATES) {
    const rects = t.generateRects(params);
    if (rects.length !== t.photoCount) {
      throw new Error(`Template ${t.id} generated ${rects.length} rects, expected ${t.photoCount}`);
    }

    // Ensure all rects are positive
    for (const r of rects) {
      if (r.width <= 0 || r.height <= 0) {
        throw new Error(`Template ${t.id} produced non-positive dimensions: ${JSON.stringify(r)}`);
      }
      if (r.x < 0 || r.y < 0) {
        throw new Error(`Template ${t.id} produced negative coordinate: ${JSON.stringify(r)}`);
      }
    }

    // Verify SVG preview generator
    const svg = generateTemplateSvgPreview(t);
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
      throw new Error(`Invalid SVG generated for ${t.id}`);
    }
  }
  console.log(`✓ All ${BUILTIN_LAYOUT_TEMPLATES.length} built-in layout templates validated.`);

  // 3. Verify Reflow & Frame Element Generation
  const template4p = BUILTIN_LAYOUT_TEMPLATES.find((t) => t.id === '4p_balanced_2x2_grid');
  if (!template4p) throw new Error('Missing 4p_balanced_2x2_grid template');

  const elements = generateSpreadElementsFromTemplate(template4p, params, true, 2, '#FF0000');
  if (elements.length !== 4) {
    throw new Error(`Expected 4 elements, got ${elements.length}`);
  }

  // Verify photos assigned correctly
  if (elements[0].filePath !== 'C:/photos/img1.jpg' || elements[1].filePath !== 'C:/photos/img2.jpg') {
    throw new Error('Photo assignment preservation failed during template generation');
  }

  if (elements[0].borderEnabled !== true || elements[0].borderWidth !== 2 || elements[0].borderColor !== '#FF0000') {
    throw new Error('Default border properties not propagated to template frames');
  }

  console.log('✓ Element generation & photo preservation passed.');
  console.log('ALL TEMPLATE TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests();
