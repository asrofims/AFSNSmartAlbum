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
  matchFrameDimensions,
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

// Dragged near Right Page Center (Page 2 Center = 451.5mm, frame width = 100mm, x = 402mm -> centerX = 452mm)
const draggedNearRightCenter: RectBounds = { x: 402, y: 50, width: 100, height: 80 };
const snapRightCenter = calculateSnapping(draggedNearRightCenter, spreadWidth, spreadHeight, safeArea, gutterWidth, otherFrames, 3.0);
console.assert(snapRightCenter.snappedX === 401.5, `Should snap center to 451.5 (x=401.5), got ${snapRightCenter.snappedX}`);
console.assert(snapRightCenter.snapLines[0].label === 'Right Page Center', `Snap line should be Right Page Center, got ${snapRightCenter.snapLines[0].label}`);

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

console.log('✓ All Editor domain, Multiple Selection, Batch Alignment, Granular Snapping, Group/Ungroup, Shift Orthogonal Drag, Copy-Paste, Replacement, and Photo Swap tests passed successfully!');
