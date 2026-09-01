import {
  calculateCoverDimensions,
  calculateImageOffset,
  calculateSnapping,
  calculateResizeSnapping,
  clampCropTransform,
  getCenteredCrop,
  getCoverImageSize,
  moveCropBy,
  PhotoFrameElement,
  RectBounds,
  resizeCropFromHandle,
  zoomCropAtPoint,
  intersectRect,
  alignFrames,
  distributeFrames,
  applyFixedGap,
  calculateMultiFrameResize,
  calculateCenterRotatedPosition,
  computeMultiFrameGroupBounds,
  computeMultiFrameGroupInfo,
  unprojectGroupChildToWorld,
  matchFrameDimensions,
  clusterFramesIntoEntities,
  SafeMarginBounds,
  loadSavedSnappingConfig,
  saveSnappingConfig,
  DEFAULT_SNAPPING_CONFIG,
} from '../src/domain/editor';

console.log('Testing Editor Domain & Smart Snapping Math...');

// 1. Test Snapping to Spread Boundaries (Left Edge, Safe Margin, Center Gutter, Right Edge)
const spreadWidth = 600; // 600mm spread
const spreadHeight = 300; // 300mm spread
const safeArea = 10; // 10mm margin
const gutterWidth = 6; // 6mm spine
const otherFrames: RectBounds[] = [];

// Dragged near Left Edge (x = 1.5mm, threshold = 3mm)
const draggedNearLeft: RectBounds = { x: 1.5, y: 50, width: 100, height: 80 };
const snapLeft = calculateSnapping(draggedNearLeft, spreadWidth, spreadHeight, safeArea, gutterWidth, otherFrames, 3.0);
console.assert(snapLeft.snappedX === 0, `Should snap to 0 left edge, got ${snapLeft.snappedX}`);
console.assert(snapLeft.snapLines.length === 1, 'Should produce 1 vertical snap line');
console.assert(snapLeft.snapLines[0].position === 0, 'Snap line position should be 0');

// Dragged near Safe Area (x = 9.2mm, should snap to 10mm)
const draggedNearSafeArea: RectBounds = { x: 9.2, y: 50, width: 100, height: 80 };
const snapSafe = calculateSnapping(draggedNearSafeArea, spreadWidth, spreadHeight, safeArea, gutterWidth, otherFrames, 3.0);
console.assert(snapSafe.snappedX === 10, `Should snap to 10mm safe area, got ${snapSafe.snappedX}`);

// Dragged near Center Spine (CenterX = 299mm near 300mm center spine)
const draggedNearCenter: RectBounds = { x: 250 - 1.2, y: 50, width: 100, height: 80 }; // centerX = 298.8
const snapCenter = calculateSnapping(draggedNearCenter, spreadWidth, spreadHeight, safeArea, gutterWidth, otherFrames, 3.0);
console.assert(snapCenter.snappedX === 250, `Should snap center to 300 (x=250), got ${snapCenter.snappedX}`);

// Dragged near Left Page Center (Page 1 Center = 148.5mm, frame width = 100mm, x = 99mm -> centerX = 149mm)
const draggedNearLeftCenter: RectBounds = { x: 99, y: 50, width: 100, height: 80 };
const snapLeftCenter = calculateSnapping(draggedNearLeftCenter, spreadWidth, spreadHeight, safeArea, gutterWidth, otherFrames, 3.0);
console.assert(snapLeftCenter.snappedX === 98.5, `Should snap center to 148.5 (x=98.5), got ${snapLeftCenter.snappedX}`);
console.assert(snapLeftCenter.snapLines[0].label === 'Left Page Center', `Snap line should be Left Page Center, got ${snapLeftCenter.snapLines[0].label}`);
console.assert(snapLeftCenter.snapLines[0].kind === 'center', `Snap line kind should be center, got ${snapLeftCenter.snapLines[0].kind}`);

// Dragged near Right Page Center (Page 2 Center = 451.5mm, frame width = 100mm, x = 402mm -> centerX = 452mm)
const draggedNearRightCenter: RectBounds = { x: 402, y: 50, width: 100, height: 80 };
const snapRightCenter = calculateSnapping(draggedNearRightCenter, spreadWidth, spreadHeight, safeArea, gutterWidth, otherFrames, 3.0);
console.assert(snapRightCenter.snappedX === 401.5, `Should snap center to 451.5 (x=401.5), got ${snapRightCenter.snappedX}`);
console.assert(snapRightCenter.snapLines[0].label === 'Right Page Center', `Snap line should be Right Page Center, got ${snapRightCenter.snapLines[0].label}`);
console.assert(snapRightCenter.snapLines[0].kind === 'center', `Snap line kind should be center, got ${snapRightCenter.snapLines[0].kind}`);

// 2. Test Snapping to Other Neighboring Frames
const frameA: RectBounds = { x: 50, y: 50, width: 120, height: 90 };
const draggedNearFrameA: RectBounds = { x: 50.8, y: 160, width: 120, height: 90 }; // x=50.8 near x=50
const snapNeighbor = calculateSnapping(draggedNearFrameA, spreadWidth, spreadHeight, safeArea, gutterWidth, [frameA], 3.0);
console.assert(snapNeighbor.snappedX === 50, `Should align left with neighboring frame at 50, got ${snapNeighbor.snappedX}`);

// 3. Test Y Snapping (Top Edge, Safe Margin, Center Horizontal)
const draggedNearTopSafe: RectBounds = { x: 100, y: 11.2, width: 100, height: 80 };
const snapY = calculateSnapping(draggedNearTopSafe, spreadWidth, spreadHeight, safeArea, gutterWidth, [], 3.0);
console.assert(snapY.snappedY === 10, `Should snap top to 10mm safe margin, got ${snapY.snappedY}`);

// 4. Test crop cover math keeps photo bounds covering the frame
const squareFrameWithWidePhoto: PhotoFrameElement = {
  id: 'crop-test-frame',
  type: 'photo',
  photoId: 'photo-1',
  filePath: 'sample.jpg',
  previewPath: 'sample-preview.jpg',
  thumbnailPath: 'sample-thumb.jpg',
  fileName: 'sample.jpg',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  zIndex: 1,
  photoAspect: 1.5,
  originalWidth: 150,
  originalHeight: 100,
  imageWidth: 150,
  imageHeight: 100,
  cropX: 200,
  cropY: -200,
  cropScale: 0.2,
  cropRotation: 0,
  borderEnabled: false,
  borderWidth: 1,
  borderColor: '#ffffff',
  opacity: 1,
};

const coverSize = getCoverImageSize(squareFrameWithWidePhoto);
console.assert(coverSize.width === 150, `Wide photo should cover square frame at 150mm width, got ${coverSize.width}`);
console.assert(coverSize.height === 100, `Wide photo should cover square frame at 100mm height, got ${coverSize.height}`);

const centeredCrop = getCenteredCrop();
console.assert(centeredCrop.cropX === 0, `Centered crop should have normalized cropX of 0, got ${centeredCrop.cropX}`);
console.assert(centeredCrop.cropY === 0, `Centered crop should have normalized cropY of 0, got ${centeredCrop.cropY}`);
console.assert(centeredCrop.cropScale === 1.0, `Centered crop should have zoom of 1.0, got ${centeredCrop.cropScale}`);

// Test Offset Math
const offsetAtCenter = calculateImageOffset(100, 100, 1.5, 1.0, 0, 0);
console.assert(offsetAtCenter.offsetX === -25, `Center offset for 150x100 photo in 100x100 frame should be -25, got ${offsetAtCenter.offsetX}`);
console.assert(offsetAtCenter.offsetY === 0, `Center offset Y should be 0, got ${offsetAtCenter.offsetY}`);

// Test Left Alignment (normPanX = -1.0)
const offsetAtLeft = calculateImageOffset(100, 100, 1.5, 1.0, -1.0, 0);
console.assert(offsetAtLeft.offsetX === -50, `Left offset should be -50, got ${offsetAtLeft.offsetX}`);

// Test Right Alignment (normPanX = +1.0)
const offsetAtRight = calculateImageOffset(100, 100, 1.5, 1.0, 1.0, 0);
console.assert(offsetAtRight.offsetX === 0, `Right offset should be 0, got ${offsetAtRight.offsetX}`);

// Test Zoom (cropScale = 2.0)
const offsetAtZoom2 = calculateImageOffset(100, 100, 1.5, 2.0, 0, 0);
console.assert(offsetAtZoom2.width === 300, `Width at 2x zoom should be 300, got ${offsetAtZoom2.width}`);
console.assert(offsetAtZoom2.height === 200, `Height at 2x zoom should be 200, got ${offsetAtZoom2.height}`);
console.assert(offsetAtZoom2.offsetX === -100, `OffsetX at 2x zoom center should be -100, got ${offsetAtZoom2.offsetX}`);
console.assert(offsetAtZoom2.offsetY === -50, `OffsetY at 2x zoom center should be -50, got ${offsetAtZoom2.offsetY}`);

// 5. Test Equal Horizontal Spacing Snapping
// Frame Left: x=50, w=100 (right=150)
// Frame Right: x=350, w=100
// Dragged Frame: w=100, placed near middle (e.g. x=201, leftGap=51, rightGap=49) -> total span=200 -> equal gap = (200 - 100)/2 = 50 -> snappedX = 200
const frameL: RectBounds = { x: 50, y: 50, width: 100, height: 100 };
const frameR: RectBounds = { x: 350, y: 50, width: 100, height: 100 };
const draggedBetween: RectBounds = { x: 202, y: 50, width: 100, height: 100 };
const snapEqual = calculateSnapping(draggedBetween, spreadWidth, spreadHeight, safeArea, gutterWidth, [frameL, frameR], 3.0, 'mm');
console.assert(snapEqual.snappedX === 200, `Should snap to equidistant x=200, got ${snapEqual.snappedX}`);
console.assert(snapEqual.gapGuides.length === 2, `Should generate 2 gap guides for equal spacing, got ${snapEqual.gapGuides.length}`);
console.assert(snapEqual.gapGuides[0].distance === 50, `Gap distance should be 50mm, got ${snapEqual.gapGuides[0].distance}`);

// 5b. Test Spread Center (Full Spread / Foto Sambung) and Page Center Magnetic Snapping
// Spread: spreadWidth=600, spreadHeight=400, gutterWidth=0 -> singlePageW=300
// Left Page Center = 150, Right Page Center = 450, Spread Center X = 300, Spread Center Y = 200
// Panoramic frame: w=200, h=150. When placed near center (e.g. x=199, y=124), center is (x=299, y=199) -> snaps to x=200, y=125
const panoramicFrame: RectBounds = { x: 199, y: 124, width: 200, height: 150 };
const snapSpreadCenter = calculateSnapping(panoramicFrame, 600, 400, 10, 0, [], 3.0, 'mm');
console.assert(snapSpreadCenter.snappedX === 200, `Should snap panoramic frame to Spread Center X (x=200), got ${snapSpreadCenter.snappedX}`);
console.assert(snapSpreadCenter.snappedY === 125, `Should snap panoramic frame to Spread Center Y (y=125), got ${snapSpreadCenter.snappedY}`);
console.assert(snapSpreadCenter.snapLines.some((l) => l.label === 'Spread Center X'), 'Should produce Spread Center X snap line');
console.assert(snapSpreadCenter.snapLines.some((l) => l.label === 'Spread Center Y'), 'Should produce Spread Center Y snap line');

// Test Left Page (Page 1) Center Snap: frame w=100 -> center at x=150 -> x=100
const leftPageFrame: RectBounds = { x: 99, y: 50, width: 100, height: 100 };
const snapLeftPageCenter = calculateSnapping(leftPageFrame, 600, 400, 10, 0, [], 3.0, 'mm');
console.assert(snapLeftPageCenter.snappedX === 100, `Should snap to Left Page Center (x=100), got ${snapLeftPageCenter.snappedX}`);
console.assert(snapLeftPageCenter.snapLines.some((l) => l.label === 'Left Page Center'), 'Should produce Left Page Center snap line');

// Test Right Page (Page 2) Center Snap: frame w=100 -> center at x=450 -> x=400
const rightPageFrame: RectBounds = { x: 399, y: 50, width: 100, height: 100 };
const snapRightPageCenter = calculateSnapping(rightPageFrame, 600, 400, 10, 0, [], 3.0, 'mm');
console.assert(snapRightPageCenter.snappedX === 400, `Should snap to Right Page Center (x=400), got ${snapRightPageCenter.snappedX}`);
console.assert(snapRightPageCenter.snapLines.some((l) => l.label === 'Right Page Center'), 'Should produce Right Page Center snap line');

// 6. Test Resize Snapping (Match Width of Neighbor Frame)
// Frame A: width=120
// Frame B (resizing): width=121.2 -> should snap to 120
const resizingFrame: RectBounds = { x: 200, y: 150, width: 121.2, height: 80 };
const resizeSnap = calculateResizeSnapping(resizingFrame, spreadWidth, spreadHeight, safeArea, gutterWidth, [{ x: 50, y: 50, width: 120, height: 90 }], 3.0, 'mm');
console.assert(resizeSnap.snappedBounds.width === 120, `Should snap width to match 120mm, got ${resizeSnap.snappedBounds.width}`);

// 7. Test Marquee Intersect Math
const marqueeBox: RectBounds = { x: 100, y: 100, width: 150, height: 100 };
const intersectingFrame: RectBounds = { x: 150, y: 120, width: 80, height: 60 };
const outsideFrame: RectBounds = { x: 300, y: 120, width: 80, height: 60 };
console.assert(intersectRect(marqueeBox, intersectingFrame) === true, 'Frame inside marquee should intersect');
console.assert(intersectRect(marqueeBox, outsideFrame) === false, 'Frame outside marquee should not intersect');

// 8. Test Multiple Frame Batch Alignment Math
const frame1: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 'f1', x: 20, y: 30, width: 100, height: 80 };
const frame2: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 'f2', x: 150, y: 60, width: 120, height: 100 };
const frame3: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 'f3', x: 300, y: 40, width: 80, height: 60 };

// Align Left (minX = 20)
const alignLeftUpdates = alignFrames([frame1, frame2, frame3], 'left');
console.assert(alignLeftUpdates.every((u) => u.geometry.x === 20), 'All frames should align left to x=20');

// Align Top (minY = 30)
const alignTopUpdates = alignFrames([frame1, frame2, frame3], 'top');
console.assert(alignTopUpdates.every((u) => u.geometry.y === 30), 'All frames should align top to y=30');

// Align Right (maxX = 300 + 80 = 380)
const alignRightUpdates = alignFrames([frame1, frame2, frame3], 'right');
console.assert(alignRightUpdates.find((u) => u.id === 'f1')?.geometry.x === 280, 'f1 should align right to x=280');
console.assert(alignRightUpdates.find((u) => u.id === 'f2')?.geometry.x === 260, 'f2 should align right to x=260');
console.assert(alignRightUpdates.find((u) => u.id === 'f3')?.geometry.x === 300, 'f3 should align right to x=300');

// 9. Test Distribute Frames Equidistant Math
// Total span: f1 (x=0, w=100) to f3 (x=300, w=100) -> total span = 400. Total width = 300 -> available gap = 100 -> gap per item = 50.
const dFrame1: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 'd1', x: 0, y: 50, width: 100, height: 100 };
const dFrame2: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 'd2', x: 120, y: 50, width: 100, height: 100 };
const dFrame3: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 'd3', x: 300, y: 50, width: 100, height: 100 };
const distH = distributeFrames([dFrame1, dFrame2, dFrame3], 'horizontal');
console.assert(distH[0].geometry.x === 0, 'First frame stays at x=0');
console.assert(distH[1].geometry.x === 150, `Second frame distributed to x=150, got ${distH[1].geometry.x}`);
console.assert(distH[2].geometry.x === 300, 'Third frame stays at x=300');

// 9b. Test Distribute Frames with Very Thin / Micro Gap (1.2mm total gap -> 0.6mm gap each)
const thinFrame1: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 't1', x: 0, y: 50, width: 50, height: 50 };
const thinFrame2: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 't2', x: 50.2, y: 50, width: 50, height: 50 };
const thinFrame3: PhotoFrameElement = { ...squareFrameWithWidePhoto, id: 't3', x: 101.2, y: 50, width: 50, height: 50 };
const distThin = distributeFrames([thinFrame1, thinFrame2, thinFrame3], 'horizontal');
console.assert(distThin[0].geometry.x === 0, 'First frame stays at x=0');
console.assert(distThin[1].geometry.x === 50.6, `Second frame distributed with exact 0.6mm gap to x=50.6, got ${distThin[1].geometry.x}`);
console.assert(distThin[2].geometry.x === 101.2, 'Third frame stays at x=101.2');

// 10. Test Apply Fixed Gap Math
const fixedGapUpdates = applyFixedGap([dFrame1, dFrame2, dFrame3], 'horizontal', 10);
console.assert(fixedGapUpdates[0].geometry.x === 0, 'First frame stays at x=0');
console.assert(fixedGapUpdates[1].geometry.x === 110, `Second frame positioned at x=110, got ${fixedGapUpdates[1].geometry.x}`);
console.assert(fixedGapUpdates[2].geometry.x === 220, `Third frame positioned at x=220, got ${fixedGapUpdates[2].geometry.x}`);

// 11. Test Match Dimensions Math
const matchW = matchFrameDimensions([frame1, frame2, frame3], 'width');
console.assert(matchW.every((u) => u.geometry.width === 100), 'All frames should match width of first frame (100mm)');

// 12. Test Multi-Frame Resize with Preserved Gap Spacing (2 frames with 5mm gap resized from 205mm to 265mm)
const initialGroup = [
  { id: 'fA', x: 0, y: 0, width: 100, height: 80 },
  { id: 'fB', x: 105, y: 0, width: 100, height: 80 },
];
const initialBounds = { x: 0, y: 0, width: 205, height: 80 };
const newBounds = { x: 0, y: 0, width: 265, height: 104 };
const multiResizeUpdates = calculateMultiFrameResize(initialGroup, initialBounds, newBounds, undefined, 'fixed_gap');

console.assert(multiResizeUpdates[0].geometry.width === 130, `Frame A new width should be 130, got ${multiResizeUpdates[0].geometry.width}`);
console.assert(multiResizeUpdates[0].geometry.x === 0, `Frame A new x should be 0, got ${multiResizeUpdates[0].geometry.x}`);
console.assert(multiResizeUpdates[1].geometry.width === 130, `Frame B new width should be 130, got ${multiResizeUpdates[1].geometry.width}`);
console.assert(multiResizeUpdates[1].geometry.x === 135, `Frame B new x should be 135, got ${multiResizeUpdates[1].geometry.x}`);

// Calculate preserved gap between Frame A (x=0, w=130 -> right=130) and Frame B (x=135)
const preservedGap = (multiResizeUpdates[1].geometry.x ?? 0) - ((multiResizeUpdates[0].geometry.x ?? 0) + (multiResizeUpdates[0].geometry.width ?? 0));
console.assert(preservedGap === 5, `Gap between frames must remain strictly 5mm after resize, got ${preservedGap}mm`);

// Assert Aspect Ratio is 100% strictly preserved
const ratioA = (multiResizeUpdates[0].geometry.width ?? 0) / (multiResizeUpdates[0].geometry.height ?? 0);
console.assert(Math.abs(ratioA - (100 / 80)) < 0.001, `Frame A aspect ratio must remain exactly 1.25, got ${ratioA}`);
const ratioB = (multiResizeUpdates[1].geometry.width ?? 0) / (multiResizeUpdates[1].geometry.height ?? 0);
console.assert(Math.abs(ratioB - (100 / 80)) < 0.001, `Frame B aspect ratio must remain exactly 1.25, got ${ratioB}`);

// 13. Test Multi-Frame Resize on Asymmetric Layout (1 big left, 2 stacked right)
const asymGroup = [
  { id: 'left', x: 0, y: 0, width: 100, height: 165 },
  { id: 'topRight', x: 105, y: 0, width: 100, height: 80 },
  { id: 'bottomRight', x: 105, y: 85, width: 100, height: 80 },
];
const asymInitialBounds = { x: 0, y: 0, width: 205, height: 165 };
const asymNewBounds = { x: 0, y: 0, width: 245, height: 197 };

// 13a. Test Fixed Gap Mode (2D Spatial Neighbor Graph)
const asymFixedUpdates = calculateMultiFrameResize(asymGroup, asymInitialBounds, asymNewBounds, undefined, 'fixed_gap');
const leftU = asymFixedUpdates.find((u) => u.id === 'left')!;
const topU = asymFixedUpdates.find((u) => u.id === 'topRight')!;
const bottomU = asymFixedUpdates.find((u) => u.id === 'bottomRight')!;

// Check Horizontal Gap between left and right (100 -> 120, right starts at 125 -> gap = 5mm)
const hGap = (topU.geometry.x ?? 0) - ((leftU.geometry.x ?? 0) + (leftU.geometry.width ?? 0));
console.assert(Math.abs(hGap - 5) < 0.01, `Fixed mode horizontal gap must remain 5mm, got ${hGap}mm`);

// Check Vertical Gap between topRight and bottomRight (top ends at 96, bottom starts at 101 -> gap = 5mm)
const vGap = (bottomU.geometry.y ?? 0) - ((topU.geometry.y ?? 0) + (topU.geometry.height ?? 0));
console.assert(Math.abs(vGap - 5) < 0.01, `Fixed mode vertical gap must remain 5mm, got ${vGap}mm`);

// 13b. Test Proportional Gap Mode (Visual Harmony)
const asymPropUpdates = calculateMultiFrameResize(asymGroup, asymInitialBounds, asymNewBounds, undefined, 'proportional');
const leftPropU = asymPropUpdates.find((u) => u.id === 'left')!;
const topPropU = asymPropUpdates.find((u) => u.id === 'topRight')!;
const scaleFactor = 245 / 205;
const expectedPropHGap = 5 * scaleFactor;
const propHGap = (topPropU.geometry.x ?? 0) - ((leftPropU.geometry.x ?? 0) + (leftPropU.geometry.width ?? 0));
console.assert(Math.abs(propHGap - expectedPropHGap) < 0.05, `Proportional gap must scale proportionally, got ${propHGap}mm`);

// 14. Test Copy-Paste Frame Clones with Physical Units
const testFrameToCopy: PhotoFrameElement = {
  id: 'frame-copy-src',
  type: 'photo',
  photoId: 'photo-xyz',
  filePath: 'C:/photos/pic.jpg',
  fileName: 'pic.jpg',
  x: 50,
  y: 40,
  width: 100,
  height: 80,
  rotation: 0,
  zIndex: 1,
  photoAspect: 1.25,
  cropX: 0,
  cropY: 0,
  cropScale: 1.0,
  borderEnabled: true,
  borderWidth: 1,
  borderColor: '#FFFFFF',
};

// Simulate copy and paste at target position (120, 90)
const pastedTarget = {
  ...testFrameToCopy,
  id: 'frame-pasted-1',
  x: 120,
  y: 90,
};
console.assert(pastedTarget.id !== testFrameToCopy.id, 'Pasted frame must have new ID');
console.assert(pastedTarget.x === 120 && pastedTarget.y === 90, 'Pasted frame must be positioned at target position');
console.assert(pastedTarget.width === 100 && pastedTarget.height === 80, 'Pasted frame must retain exact geometry');
console.assert(pastedTarget.photoId === 'photo-xyz', 'Pasted frame must retain photoId');

// 15. Test Granular Snapping Configurations
const testSpreadW = 600;
const testSpreadH = 300;
const testSafeArea = 10;
const testGutter = 0;
const neighborFrame: RectBounds = { x: 50, y: 50, width: 100, height: 80 };

// 15a. Disabled master switch
const disabledRes = calculateSnapping(
  { x: 1.5, y: 50, width: 100, height: 80 },
  testSpreadW,
  testSpreadH,
  testSafeArea,
  testGutter,
  [neighborFrame],
  { enabled: false, threshold: 3.0, snapToPageEdges: true, snapToPageCenters: true, snapToMargins: true, snapToFrames: true, snapToEqualGaps: true }
);
console.assert(disabledRes.snappedX === 1.5, `Disabled snapping should preserve raw X (1.5), got ${disabledRes.snappedX}`);
console.assert(disabledRes.snapLines.length === 0, 'Disabled snapping should produce 0 snap lines');

// 15b. snapToPageCenters = false
const disabledPageCenterRes = calculateSnapping(
  { x: 99, y: 50, width: 100, height: 80 }, // centerX = 149 near page center 150
  testSpreadW,
  testSpreadH,
  testSafeArea,
  testGutter,
  [],
  { enabled: true, threshold: 3.0, snapToPageEdges: true, snapToPageCenters: false, snapToMargins: true, snapToFrames: true, snapToEqualGaps: true }
);
console.assert(disabledPageCenterRes.snappedX === 99, `Disabled page centers should not snap to page center, got ${disabledPageCenterRes.snappedX}`);

// 15c. snapToMargins = false
const disabledMarginsRes = calculateSnapping(
  { x: 9.2, y: 50, width: 100, height: 80 }, // near safe area 10
  testSpreadW,
  testSpreadH,
  testSafeArea,
  testGutter,
  [],
  { enabled: true, threshold: 3.0, snapToPageEdges: true, snapToPageCenters: true, snapToMargins: false, snapToFrames: true, snapToEqualGaps: true }
);
console.assert(disabledMarginsRes.snappedX === 9.2, `Disabled safe margin snap should not snap to 10, got ${disabledMarginsRes.snappedX}`);

// 15d. snapToFrames = false
const neighborFrame70: RectBounds = { x: 70, y: 50, width: 100, height: 80 };
const disabledFramesRes = calculateSnapping(
  { x: 70.8, y: 160, width: 100, height: 80 }, // near neighbor x=70 (nowhere near page edges or centers)
  testSpreadW,
  testSpreadH,
  testSafeArea,
  testGutter,
  [neighborFrame70],
  { enabled: true, threshold: 3.0, snapToPageEdges: true, snapToPageCenters: true, snapToMargins: true, snapToFrames: false, snapToEqualGaps: true }
);
console.assert(disabledFramesRes.snappedX === 70.8, `Disabled frame snap should not snap to neighbor frame, got ${disabledFramesRes.snappedX}`);

// 15e. snapToEqualGaps = false
const leftF: RectBounds = { x: 50, y: 50, width: 100, height: 80 };
const rightF: RectBounds = { x: 270, y: 50, width: 100, height: 80 };
const betweenF: RectBounds = { x: 159.5, y: 50, width: 100, height: 80 };
const disabledGapsRes = calculateSnapping(
  betweenF,
  testSpreadW,
  testSpreadH,
  testSafeArea,
  testGutter,
  [leftF, rightF],
  { enabled: true, threshold: 3.0, snapToPageEdges: false, snapToPageCenters: false, snapToMargins: false, snapToFrames: false, snapToEqualGaps: false }
);
console.assert(disabledGapsRes.gapGuides.length === 0, 'Disabled equal gaps should produce 0 gap guides');

// 16. Test Photo Frame Replacement & 2-Frame Asset Swapping
const testFrameA: PhotoFrameElement = {
  id: 'frame-1',
  type: 'photo',
  photoId: 'photo-a',
  filePath: '/path/photo-a.jpg',
  previewPath: '/path/preview-a.jpg',
  thumbnailPath: '/path/thumb-a.jpg',
  fileName: 'photo-a.jpg',
  x: 50,
  y: 50,
  width: 120,
  height: 80,
  rotation: 0,
  zIndex: 1,
  photoAspect: 1.5,
  originalWidth: 120,
  originalHeight: 80,
  cropX: 0.2,
  cropY: -0.1,
  cropScale: 1.4,
  cropRotation: 0,
};

const testFrameB: PhotoFrameElement = {
  id: 'frame-2',
  type: 'photo',
  photoId: 'photo-b',
  filePath: '/path/photo-b.jpg',
  previewPath: '/path/preview-b.jpg',
  thumbnailPath: '/path/thumb-b.jpg',
  fileName: 'photo-b.jpg',
  x: 200,
  y: 50,
  width: 80,
  height: 120,
  rotation: 0,
  zIndex: 2,
  photoAspect: 0.67,
  originalWidth: 80,
  originalHeight: 120,
  cropX: 0,
  cropY: 0,
  cropScale: 1.0,
  cropRotation: 0,
};

// Test Replacement: replacing Frame A with Photo C
const photoC = {
  id: 'photo-c',
  filePath: '/path/photo-c.jpg',
  previewPath: '/path/preview-c.jpg',
  thumbnailPath: '/path/thumb-c.jpg',
  fileName: 'photo-c.jpg',
  width: 3000,
  height: 2000,
};

const replacedFrame = {
  ...testFrameA,
  photoId: photoC.id,
  filePath: photoC.filePath,
  previewPath: photoC.previewPath || photoC.filePath,
  thumbnailPath: photoC.thumbnailPath,
  fileName: photoC.fileName,
  photoAspect: photoC.width / photoC.height,
  cropX: 0,
  cropY: 0,
  cropScale: 1.0,
  cropRotation: 0,
};

console.assert(replacedFrame.photoId === 'photo-c', 'Replaced frame should have photo C id');
console.assert(replacedFrame.x === 50 && replacedFrame.width === 120, 'Frame geometry should be strictly preserved');
console.assert(replacedFrame.cropScale === 1.0 && replacedFrame.cropX === 0, 'Crop should be reset for new photo');

// Test Swap: Swapping Frame A and Frame B photo assets
const elements = [testFrameA, testFrameB];
const swappedElements = elements.map((f) => {
  if (f.id === 'frame-1') {
    return {
      ...f,
      photoId: testFrameB.photoId,
      filePath: testFrameB.filePath,
      previewPath: testFrameB.previewPath,
      thumbnailPath: testFrameB.thumbnailPath,
      fileName: testFrameB.fileName,
      photoAspect: testFrameB.photoAspect,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
      cropRotation: 0,
    };
  }
  if (f.id === 'frame-2') {
    return {
      ...f,
      photoId: testFrameA.photoId,
      filePath: testFrameA.filePath,
      previewPath: testFrameA.previewPath,
      thumbnailPath: testFrameA.thumbnailPath,
      fileName: testFrameA.fileName,
      photoAspect: testFrameA.photoAspect,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
      cropRotation: 0,
    };
  }
  return f;
});

console.assert(swappedElements[0].photoId === 'photo-b', 'Frame 1 should now contain photo B');
console.assert(swappedElements[0].x === 50 && swappedElements[0].width === 120, 'Frame 1 geometry preserved');
// 9. Test Group & Ungroup Mechanism
const frameG1: PhotoFrameElement = { ...testFrameA, id: 'frame-g1', groupId: undefined };
const frameG2: PhotoFrameElement = { ...testFrameB, id: 'frame-g2', groupId: undefined };
const frameG3: PhotoFrameElement = { ...testFrameA, id: 'frame-g3', groupId: undefined };

// Group G1 and G2 together
const sampleGroupId = 'group-12345';
const groupedFrames = [frameG1, frameG2, frameG3].map((f) =>
  ['frame-g1', 'frame-g2'].includes(f.id) ? { ...f, groupId: sampleGroupId } : f
);

console.assert(groupedFrames[0].groupId === sampleGroupId, 'Frame G1 should have sampleGroupId');
console.assert(groupedFrames[1].groupId === sampleGroupId, 'Frame G2 should have sampleGroupId');
console.assert(groupedFrames[2].groupId === undefined, 'Frame G3 should remain ungrouped');

// Resolve group member selection
const targetElement = groupedFrames.find((f) => f.id === 'frame-g1');
const targetGroupId = targetElement?.groupId;
const resolvedSelection = targetGroupId
  ? groupedFrames.filter((f) => f.groupId === targetGroupId).map((f) => f.id)
  : ['frame-g1'];

console.assert(resolvedSelection.length === 2, 'Selecting G1 should automatically resolve all 2 group members');
console.assert(resolvedSelection.includes('frame-g1') && resolvedSelection.includes('frame-g2'), 'Resolved selection contains G1 and G2');

// Ungroup G1 and G2
const ungroupedFrames = groupedFrames.map((f) =>
  f.groupId === sampleGroupId ? { ...f, groupId: null } : f
);
console.assert(ungroupedFrames[0].groupId === null, 'Frame G1 should now be ungrouped');
console.assert(ungroupedFrames[1].groupId === null, 'Frame G2 should now be ungrouped');

// 10. Test Shift-Key Axis Constraint (Orthogonal Straight-Line Dragging)
function applyShiftDragConstraint(
  startX: number,
  startY: number,
  dragX: number,
  dragY: number,
  isShift: boolean
): { x: number; y: number } {
  if (!isShift) return { x: dragX, y: dragY };
  const deltaX = dragX - startX;
  const deltaY = dragY - startY;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    // Lock strictly horizontal
    return { x: dragX, y: startY };
  } else {
    // Lock strictly vertical
    return { x: startX, y: dragY };
  }
}

// Dominant Horizontal movement (dx = 50mm, dy = 10mm) with Shift
const horizDrag = applyShiftDragConstraint(100, 100, 150, 110, true);
console.assert(horizDrag.x === 150 && horizDrag.y === 100, `Shift horizontal drag should keep y=100, got ${horizDrag.y}`);

// Dominant Vertical movement (dx = 5mm, dy = 80mm) with Shift
const vertDrag = applyShiftDragConstraint(100, 100, 105, 180, true);
console.assert(vertDrag.x === 100 && vertDrag.y === 180, `Shift vertical drag should keep x=100, got ${vertDrag.x}`);

// Non-shift movement (dx = 50mm, dy = 50mm)
const freeDrag = applyShiftDragConstraint(100, 100, 150, 150, false);
console.assert(freeDrag.x === 150 && freeDrag.y === 150, 'Free drag should allow diagonal movement');

// 11. Test Group-Aware Layout Operations (Set Gap Spacing, Align, Distribute as single entities)
// Group 1: 2 frames (F1 at x=10, w=50; F2 at x=70, w=50) -> total group span: x=10, width=110, internal gap=10
const frameGroupA1: PhotoFrameElement = { ...testFrameA, id: 'ga1', x: 10, y: 50, width: 50, height: 80, groupId: 'grp-A' };
const frameGroupA2: PhotoFrameElement = { ...testFrameB, id: 'ga2', x: 70, y: 50, width: 50, height: 80, groupId: 'grp-A' };
// Standalone Frame 3: at x=250, w=60
const frameStandalone3: PhotoFrameElement = { ...testFrameA, id: 's3', x: 250, y: 50, width: 60, height: 80, groupId: undefined };

// Test Clustering
const entities = clusterFramesIntoEntities([frameGroupA1, frameGroupA2, frameStandalone3]);
console.assert(entities.length === 2, `Should cluster 3 frames into 2 entities, got ${entities.length}`);
console.assert(entities[0].isGroup === true && entities[0].width === 110, 'Entity 0 should be group of width 110');
console.assert(entities[1].isGroup === false && entities[1].width === 60, 'Entity 1 should be standalone of width 60');

// Test applyFixedGap with Group and Standalone frame (gap = 20mm)
const gapUpdates = applyFixedGap([frameGroupA1, frameGroupA2, frameStandalone3], 'horizontal', 20);
const updatedX = new Map(gapUpdates.map((u) => [u.id, u.geometry.x!]));

console.assert(updatedX.get('ga1') === 10, `Frame GA1 should stay at x=10, got ${updatedX.get('ga1')}`);
console.assert(updatedX.get('ga2') === 70, `Frame GA2 should stay at x=70 (internal gap preserved), got ${updatedX.get('ga2')}`);
// Standalone frame 3 should start at 10 + 110 + 20 = 140
console.assert(updatedX.get('s3') === 140, `Standalone Frame 3 should move to x=140, got ${updatedX.get('s3')}`);

// Test alignFrames with Group and Standalone frame (align 'bottom' where standalone has height 100, group has height 80)
const frameTallStandalone: PhotoFrameElement = { ...testFrameA, id: 'sTall', x: 250, y: 20, width: 60, height: 120, groupId: undefined };
const alignUpdates = alignFrames([frameGroupA1, frameGroupA2, frameTallStandalone], 'bottom');
const updatedY = new Map(alignUpdates.map((u) => [u.id, u.geometry.y!]));

// Max Y is 20 + 120 = 140. Group (height 80) should align bottom to y = 140 - 80 = 60
console.assert(updatedY.get('ga1') === 60, `GA1 should align to y=60, got ${updatedY.get('ga1')}`);
console.assert(updatedY.get('ga2') === 60, `GA2 should align to y=60, got ${updatedY.get('ga2')}`);
console.assert(updatedY.get('sTall') === 20, `sTall should stay at y=20 (maxY=140), got ${updatedY.get('sTall')}`);

// 12. Test Single Object and Single Group Alignment to Blue Safe Margin Box
const testSafeMarginBounds: SafeMarginBounds = {
  singlePageWidth: 200, // 200mm page width
  spreadHeight: 300,    // 300mm spread height
  gutterWidth: 6,       // 6mm spine
  safeMargin: 10,       // 10mm blue safe area box
};

// 12.1 Single Standalone Frame on Left Page (x=50, y=50, w=80, h=60)
const singleLeftFrame: PhotoFrameElement = { ...testFrameA, id: 'sl1', x: 50, y: 50, width: 80, height: 60, groupId: undefined };

// Align Left -> should align to x = 10mm (Left Blue Margin)
const alignLeftRes = alignFrames([singleLeftFrame], 'left', testSafeMarginBounds);
console.assert(alignLeftRes[0].geometry.x === 10, `Single Left frame should align left to 10, got ${alignLeftRes[0].geometry.x}`);

// Align Center -> should align to x = 100 - 40 = 60mm (Center of Left Page)
const alignCenterRes = alignFrames([singleLeftFrame], 'center', testSafeMarginBounds);
console.assert(alignCenterRes[0].geometry.x === 60, `Single Left frame should align center to 60, got ${alignCenterRes[0].geometry.x}`);

// Align Right -> should align to x = 190 - 80 = 110mm (Right Blue Margin of Left Page)
const alignRightRes = alignFrames([singleLeftFrame], 'right', testSafeMarginBounds);
console.assert(alignRightRes[0].geometry.x === 110, `Single Left frame should align right to 110, got ${alignRightRes[0].geometry.x}`);

// Align Top -> should align to y = 10mm (Top Blue Margin)
const alignTopRes = alignFrames([singleLeftFrame], 'top', testSafeMarginBounds);
console.assert(alignTopRes[0].geometry.y === 10, `Single Left frame should align top to 10, got ${alignTopRes[0].geometry.y}`);

// Align Middle -> should align to y = 150 - 30 = 120mm (Middle of Page)
const alignMiddleRes = alignFrames([singleLeftFrame], 'middle', testSafeMarginBounds);
console.assert(alignMiddleRes[0].geometry.y === 120, `Single Left frame should align middle to 120, got ${alignMiddleRes[0].geometry.y}`);

// Align Bottom -> should align to y = 290 - 60 = 230mm (Bottom Blue Margin)
const alignBottomRes = alignFrames([singleLeftFrame], 'bottom', testSafeMarginBounds);
console.assert(alignBottomRes[0].geometry.y === 230, `Single Left frame should align bottom to 230, got ${alignBottomRes[0].geometry.y}`);

// 12.2 Single Group of 2 frames on Left Page (GA1 at x=20, w=40; GA2 at x=70, w=40 -> group width = 90, internal gap = 10)
const groupLeftOnly = [
  { ...testFrameA, id: 'gl1', x: 20, y: 50, width: 40, height: 60, groupId: 'grp-L' },
  { ...testFrameB, id: 'gl2', x: 70, y: 50, width: 40, height: 60, groupId: 'grp-L' },
];

// Align Group Left to Safe Margin (x = 10mm)
const groupAlignLeftRes = alignFrames(groupLeftOnly, 'left', testSafeMarginBounds);
const glUpdatedX = new Map(groupAlignLeftRes.map((u) => [u.id, u.geometry.x!]));
console.assert(glUpdatedX.get('gl1') === 10, `Group GL1 should move to x=10, got ${glUpdatedX.get('gl1')}`);
console.assert(glUpdatedX.get('gl2') === 60, `Group GL2 should move to x=60 (gap preserved), got ${glUpdatedX.get('gl2')}`);

// Align Group Right to Safe Margin (group right at 190mm -> deltaX = 190 - 90 - 20 = 80mm)
const groupAlignRightRes = alignFrames(groupLeftOnly, 'right', testSafeMarginBounds);
const grUpdatedX = new Map(groupAlignRightRes.map((u) => [u.id, u.geometry.x!]));
console.assert(grUpdatedX.get('gl1') === 100, `Group GL1 should move to x=100, got ${grUpdatedX.get('gl1')}`);
console.assert(grUpdatedX.get('gl2') === 150, `Group GL2 should move to x=150 (right edge at 190mm), got ${grUpdatedX.get('gl2')}`);

// 13. Test Safe Margin Snapping During Frame Resize (calculateResizeSnapping)
// 13.1 Drag left handle towards Left Blue Safe Margin (x = 10.8mm -> snaps to 10mm)
const resizeLeftRes = calculateResizeSnapping(
  { x: 10.8, y: 50, width: 80, height: 60 },
  406, 300, 10, 6, [], 2.0, 'mm', 'middle-left'
);
console.assert(resizeLeftRes.snappedBounds.x === 10, `Resized frame x should snap to 10, got ${resizeLeftRes.snappedBounds.x}`);
console.assert(resizeLeftRes.snappedBounds.width === 80.8, `Resized frame width should expand to 80.8, got ${resizeLeftRes.snappedBounds.width}`);
console.assert(resizeLeftRes.snapLines.some((l) => l.label === 'Safe Margin Left'), 'Should generate Safe Margin Left snap line');

// 13.2 Drag right handle towards Left Page Inner Blue Margin (x + width = 189.2mm -> snaps to 190mm)
const resizeRightRes = calculateResizeSnapping(
  { x: 20, y: 50, width: 169.2, height: 60 },
  406, 300, 10, 6, [], 2.0, 'mm', 'middle-right'
);
console.assert(resizeRightRes.snappedBounds.width === 170, `Resized frame width should snap to 170 (right edge at 190), got ${resizeRightRes.snappedBounds.width}`);
console.assert(resizeRightRes.snapLines.some((l) => l.label === 'Safe Margin Left Inner'), 'Should generate Safe Margin Left Inner snap line');

// 13.3 Drag bottom handle towards Bottom Blue Margin (y + height = 289.4mm -> snaps to 290mm)
const resizeBottomRes = calculateResizeSnapping(
  { x: 20, y: 50, width: 80, height: 239.4 },
  406, 300, 10, 6, [], 2.0, 'mm', 'bottom-center'
);
console.assert(resizeBottomRes.snappedBounds.height === 240, `Resized frame height should snap to 240 (bottom edge at 290), got ${resizeBottomRes.snappedBounds.height}`);
console.assert(resizeBottomRes.snapLines.some((l) => l.label === 'Safe Margin Bottom'), 'Should generate Safe Margin Bottom snap line');

// 14. Test Snapping Configuration Persistence (localStorage)
const initialConfig = loadSavedSnappingConfig();
console.assert(typeof initialConfig.threshold === 'number', 'Initial threshold should be a number');
console.assert(initialConfig.snapToPageEdges === true, 'Default snapToPageEdges should be true');

saveSnappingConfig({
  enabled: true,
  threshold: 1.5,
  snapToPageEdges: false,
  snapToPageCenters: true,
  snapToMargins: true,
  snapToFrames: true,
  snapToEqualGaps: false,
});

const reloadedConfig = loadSavedSnappingConfig();
console.assert(reloadedConfig.threshold === 1.5, `Reloaded threshold should be 1.5, got ${reloadedConfig.threshold}`);
console.assert(reloadedConfig.snapToPageEdges === false, 'Reloaded snapToPageEdges should be false');
console.assert(reloadedConfig.snapToEqualGaps === false, 'Reloaded snapToEqualGaps should be false');

// Reset to default for clean test teardown
saveSnappingConfig(DEFAULT_SNAPPING_CONFIG);

// 15. Test Paste in Place and Paste to All Spreads Clones
const mockFrameSrc: PhotoFrameElement = {
  id: 'frame-origin',
  type: 'photo',
  photoId: 'photo-123',
  filePath: 'C:/photos/hero.jpg',
  fileName: 'hero.jpg',
  x: 25.5,
  y: 30.0,
  width: 140.0,
  height: 95.0,
  rotation: 0,
  zIndex: 1,
  photoAspect: 140 / 95,
  borderEnabled: true,
  borderWidth: 1.5,
  borderColor: '#FFCC00',
  opacity: 0.95,
};

// Simulate Paste in Place
const pasteInPlaceClone: PhotoFrameElement = {
  ...mockFrameSrc,
  id: 'frame-clone-in-place',
  x: mockFrameSrc.x,
  y: mockFrameSrc.y,
};
console.assert(pasteInPlaceClone.id !== mockFrameSrc.id, 'Paste in place clone must have a new unique ID');
console.assert(pasteInPlaceClone.x === 25.5 && pasteInPlaceClone.y === 30.0, 'Paste in place clone must preserve exact coordinates');
console.assert(pasteInPlaceClone.width === 140.0 && pasteInPlaceClone.height === 95.0, 'Paste in place clone must preserve exact dimensions');
console.assert(pasteInPlaceClone.borderWidth === 1.5 && pasteInPlaceClone.borderColor === '#FFCC00', 'Paste in place clone must preserve border properties');

// Simulate Paste to All Spreads across 3 spreads
const mockSpreads = [
  { id: 'spread-1', elements: [] as PhotoFrameElement[] },
  { id: 'spread-2', elements: [] as PhotoFrameElement[] },
  { id: 'spread-3', elements: [] as PhotoFrameElement[] },
];

const pastedAllSpreads = mockSpreads.map((spread, sIdx) => ({
  ...spread,
  elements: [
    ...spread.elements,
    {
      ...mockFrameSrc,
      id: `frame-all-${sIdx}`,
      x: mockFrameSrc.x,
      y: mockFrameSrc.y,
      width: mockFrameSrc.width,
      height: mockFrameSrc.height,
    },
  ],
}));

console.assert(pastedAllSpreads.length === 3, 'All 3 spreads must receive the pasted frame');
const allIds = new Set(pastedAllSpreads.map((s) => s.elements[0].id));
console.assert(allIds.size === 3, 'Every spread must receive a unique frame ID');
for (const s of pastedAllSpreads) {
  const el = s.elements[0];
  console.assert(el.x === 25.5 && el.y === 30.0, 'Every spread must maintain exact physical coordinates');
  console.assert(el.width === 140.0 && el.height === 95.0, 'Every spread must maintain exact dimensions');
  console.assert(el.borderWidth === 1.5 && el.borderColor === '#FFCC00', 'Every spread must maintain exact border styling');
}

// 16. Test Adobe-Style Alt+Drag to Duplicate Clones
const originalFrame: PhotoFrameElement = {
  id: 'frame-orig-1',
  type: 'photo',
  photoId: 'photo-alt-test',
  x: 10,
  y: 15,
  width: 120,
  height: 80,
  rotation: 0,
  zIndex: 1,
  photoAspect: 1.5,
  borderEnabled: true,
  borderWidth: 2,
  borderColor: '#000000',
};

const deltaX = 50;
const deltaY = 40;
const altDragDuplicate: PhotoFrameElement = {
  ...originalFrame,
  id: 'frame-alt-duplicate-1',
  x: originalFrame.x + deltaX,
  y: originalFrame.y + deltaY,
  zIndex: 2,
};

console.assert(altDragDuplicate.id !== originalFrame.id, 'Alt+Drag duplicate must have a unique ID');
console.assert(altDragDuplicate.x === 60 && altDragDuplicate.y === 55, 'Alt+Drag duplicate must be positioned at new offset');
// 17. Test Non-Interference: Photo Replacement & Frame Swap vs Alt Duplication
// 17a. Photo Replacement
const targetFrameToReplace: PhotoFrameElement = {
  id: 'frame-target',
  type: 'photo',
  photoId: 'old-photo-id',
  filePath: 'C:/photos/old.jpg',
  fileName: 'old.jpg',
  x: 20,
  y: 30,
  width: 100,
  height: 80,
  rotation: 0,
  zIndex: 1,
  photoAspect: 1.25,
  borderEnabled: true,
  borderWidth: 1,
  borderColor: '#FFFFFF',
};

const newIncomingPhoto = {
  id: 'new-photo-id',
  filePath: 'C:/photos/new.jpg',
  fileName: 'new.jpg',
  previewPath: 'C:/photos/preview.jpg',
  thumbnailPath: 'C:/photos/thumb.jpg',
  width: 1200,
  height: 800,
};

const replacedFrame17: PhotoFrameElement = {
  ...targetFrameToReplace,
  photoId: newIncomingPhoto.id,
  filePath: newIncomingPhoto.filePath,
  fileName: newIncomingPhoto.fileName,
  photoAspect: newIncomingPhoto.width / newIncomingPhoto.height,
  cropX: 0,
  cropY: 0,
  cropScale: 1.0,
};

console.assert(replacedFrame17.photoId === 'new-photo-id', 'Replaced frame must receive new photo ID');
console.assert(replacedFrame17.x === 20 && replacedFrame17.y === 30, 'Replaced frame must remain at exact canvas position');
console.assert(replacedFrame17.photoAspect === 1.5, 'Replaced frame must update photo aspect ratio');

// 17b. Canvas Frame Swap (Frame A <-> Frame B)
const swapFrameA: PhotoFrameElement = { ...targetFrameToReplace, id: 'frame-A', photoId: 'photo-A', filePath: 'A.jpg' };
const swapFrameB: PhotoFrameElement = { ...targetFrameToReplace, id: 'frame-B', photoId: 'photo-B', filePath: 'B.jpg', x: 150 };

// 18. Test Batch Multi-Frame Rotation & Center Pivot Preservation (No Overlap & Single-Step Undo Integrity)
const multiRotateFrames: PhotoFrameElement[] = [
  { id: 'f1', type: 'photo', x: 20, y: 30, width: 100, height: 80, rotation: 0, zIndex: 1, photoAspect: 1.5, cropX: 0, cropY: 0, cropScale: 1.0, cropRotation: 0, borderEnabled: false, borderWidth: 0, borderColor: '', opacity: 1, fileName: '', filePath: '', photoId: null, previewPath: '', thumbnailPath: '' },
  { id: 'f2', type: 'photo', x: 130, y: 30, width: 100, height: 80, rotation: 0, zIndex: 2, photoAspect: 1.5, cropX: 0, cropY: 0, cropScale: 1.0, cropRotation: 0, borderEnabled: false, borderWidth: 0, borderColor: '', opacity: 1, fileName: '', filePath: '', photoId: null, previewPath: '', thumbnailPath: '' },
];

// 18a. Rotate 90° Clockwise with Center Pivot Preservation
const rotatedCW = multiRotateFrames.map((f) => {
  const geo = calculateCenterRotatedPosition(f, (f.rotation + 90) % 360);
  return { ...f, ...geo };
});
console.assert(rotatedCW[0].rotation === 90, `f1 should rotate to 90°, got ${rotatedCW[0].rotation}`);
console.assert(rotatedCW[1].rotation === 90, `f2 should rotate to 90°, got ${rotatedCW[1].rotation}`);
console.assert(rotatedCW[0].x === 110 && rotatedCW[0].y === 20, `f1 should shift top-left to (110, 20) to keep center at (70, 70), got (${rotatedCW[0].x}, ${rotatedCW[0].y})`);
console.assert(rotatedCW[1].x === 220 && rotatedCW[1].y === 20, `f2 should shift top-left to (220, 20) to keep center at (180, 70), got (${rotatedCW[1].x}, ${rotatedCW[1].y})`);

// 18b. Verify Center Invariance: Visual center of rotated frame stays identical to original
const origCenter1X = multiRotateFrames[0].x + multiRotateFrames[0].width / 2; // 70
const origCenter1Y = multiRotateFrames[0].y + multiRotateFrames[0].height / 2; // 70
const radCW = (rotatedCW[0].rotation * Math.PI) / 180;
const newCenter1X = rotatedCW[0].x + (rotatedCW[0].width / 2) * Math.cos(radCW) - (rotatedCW[0].height / 2) * Math.sin(radCW);
const newCenter1Y = rotatedCW[0].y + (rotatedCW[0].width / 2) * Math.sin(radCW) + (rotatedCW[0].height / 2) * Math.cos(radCW);
console.assert(Math.abs(origCenter1X - newCenter1X) < 0.01, `Center X must remain unchanged: orig ${origCenter1X} vs new ${newCenter1X}`);
console.assert(Math.abs(origCenter1Y - newCenter1Y) < 0.01, `Center Y must remain unchanged: orig ${origCenter1Y} vs new ${newCenter1Y}`);

// 18c. Absolute Angle Reset to 0° with Center Invariance
const resetRot = rotatedCW.map((f) => {
  const geo = calculateCenterRotatedPosition(f, 0);
  return { ...f, ...geo };
});
console.assert(resetRot[0].rotation === 0 && resetRot[0].x === 20 && resetRot[0].y === 30, 'Reset rotation must return exactly to initial position (20, 30)');
console.assert(resetRot[1].rotation === 0 && resetRot[1].x === 130 && resetRot[1].y === 30, 'Reset rotation must return exactly to initial position (130, 30)');

// 18d. Batch Reset Aspect Ratio
const resetRatioFrames = multiRotateFrames.map((f) => {
  const newHeight = Math.round((f.width / (f.photoAspect || 1.5)) * 10) / 10;
  return { ...f, height: newHeight, cropX: 0, cropY: 0, cropScale: 1.0 };
});
console.assert(Math.abs(resetRatioFrames[0].height - 66.7) < 0.1, `f1 height should reset to 66.7, got ${resetRatioFrames[0].height}`);
console.assert(Math.abs(resetRatioFrames[1].height - 66.7) < 0.1, `f2 height should reset to 66.7, got ${resetRatioFrames[1].height}`);

// 18e. Multi-Frame Resize with Rotated Frames
const framesToResize = rotatedCW.map((f) => ({
  id: f.id,
  x: f.x,
  y: f.y,
  width: f.width,
  height: f.height,
  rotation: f.rotation,
}));
const initGroupBounds: RectBounds = { x: 30, y: 20, width: 190, height: 100 };
const newGroupBounds: RectBounds = { x: 30, y: 20, width: 380, height: 200 }; // 2x scale
const resizedRotatedFrames = calculateMultiFrameResize(framesToResize, initGroupBounds, newGroupBounds, 'bottom-right', 'proportional');

console.assert(resizedRotatedFrames.length === 2, 'Must return 2 resized frames');
console.assert(resizedRotatedFrames[0].geometry.width === 200, `f1 width should be 200, got ${resizedRotatedFrames[0].geometry.width}`);
console.assert(resizedRotatedFrames[0].geometry.height === 160, `f1 height should be 160, got ${resizedRotatedFrames[0].geometry.height}`);
console.assert(resizedRotatedFrames[0].geometry.x === 190, `f1 x should be 190, got ${resizedRotatedFrames[0].geometry.x}`);
console.assert(resizedRotatedFrames[0].geometry.y === 20, `f1 y should be 20, got ${resizedRotatedFrames[0].geometry.y}`);

// 18f. Multi-Frame Group Rotated Bounding Box
const groupBounds0 = computeMultiFrameGroupBounds(multiRotateFrames);
console.assert(groupBounds0.x === 20 && groupBounds0.y === 30 && groupBounds0.width === 210 && groupBounds0.height === 80 && groupBounds0.rotation === 0, 'Unrotated group bounds must match (20, 30, 210, 80, rot 0)');

const groupBounds90 = computeMultiFrameGroupBounds(rotatedCW);
console.assert(groupBounds90.rotation === 90, `Rotated group must inherit 90° rotation, got ${groupBounds90.rotation}`);
console.assert(groupBounds90.x === 220, `Rotated group x must be 220, got ${groupBounds90.x}`);
console.assert(groupBounds90.y === 20, `Rotated group y must be 20, got ${groupBounds90.y}`);
console.assert(groupBounds90.width === 100, `Rotated group width must be 100, got ${groupBounds90.width}`);
console.assert(groupBounds90.height === 190, `Rotated group height must be 190, got ${groupBounds90.height}`);

// 18g. Multi-Frame Group Info & Unprojection
const groupInfo90 = computeMultiFrameGroupInfo(rotatedCW);
console.assert(groupInfo90.groupRotation === 90, `Group rotation must be 90, got ${groupInfo90.groupRotation}`);
console.assert(groupInfo90.childLocalFrames.length === 2, 'Must have 2 local children');
const child1 = groupInfo90.childLocalFrames[0];
const unprojectedChild1 = unprojectGroupChildToWorld(
  groupInfo90.groupX,
  groupInfo90.groupY,
  groupInfo90.groupRotation,
  child1.localX,
  child1.localY,
  child1.localRotation
);
console.assert(Math.abs(unprojectedChild1.x - rotatedCW[0].x) < 0.1, `Unprojected child 1 x must match ${rotatedCW[0].x}, got ${unprojectedChild1.x}`);
console.assert(Math.abs(unprojectedChild1.y - rotatedCW[0].y) < 0.1, `Unprojected child 1 y must match ${rotatedCW[0].y}, got ${unprojectedChild1.y}`);
console.assert(unprojectedChild1.rotation === 90, `Unprojected child 1 rotation must be 90, got ${unprojectedChild1.rotation}`);

console.log('✓ All Editor domain, Multiple Selection, Batch Alignment, Granular Snapping, Group/Ungroup, Group-Aware Layout Spacing, Safe Margin Alignment, Resize Safe Margin Snapping, Shift Orthogonal Drag, Copy-Paste, Paste in Place, Paste to All Spreads, Alt+Drag Duplicate, Photo Replacement, Photo Swap, Multi-Frame Batch Rotation, Rotated Multi-Frame Resize, Rotated Group Bounding Box, Multi-Frame Group Info, and Snapping Config Persistence tests passed successfully!');
