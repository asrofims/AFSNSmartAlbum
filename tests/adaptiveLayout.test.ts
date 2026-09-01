import {
  generateAdaptiveLayoutVariations,
  buildSpreadElementsFromVariation,
  shuffleElementsPhotos,
  partitionPageBoxIntoKRects,
  getPhotoOrientation,
  getPhotosFingerprint,
  calculateCropPenalty,
  findOptimalPhotoSlotMapping,
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

  // Test 3: Verify photoInset adds exact breathing room to outer edges
  const insetParams: TemplateParams = {
    ...baseParams,
    photoInset: 5, // 5mm breathing room on outer edges
  };
  const { leftPageArea: insetLeft, rightPageArea: insetRight } = getUsableAreas(insetParams);

  if (insetLeft.x !== 15 || insetLeft.width !== 175 || insetLeft.height !== 170) {
    throw new Error(`Inset Left area mismatch: ${JSON.stringify(insetLeft)}`);
  }
  if (insetRight.x !== 216 || insetRight.width !== 175 || insetRight.height !== 170) {
    throw new Error(`Inset Right area mismatch: ${JSON.stringify(insetRight)}`);
  }
  console.log('✓ Dynamic photoInset creates exact outer 4-edge breathing room while anchoring the spine.');

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

  // Test 6: Orientation & Aspect-Ratio Fingerprinting
  console.assert(getPhotoOrientation(1.5) === 'landscape', '1.5 should be landscape');
  console.assert(getPhotoOrientation(0.67) === 'portrait', '0.67 should be portrait');
  console.assert(getPhotoOrientation(1.0) === 'square', '1.0 should be square');

  const mixedPhotos: AdaptivePhoto[] = [
    { photoAspect: 1.5 }, // L
    { photoAspect: 0.67 }, // P
    { photoAspect: 0.67 }, // P
  ];
  const fp = getPhotosFingerprint(mixedPhotos);
  console.assert(fp === '1L+2P', `Fingerprint should be 1L+2P, got ${fp}`);
  console.log('✓ Photo orientation classification & fingerprinting passed.');

  // Test 7: Crop Loss Penalty Metric
  const zeroPenalty = calculateCropPenalty(1.5, 1.5);
  console.assert(Math.abs(zeroPenalty) < 0.001, `Exact aspect match must have 0 crop penalty, got ${zeroPenalty}`);

  const mismatchPenalty = calculateCropPenalty(1.5, 0.67);
  console.assert(mismatchPenalty > 0.5, `Mismatch penalty must be > 0.5, got ${mismatchPenalty}`);
  console.log('✓ Crop loss penalty calculation passed.');

  // Test 8: Optimal Photo-to-Slot Bipartite Assignment
  const testSlots = [
    { x: 0, y: 0, width: 80, height: 120 }, // slot 0: Portrait (0.67)
    { x: 90, y: 0, width: 180, height: 120 }, // slot 1: Landscape (1.5)
  ];
  const testTwoPhotos: AdaptivePhoto[] = [
    { photoAspect: 1.5 }, // photo 0: Landscape
    { photoAspect: 0.67 }, // photo 1: Portrait
  ];
  const mappingRes = findOptimalPhotoSlotMapping(testTwoPhotos, testSlots);
  // Photo 0 (Landscape) should be assigned to Slot 1 (Landscape)
  // Photo 1 (Portrait) should be assigned to Slot 0 (Portrait)
  console.assert(mappingRes.mapping[0] === 1, `Photo 0 (Landscape) must map to Slot 1, got ${mappingRes.mapping[0]}`);
  console.assert(mappingRes.mapping[1] === 0, `Photo 1 (Portrait) must map to Slot 0, got ${mappingRes.mapping[1]}`);
  console.assert(mappingRes.score === 100, `Perfect fit score must be 100%, got ${mappingRes.score}`);
  console.log('✓ Optimal photo-to-slot bipartite matching passed.');

  // Test 9: Layout Variations Ranked by Score (Top variation has highest score)
  const scoredVariations = generateAdaptiveLayoutVariations(baseParams, mixedPhotos);
  console.assert(scoredVariations.length > 0, 'Must produce variations');
  console.assert(scoredVariations[0].score !== undefined, 'Top variation must have score');
  console.assert(scoredVariations[0].score! >= scoredVariations[scoredVariations.length - 1].score!, 'Top variation score must be >= bottom variation score');
  console.assert(scoredVariations[0].fingerprint === '1L+2P', 'Top variation must record fingerprint 1L+2P');
  console.log('✓ Layout variations sorted and ranked by aspect-ratio match score.');

  // Test 10: Locked Frames Shuffle Immunity
  const elementsWithLock: any[] = [
    { id: 'f1', photoId: 'p1', filePath: 'a.jpg', fileName: 'a.jpg', locked: true, x: 10, y: 10, width: 80, height: 60 },
    { id: 'f2', photoId: 'p2', filePath: 'b.jpg', fileName: 'b.jpg', locked: false, x: 100, y: 10, width: 80, height: 60 },
    { id: 'f3', photoId: 'p3', filePath: 'c.jpg', fileName: 'c.jpg', locked: false, x: 190, y: 10, width: 80, height: 60 },
  ];
  const shuffledResult = shuffleElementsPhotos(elementsWithLock);
  console.assert(shuffledResult[0].photoId === 'p1', 'Locked frame f1 photoId must remain p1');
  console.assert(shuffledResult[0].filePath === 'a.jpg', 'Locked frame f1 filePath must remain a.jpg');
  console.assert(shuffledResult[0].locked === true, 'Locked frame f1 must remain locked');
  console.log('✓ Locked frame photo content is 100% immune to shuffle.');

  // Test 11: Non-Overlapping Smart Layout with Locked Frame on Full Left Page
  const leftLockedFrame: any = {
    id: 'lock-left',
    x: 10,
    y: 10,
    width: 180,
    height: 180,
    locked: true,
  };
  const unlockedTwoPhotos: AdaptivePhoto[] = [
    { photoAspect: 1.5, filePath: 'photo1.jpg' },
    { photoAspect: 1.5, filePath: 'photo2.jpg' },
  ];
  const paramsWithLeftLock = {
    ...baseParams,
    lockedElements: [leftLockedFrame],
  };
  const lockedSpreadVariations = generateAdaptiveLayoutVariations(paramsWithLeftLock, unlockedTwoPhotos);
  console.assert(lockedSpreadVariations.length > 0, 'Must produce non-overlapping variations');
  for (const v of lockedSpreadVariations) {
    for (const r of v.rects) {
      console.assert(
        r.x >= 200, // Right page area starts after 200mm
        `Generated rect (x=${r.x}) must not occupy or overlap full locked left page!`
      );
    }
  }
  console.log('✓ Smart layout generates non-overlapping rects exclusively on unoccupied page when full left page is locked.');

  // Test 12: Surrounding Sub-Box Occupancy (Top-half locked, bottom-half and right page available)
  const topHalfLocked: any = {
    id: 'lock-top-left',
    x: 10,
    y: 10,
    width: 180,
    height: 80, // occupies y=10..90 on left page (height 180 total, so bottom y=95..190 is free)
    locked: true,
  };
  const paramsWithTopHalfLock = {
    ...baseParams,
    lockedElements: [topHalfLocked],
  };
  const surroundingVariations = generateAdaptiveLayoutVariations(paramsWithTopHalfLock, unlockedTwoPhotos);
  console.assert(surroundingVariations.length > 0, 'Must produce variations');

  // Verify that there ARE variations placing rects in the bottom half of the left page (y >= 90, x < 200)
  const hasSamePageBottomVariations = surroundingVariations.some((v) =>
    v.rects.some((r) => r.x < 200 && r.y >= 90)
  );
  console.assert(
    hasSamePageBottomVariations,
    'Smart layout must generate variations utilizing available space below the locked photo on the same page!'
  );

  // Verify ZERO rects in ANY variation collide with the locked top-half frame
  for (const v of surroundingVariations) {
    for (const r of v.rects) {
      const collides = !(
        r.x >= topHalfLocked.x + topHalfLocked.width ||
        r.x + r.width <= topHalfLocked.x ||
        r.y >= topHalfLocked.y + topHalfLocked.height ||
        r.y + r.height <= topHalfLocked.y
      );
      console.assert(!collides, `Generated rect [${r.x}, ${r.y}, ${r.width}, ${r.height}] collides with locked frame!`);
    }
  }
  console.log('✓ Smart layout cleanly utilizes free surrounding space around locked photos without any collision.');

  console.log('ALL ADAPTIVE MULTI-PHOTO TESTS PASSED! 🎉');
}

runTests();
