import assert from 'node:assert/strict';
import { createInitialAlbum } from '../src/domain/album';
import { calculatePhotoBatchPlacement } from '../src/domain/photoPlacement';
import type { Photo } from '../src/domain/photo';
import type { Project } from '../src/domain/project';
import { useAlbumStore } from '../src/stores/albumStore';
import { useEditorStore } from '../src/stores/editorStore';
import { useHistoryStore } from '../src/stores/historyStore';
import { usePhotoStore } from '../src/stores/photoStore';
import { useProjectStore } from '../src/stores/projectStore';

const project: Project = {
  id: 'batch-project', name: 'Batch', canvasWidth: 200, canvasHeight: 200,
  canvasUnit: 'mm', canvasDpi: 300, spacingValue: 5, spacingUnit: 'mm',
  marginValue: 10, marginUnit: 'mm', borderEnabled: false, borderWidth: 0,
  borderUnit: 'mm', borderColor: '#fff', backgroundType: 'solid',
  backgroundColor: '#fff', createdAt: '', updatedAt: '',
};
const photos: Photo[] = [
  { id: 'p1', width: 3000, height: 2000 },
  { id: 'p2', width: 2000, height: 3000 },
  { id: 'p3', width: 3000, height: 3000 },
].map((photo) => ({
  ...photo, projectId: project.id, filePath: `${photo.id}.jpg`, fileName: `${photo.id}.jpg`,
  fileSize: 1000, format: 'jpg', isFavorite: false, usedCount: 0, isMissing: false,
  createdAt: '', updatedAt: '',
}));

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const right = calculatePhotoBatchPlacement(photos, 200, 200, 0, 10, 5, { x: 340, y: 100 });
assert.equal(right.length, 3);
right.forEach((frame, index) => {
  assert.ok(frame.x >= 210 && frame.x + frame.width <= 390);
  assert.ok(frame.y >= 10 && frame.y + frame.height <= 190);
  assert.ok(Math.abs(frame.width / frame.height - photos[index]!.width / photos[index]!.height) < 1e-8);
  right.slice(index + 1).forEach((other) => assert.equal(overlaps(frame, other), false));
});
const many = calculatePhotoBatchPlacement(Array.from({ length: 12 }, (_, index) => photos[index % photos.length]!),
  200, 200, 0, 10, 5, { x: -100, y: -100 });
many.forEach((frame, index) => {
  assert.ok(frame.x >= 10 && frame.x + frame.width <= 190);
  assert.ok(frame.y >= 10 && frame.y + frame.height <= 190);
  many.slice(index + 1).forEach((other) => assert.equal(overlaps(frame, other), false));
});

useProjectStore.setState({ currentProject: project });
useAlbumStore.setState({ currentAlbum: createInitialAlbum(project), saveStatus: 'unsaved' });
usePhotoStore.setState({ photos, selectedPhotoIds: photos.map((photo) => photo.id), clipboardPhotoIds: [] });
useHistoryStore.getState().clearHistory();
const spreadId = useAlbumStore.getState().currentAlbum!.spreads[0]!.id;
useEditorStore.getState().addPhotosToSpread(spreadId, photos, { x: 330, y: 100 });
const placed = useAlbumStore.getState().currentAlbum!.spreads[0]!.elements;
assert.equal(placed.length, 3);
assert.deepEqual(placed.map((frame) => frame.photoId), ['p1', 'p2', 'p3']);
assert.equal(useEditorStore.getState().selectedFrameIds.length, 3);
assert.equal(useHistoryStore.getState().past.length, 1);

useEditorStore.setState({ clipboardFrames: placed });
assert.equal(await usePhotoStore.getState().copySelectedPhotos(), 3);
assert.deepEqual(usePhotoStore.getState().clipboardPhotoIds, ['p1', 'p2', 'p3']);
assert.equal(useEditorStore.getState().clipboardFrames.length, 0);

useHistoryStore.getState().clearHistory();
useEditorStore.getState().pasteFrames(spreadId, { x: 90, y: 100 });
const pasted = useAlbumStore.getState().currentAlbum!.spreads[0]!.elements.slice(3);
assert.equal(pasted.length, 3);
assert.equal(useHistoryStore.getState().past.length, 1);
pasted.forEach((frame, index) => pasted.slice(index + 1).forEach((other) => assert.equal(overlaps(frame, other), false)));

const album = createInitialAlbum(project);
album.spreads[0]!.safeArea = 30;
album.spreads[0]!.spacingValue = 12;
album.spreads.push({ ...album.spreads[0]!, id: 'second-spread', elements: [] });
album.spreads[1]!.safeArea = 10;
album.spreads[1]!.spacingValue = 2;
useAlbumStore.setState({ currentAlbum: album, activeSpreadId: album.spreads[0]!.id, saveStatus: 'unsaved' });
useHistoryStore.getState().clearHistory();
const result = useEditorStore.getState().pasteFramesToAllSpreads();
assert.deepEqual(result, { count: 3, spreadsCount: 2 });
const afterAll = useAlbumStore.getState().currentAlbum!;
assert.equal(afterAll.coverSpread.elements.length, 0);
assert.ok(afterAll.spreads.every((spread) => spread.elements.length === 3));
assert.deepEqual(
  afterAll.spreads[0]!.elements.map(({ x, y, width, height }) => ({ x, y, width, height })),
  afterAll.spreads[1]!.elements.map(({ x, y, width, height }) => ({ x, y, width, height })),
  'Paste to All Spreads must keep the same photo geometry even when spread margins and spacing differ',
);
assert.equal(new Set(afterAll.spreads.flatMap((spread) => spread.elements.map((frame) => frame.id))).size, 6);
assert.equal(useHistoryStore.getState().past.length, 1);

useEditorStore.setState({ selectedFrameIds: afterAll.spreads[0]!.elements.slice(0, 2).map((frame) => frame.id) });
useEditorStore.getState().copySelectedFrames(afterAll.spreads[0]!.id);
assert.deepEqual(usePhotoStore.getState().clipboardPhotoIds, []);
assert.equal(useEditorStore.getState().clipboardFrames.length, 2);
useHistoryStore.getState().clearHistory();
const frameResult = useEditorStore.getState().pasteFramesToAllSpreads();
assert.deepEqual(frameResult, { count: 2, spreadsCount: 2 });
assert.ok(useAlbumStore.getState().currentAlbum!.spreads.every((spread) => spread.elements.length === 5));
assert.deepEqual(
  useAlbumStore.getState().currentAlbum!.spreads[0]!.elements.slice(3).map(({ x, y, width, height }) => ({ x, y, width, height })),
  useAlbumStore.getState().currentAlbum!.spreads[1]!.elements.slice(3).map(({ x, y, width, height }) => ({ x, y, width, height })),
);
assert.equal(useHistoryStore.getState().past.length, 1);

console.log('✓ Multi-photo placement, clipboard, paste, and all-spread copy passed.');
