// Browser-only manual regression fixture: npm run dev, then /tests/pasteboard.preview.html.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC } from '@tauri-apps/api/mocks';
import { KonvaEditorCanvas } from '../src/features/editor/KonvaEditorCanvas';
import { useProjectStore } from '../src/stores/projectStore';
import { useAlbumStore } from '../src/stores/albumStore';
import { useEditorStore } from '../src/stores/editorStore';
import { usePhotoStore } from '../src/stores/photoStore';
import { createInitialAlbum } from '../src/domain/album';
import { buildSpreadElementsFromVariation } from '../src/domain/adaptiveLayout';
import type { Project } from '../src/domain/project';
import '../src/styles/tokens.css';

mockIPC(() => null);
(window as any).__TAURI_INTERNALS__.convertFileSrc = () => '/src/assets/welcome-hero.jpg';
const project: Project = { id: 'preview', name: 'Pasteboard regression', canvasWidth: 200, canvasHeight: 200, canvasUnit: 'mm', canvasDpi: 300,
  spacingValue: 3, spacingUnit: 'mm', borderEnabled: false, borderWidth: 0, borderUnit: 'mm', borderColor: '#fff',
  marginEnabled: true, marginValue: 0, marginUnit: 'mm', backgroundType: 'solid', backgroundColor: '#fff', createdAt: '', updatedAt: '' };
useProjectStore.setState({ currentProject: project });
const album = createInitialAlbum(project);
const spread = album.spreads[0]!;
spread.elements = buildSpreadElementsFromVariation({ id: 'preview', name: 'Preview', description: '', tags: [],
  rects: [{ x: 0, y: 0, width: 200, height: 200 }, { x: -95, y: 65, width: 70, height: 70 }] },
  [0, 1].map(i => ({ photoId: `photo-${i}`, previewPath: '/previews/welcome-hero.jpg', filePath: 'preview.jpg', photoAspect: 1.5 })));
useAlbumStore.setState({ currentAlbum: album, activeSpreadId: spread.id });
useEditorStore.setState({ selectedFrameIds: [spread.elements[0]!.id] });
usePhotoStore.setState({ photos: [] });

function Preview() {
  const [zoom, setZoom] = useState(100);
  const elements = useAlbumStore(s => s.currentAlbum!.spreads[0]!.elements);
  const crop = useEditorStore(s => s.editingCropFrameId);
  return <div style={{ fontFamily: 'Arial', height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: 12, display: 'flex', gap: 12 }}>
      <button onClick={() => useEditorStore.getState().enterCropMode(spread.elements[0]!.id)}>Crop page photo</button>
      <button onClick={() => useEditorStore.getState().exitCropMode()}>Done</button>
      <button onClick={() => setZoom(zoom === 100 ? 200 : 100)}>Zoom {zoom}%</button>
      <span>{crop ? 'Crop active' : 'Select and drag; Space + drag to pan'}</span>
    </div>
    <div style={{ flex: 1, minHeight: 0 }}><KonvaEditorCanvas zoomLevel={zoom} /></div>
    <output style={{ padding: 8 }}>{elements.map(e => `${e.id}: x=${e.x.toFixed(2)}, y=${e.y.toFixed(2)}, w=${e.width.toFixed(2)}, h=${e.height.toFixed(2)}`).join(' | ')}</output>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
