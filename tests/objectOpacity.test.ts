import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { createInitialAlbum, isAlbumDesignEqual } from '../src/domain/album';
import type { Photo } from '../src/domain/photo';
import type { Project } from '../src/domain/project';
import type { TextNodeElement } from '../src/domain/text';
import { TextPreviewCanvas } from '../src/features/editor/TextPreviewCanvas';
import { useAlbumStore } from '../src/stores/albumStore';
import { useEditorStore } from '../src/stores/editorStore';
import { useHistoryStore } from '../src/stores/historyStore';
import { useProjectStore } from '../src/stores/projectStore';

(globalThis as any).window = {};
let savedAlbum: any;
mockIPC((command, args) => {
  if (command === 'save_album_structure') { savedAlbum = args.album; return null; }
  if (command === 'load_album_structure') return savedAlbum;
  return null;
});

const project: Project = {
  id: 'opacity-test', name: 'Opacity', canvasWidth: 200, canvasHeight: 200,
  canvasUnit: 'mm', canvasDpi: 300, spacingValue: 3, spacingUnit: 'mm',
  borderEnabled: false, borderWidth: 0, borderUnit: 'mm', borderColor: '#ffffff',
  backgroundType: 'solid', backgroundColor: '#ffffff', createdAt: '', updatedAt: '',
};
const photo: Photo = {
  id: 'opacity-photo', projectId: project.id, filePath: 'opacity.png', fileName: 'opacity.png',
  fileSize: 1, width: 300, height: 200, format: 'png', isFavorite: false, usedCount: 0,
  isMissing: false, createdAt: '', updatedAt: '',
};
useProjectStore.setState({ currentProject: project });
useAlbumStore.setState({ currentAlbum: createInitialAlbum(project), saveStatus: 'saved' });
const spreadId = useAlbumStore.getState().currentAlbum!.spreads[0].id;
const editor = useEditorStore.getState();
editor.addPhotoToSpread(spreadId, photo);
const photoId = useAlbumStore.getState().currentAlbum!.spreads[0].elements[0].id;
const textId = editor.addTextToSpread(spreadId, { text: 'Opacity sample' });
const elements = () => useAlbumStore.getState().currentAlbum!.spreads[0].elements;
const find = (id: string) => elements().find((element) => element.id === id)!;
assert.equal(find(photoId).opacity, 1);
assert.equal(find(textId).opacity, 1);

editor.selectFrames([photoId, textId]);
const beforeOpacity = useAlbumStore.getState().currentAlbum!;
useAlbumStore.setState({ saveStatus: 'saved' });
editor.setSelectedOpacity(spreadId, 0.42);
assert.equal(find(photoId).opacity, 0.42);
assert.equal(find(textId).opacity, 0.42);
const previewMarkup = renderToStaticMarkup(createElement(TextPreviewCanvas, {
  element: find(textId) as TextNodeElement, unit: 'mm', dpi: 300, width: 100, height: 40,
}));
assert.match(previewMarkup, /opacity:0\.42/, 'Spread and export text previews must carry object opacity');
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.equal(isAlbumDesignEqual(beforeOpacity, useAlbumStore.getState().currentAlbum), false,
  'Text opacity must count as a design edit');
const afterOpacity = useAlbumStore.getState().currentAlbum;
editor.setSelectedOpacity(spreadId, 0.42);
assert.equal(useAlbumStore.getState().currentAlbum, afterOpacity, 'Same opacity must not create an edit');
assert.equal(useHistoryStore.getState().undo(afterOpacity!)!.spreads[0].elements.find((e) => e.id === textId)!.opacity, 1);

// A locked element remains unchanged during a mixed selection adjustment.
const current = useAlbumStore.getState().currentAlbum!;
useAlbumStore.setState({ currentAlbum: {
  ...current, spreads: current.spreads.map((spread) => spread.id === spreadId
    ? { ...spread, elements: spread.elements.map((element) => element.id === textId
      ? { ...element, locked: true } : element) } : spread),
} });
editor.setSelectedOpacity(spreadId, 0.7);
assert.equal(find(photoId).opacity, 0.7);
assert.equal(find(textId).opacity, 0.42);
editor.setSelectedOpacity(spreadId, 9);
assert.equal(find(photoId).opacity, 1, 'Opacity above 100% must clamp');
editor.setSelectedOpacity(spreadId, -1);
assert.equal(find(photoId).opacity, 0, 'Zero opacity must remain valid');
const beforeInvalid = useAlbumStore.getState().currentAlbum;
editor.setSelectedOpacity(spreadId, Number.NaN);
assert.equal(useAlbumStore.getState().currentAlbum, beforeInvalid);

assert.equal(await useAlbumStore.getState().saveAlbumToDb(), true);
assert.equal(savedAlbum.spreads[0].elements.find((e: any) => e.id === photoId).opacity, 0);
assert.equal(savedAlbum.spreads[0].elements.find((e: any) => e.id === textId).opacity, 0.42);
assert.equal(await useAlbumStore.getState().loadAlbumFromDb(project.id), true);
assert.equal(find(photoId).opacity, 0);
assert.equal(find(textId).opacity, 0.42);

// Older saved text rows had no opacity value and must load fully opaque.
const oldAlbum = JSON.parse(JSON.stringify(savedAlbum));
delete oldAlbum.spreads[0].elements.find((e: any) => e.id === textId).opacity;
savedAlbum = oldAlbum;
assert.equal(await useAlbumStore.getState().loadAlbumFromDb(project.id), true);
assert.equal(find(textId).opacity, 1);

clearMocks();
console.log('✓ Object opacity selection, lock, undo, dirty state, bounds, persistence, and legacy defaults passed.');
