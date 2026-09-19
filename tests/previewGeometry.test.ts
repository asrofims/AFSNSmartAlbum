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

// Spine fold must seamlessly meet with 1px overlap (no white divider gap)
assert.ok((f2.renderX + f2.renderW) >= f5.renderX, 'Spine seam must be completely closed');

console.log('✓ Preview spread, export preview, safe bounds, gap, and spine projection passed.');

