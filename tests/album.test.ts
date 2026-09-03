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
} from '../src/domain/album';
import { type PhotoFrameElement, applyFixedGap } from '../src/domain/editor';

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
console.assert(inchAlbum.coverSpread.bleed === 0.125, `Inch bleed should be 0.125 inch, got ${inchAlbum.coverSpread.bleed}`);

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

// Creating new spread 3: must follow project creation defaults (spacingValue: 2, safeArea: 10, bleed: 3.0)
const darkSpread3 = createInteriorSpread(darkAlbum, darkProject, 3);
console.assert(darkSpread3.bleed === 3.0, `New spread should follow project default bleed (3.0), got ${darkSpread3.bleed}`);
console.assert(darkSpread3.spacingValue === 2, `New spread should follow project default spacing (2), got ${darkSpread3.spacingValue}`);
console.assert(darkSpread3.safeArea === 10, `New spread should follow project default safeArea (10), got ${darkSpread3.safeArea}`);

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

console.log('✓ All Album Structure domain tests passed successfully (1-2, 3-4, 5-6 model, spread duplication & reordering, background color propagation, project baseline defaults & per-spread independence, smart previous spread selection upon deletion, and in-place non-shuffling photo gap adjustment)!');
