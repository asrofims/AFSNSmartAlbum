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

// 10. Test Apply Fixed Gap Math
const fixedGapUpdates = applyFixedGap([dFrame1, dFrame2, dFrame3], 'horizontal', 10);
console.assert(fixedGapUpdates[0].geometry.x === 0, 'First frame stays at x=0');
console.assert(fixedGapUpdates[1].geometry.x === 110, `Second frame positioned at x=110, got ${fixedGapUpdates[1].geometry.x}`);
console.assert(fixedGapUpdates[2].geometry.x === 220, `Third frame positioned at x=220, got ${fixedGapUpdates[2].geometry.x}`);

// 11. Test Match Dimensions Math
const matchW = matchFrameDimensions([frame1, frame2, frame3], 'width');
console.assert(matchW.every((u) => u.geometry.width === 100), 'All frames should match width of first frame (100mm)');

console.log('✓ All Editor domain, Multiple Selection, Batch Alignment, and Snapping tests passed successfully!');
