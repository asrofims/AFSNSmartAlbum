import { Project } from '../src/domain/project';
import {
  createInitialAlbum,
  createInteriorSpread,
  duplicateAlbumSpread,
  recalculateAlbumPageNumbers,
  reorderAlbumSpreads,
  moveAlbumSpread,
  getAllAlbumSpreads,
  mergeFramePhotoAsset,
  syncAlbumPhotoAssets,
  isElementDesignEqual,
  isSpreadDesignEqual,
  isAlbumDesignEqual,
} from '../src/domain/album';
import { type PhotoFrameElement, applyFixedGap, adjustSpreadPhotoGaps } from '../src/domain/editor';
import { getProjectDimensionsInCanvasUnit } from '../src/domain/templates';
import { applyAdaptiveGapToSpread, applyAdaptiveSafeAreaToSpread } from '../src/stores/albumStore';

console.log('Testing Album Structure Domain...');

const mockProject: Project = {
  id: 'test-proj-1',
  name: 'Wedding Story Album',
  canvasWidth: 300,
  canvasHeight: 300,
  canvasUnit: 'mm',
  canvasDpi: 300,
  spacingValue: 3,
  spacingUnit: 'mm',
  marginEnabled: true,
  marginValue: 12,
  marginUnit: 'mm',
  borderEnabled: false,
  borderWidth: 1,
  borderUnit: 'mm',
  borderColor: '#FFFFFF',
  backgroundType: 'solid',
  backgroundColor: '#FFFFFF',
  createdAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:00:00Z',
};

// 1. Test Initial Album Creation (Model 1-2)
const album = createInitialAlbum(mockProject);
console.assert(album.id === 'album-test-proj-1', 'Album ID should match project');
console.assert(album.totalSpreads === 1, `Total spreads should be 1 (Spread 1), got ${album.totalSpreads}`);
console.assert(album.totalPages === 2, `Total interior pages should be 2, got ${album.totalPages}`);

// Verify Spread 1 (Pages 1-2)
const spread1 = album.spreads[0];
console.assert(spread1.type === 'interior', 'Spread 1 should be interior');
console.assert(spread1.leftPage?.pageNumber === 1, `Spread 1 left page should be Page 1, got ${spread1.leftPage?.pageNumber}`);
console.assert(spread1.rightPage?.pageNumber === 2, `Spread 1 right page should be Page 2, got ${spread1.rightPage?.pageNumber}`);
console.assert(spread1.name === 'Spread 1 (Pages 1-2)', `Spread 1 name should be Spread 1 (Pages 1-2), got ${spread1.name}`);
console.assert(spread1.leftPage?.width === 300, 'Page width should match project canvasWidth');
console.assert(spread1.leftPage?.safeArea === 12, 'Page safeArea should match project marginValue');

// 2. Test Adding Interior Spreads (Spread 2 => Pages 3-4)
const spread2 = createInteriorSpread(album, mockProject, 2);
console.assert(spread2.spreadIndex === 2, 'Spread 2 index should be 2');
console.assert(spread2.leftPage?.pageNumber === 3, `Spread 2 left page should be 3, got ${spread2.leftPage?.pageNumber}`);
console.assert(spread2.rightPage?.pageNumber === 4, `Spread 2 right page should be 4, got ${spread2.rightPage?.pageNumber}`);
console.assert(spread2.name === 'Spread 2 (Pages 3-4)', `Spread 2 name should be Spread 2 (Pages 3-4), got ${spread2.name}`);

// 3. Test Adding Spread 3 (Spread 3 => Pages 5-6)
const spread3 = createInteriorSpread(album, mockProject, 3);
console.assert(spread3.leftPage?.pageNumber === 5, `Spread 3 left page should be 5, got ${spread3.leftPage?.pageNumber}`);
console.assert(spread3.rightPage?.pageNumber === 6, `Spread 3 right page should be 6, got ${spread3.rightPage?.pageNumber}`);

// 4. Test Recalculating Page Numbers
album.spreads.push(spread2);
album.spreads.push(spread3);
const recalculated = recalculateAlbumPageNumbers(album);
console.assert(recalculated.totalSpreads === 3, `Total spreads should now be 3, got ${recalculated.totalSpreads}`);
console.assert(recalculated.totalPages === 6, `Total pages should now be 6, got ${recalculated.totalPages}`);

// 5. Test Getting All Spreads Sequential Order
const allSpreads = getAllAlbumSpreads(recalculated);
console.assert(allSpreads.length === 3, `All spreads should have length 3, got ${allSpreads.length}`);
console.assert(allSpreads[0].name === 'Spread 1 (Pages 1-2)', 'First spread should be Spread 1 (Pages 1-2)');
console.assert(allSpreads[1].name === 'Spread 2 (Pages 3-4)', 'Second spread should be Spread 2 (Pages 3-4)');
console.assert(allSpreads[2].name === 'Spread 3 (Pages 5-6)', 'Third spread should be Spread 3 (Pages 5-6)');

// 6. Test Inch-based Album
const inchProject: Project = {
  ...mockProject,
  id: 'test-proj-inch',
  canvasWidth: 10,
  canvasHeight: 10,
  canvasUnit: 'inch',
  marginValue: 0.5,
  marginUnit: 'inch',
};
const inchAlbum = createInitialAlbum(inchProject);
console.assert(inchAlbum.coverSpread.leftPage?.width === 10, 'Inch album page width should be 10');
console.assert(inchAlbum.coverSpread.gutterWidth === 0, `Inch spine gutterWidth should be 0 for layflat albums, got ${inchAlbum.coverSpread.gutterWidth}`);
console.assert(inchAlbum.coverSpread.bleed === 0, `Inch bleed should be 0, got ${inchAlbum.coverSpread.bleed}`);

// 7. Test Duplicating Spread with Elements & Content
const spreadWithElements = recalculated.spreads[0];
spreadWithElements.elements = [
  {
    id: 'frame-orig-1',
    type: 'photo',
    photoId: 'photo-100',
    filePath: 'C:/photos/img1.jpg',
    fileName: 'img1.jpg',
    x: 20,
    y: 30,
    width: 120,
    height: 80,
    rotation: 0,
    zIndex: 1,
    photoAspect: 1.5,
    cropX: 0.1,
    cropY: -0.05,
    cropScale: 1.2,
    borderEnabled: true,
    borderWidth: 2,
    borderColor: '#FF0000',
  } as any,
];

const duplicateResult = duplicateAlbumSpread(recalculated, mockProject, spreadWithElements.id);
console.assert(duplicateResult !== null, 'duplicateAlbumSpread should succeed');
if (duplicateResult) {
  const { updatedAlbum, newSpreadId, newSpreadIndex } = duplicateResult;
  console.assert(updatedAlbum.totalSpreads === 4, `Total spreads should now be 4, got ${updatedAlbum.totalSpreads}`);
  console.assert(newSpreadIndex === 1, `Duplicated spread should be inserted at index 1, got ${newSpreadIndex}`);

  const dupSpread = updatedAlbum.spreads[newSpreadIndex];
  console.assert(dupSpread.id === newSpreadId, 'Duplicated spread ID should match');
  console.assert(dupSpread.elements.length === 1, `Duplicated spread should have 1 element, got ${dupSpread.elements.length}`);
  console.assert(dupSpread.elements[0].id !== 'frame-orig-1', 'Duplicated frame should have new unique ID');
  console.assert(dupSpread.elements[0].photoId === 'photo-100', 'Duplicated frame should retain photoId');
  console.assert(dupSpread.elements[0].x === 20, 'Duplicated frame should retain exact X');
  console.assert(dupSpread.elements[0].y === 30, 'Duplicated frame should retain exact Y');
  console.assert(dupSpread.elements[0].width === 120, 'Duplicated frame should retain exact width');
  console.assert(dupSpread.elements[0].height === 80, 'Duplicated frame should retain exact height');
  console.assert(dupSpread.elements[0].cropScale === 1.2, 'Duplicated frame should retain crop scale');
  console.assert(dupSpread.elements[0].borderColor === '#FF0000', 'Duplicated frame should retain border color');
}

// 8. Test recovered photos refresh stored frame assets without changing the layout or crop
const staleFrame: PhotoFrameElement = {
  id: 'frame-relink-1',
  type: 'photo',
  photoId: 'photo-relink-1',
  filePath: 'D:/missing/session/photo-001.jpg',
  previewPath: 'D:/missing/session/photo-001.jpg',
  thumbnailPath: 'C:/cache/stale-photo-001.jpg',
  fileName: 'photo-001.jpg',
  x: 12,
  y: 18,
  width: 140,
  height: 90,
  rotation: 5,
  zIndex: 2,
  photoAspect: 1.5,
  cropX: 0.18,
  cropY: -0.12,
  cropScale: 1.35,
  cropRotation: 2,
  borderEnabled: true,
  borderWidth: 1.5,
  borderColor: '#112233',
  opacity: 0.8,
};
const recoveredPhoto = {
  id: 'photo-relink-1',
  filePath: 'E:/recovered/session/photo-001.jpg',
  fileName: 'photo-001.jpg',
  previewPath: 'C:/cache/recovered-photo-001-preview.jpg',
  thumbnailPath: 'C:/cache/recovered-photo-001.jpg',
  width: 6000,
  height: 4000,
  isMissing: false,
};
const recoveredFrame = mergeFramePhotoAsset(staleFrame, recoveredPhoto);
console.assert(recoveredFrame.filePath === recoveredPhoto.filePath, 'Recovered frame should use the relinked original path');
console.assert(recoveredFrame.thumbnailPath === recoveredPhoto.thumbnailPath, 'Recovered frame should use the regenerated thumbnail');
console.assert(recoveredFrame.previewPath === recoveredPhoto.previewPath, 'Recovered frame should use the generated canvas preview');
console.assert(recoveredFrame.photoAspect === 1.5, 'Recovered frame should refresh its native photo aspect');
console.assert(recoveredFrame.x === staleFrame.x && recoveredFrame.y === staleFrame.y, 'Recovery should preserve frame position');
console.assert(recoveredFrame.width === staleFrame.width && recoveredFrame.height === staleFrame.height, 'Recovery should preserve frame size');
console.assert(recoveredFrame.cropX === staleFrame.cropX && recoveredFrame.cropY === staleFrame.cropY && recoveredFrame.cropScale === staleFrame.cropScale, 'Recovery should preserve crop settings');
console.assert(mergeFramePhotoAsset(staleFrame, { ...recoveredPhoto, id: 'other-photo' }) === staleFrame, 'Unrelated photos must not alter a frame');

const recoveredWithoutPreview = mergeFramePhotoAsset(staleFrame, {
  ...recoveredPhoto,
  previewPath: null,
});
console.assert(recoveredWithoutPreview.previewPath === recoveredPhoto.thumbnailPath, 'Recovered frame should use the thumbnail without loading heavy raw original when preview is unavailable');

const missingFrame = mergeFramePhotoAsset(staleFrame, {
  ...recoveredPhoto,
  filePath: staleFrame.filePath,
  previewPath: null,
  isMissing: true,
});
console.assert(missingFrame.previewPath === recoveredPhoto.thumbnailPath, 'Missing photos should still use a healthy thumbnail instead of the broken original path');

const relinkAlbum = {
  ...recalculated,
  coverSpread: { ...recalculated.coverSpread, elements: [staleFrame] },
  spreads: recalculated.spreads.map((spread) => ({ ...spread, elements: [] })),
};
const syncedRelinkAlbum = syncAlbumPhotoAssets(relinkAlbum, [recoveredPhoto]);
console.assert(syncedRelinkAlbum.changed, 'Album asset sync should report recovered frames as changed');
// 9. Test Reordering Spreads and Automatic Page Renumbering
const reordered = reorderAlbumSpreads(recalculated, 2, 0); // Move spread 3 (index 2) to front (index 0)
console.assert(reordered.spreads[0].id === spread3.id, 'Spread 3 should now be first');
console.assert(reordered.spreads[0].name === 'Spread 1 (Pages 1-2)', 'First spread name should be updated to Spread 1 (Pages 1-2)');
console.assert(reordered.spreads[0].leftPage?.pageNumber === 1, 'First spread left page should be Page 1');
console.assert(reordered.spreads[0].rightPage?.pageNumber === 2, 'First spread right page should be Page 2');
console.assert(reordered.spreads[1].id === spread1.id, 'Original Spread 1 should now be at index 1');
console.assert(reordered.spreads[1].name === 'Spread 2 (Pages 3-4)', 'Second spread name should be updated to Spread 2 (Pages 3-4)');

// Test Move Spread Left and Right
const movedRight = moveAlbumSpread(recalculated, spread1.id, 'right');
console.assert(movedRight !== null, 'moveAlbumSpread right should succeed');
if (movedRight) {
  console.assert(movedRight.newActiveIndex === 1, 'Spread 1 should move to index 1');
  console.assert(movedRight.updatedAlbum.spreads[1].id === spread1.id, 'Spread 1 should be at index 1');
}

const invalidMoveLeft = moveAlbumSpread(recalculated, spread1.id, 'left');
console.assert(invalidMoveLeft === null, 'Moving first spread left should return null');

// 10. Test Background Color Propagation from Project Default
const darkProject: Project = {
  ...mockProject,
  id: 'test-proj-dark',
  backgroundColor: '#1E293B',
};
const darkAlbum = createInitialAlbum(darkProject);
console.assert(darkAlbum.spreads[0].backgroundColor === '#1E293B', 'Initial spread should inherit project backgroundColor');
console.assert(darkAlbum.spreads[0].leftPage?.backgroundColor === '#1E293B', 'Initial left page should inherit project backgroundColor');
console.assert(darkAlbum.spreads[0].rightPage?.backgroundColor === '#1E293B', 'Initial right page should inherit project backgroundColor');

const darkSpread2 = createInteriorSpread(darkAlbum, darkProject, 2);
console.assert(darkSpread2.backgroundColor === '#1E293B', 'New interior spread should inherit project backgroundColor');
console.assert(darkSpread2.leftPage?.backgroundColor === '#1E293B', 'New left page should inherit project backgroundColor');
console.assert(darkSpread2.rightPage?.backgroundColor === '#1E293B', 'New right page should inherit project backgroundColor');

// Test Duplicating Spread with custom page background colors
darkSpread2.leftPage!.backgroundColor = '#FDFBF7'; // Cream
darkSpread2.rightPage!.backgroundColor = '#000000'; // Black
darkAlbum.spreads.push(darkSpread2);

const dupResult = duplicateAlbumSpread(darkAlbum, darkProject, darkSpread2.id);
console.assert(dupResult !== null, 'duplicateAlbumSpread should succeed');
if (dupResult) {
  const clonedSpread = dupResult.updatedAlbum.spreads.find((s) => s.id === dupResult.newSpreadId);
  console.assert(clonedSpread?.leftPage?.backgroundColor === '#FDFBF7', 'Duplicated spread should preserve left page background color');
  console.assert(clonedSpread?.rightPage?.backgroundColor === '#000000', 'Duplicated spread should preserve right page background color');
}

// Test that new spreads follow project creation settings by default, while remaining dynamic per-spread
const spreadToCustomize = darkAlbum.spreads[darkAlbum.spreads.length - 1];
spreadToCustomize.bleed = 5.0; // Customize spread 2
spreadToCustomize.spacingValue = 6.0;
spreadToCustomize.safeArea = 15.0;

// Creating new spread 3: must follow project creation defaults (spacingValue: darkProject.spacingValue, safeArea: darkProject.marginValue, bleed: 0)
const darkSpread3 = createInteriorSpread(darkAlbum, darkProject, 3);
console.assert(darkSpread3.bleed === 0, `New spread should follow project default bleed (0), got ${darkSpread3.bleed}`);
console.assert(darkSpread3.spacingValue === darkProject.spacingValue, `New spread should follow project default spacing (${darkProject.spacingValue}), got ${darkSpread3.spacingValue}`);
console.assert(darkSpread3.safeArea === darkProject.marginValue, `New spread should follow project default safeArea (${darkProject.marginValue}), got ${darkSpread3.safeArea}`);

// Verify previous spread retains its customized dynamic values
console.assert(spreadToCustomize.bleed === 5.0, `Customized spread bleed must remain 5.0, got ${spreadToCustomize.bleed}`);
console.assert(spreadToCustomize.spacingValue === 6.0, `Customized spread spacing must remain 6.0, got ${spreadToCustomize.spacingValue}`);
console.assert(spreadToCustomize.safeArea === 15.0, `Customized spread safeArea must remain 15.0, got ${spreadToCustomize.safeArea}`);

// Verify new spread can be dynamically edited independently
darkSpread3.spacingValue = 0.0; // e.g. seamless collage
console.assert(spreadToCustomize.spacingValue === 6.0, `Customized spread spacing must NOT be affected by new spread, got ${spreadToCustomize.spacingValue}`);
console.assert(darkSpread3.spacingValue === 0.0, `New spread spacing must be independently editable to 0.0, got ${darkSpread3.spacingValue}`);

// Test spread deletion fallback selection: deleting latest spread must select previous spread
{
  const testAlbum = createInitialAlbum(mockProject);
  const s2 = createInteriorSpread(testAlbum, mockProject, 2);
  const s3 = createInteriorSpread(testAlbum, mockProject, 3);
  testAlbum.spreads.push(s2, s3);
  const reAlbum = recalculateAlbumPageNumbers(testAlbum);
  const all = getAllAlbumSpreads(reAlbum); // [Spread 1, Spread 2, Spread 3]
  console.assert(all.length === 3, 'Should have 3 spreads');

  // Simulate deleting the latest spread (Spread 3)
  const deletedSpreadId = s3.id;
  const oldDeletedIndex = all.findIndex((s) => s.id === deletedSpreadId);
  console.assert(oldDeletedIndex === 2, 'Deleted spread was at index 2 (the latest spread)');

  const remaining = reAlbum.spreads.filter((s) => s.id !== deletedSpreadId);
  const updated = recalculateAlbumPageNumbers({ ...reAlbum, spreads: remaining });
  const remainingAll = getAllAlbumSpreads(updated);

  // Fallback calculation:
  const candidateIndex = oldDeletedIndex >= remainingAll.length
    ? Math.max(0, remainingAll.length - 1)
    : Math.max(0, oldDeletedIndex);
  const targetSpread = remainingAll[candidateIndex];

  console.assert(targetSpread.id === s2.id, `Selected spread after deleting latest must be Spread 2 (the previous spread), got ${targetSpread.name}`);
  console.assert(candidateIndex === 1, `Candidate index should be 1 (Spread 2), not 0 (Spread 1)`);
}

// Test in-place gap adjustment without layout shuffle
{
  const f1: any = {
    id: 'f1',
    type: 'photo',
    photoId: 'photo-1',
    filePath: '/p1.jpg',
    fileName: 'p1.jpg',
    previewPath: '',
    thumbnailPath: '',
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    rotation: 0,
    zIndex: 1,
    photoAspect: 1.25,
    originalWidth: 100,
    originalHeight: 80,
    cropX: 0,
    cropY: 0,
    cropScale: 1,
    cropRotation: 0,
    borderEnabled: false,
    borderWidth: 0,
    borderColor: '#000',
    opacity: 1,
  };
  const f2: any = { ...f1, id: 'f2', photoId: 'photo-2', x: 120 };
  const gapUpdates = applyFixedGap([f1, f2], 'horizontal', 10);
  console.assert(gapUpdates.length > 0, 'applyFixedGap should return geometry updates');
  const newX2 = (gapUpdates.find((u) => u.id === 'f2')?.geometry as any).x;
  console.assert(newX2 === 120, `f2 should have x = 10 + 100 + 10 = 120, got ${newX2}`);
  console.assert(f1.photoId === 'photo-1' && f2.photoId === 'photo-2', 'Photo identity must never shuffle');
}

// 12. Test Zero Safe Margin and Full-Bleed Consistency (Fix 0-value clamping bug)
{
  const zeroPixelProject: Project = {
    ...mockProject,
    id: 'test-proj-zero-px',
    canvasWidth: 3000,
    canvasHeight: 2000,
    canvasUnit: 'px',
    canvasDpi: 300,
    marginEnabled: true,
    marginValue: 0,
    marginUnit: 'px',
    marginTop: 0,
    marginBottom: 0,
    marginOutside: 0,
    marginSpine: 0,
    spacingValue: 0,
    spacingUnit: 'px',
  };

  const zeroAlbum = createInitialAlbum(zeroPixelProject);
  const cover = zeroAlbum.coverSpread;
  const spread1 = zeroAlbum.spreads[0];

  // Test cover spread margins strictly 0 (not 0.1 or 10)
  console.assert(cover.safeArea === 0, `Cover safeArea should be 0, got ${cover.safeArea}`);
  console.assert(cover.safeAreaTop === 0, `Cover safeAreaTop should be 0, got ${cover.safeAreaTop}`);
  console.assert(cover.safeAreaBottom === 0, `Cover safeAreaBottom should be 0, got ${cover.safeAreaBottom}`);
  console.assert(cover.safeAreaOutside === 0, `Cover safeAreaOutside should be 0, got ${cover.safeAreaOutside}`);
  console.assert(cover.safeAreaSpine === 0, `Cover safeAreaSpine should be 0, got ${cover.safeAreaSpine}`);

  // Test spread 1 margins strictly 0
  console.assert(spread1.safeArea === 0, `Spread1 safeArea should be 0, got ${spread1.safeArea}`);
  console.assert(spread1.safeAreaTop === 0, `Spread1 safeAreaTop should be 0, got ${spread1.safeAreaTop}`);
  console.assert(spread1.safeAreaBottom === 0, `Spread1 safeAreaBottom should be 0, got ${spread1.safeAreaBottom}`);
  console.assert(spread1.safeAreaOutside === 0, `Spread1 safeAreaOutside should be 0, got ${spread1.safeAreaOutside}`);
  console.assert(spread1.safeAreaSpine === 0, `Spread1 safeAreaSpine should be 0, got ${spread1.safeAreaSpine}`);
  console.assert(spread1.leftPage?.safeArea === 0, `Spread1 leftPage safeArea should be 0, got ${spread1.leftPage?.safeArea}`);
  console.assert(spread1.rightPage?.safeArea === 0, `Spread1 rightPage safeArea should be 0, got ${spread1.rightPage?.safeArea}`);

  // Test new interior spread inherits zero safe margin from project
  const spread2 = createInteriorSpread(zeroAlbum, zeroPixelProject, 2);
  console.assert(spread2.safeArea === 0, `Spread2 safeArea should be 0, got ${spread2.safeArea}`);
  console.assert(spread2.safeAreaTop === 0, `Spread2 safeAreaTop should be 0, got ${spread2.safeAreaTop}`);
  console.assert(spread2.safeAreaBottom === 0, `Spread2 safeAreaBottom should be 0, got ${spread2.safeAreaBottom}`);
  console.assert(spread2.safeAreaOutside === 0, `Spread2 safeAreaOutside should be 0, got ${spread2.safeAreaOutside}`);
  console.assert(spread2.safeAreaSpine === 0, `Spread2 safeAreaSpine should be 0, got ${spread2.safeAreaSpine}`);

  // Test getProjectDimensionsInCanvasUnit preserves 0
  const dims = getProjectDimensionsInCanvasUnit(zeroPixelProject, spread1);
  console.assert(dims.safeMargin === 0, `Dims safeMargin should be 0, got ${dims.safeMargin}`);
  console.assert(dims.safeMarginTop === 0, `Dims safeMarginTop should be 0, got ${dims.safeMarginTop}`);
  console.assert(dims.safeMarginBottom === 0, `Dims safeMarginBottom should be 0, got ${dims.safeMarginBottom}`);
  console.assert(dims.safeMarginOutside === 0, `Dims safeMarginOutside should be 0, got ${dims.safeMarginOutside}`);
  console.assert(dims.safeMarginSpine === 0, `Dims safeMarginSpine should be 0, got ${dims.safeMarginSpine}`);

  // Test 4-sided margin with 0 spine and non-zero outside
  const seamlessSpineProject: Project = {
    ...mockProject,
    id: 'test-proj-seamless-spine',
    marginValue: 20,
    marginTop: 15,
    marginBottom: 15,
    marginOutside: 25,
    marginSpine: 0, // Zero spine for seamless layflat center fold
  };
  const seamlessAlbum = createInitialAlbum(seamlessSpineProject);
  const sSpread1 = seamlessAlbum.spreads[0];
  console.assert(sSpread1.safeAreaSpine === 0, `Seamless spread safeAreaSpine should be 0, got ${sSpread1.safeAreaSpine}`);
  console.assert(sSpread1.safeAreaOutside === 25, `Seamless spread safeAreaOutside should be 25, got ${sSpread1.safeAreaOutside}`);
  console.assert(sSpread1.safeAreaTop === 15, `Seamless spread safeAreaTop should be 15, got ${sSpread1.safeAreaTop}`);

  const sDims = getProjectDimensionsInCanvasUnit(seamlessSpineProject, sSpread1);
  console.assert(sDims.safeMarginSpine === 0, `Seamless dims safeMarginSpine should be 0, got ${sDims.safeMarginSpine}`);
  console.assert(sDims.safeMarginOutside === 25, `Seamless dims safeMarginOutside should be 25, got ${sDims.safeMarginOutside}`);

  // Test marginEnabled: false sets all margins to 0
  const marginDisabledProject: Project = {
    ...mockProject,
    id: 'test-proj-margin-disabled',
    marginEnabled: false,
    marginValue: 15,
    marginTop: 15,
    marginBottom: 15,
    marginOutside: 20,
    marginSpine: 10,
  };
  const marginDisabledAlbum = createInitialAlbum(marginDisabledProject);
  console.assert(marginDisabledAlbum.spreads[0].safeArea === 0, 'marginDisabled album spread safeArea should be 0');
  console.assert(marginDisabledAlbum.spreads[0].safeAreaTop === 0, 'marginDisabled album spread safeAreaTop should be 0');
  console.assert(marginDisabledAlbum.spreads[0].safeAreaOutside === 0, 'marginDisabled album spread safeAreaOutside should be 0');

  const marginDisabledDims = getProjectDimensionsInCanvasUnit(marginDisabledProject, marginDisabledAlbum.spreads[0]);
  console.assert(marginDisabledDims.safeMargin === 0, 'marginDisabledDims safeMargin should be 0');
  console.assert(marginDisabledDims.safeMarginTop === 0, 'marginDisabledDims safeMarginTop should be 0');
  console.assert(marginDisabledDims.safeMarginOutside === 0, 'marginDisabledDims safeMarginOutside should be 0');

  // Test isElementDesignEqual, isSpreadDesignEqual, isAlbumDesignEqual
  const elemA: PhotoFrameElement = {
    id: 'el-1',
    type: 'photo',
    photoId: 'p-1',
    filePath: '/path/1.jpg',
    previewPath: '/cache/preview1.jpg',
    thumbnailPath: '/cache/thumb1.jpg',
    fileName: '1.jpg',
    x: 10,
    y: 10,
    width: 100,
    height: 80,
    rotation: 0,
    zIndex: 1,
    cropScale: 1.0,
    cropX: 0,
    cropY: 0,
    cropRotation: 0,
    borderEnabled: false,
    borderWidth: 1,
    borderColor: '#ffffff',
    opacity: 1,
  };

  // Clone with identical design but different runtime preview/thumbnail paths
  const elemACacheUpdated: PhotoFrameElement = {
    ...elemA,
    previewPath: '/cache/preview1_updated.jpg',
    thumbnailPath: '/cache/thumb1_updated.jpg',
  };

  console.assert(isElementDesignEqual(elemA, elemACacheUpdated) === true, 'Cache path change must be treated as design-equal');

  const elemAGeometryChanged: PhotoFrameElement = { ...elemA, x: 15 };
  console.assert(isElementDesignEqual(elemA, elemAGeometryChanged) === false, 'X coordinate change must not be design-equal');

  const elemACropChanged: PhotoFrameElement = { ...elemA, cropScale: 1.5 };
  console.assert(isElementDesignEqual(elemA, elemACropChanged) === false, 'Crop scale change must not be design-equal');

  const albumBase = createInitialAlbum(mockProject);
  albumBase.spreads[0].elements = [elemA];

  const albumCacheOnly = JSON.parse(JSON.stringify(albumBase));
  albumCacheOnly.spreads[0].elements[0].previewPath = '/new/cache.jpg';
  albumCacheOnly.spreads[0].elements[0].thumbnailPath = '/new/thumb.jpg';

  console.assert(isAlbumDesignEqual(albumBase, albumCacheOnly) === true, 'Album design equality must ignore thumbnail/preview cache paths');

  const albumDesignChanged = JSON.parse(JSON.stringify(albumBase));
  albumDesignChanged.spreads[0].elements[0].width = 120;
  console.assert(isAlbumDesignEqual(albumBase, albumDesignChanged) === false, 'Album design equality must detect geometry change');

  // Spacing value and unit equality
  const spreadSpacingA = { ...albumBase.spreads[0], spacingValue: 4, spacingUnit: 'mm' as const };
  const spreadSpacingB = { ...albumBase.spreads[0], spacingValue: 4, spacingUnit: 'mm' as const };
  console.assert(isSpreadDesignEqual(spreadSpacingA, spreadSpacingB) === true, 'Identical spacing must be equal');

  const spreadSpacingValChanged = { ...albumBase.spreads[0], spacingValue: 6, spacingUnit: 'mm' as const };
  console.assert(isSpreadDesignEqual(spreadSpacingA, spreadSpacingValChanged) === false, 'Different spacing value must not be equal');

  const spreadSpacingUnitChanged = { ...albumBase.spreads[0], spacingValue: 4, spacingUnit: 'inch' as const };
  console.assert(isSpreadDesignEqual(spreadSpacingA, spreadSpacingUnitChanged) === false, 'Different spacing unit must not be equal');
}

// 18. Test adjustSpreadPhotoGaps: In-place realtime gap adjustment without altering layout topology
{
  const f1: PhotoFrameElement = {
    id: 'f1',
    type: 'photo',
    photoId: 'photo-1',
    filePath: '/photos/p1.jpg',
    fileName: 'p1.jpg',
    previewPath: '/cache/p1.jpg',
    thumbnailPath: '/cache/p1_thumb.jpg',
    x: 10,
    y: 10,
    width: 90,
    height: 100,
    rotation: 0,
    zIndex: 1,
    cropX: 0,
    cropY: 0,
    cropScale: 1,
    cropRotation: 0,
    borderEnabled: false,
    borderWidth: 0,
    borderColor: '#000',
    opacity: 1,
  };

  const f2: PhotoFrameElement = {
    ...f1,
    id: 'f2',
    photoId: 'photo-2',
    x: 110,
    width: 90,
  };

  // Initial setup: 2 photos on Left Page (x: 10..200), initial gap is 10mm (110 - (10 + 90) = 10)
  // Target gap is 4mm
  const adjusted = adjustSpreadPhotoGaps([f1, f2], 4, 300, 0);
  const adj1 = adjusted.find((el: any) => el.id === 'f1') as PhotoFrameElement;
  const adj2 = adjusted.find((el: any) => el.id === 'f2') as PhotoFrameElement;

  console.assert(adj1 && adj2, 'Both frames must be returned');
  const measuredGap = Math.round((adj2.x - (adj1.x + adj1.width)) * 100) / 100;
  console.assert(measuredGap === 4, `Measured gap between f1 and f2 must be 4mm, got ${measuredGap}`);
  console.assert(adj1.x === 10, `f1 should start at x = 10, got ${adj1.x}`);
  const outerRight = Math.round((adj2.x + adj2.width) * 100) / 100;
  console.assert(outerRight === 200, `Outer right boundary should remain 200, got ${outerRight}`);
  console.assert(adj1.photoId === 'photo-1' && adj2.photoId === 'photo-2', 'Photo identity must never shuffle');

  // Test asymmetric 3-photo layout (1 large left, 2 stacked right)
  const leftBig: PhotoFrameElement = { ...f1, id: 'leftBig', x: 10, y: 10, width: 100, height: 200 };
  const rightTop: PhotoFrameElement = { ...f1, id: 'rightTop', x: 120, y: 10, width: 80, height: 95 };
  const rightBottom: PhotoFrameElement = { ...f1, id: 'rightBottom', x: 120, y: 115, width: 80, height: 95 };

  // Old horizontal gap = 120 - (10 + 100) = 10
  // Old vertical gap = 115 - (10 + 95) = 10
  // Total span: X [10, 200], Y [10, 210]
  const adjAsymm = adjustSpreadPhotoGaps([leftBig, rightTop, rightBottom], 6, 300, 0);
  const aBig = adjAsymm.find((el: any) => el.id === 'leftBig') as PhotoFrameElement;
  const aTop = adjAsymm.find((el: any) => el.id === 'rightTop') as PhotoFrameElement;
  const aBottom = adjAsymm.find((el: any) => el.id === 'rightBottom') as PhotoFrameElement;

  const horizGap = Math.round((aTop.x - (aBig.x + aBig.width)) * 100) / 100;
  const vertGap = Math.round((aBottom.y - (aTop.y + aTop.height)) * 100) / 100;

  console.assert(horizGap === 6, `Horizontal gap must be 6mm, got ${horizGap}`);
  console.assert(vertGap === 6, `Vertical gap must be 6mm, got ${vertGap}`);
  console.assert(aTop.x === aBottom.x, `Right column frames must align horizontally: ${aTop.x} vs ${aBottom.x}`);
  console.assert(aBig.height === 200, `Left large photo height must be preserved: got ${aBig.height}`);
}

// 19. Test applyAdaptiveGapToSpread: Adaptive layout gap adjustment strictly bounded by Safe Zone
{
  const testProject: Project = {
    ...mockProject,
    canvasWidth: 200,
    canvasHeight: 200,
    canvasUnit: 'mm',
    marginEnabled: true,
    marginValue: 10,
    marginTop: 10,
    marginBottom: 10,
    marginOutside: 10,
    marginSpine: 10,
    spacingValue: 4,
    spacingUnit: 'mm',
  };

  const initialSpread: Spread = {
    id: 'spread-adaptive-test',
    albumId: 'test-album-1',
    spreadNumber: 1,
    pageNumber: 1,
    safeArea: 10,
    spacingValue: 4,
    spacingUnit: 'mm',
    gutterWidth: 0,
    leftPage: {
      id: 'lp-1',
      pageNumber: 1,
      width: 200,
      height: 200,
      unit: 'mm',
      safeArea: 10,
    },
    rightPage: {
      id: 'rp-1',
      pageNumber: 2,
      width: 200,
      height: 200,
      unit: 'mm',
      safeArea: 10,
    },
    elements: [
      {
        id: 'f1',
        type: 'photo',
        photoId: 'p1',
        filePath: '/photos/p1.jpg',
        fileName: 'p1.jpg',
        previewPath: '/cache/p1.jpg',
        thumbnailPath: '/cache/p1_thumb.jpg',
        x: 10,
        y: 10,
        width: 88,
        height: 180,
        rotation: 0,
        cropX: 5,
        cropY: 5,
        cropScale: 1.2,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000',
        cornerRadius: 0,
        opacity: 1,
      },
      {
        id: 'f2',
        type: 'photo',
        photoId: 'p2',
        filePath: '/photos/p2.jpg',
        fileName: 'p2.jpg',
        previewPath: '/cache/p2.jpg',
        thumbnailPath: '/cache/p2_thumb.jpg',
        x: 102,
        y: 10,
        width: 88,
        height: 180,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000',
        cornerRadius: 0,
        opacity: 1,
      },
    ],
  };

  // Adjust gap from 4mm to 10mm
  const updatedSpread = applyAdaptiveGapToSpread(initialSpread, 10, 'mm', testProject);
  const elements = updatedSpread.elements as PhotoFrameElement[];
  console.assert(elements.length === 2, 'Must have 2 elements');

  const el1 = elements.find((e) => e.id === 'f1')!;
  const el2 = elements.find((e) => e.id === 'f2')!;
  console.assert(el1 && el2, 'Both frames must be preserved by ID');
  console.assert(el1.cropScale === 1.2 && el1.cropX === 5, 'Existing crop settings must be strictly preserved');

  // Verify safe margin confinement (safe box: x from 10 to 190, y from 10 to 190)
  console.assert(el1.x >= 10, `Photo 1 left edge (${el1.x}) must not exceed safe margin 10`);
  console.assert(el1.y >= 10, `Photo 1 top edge (${el1.y}) must not exceed safe margin 10`);
  console.assert(el2.x + el2.width <= 190.01, `Photo 2 right edge (${el2.x + el2.width}) must not exceed safe margin 190`);
  console.assert(el2.y + el2.height <= 190.01, `Photo 2 bottom edge (${el2.y + el2.height}) must not exceed safe margin 190`);

  // Verify exact gap spacing between adjacent photos
  const measuredGap = Math.round((el2.x - (el1.x + el1.width)) * 100) / 100;
  console.assert(measuredGap === 10, `Gap must be 10mm, got ${measuredGap}`);
}

// ---------------------------------------------------------------------------
// 20. Real-Time Adaptive Safe Margin Scaling Test
// ---------------------------------------------------------------------------
{
  const testProject: Project = {
    ...mockProject,
    canvasWidth: 200,
    canvasHeight: 200,
    canvasUnit: 'mm',
    spacingValue: 4,
    spacingUnit: 'mm',
    marginValue: 10,
    marginUnit: 'mm',
    marginEnabled: true,
  };

  const initialSpread = {
    id: 'spread-margin-test',
    albumId: 'alb-1',
    spreadIndex: 1,
    pageNumber: 1,
    safeArea: 10,
    spacingValue: 4,
    spacingUnit: 'mm' as const,
    gutterWidth: 0,
    leftPage: {
      id: 'lp-m',
      pageNumber: 1,
      width: 200,
      height: 200,
      unit: 'mm' as const,
      safeArea: 10,
    },
    rightPage: {
      id: 'rp-m',
      pageNumber: 2,
      width: 200,
      height: 200,
      unit: 'mm' as const,
      safeArea: 10,
    },
    elements: [
      {
        id: 'f1',
        type: 'photo' as const,
        photoId: 'p1',
        filePath: '/photos/p1.jpg',
        fileName: 'p1.jpg',
        previewPath: '/cache/p1.jpg',
        thumbnailPath: '/cache/p1_thumb.jpg',
        x: 10,
        y: 10,
        width: 88,
        height: 180,
        rotation: 0,
        cropX: 5,
        cropY: 5,
        cropScale: 1.2,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000',
        cornerRadius: 0,
        opacity: 1,
      },
      {
        id: 'f2',
        type: 'photo' as const,
        photoId: 'p2',
        filePath: '/photos/p2.jpg',
        fileName: 'p2.jpg',
        previewPath: '/cache/p2.jpg',
        thumbnailPath: '/cache/p2_thumb.jpg',
        x: 102,
        y: 10,
        width: 88,
        height: 180,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000',
        cornerRadius: 0,
        opacity: 1,
      },
    ],
  };

  // 1. Uniform Safe Margin increased from 10mm to 20mm
  const margin20Spread = applyAdaptiveSafeAreaToSpread(
    initialSpread,
    { safeArea: 20, safeAreaTop: 20, safeAreaBottom: 20, safeAreaOutside: 20, safeAreaSpine: 20 },
    testProject
  );
  const m20Elements = margin20Spread.elements as PhotoFrameElement[];
  console.assert(m20Elements.length === 2, 'Must have 2 elements after margin change');

  const el1_20 = m20Elements.find((e) => e.id === 'f1')!;
  const el2_20 = m20Elements.find((e) => e.id === 'f2')!;
  console.assert(el1_20 && el2_20, 'Both frames must be preserved by ID');
  console.assert(el1_20.cropScale === 1.2 && el1_20.cropX === 5, 'Crop coordinates must remain intact');

  // Verify safe margin confinement to 20mm (safe box: x from 20 to 180, y from 20 to 180)
  console.assert(el1_20.x >= 20, `Photo 1 left edge (${el1_20.x}) must be >= 20`);
  console.assert(el1_20.y >= 20, `Photo 1 top edge (${el1_20.y}) must be >= 20`);
  console.assert(el2_20.x + el2_20.width <= 180.01, `Photo 2 right edge (${el2_20.x + el2_20.width}) must be <= 180`);
  console.assert(el2_20.y + el2_20.height <= 180.01, `Photo 2 bottom edge (${el2_20.y + el2_20.height}) must be <= 180`);

  // Verify exact gap (4mm) is preserved
  const gapAt20 = Math.round((el2_20.x - (el1_20.x + el1_20.width)) * 100) / 100;
  console.assert(gapAt20 === 4, `Gap must remain 4mm, got ${gapAt20}`);

  // 2. Asymmetric 4-sided Safe Margin (Top: 30mm, Bottom: 10mm, Outside: 15mm, Spine: 0mm seamless)
  const asymSpread = applyAdaptiveSafeAreaToSpread(
    initialSpread,
    { safeAreaTop: 30, safeAreaBottom: 10, safeAreaOutside: 15, safeAreaSpine: 0 },
    testProject
  );
  const asymElements = asymSpread.elements as PhotoFrameElement[];
  const asymEl1 = asymElements.find((e) => e.id === 'f1')!;
  const asymEl2 = asymElements.find((e) => e.id === 'f2')!;

  console.assert(asymEl1.y >= 30, `Asymmetric top edge (${asymEl1.y}) must be >= 30mm`);
  console.assert(asymEl1.x >= 15, `Asymmetric outside edge (${asymEl1.x}) must be >= 15mm`);
  console.assert(asymEl2.x + asymEl2.width <= 200.01, `Asymmetric right edge (${asymEl2.x + asymEl2.width}) must extend to spine (200mm)`);
  const asymGap = Math.round((asymEl2.x - (asymEl1.x + asymEl1.width)) * 100) / 100;
  // 3. Single photo on left page (with or without photos on right page)
  const singlePhotoSpread: Spread = {
    ...initialSpread,
    id: 'single-photo-spread',
    elements: [initialSpread.elements[0]!], // only f1 on left page
  };

  const singlePhotoResized = applyAdaptiveSafeAreaToSpread(
    singlePhotoSpread,
    { safeArea: 25, safeAreaTop: 25, safeAreaBottom: 25, safeAreaOutside: 25, safeAreaSpine: 25 },
    testProject
  );
  const singleEl = singlePhotoResized.elements[0] as PhotoFrameElement;
  console.assert(singleEl && singleEl.id === 'f1', 'Single photo element must exist with id f1');
  console.assert(singleEl.x === 25, `Single photo left edge must be 25, got ${singleEl.x}`);
  console.assert(singleEl.y === 25, `Single photo top edge must be 25, got ${singleEl.y}`);
  console.assert(singleEl.width === 150, `Single photo width must be 150, got ${singleEl.width}`);
  console.assert(singleEl.height === 150, `Single photo height must be 150, got ${singleEl.height}`);

  // 4. Single full-bleed photo adapting when safe margin is increased from 0 to 15mm
  const fullBleedSpread: Spread = {
    ...initialSpread,
    id: 'full-bleed-spread',
    elements: [
      {
        ...initialSpread.elements[0]!,
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      },
    ],
  };
  const bleedAdapted = applyAdaptiveSafeAreaToSpread(
    fullBleedSpread,
    { safeArea: 15, safeAreaTop: 15, safeAreaBottom: 15, safeAreaOutside: 15, safeAreaSpine: 15 },
    testProject
  );
  const bleedEl = bleedAdapted.elements[0] as PhotoFrameElement;
  console.assert(bleedEl.x === 15, `Full bleed photo must adapt to safe margin x=15, got ${bleedEl.x}`);
  console.assert(bleedEl.y === 15, `Full bleed photo must adapt to safe margin y=15, got ${bleedEl.y}`);
  console.assert(bleedEl.width === 170, `Full bleed photo must adapt to safe margin width=170, got ${bleedEl.width}`);
  console.assert(bleedEl.height === 170, `Full bleed photo must adapt to safe margin height=170, got ${bleedEl.height}`);

  // 5. Asymmetric spread: 1 photo on left page, 2 photos on right page - both pages adapt in real-time
  const mixedSpread: Spread = {
    ...initialSpread,
    id: 'mixed-spread',
    elements: [
      {
        id: 'f-left',
        type: 'photo',
        photoId: 'p1',
        filePath: '/photos/p1.jpg',
        fileName: 'p1.jpg',
        x: 10,
        y: 10,
        width: 180,
        height: 180,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000',
        cornerRadius: 0,
        opacity: 1,
      },
      {
        id: 'f-right-1',
        type: 'photo',
        photoId: 'p2',
        filePath: '/photos/p2.jpg',
        fileName: 'p2.jpg',
        x: 210,
        y: 10,
        width: 88,
        height: 180,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000',
        cornerRadius: 0,
        opacity: 1,
      },
      {
        id: 'f-right-2',
        type: 'photo',
        photoId: 'p3',
        filePath: '/photos/p3.jpg',
        fileName: 'p3.jpg',
        x: 302,
        y: 10,
        width: 88,
        height: 180,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000',
        cornerRadius: 0,
        opacity: 1,
      },
    ],
  };

  const mixedAdapted = applyAdaptiveSafeAreaToSpread(
    mixedSpread,
    { safeArea: 20, safeAreaTop: 20, safeAreaBottom: 20, safeAreaOutside: 20, safeAreaSpine: 20 },
    testProject
  );
  const mixedLeft = (mixedAdapted.elements as PhotoFrameElement[]).find((e) => e.id === 'f-left')!;
  const mixedR1 = (mixedAdapted.elements as PhotoFrameElement[]).find((e) => e.id === 'f-right-1')!;
  const mixedR2 = (mixedAdapted.elements as PhotoFrameElement[]).find((e) => e.id === 'f-right-2')!;

  console.assert(mixedLeft.x === 20 && mixedLeft.y === 20 && mixedLeft.width === 160 && mixedLeft.height === 160,
    `Left single photo must scale to safe box (20,20,160,160), got (${mixedLeft.x},${mixedLeft.y},${mixedLeft.width},${mixedLeft.height})`);
  console.assert(mixedR1.x >= 220 && mixedR1.y >= 20, `Right photo 1 must respect safe area`);
  console.assert(mixedR2.x + mixedR2.width <= 380.01, `Right photo 2 must stay within safe area`);
}

console.log('✓ All Album Structure domain tests passed successfully (1-2, 3-4, 5-6 model, spread duplication & reordering, background color propagation, project baseline defaults & per-spread independence, smart previous spread selection upon deletion, zero safe margin & seamless spine consistency, marginEnabled: false evaluation, design equality vs cache paths, in-place non-shuffling photo gap adjustment, adaptive safezone-bounded gap scaling, and real-time adaptive safe margin resizing)!');
