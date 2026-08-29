import {
  generateAdaptiveLayoutVariations,
  matchPhotosToRects,
  buildSpreadElementsFromVariation,
  shuffleElementsPhotos,
  AdaptivePhoto,
} from '../src/domain/adaptiveLayout';
import { TemplateParams } from '../src/domain/templates';

function runTests() {
  console.log('Testing Adaptive Smart Layout Engine & Orientation-Aware Solver...');

  const baseParams: TemplateParams = {
    spreadWidth: 400,
    spreadHeight: 200,
    isSpread: true,
    safeMargin: 10,
    gutterWidth: 6,
    spacing: 5,
  };

  // Test 1: Photo counts from 1 to 10 generate valid variations
  for (let n = 1; n <= 10; n++) {
    const mockPhotos: AdaptivePhoto[] = Array.from({ length: n }, (_, i) => ({
      filePath: `C:/photos/img${i + 1}.jpg`,
      fileName: `img${i + 1}.jpg`,
      photoAspect: i % 2 === 0 ? 1.5 : 0.67, // alternating landscape and portrait
    }));

    const variations = generateAdaptiveLayoutVariations(baseParams, mockPhotos);
    if (variations.length === 0) {
      throw new Error(`Failed to generate variations for photo count ${n}`);
    }

    for (const v of variations) {
      if (v.rects.length !== n) {
        throw new Error(`Variation ${v.id} for ${n} photos has ${v.rects.length} rects`);
      }
      for (const r of v.rects) {
        if (r.width <= 0 || r.height <= 0) {
          throw new Error(`Non-positive rect in ${v.id}: ${JSON.stringify(r)}`);
        }
      }
    }
  }
  console.log('✓ Dynamic variations generated cleanly for photo counts 1 to 10.');

  // Test 2: Smart Orientation Pairing
  const testPhotos: AdaptivePhoto[] = [
    { filePath: 'img_portrait.jpg', fileName: 'img_portrait.jpg', photoAspect: 0.67 }, // Portrait
    { filePath: 'img_landscape.jpg', fileName: 'img_landscape.jpg', photoAspect: 1.77 }, // Landscape
  ];

  // 1 Tall Left Hero, 1 Wide Top Right
  const rects = [
    { x: 10, y: 10, width: 180, height: 180 }, // Square/Hero
    { x: 200, y: 10, width: 180, height: 85 }, // Wide rectangle
  ];

  const pairings = matchPhotosToRects(testPhotos, rects);
  // Wide rectangle (index 1) should receive the landscape photo
  if (pairings[1].photo.fileName !== 'img_landscape.jpg') {
    throw new Error('Orientation matching failed to pair landscape photo with wide rectangle');
  }
  console.log('✓ Smart Orientation Matching algorithm correctly paired portrait & landscape.');

  // Test 3: Shuffle functionality
  const elements = buildSpreadElementsFromVariation(
    {
      id: 'test_var',
      name: 'Test',
      description: 'Test',
      photoCount: 3,
      rects: [
        { x: 10, y: 10, width: 100, height: 100 },
        { x: 120, y: 10, width: 100, height: 100 },
        { x: 230, y: 10, width: 100, height: 100 },
      ],
    },
    [
      { filePath: 'A.jpg', fileName: 'A.jpg' },
      { filePath: 'B.jpg', fileName: 'B.jpg' },
      { filePath: 'C.jpg', fileName: 'C.jpg' },
    ]
  );

  const shuffled = shuffleElementsPhotos(elements);
  if (shuffled.length !== 3) {
    throw new Error('Shuffled elements length mismatch');
  }
  console.log('✓ Shuffle photo rotation passed.');
  console.log('ALL ADAPTIVE LAYOUT TESTS PASSED! 🎉');
}

runTests();
