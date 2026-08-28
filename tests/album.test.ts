import { Project } from '../src/domain/project';
import {
  createInitialAlbum,
  createInteriorSpread,
  recalculateAlbumPageNumbers,
  getAllAlbumSpreads,
} from '../src/domain/album';

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
console.assert(album.totalSpreads === 2, `Total spreads should be 2 (Cover + Spread 1), got ${album.totalSpreads}`);
console.assert(album.totalPages === 2, `Total interior pages should be 2, got ${album.totalPages}`);

// Verify Cover Spread
console.assert(album.coverSpread.type === 'cover', 'Cover spread should have type cover');
console.assert(album.coverSpread.leftPage?.type === 'cover_back', 'Cover left page should be back cover');
console.assert(album.coverSpread.rightPage?.type === 'cover_front', 'Cover right page should be front cover');
console.assert(album.coverSpread.gutterWidth === 6, `Cover spine width should be 6mm, got ${album.coverSpread.gutterWidth}`);

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
console.assert(recalculated.totalSpreads === 4, `Total spreads should now be 4, got ${recalculated.totalSpreads}`);
console.assert(recalculated.totalPages === 6, `Total pages should now be 6, got ${recalculated.totalPages}`);

// 5. Test Getting All Spreads Sequential Order
const allSpreads = getAllAlbumSpreads(recalculated);
console.assert(allSpreads.length === 4, `All spreads should have length 4, got ${allSpreads.length}`);
console.assert(allSpreads[0].type === 'cover', 'First spread should be cover');
console.assert(allSpreads[1].name === 'Spread 1 (Pages 1-2)', 'Second spread should be Spread 1 (Pages 1-2)');
console.assert(allSpreads[2].name === 'Spread 2 (Pages 3-4)', 'Third spread should be Spread 2 (Pages 3-4)');
console.assert(allSpreads[3].name === 'Spread 3 (Pages 5-6)', 'Fourth spread should be Spread 3 (Pages 5-6)');

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
console.assert(inchAlbum.coverSpread.leftPage?.unit === 'inch', 'Inch album page unit should be inch');
console.assert(inchAlbum.coverSpread.gutterWidth === 0.25, `Inch spine should be 0.25 inch, got ${inchAlbum.coverSpread.gutterWidth}`);
console.assert(inchAlbum.coverSpread.bleed === 0.125, `Inch bleed should be 0.125 inch, got ${inchAlbum.coverSpread.bleed}`);

console.log('✓ All Album Structure domain tests passed successfully (1-2, 3-4, 5-6 model)!');
