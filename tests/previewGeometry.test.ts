import assert from 'node:assert/strict';
import { calculatePreviewProjection, projectPreviewRect, alignPreviewElementBounds } from '../src/domain/previewGeometry';
import { getProjectDimensionsInCanvasUnit } from '../src/domain/templates';
import type { Project } from '../src/domain/project';
import type { Spread } from '../src/domain/album';

const project = {
  canvasWidth: 200, canvasHeight: 200, canvasUnit: 'mm', canvasDpi: 300,
  marginValue: 10, marginUnit: 'mm', spacingValue: 5, spacingUnit: 'mm',
} as Project;
const legacySpread = { gutterWidth: 8, safeArea: 10 } as Spread;
const dims = getProjectDimensionsInCanvasUnit(project, legacySpread);
assert.equal(dims.gutterWidth, 0);

const frames = [
  { x: 10, y: 20, width: 87.5, height: 80 },
  { x: 102.5, y: 20, width: 87.5, height: 80 },
];
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `Expected ${expected}, got ${actual}`);

for (const [boxWidth, boxHeight, bleed] of [[136, 54, 0], [550, 330, 3]]) {
  const projection = calculatePreviewProjection(dims.pageWidth, dims.pageHeight,
    dims.gutterWidth, boxWidth!, boxHeight!, 'spread', bleed!);
  const [left, right] = frames.map((frame) => projectPreviewRect(frame, projection));
  close(projection.width, (dims.pageWidth * 2 + bleed! * 2) * projection.scale);
  close(projection.spineX, (dims.pageWidth + bleed!) * projection.scale);
  close(right!.x - (left!.x + left!.width), 5 * projection.scale);
  close(left!.x - projection.bleedPx, 10 * projection.scale);
  close(projection.spineX - (right!.x + right!.width), 10 * projection.scale);
}

const leftPage = calculatePreviewProjection(200, 200, 0, 550, 330, 'left-page', 3);
close(leftPage.width, (200 + 3) * leftPage.scale);
close(leftPage.bleedLeftPx, 3 * leftPage.scale);
close(leftPage.bleedRightPx, 0);
close(projectPreviewRect({ x: 0, y: 0, width: 200, height: 200 }, leftPage).x, leftPage.bleedLeftPx);
close(projectPreviewRect({ x: 0, y: 0, width: 200, height: 200 }, leftPage).x + 200 * leftPage.scale, leftPage.width);

const rightPage = calculatePreviewProjection(200, 200, 0, 550, 330, 'right-page', 3);
close(rightPage.width, (200 + 3) * rightPage.scale);
close(rightPage.bleedLeftPx, 0);
close(rightPage.bleedRightPx, 3 * rightPage.scale);
close(projectPreviewRect({ x: 200, y: 0, width: 50, height: 50 }, rightPage).x, 0);
const rightSafeArea = projectPreviewRect({ x: 208, y: 10, width: 180, height: 180 }, rightPage);
close(rightSafeArea.x, 8 * rightPage.scale);
close(rightPage.width - rightPage.bleedPx - (rightSafeArea.x + rightSafeArea.width), 12 * rightPage.scale);

// Test alignPreviewElementBounds for 2D topological gap uniformity across rows and columns
const testProjection = calculatePreviewProjection(1080, 1350, 0, 550, 330, 'spread', 0);
const gridElements = [
  { id: 'f1', x: 0.0, y: 0.0, width: 537.5, height: 672.5 },
  { id: 'f2', x: 542.5, y: 0.0, width: 537.5, height: 672.5 },
  { id: 'f3', x: 0.0, y: 677.5, width: 537.5, height: 672.5 },
  { id: 'f4', x: 542.5, y: 677.5, width: 537.5, height: 672.5 },
  { id: 'f5', x: 1080.0, y: 0.0, width: 1080.0, height: 672.5 },
  { id: 'f6', x: 1080.0, y: 677.5, width: 1080.0, height: 672.5 },
];

const aligned = alignPreviewElementBounds({
  elements: gridElements,
  projection: testProjection,
  singlePageW: 1080,
  singlePageH: 1350,
  gutterW: 0,
  spacing: 5.0,
  viewMode: 'spread',
  includeBleed: false,
});

const byId = new Map(aligned.map((a) => [a.element.id, a]));
const f1 = byId.get('f1')!;
const f2 = byId.get('f2')!;
const f3 = byId.get('f3')!;
const f4 = byId.get('f4')!;
const f5 = byId.get('f5')!;

const gapXTop = f2.renderX - (f1.renderX + f1.renderW);
const gapXBot = f4.renderX - (f3.renderX + f3.renderW);
const gapYLeft = f3.renderY - (f1.renderY + f1.renderH);
const gapYRight = f4.renderY - (f2.renderY + f2.renderH);

// Must have 100% equal pixel width in both horizontal and vertical directions
const targetGapPx = Math.max(1, Math.round(5.0 * testProjection.scale));
assert.ok(Math.abs(gapXTop - targetGapPx) < 1e-6, `gapXTop ${gapXTop} should match targetGapPx ${targetGapPx}`);
assert.ok(Math.abs(gapXBot - targetGapPx) < 1e-6, `gapXBot ${gapXBot} should match targetGapPx ${targetGapPx}`);
assert.ok(Math.abs(gapYLeft - targetGapPx) < 1e-6, `gapYLeft ${gapYLeft} should match targetGapPx ${targetGapPx}`);
assert.ok(Math.abs(gapYRight - targetGapPx) < 1e-6, `gapYRight ${gapYRight} should match targetGapPx ${targetGapPx}`);
assert.equal(gapXTop, gapYLeft, 'Horizontal and vertical gaps must be identical!');

// All coordinates and sizes must be pure integers (no subpixel fractions)
for (const a of aligned) {
  assert.equal(Number.isInteger(a.renderX), true, `renderX ${a.renderX} must be an integer`);
  assert.equal(Number.isInteger(a.renderY), true, `renderY ${a.renderY} must be an integer`);
  assert.equal(Number.isInteger(a.renderW), true, `renderW ${a.renderW} must be an integer`);
  assert.equal(Number.isInteger(a.renderH), true, `renderH ${a.renderH} must be an integer`);
}

// Spine fold must seamlessly meet with 1px overlap (no white divider gap)
assert.ok((f2.renderX + f2.renderW) >= f5.renderX, 'Spine seam must be completely closed');

// Test 6-photo asymmetrical collage matching live user spread (Columns: [f1,f3], [f2,f4], [f5], [f6])
const liveElements = [
  { id: 'l1', x: 0.0, y: 0.0, width: 320.0, height: 672.5 },
  { id: 'l3', x: 0.0, y: 677.5, width: 320.0, height: 672.5 },
  { id: 'l2', x: 325.0, y: 0.0, width: 320.0, height: 672.5 },
  { id: 'l4', x: 325.0, y: 677.5, width: 320.0, height: 672.5 },
  { id: 'l5', x: 650.0, y: 0.0, width: 430.0, height: 1350.0 },
  { id: 'l6', x: 1080.0, y: 0.0, width: 1080.0, height: 1350.0 },
];

const liveAligned = alignPreviewElementBounds({
  elements: liveElements,
  projection: testProjection,
  singlePageW: 1080,
  singlePageH: 1350,
  gutterW: 0,
  spacing: 5.0,
  viewMode: 'spread',
  includeBleed: false,
});

const liveById = new Map(liveAligned.map((a) => [a.element.id, a]));
const l1 = liveById.get('l1')!;
const l2 = liveById.get('l2')!;
const l3 = liveById.get('l3')!;
const l4 = liveById.get('l4')!;
const l5 = liveById.get('l5')!;
const l6 = liveById.get('l6')!;

// Vertical column gaps:
const gapCol1_2 = l2.renderX - (l1.renderX + l1.renderW);
const gapCol2_5 = l5.renderX - (l2.renderX + l2.renderW);
const gapCol1_2Bot = l4.renderX - (l3.renderX + l3.renderW);
const gapCol2_5Bot = l5.renderX - (l4.renderX + l4.renderW);

// Horizontal row gaps:
const gapRow1_3 = l3.renderY - (l1.renderY + l1.renderH);
const gapRow2_4 = l4.renderY - (l2.renderY + l2.renderH);

assert.equal(gapCol1_2, targetGapPx, 'gap Col 1->2 must be exactly targetGapPx');
assert.equal(gapCol2_5, targetGapPx, 'gap Col 2->5 must be exactly targetGapPx');
assert.equal(gapCol1_2Bot, targetGapPx, 'gap Col 1->2 (bottom) must be exactly targetGapPx');
assert.equal(gapCol2_5Bot, targetGapPx, 'gap Col 2->5 (bottom) must be exactly targetGapPx');
assert.equal(gapRow1_3, targetGapPx, 'gap Row 1->3 must be exactly targetGapPx');
assert.equal(gapRow2_4, targetGapPx, 'gap Row 2->4 must be exactly targetGapPx');

// Center spine must be completely closed (overlap by 1px)
assert.ok((l5.renderX + l5.renderW) >= l6.renderX, 'Center spine between l5 and l6 must have 0 gap');

// Windows commonly runs the WebView at 125% display scaling. A CSS-integer gap
// becomes 1.25 device pixels there and rasterizes inconsistently as one or two
// visible pixels. Both preview sizes must instead align to the device-pixel grid.
const windowsPixelRatio = 1.25;
const previewCases = [
  calculatePreviewProjection(1080, 1350, 0, 550, 330, 'spread', 0),
  calculatePreviewProjection(1080, 1350, 0, 136, 54, 'spread', 0),
];

for (const deviceProjection of previewCases) {
  const deviceAligned = alignPreviewElementBounds({
    elements: liveElements,
    projection: deviceProjection,
    singlePageW: 1080,
    singlePageH: 1350,
    gutterW: 0,
    spacing: 5.0,
    viewMode: 'spread',
    includeBleed: false,
    pixelRatio: windowsPixelRatio,
  });
  const deviceById = new Map(deviceAligned.map((a) => [a.element.id, a]));
  const d1 = deviceById.get('l1')!;
  const d2 = deviceById.get('l2')!;
  const d3 = deviceById.get('l3')!;
  const d4 = deviceById.get('l4')!;
  const d5 = deviceById.get('l5')!;
  const expectedDeviceGap = Math.max(
    1,
    Math.round(5 * deviceProjection.scale * windowsPixelRatio),
  );

  const horizontalDeviceGaps = [
    (d2.renderX - (d1.renderX + d1.renderW)) * windowsPixelRatio,
    (d5.renderX - (d2.renderX + d2.renderW)) * windowsPixelRatio,
    (d4.renderX - (d3.renderX + d3.renderW)) * windowsPixelRatio,
    (d5.renderX - (d4.renderX + d4.renderW)) * windowsPixelRatio,
  ];
  const verticalDeviceGaps = [
    (d3.renderY - (d1.renderY + d1.renderH)) * windowsPixelRatio,
    (d4.renderY - (d2.renderY + d2.renderH)) * windowsPixelRatio,
  ];

  for (const gap of [...horizontalDeviceGaps, ...verticalDeviceGaps]) {
    assert.ok(Math.abs(gap - expectedDeviceGap) < 1e-6,
      `Device-pixel gap ${gap} should equal ${expectedDeviceGap}`);
  }

  for (const alignedElement of deviceAligned) {
    for (const value of [
      alignedElement.renderX,
      alignedElement.renderY,
      alignedElement.renderW,
      alignedElement.renderH,
    ]) {
      assert.ok(Math.abs(value * windowsPixelRatio - Math.round(value * windowsPixelRatio)) < 1e-6,
        `Preview bound ${value} must align to the 125% device-pixel grid`);
    }
  }
}

console.log('✓ Preview spread, export preview, safe bounds, gap, and spine projection passed.');

