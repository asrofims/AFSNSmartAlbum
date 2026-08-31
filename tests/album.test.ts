import { Project } from '../src/domain/project';
import {
  createInitialAlbum,
  createInteriorSpread,
  duplicateAlbumSpread,
  recalculateAlbumPageNumbers,
  getAllAlbumSpreads,
  mergeFramePhotoAsset,
  syncAlbumPhotoAssets,
} from '../src/domain/album';
import type { PhotoFrameElement } from '../src/domain/editor';

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
  previewPath: null,
  thumbnailPath: 'C:/cache/recovered-photo-001.jpg',
  width: 6000,
  height: 4000,
};
const recoveredFrame = mergeFramePhotoAsset(staleFrame, recoveredPhoto);
console.assert(recoveredFrame.filePath === recoveredPhoto.filePath, 'Recovered frame should use the relinked original path');
console.assert(recoveredFrame.thumbnailPath === recoveredPhoto.thumbnailPath, 'Recovered frame should use the regenerated thumbnail');
console.assert(recoveredFrame.previewPath === recoveredPhoto.thumbnailPath, 'Recovered frame should fall back to the healthy thumbnail when no preview exists');
console.assert(recoveredFrame.photoAspect === 1.5, 'Recovered frame should refresh its native photo aspect');
console.assert(recoveredFrame.x === staleFrame.x && recoveredFrame.y === staleFrame.y, 'Recovery should preserve frame position');
console.assert(recoveredFrame.width === staleFrame.width && recoveredFrame.height === staleFrame.height, 'Recovery should preserve frame size');
console.assert(recoveredFrame.cropX === staleFrame.cropX && recoveredFrame.cropY === staleFrame.cropY && recoveredFrame.cropScale === staleFrame.cropScale, 'Recovery should preserve crop settings');
console.assert(mergeFramePhotoAsset(staleFrame, { ...recoveredPhoto, id: 'other-photo' }) === staleFrame, 'Unrelated photos must not alter a frame');

const relinkAlbum = {
  ...recalculated,
  coverSpread: { ...recalculated.coverSpread, elements: [staleFrame] },
  spreads: recalculated.spreads.map((spread) => ({ ...spread, elements: [] })),
};
const syncedRelinkAlbum = syncAlbumPhotoAssets(relinkAlbum, [recoveredPhoto]);
console.assert(syncedRelinkAlbum.changed, 'Album asset sync should report recovered frames as changed');
console.assert(syncedRelinkAlbum.album.coverSpread.elements[0].filePath === recoveredPhoto.filePath, 'Album asset sync should update cover frames too');
console.assert(syncedRelinkAlbum.album.coverSpread.elements[0].cropScale === staleFrame.cropScale, 'Album asset sync should retain cover frame crop');

console.log('✓ All Album Structure domain tests passed successfully (1-2, 3-4, 5-6 model & spread duplication)!');
