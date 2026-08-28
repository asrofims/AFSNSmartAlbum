import {
  calculateCoverDimensions,
  calculateImageOffset,
  calculateSnapping,
  clampCropTransform,
  getCenteredCrop,
  getCoverImageSize,
  moveCropBy,
  PhotoFrameElement,
  RectBounds,
  resizeCropFromHandle,
  zoomCropAtPoint,
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

console.log('✓ All Editor domain and Smart Snapping unit tests passed successfully!');
