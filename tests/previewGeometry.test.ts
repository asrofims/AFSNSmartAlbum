import assert from 'node:assert/strict';
import { calculatePreviewProjection, projectPreviewRect } from '../src/domain/previewGeometry';
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

console.log('✓ Preview spread, export preview, safe bounds, gap, and spine projection passed.');
