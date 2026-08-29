import {
  generateAdaptiveLayoutVariations,
  buildSpreadElementsFromVariation,
  shuffleElementsPhotos,
  partitionPageBoxIntoKRects,
  AdaptivePhoto,
} from '../src/domain/adaptiveLayout';
import { TemplateParams, getUsableAreas } from '../src/domain/templates';

function runTests() {
  console.log('Testing Adaptive Multi-Photo Partitioning Engine & Safe Area Confinement...');

  const baseParams: TemplateParams = {
    spreadWidth: 406,
    spreadHeight: 200,
    isSpread: true,
    safeMargin: 10,
    photoInset: 0,
    gutterWidth: 6,
    spacing: 4,
  };

  // Test 1: Dynamic variations generated cleanly for photo counts 1 to 12
  for (let n = 1; n <= 12; n++) {
    const photos: AdaptivePhoto[] = Array.from({ length: n }, (_, i) => ({
      filePath: `/path/to/photo_${i + 1}.jpg`,
      fileName: `photo_${i + 1}.jpg`,
      photoAspect: i % 2 === 0 ? 1.5 : 0.67,
    }));

    const variations = generateAdaptiveLayoutVariations(baseParams, photos);
    if (variations.length === 0) {
      throw new Error(`Failed to generate variations for ${n} photos`);
    }

    // Verify every variation contains EXACTLY n rects
    for (const v of variations) {
      if (v.rects.length !== n) {
        throw new Error(`Variation ${v.id} has ${v.rects.length} rects instead of ${n}`);
      }
    }
  }
  console.log('✓ Dynamic variations generated cleanly for photo counts 1 to 12 (all rect counts exact).');

  // Test 2: Verify Strict Blue Safe Margin Box Confinement
  const sevenPhotos: AdaptivePhoto[] = Array.from({ length: 7 }, (_, i) => ({
    filePath: `img_${i}.jpg`,
    photoAspect: 1.5,
  }));
  const variations7p = generateAdaptiveLayoutVariations(baseParams, sevenPhotos);

  const { leftPageArea, rightPageArea } = getUsableAreas(baseParams);

  for (const v of variations7p) {
    for (const r of v.rects) {
      // Check if rect belongs to left page or right page
      const isLeft = r.x < leftPageArea.x + leftPageArea.width + baseParams.gutterWidth / 2;
      const targetBox = isLeft ? leftPageArea : rightPageArea;

      if (r.x < targetBox.x - 0.01) {
        throw new Error(`Rect X (${r.x}) exceeds safe box X (${targetBox.x}) in ${v.id}`);
      }
      if (r.y < targetBox.y - 0.01) {
        throw new Error(`Rect Y (${r.y}) exceeds safe box Y (${targetBox.y}) in ${v.id}`);
      }
      if (r.x + r.width > targetBox.x + targetBox.width + 0.01) {
        throw new Error(`Rect right edge exceeds safe box in ${v.id}`);
      }
      if (r.y + r.height > targetBox.y + targetBox.height + 0.01) {
        throw new Error(`Rect bottom edge exceeds safe box in ${v.id}`);
      }
    }
  }
  console.log('✓ All multi-photo rects strictly bounded inside Left & Right Blue Safe Margin Boxes.');

  // Test 3: Verify photoInset adds exact breathing room
  const insetParams: TemplateParams = {
    ...baseParams,
    photoInset: 5, // 5mm breathing room inside blue line
  };
  const { leftPageArea: insetLeft, rightPageArea: insetRight } = getUsableAreas(insetParams);

  if (insetLeft.x !== 15 || insetLeft.width !== 200 - 30) {
    throw new Error(`Inset Left area mismatch: ${JSON.stringify(insetLeft)}`);
  }
  if (insetRight.x !== 200 + 6 + 15 || insetRight.width !== 200 - 30) {
    throw new Error(`Inset Right area mismatch: ${JSON.stringify(insetRight)}`);
  }
  console.log('✓ Dynamic photoInset creates exact symmetrical breathing room inside safe boxes.');

  // Test 4: Single Page Partitioning (K = 1 to 6)
  const singleBox = { x: 10, y: 10, width: 180, height: 180 };
  for (let k = 1; k <= 6; k++) {
    const rects = partitionPageBoxIntoKRects(singleBox, k, 4, 0);
    if (rects.length !== k) {
      throw new Error(`partitionPageBoxIntoKRects returned ${rects.length} for K=${k}`);
    }
  }
  console.log('✓ Single page geometric box partitioning validated for K = 1..6.');

  // Test 5: Shuffle photo randomized rotation
  const elements = buildSpreadElementsFromVariation(variations7p[0], sevenPhotos);
  const shuffled = shuffleElementsPhotos(elements);
  if (shuffled.length !== elements.length) {
    throw new Error('Shuffle changed elements count');
  }
  console.log('✓ Shuffle photo randomized rotation passed.');

  console.log('ALL ADAPTIVE MULTI-PHOTO TESTS PASSED! 🎉');
}

runTests();
