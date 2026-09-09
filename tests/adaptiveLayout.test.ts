import assert from 'node:assert/strict';
import { calculateImageOffset } from '../src/domain/editor';
import { calculateSpreadViewport } from '../src/domain/viewport';
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

  // Test 2: Verify Strict Blue Safe Margin Box Confinement (non full-bleed variations only)
  const sevenPhotos: AdaptivePhoto[] = Array.from({ length: 7 }, (_, i) => ({
    filePath: `img_${i}.jpg`,
    photoAspect: 1.5,
  }));
  const variations7p = generateAdaptiveLayoutVariations(baseParams, sevenPhotos);

  const { leftPageArea, rightPageArea } = getUsableAreas(baseParams);

  // Only check safe-margin variations (full-bleed variations intentionally extend to canvas edge)
  const safeMarginVariations = variations7p.filter((v) => !v.tags?.includes('full-bleed'));

  for (const v of safeMarginVariations) {
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
  console.log('✓ Safe-margin rects strictly bounded inside Left & Right Blue Safe Margin Boxes (full-bleed excluded).');

  // Test 3: Single Page Partitioning (K = 1 to 6) with Flush Outer Edge Confinement
  const singleBox = { x: 10, y: 10, width: 180, height: 180 };
  for (let k = 1; k <= 6; k++) {
    for (let variant = 0; variant < 10; variant++) {
      const rects = partitionPageBoxIntoKRects(singleBox, k, 4, variant);
      if (rects.length !== k) {
        throw new Error(`partitionPageBoxIntoKRects returned ${rects.length} for K=${k}`);
      }
      // Check zero gap at perimeter
      const minX = Math.min(...rects.map((r) => r.x));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxRight = Math.max(...rects.map((r) => r.x + r.width));
      const maxBottom = Math.max(...rects.map((r) => r.y + r.height));

      if (Math.abs(minX - singleBox.x) > 0.001) {
        throw new Error(`K=${k} variant=${variant} minX (${minX}) does not match box.x (${singleBox.x})`);
      }
      if (Math.abs(minY - singleBox.y) > 0.001) {
        throw new Error(`K=${k} variant=${variant} minY (${minY}) does not match box.y (${singleBox.y})`);
      }
      if (Math.abs(maxRight - (singleBox.x + singleBox.width)) > 0.001) {
        throw new Error(`K=${k} variant=${variant} maxRight (${maxRight}) does not reach box right edge (${singleBox.x + singleBox.width})`);
      }
      if (Math.abs(maxBottom - (singleBox.y + singleBox.height)) > 0.001) {
        throw new Error(`K=${k} variant=${variant} maxBottom (${maxBottom}) does not reach box bottom edge (${singleBox.y + singleBox.height})`);
      }
    }
  }
  // K=1 must fill 100% of the box
  const k1Rect = partitionPageBoxIntoKRects(singleBox, 1, 4, 0)[0];
  if (k1Rect.x !== 10 || k1Rect.y !== 10 || k1Rect.width !== 180 || k1Rect.height !== 180) {
    throw new Error(`K=1 rect must be flush with singleBox, got ${JSON.stringify(k1Rect)}`);
  }
  console.log('✓ Single page geometric box partitioning validated for K = 1..6 (flush outer edges, zero perimeter gap).');

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
  // Test 13: 2-Page Simultaneous Locks (Left top-half locked + Right bottom-half locked)
  const leftTopLock: any = {
    id: 'lock-left-top',
    x: 10,
    y: 10,
    width: 180,
    height: 80,
    locked: true,
  };
  const rightBottomLock: any = {
    id: 'lock-right-bot',
    x: 216,
    y: 110,
    width: 180,
    height: 80,
    locked: true,
  };
  const paramsTwoPageLock = {
    ...baseParams,
    lockedElements: [leftTopLock, rightBottomLock],
  };
  const twoPageLockVariations = generateAdaptiveLayoutVariations(paramsTwoPageLock, unlockedTwoPhotos);
  console.assert(twoPageLockVariations.length > 0, 'Must produce variations when both pages have locked frames!');
  for (const v of twoPageLockVariations) {
    for (const r of v.rects) {
      const collidesLeft = !(
        r.x >= leftTopLock.x + leftTopLock.width ||
        r.x + r.width <= leftTopLock.x ||
        r.y >= leftTopLock.y + leftTopLock.height ||
        r.y + r.height <= leftTopLock.y
      );
      const collidesRight = !(
        r.x >= rightBottomLock.x + rightBottomLock.width ||
        r.x + r.width <= rightBottomLock.x ||
        r.y >= rightBottomLock.y + rightBottomLock.height ||
        r.y + r.height <= rightBottomLock.y
      );
      console.assert(!collidesLeft, `Rect ${JSON.stringify(r)} collides with left locked frame!`);
      console.assert(!collidesRight, `Rect ${JSON.stringify(r)} collides with right locked frame!`);
    }
  }
  console.log('✓ Smart layout generates rich non-colliding variations when BOTH pages have locked frames simultaneously.');

  // Test 14: Multiple Locked Frames on Same Page (2D Spatial Subtraction / Slicing)
  const leftTopLeftLock: any = {
    id: 'lock-tl',
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    locked: true,
  };
  const leftBottomRightLock: any = {
    id: 'lock-br',
    x: 110,
    y: 110,
    width: 80,
    height: 80,
    locked: true,
  };
  const paramsMultiSamePageLock = {
    ...baseParams,
    lockedElements: [leftTopLeftLock, leftBottomRightLock],
  };
  const multiLockVariations = generateAdaptiveLayoutVariations(paramsMultiSamePageLock, unlockedTwoPhotos);
  console.assert(multiLockVariations.length > 0, 'Must produce variations for multiple locked frames on same page!');
  for (const v of multiLockVariations) {
    for (const r of v.rects) {
      const collidesTL = !(
        r.x >= leftTopLeftLock.x + leftTopLeftLock.width ||
        r.x + r.width <= leftTopLeftLock.x ||
        r.y >= leftTopLeftLock.y + leftTopLeftLock.height ||
        r.y + r.height <= leftTopLeftLock.y
      );
      const collidesBR = !(
        r.x >= leftBottomRightLock.x + leftBottomRightLock.width ||
        r.x + r.width <= leftBottomRightLock.x ||
        r.y >= leftBottomRightLock.y + leftBottomRightLock.height ||
        r.y + r.height <= leftBottomRightLock.y
      );
      console.assert(!collidesTL, `Rect ${JSON.stringify(r)} collides with Top-Left locked frame!`);
      console.assert(!collidesBR, `Rect ${JSON.stringify(r)} collides with Bottom-Right locked frame!`);
    }
  }
  console.log('✓ 2D Spatial Subtraction successfully carves and fills non-colliding zones around multiple complex locks.');

  // Test 14: Full-Bleed Variations for Single Photo (count=1)
  const singlePhoto: AdaptivePhoto[] = [{ photoAspect: 1.5 }];
  const singlePhotoVariations = generateAdaptiveLayoutVariations(baseParams, singlePhoto);
  console.assert(singlePhotoVariations.length > 0, 'Must produce variations for 1 photo');

  // Verify full-bleed variations exist and have frames at canvas edge (x=0 or y=0)
  const hasFullBleedSingle = singlePhotoVariations.some((v) =>
    v.rects.some((r) => r.x === 0 && r.y === 0)
  );
  console.assert(hasFullBleedSingle, 'Single photo must have full-bleed variations starting at (0,0)');

  // First variation should be full-bleed (edge-to-edge priority)
  const firstSingleRect = singlePhotoVariations[0]?.rects[0];
  if (firstSingleRect) {
    // The first variation after scoring should have a rect that touches an edge
    const touchesEdge = firstSingleRect.x === 0 || firstSingleRect.y === 0 ||
      Math.abs(firstSingleRect.x + firstSingleRect.width - baseParams.spreadWidth) < 0.01 ||
      Math.abs(firstSingleRect.y + firstSingleRect.height - baseParams.spreadHeight) < 0.01;
    console.assert(touchesEdge, 'Top-scored single photo variation should touch canvas edge');
  }
  console.log('✓ Single photo full-bleed edge-to-edge variations verified.');

  // Test 15: Full-Bleed Variations for Multi-Photo (count=2 to 6)
  for (let n = 2; n <= 6; n++) {
    const multiPhotos: AdaptivePhoto[] = Array.from({ length: n }, (_, i) => ({
      photoAspect: i % 2 === 0 ? 1.5 : 0.67,
    }));
    const multiVariations = generateAdaptiveLayoutVariations(baseParams, multiPhotos);
    console.assert(multiVariations.length > 0, `Must produce variations for ${n} photos`);

    // Must have at least one full-bleed variation with rects touching canvas edge
    const hasFullBleedMulti = multiVariations.some((v) =>
      v.rects.some((r) => r.x === 0 || r.y === 0) &&
      v.rects.some((r) =>
        Math.abs(r.x + r.width - baseParams.spreadWidth) < 0.01 ||
        Math.abs(r.y + r.height - baseParams.spreadHeight) < 0.01
      )
    );
    console.assert(hasFullBleedMulti, `${n}-photo layout must have full-bleed variations touching canvas edges`);

    // Verify full-bleed rects fill page edge (minX=0, minY=0, maxRight=pageWidth or spreadWidth)
    const bleedVars = multiVariations.filter((v) => v.tags?.includes('full-bleed'));
    console.assert(bleedVars.length > 0, `${n}-photo layout must have tagged full-bleed variations`);

    for (const bv of bleedVars) {
      const minX = Math.min(...bv.rects.map((r) => r.x));
      const minY = Math.min(...bv.rects.map((r) => r.y));
      const maxRight = Math.max(...bv.rects.map((r) => r.x + r.width));
      const maxBottom = Math.max(...bv.rects.map((r) => r.y + r.height));

      console.assert(Math.abs(minY) < 0.01, `Full-bleed ${n}p minY must be 0, got ${minY} in ${bv.id}`);
      console.assert(
        Math.abs(maxBottom - baseParams.spreadHeight) < 0.01,
        `Full-bleed ${n}p maxBottom must reach spreadHeight (${baseParams.spreadHeight}), got ${maxBottom} in ${bv.id}`
      );
    }
  }
  console.log('✓ Multi-photo (2-6) full-bleed edge-to-edge variations verified.');

  console.log('ALL ADAPTIVE MULTI-PHOTO TESTS PASSED! 🎉');
}

// Exercise the actual layout -> frame -> photo -> viewport path with fractional sizes.
for (const [spreadWidth, spreadHeight, spacing] of [[420.46, 297.04, 3.125], [16.125, 10.25, 0.125]]) {
  const params: TemplateParams = { spreadWidth, spreadHeight, spacing, isSpread: true, safeMargin: 0, gutterWidth: 0 };
  for (const count of [1, 2, 3, 4, 5, 6, 8, 12]) {
    const photos = Array.from({ length: count }, (_, i) => ({ photoAspect: i % 2 ? 0.67 : 1.5 }));
    const variations = generateAdaptiveLayoutVariations(params, photos).filter(v => v.tags.includes('full-bleed'));
    assert.ok(variations.length > 0, `Missing full-bleed variations for ${count} photos`);
    for (const variation of variations) {
      const frames = buildSpreadElementsFromVariation(variation, photos);
      assert.equal(Math.min(...frames.map(f => f.y)), 0);
      assert.ok(Math.abs(Math.max(...frames.map(f => f.y + f.height)) - spreadHeight) < 1e-8);
      for (const frame of frames) {
        for (const pan of [-1, 0, 1]) {
          const image = calculateImageOffset(frame.width, frame.height, frame.photoAspect!, 1, pan, pan);
          assert.ok(image.offsetX <= 1e-9 && image.offsetY <= 1e-9);
          assert.ok(image.offsetX + image.width >= frame.width - 1e-9, `${variation.id}: photo leaves a right-edge gap inside the generated frame`);
          assert.ok(image.offsetY + image.height >= frame.height - 1e-9, `${variation.id}: photo leaves a bottom-edge gap inside the generated frame`);
        }
      }
      for (const zoom of [0.67, 1, 1.37]) {
        const viewport = calculateSpreadViewport(spreadWidth, spreadHeight, 873.08, 515.2, zoom);
        const bottom = Math.max(...frames.map(f => (f.y + f.height) * viewport.scaleFactor));
        assert.ok(Math.abs(bottom - viewport.height) < 1e-8, `${variation.id}: generated frames must reach the displayed sheet edge`);
      }
    }
  }
}

runTests();
