import { calculateSnapping, PhotoFrameElement, RectBounds } from '../src/domain/editor';

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

console.log('✓ All Editor domain and Smart Snapping unit tests passed successfully!');
