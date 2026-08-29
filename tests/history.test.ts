import { useHistoryStore } from '../src/stores/historyStore';
import { createInitialAlbum } from '../src/domain/album';
import { Project } from '../src/domain/project';

console.log('Testing History Manager (Undo / Redo Stack)...');

const mockProject: Project = {
  id: 'test-proj-hist',
  name: 'History Test Album',
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

// 1. Initial State
const history = useHistoryStore.getState();
history.clearHistory();
console.assert(useHistoryStore.getState().past.length === 0, 'Past stack should be empty initially');
console.assert(useHistoryStore.getState().canUndo === false, 'canUndo should be false initially');
console.assert(useHistoryStore.getState().canRedo === false, 'canRedo should be false initially');

// 2. Push State 1
const albumState1 = createInitialAlbum(mockProject);
history.pushState(albumState1);
console.assert(useHistoryStore.getState().past.length === 1, 'Past stack should contain 1 state');
console.assert(useHistoryStore.getState().canUndo === true, 'canUndo should be true after pushState');

// 3. Mutate and Push State 2
const albumState2 = {
  ...albumState1,
  spreads: [
    {
      ...albumState1.spreads[0],
      elements: [
        {
          id: 'frame-test-1',
          type: 'photo' as const,
          photoId: 'p1',
          filePath: '/img1.jpg',
          fileName: 'img1.jpg',
          previewPath: '',
          thumbnailPath: '',
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          rotation: 0,
          zIndex: 1,
          photoAspect: 1.25,
          originalWidth: 100,
          originalHeight: 80,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 1,
          borderColor: '#FFFFFF',
          opacity: 1,
        },
      ],
    },
  ],
};
history.pushState(albumState2);
console.assert(useHistoryStore.getState().past.length === 2, 'Past stack should contain 2 states');

// 4. Test Undo
const currentAlbum = { ...albumState2, totalPages: 10 }; // simulate state after state 2
const undoneAlbum = useHistoryStore.getState().undo(currentAlbum);
console.assert(undoneAlbum !== null, 'Undo should return previous state');
console.assert(undoneAlbum?.spreads[0]?.elements?.length === 1, 'Undone album should match state 2');
console.assert(useHistoryStore.getState().canRedo === true, 'canRedo should be true after undo');

// 5. Test Redo
const redoneAlbum = useHistoryStore.getState().redo(undoneAlbum!);
console.assert(redoneAlbum !== null, 'Redo should return future state');
console.assert(redoneAlbum?.totalPages === 10, 'Redone album should restore state');

// 6. Test Max History Truncation
useHistoryStore.setState({ maxHistory: 3, past: [], future: [] });
const h = useHistoryStore.getState();
for (let i = 0; i < 5; i++) {
  h.pushState({ ...albumState1, id: `album-v${i}` });
}
console.assert(useHistoryStore.getState().past.length === 3, 'Past stack should be capped at maxHistory 3');

console.log('✓ All History Manager (Undo / Redo) tests passed successfully!');
