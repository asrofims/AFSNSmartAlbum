import assert from 'node:assert/strict';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { useProjectStore } from '../src/stores/projectStore';
import { useAlbumStore } from '../src/stores/albumStore';
import { usePhotoStore } from '../src/stores/photoStore';
import { createInitialAlbum } from '../src/domain/album';
import type { Project } from '../src/domain/project';

(globalThis as any).window = {};
const storage = new Map<string, string>();
(globalThis as any).localStorage = { setItem: (k: string, v: string) => storage.set(k, v),
  getItem: (k: string) => storage.get(k) ?? null, removeItem: (k: string) => storage.delete(k) };
const project: Project = { id: 'p', name: 'Project', canvasWidth: 200, canvasHeight: 200, canvasUnit: 'mm', canvasDpi: 300,
  spacingValue: 3, spacingUnit: 'mm', borderEnabled: false, borderWidth: 0, borderUnit: 'mm',
  borderColor: '#fff', backgroundType: 'solid', backgroundColor: '#fff', createdAt: '', updatedAt: '', filePath: 'C:/work/project.afsn' };
const calls: string[] = [];
let native: (command: string, args: any) => any = () => null;
mockIPC((command, args) => { calls.push(command); return native(command, args); });
const reset = (patch: Partial<Project> = {}) => {
  const p = { ...project, ...patch };
  useProjectStore.setState({ currentProject: p, recentProjects: [p], isSaving: false, isLoading: false, error: null });
  usePhotoStore.setState({ isImporting: false, photos: [], folders: [] });
  useAlbumStore.setState({ currentAlbum: createInitialAlbum(p), saveStatus: 'unsaved' });
  calls.length = 0;
  storage.clear();
  native = (command) => command === 'check_path_exists' ? true : null;
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

// A local recovery snapshot is not a successful database/file save.
reset();
native = (command) => { if (command === 'save_album_structure') throw new Error('disk full'); return null; };
assert.equal((await useProjectStore.getState().saveProject()).success, false);
assert.equal(calls.includes('export_afsn_package'), false);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.ok(useProjectStore.getState().error?.includes('recovery database'));
assert.ok(storage.has('afsn_snapshot_p'));

// File errors stay visible and dirty, without a surprise Save As dialog.
reset();
native = (command) => { if (command === 'export_afsn_package') throw new Error('file locked'); return true; };
assert.equal((await useProjectStore.getState().saveProject()).success, false);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.equal(calls.includes('save_project_as_with_dialog'), false);
assert.ok(useProjectStore.getState().error?.includes('file locked'));

// The original ZIP path from an older release must never be overwritten.
reset({ filePath: 'C:/work/archive.zip' });
await useProjectStore.getState().saveProject({ automatic: true });
assert.equal(calls.includes('export_afsn_package'), false);
assert.equal(calls.includes('export_afsn_with_dialog'), false);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
native = (command) => command === 'export_afsn_with_dialog' ? 'C:/work/recovered.afsn' : null;
assert.equal((await useProjectStore.getState().saveProject()).success, true);
assert.equal(useProjectStore.getState().currentProject?.filePath, 'C:/work/recovered.afsn');
assert.equal(useProjectStore.getState().currentProject?.name, 'recovered');

// Cancelled Save As retains both identity and unsaved state.
reset();
const before = useProjectStore.getState().currentProject;
assert.equal(await useProjectStore.getState().exportProjectAsAfsn(), null);
assert.equal(useProjectStore.getState().currentProject, before);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');

// One file save at a time; newer edits are neither erased nor marked saved.
reset();
const started = deferred(), release = deferred();
native = async (command) => {
  if (command === 'save_album_structure') { started.resolve(); await release.promise; }
  return true;
};
const pendingSave = useProjectStore.getState().saveProject();
await started.promise;
const edited = { ...useAlbumStore.getState().currentAlbum!, totalPages: 42 };
useAlbumStore.setState({ currentAlbum: edited, saveStatus: 'unsaved' });
assert.equal((await useProjectStore.getState().saveProject()).success, false);
assert.equal(await useProjectStore.getState().openProjectFromFile('other.afsn'), false);
release.resolve();
assert.equal((await pendingSave).success, true);
assert.equal(useAlbumStore.getState().currentAlbum, edited);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.equal(calls.filter((c) => c === 'export_afsn_package').length, 1);

// Successful save only marks the persisted revision clean.
reset();
assert.equal((await useProjectStore.getState().saveProject()).success, true);
assert.equal(useAlbumStore.getState().saveStatus, 'saved');

// Recovery checkpoint failures cannot rewind state after switching projects.
reset();
const dbStarted = deferred(), dbRelease = deferred();
native = async (command) => {
  if (command === 'save_album_structure') { dbStarted.resolve(); await dbRelease.promise; throw new Error('failed'); }
};
const dbPending = useAlbumStore.getState().saveAlbumToDb();
await dbStarted.promise;
const nextAlbum = createInitialAlbum({ ...project, id: 'different' });
useAlbumStore.setState({ currentAlbum: nextAlbum, saveStatus: 'saved' });
dbRelease.resolve();
assert.equal(await dbPending, false);
assert.equal(useAlbumStore.getState().currentAlbum, nextAlbum);
assert.equal(useAlbumStore.getState().saveStatus, 'saved');

// ZIP rejection happens before invoking any native importer.
reset();
assert.equal(await useProjectStore.getState().openProjectFromFile('archive.zip'), false);
assert.equal(calls.length, 0);
assert.ok(useProjectStore.getState().error?.includes('Extract ZIP'));

// A Save As request finishing after new edits keeps those edits in the source.
reset();
const dialogStarted = deferred(), dialogRelease = deferred();
native = async (command) => {
  if (command === 'save_project_as_with_dialog') {
    dialogStarted.resolve(); await dialogRelease.promise;
    return { ...project, id: 'copy', filePath: 'C:/work/copy.afsn' };
  }
  return null;
};
const pendingCopy = useProjectStore.getState().exportProjectAsAfsn();
await dialogStarted.promise;
const newer = { ...useAlbumStore.getState().currentAlbum!, totalPages: 44 };
useAlbumStore.setState({ currentAlbum: newer, saveStatus: 'unsaved' });
dialogRelease.resolve();
assert.equal(await pendingCopy, 'C:/work/copy.afsn');
assert.equal(useProjectStore.getState().currentProject?.id, 'p');
assert.equal(useAlbumStore.getState().currentAlbum, newer);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');

// A cover-only document is a valid album, not a failed load.
reset();
const coverOnly = { ...createInitialAlbum(project), spreads: [], totalSpreads: 0, totalPages: 0 };
native = (command) => command === 'load_album_structure' ? coverOnly : [];
assert.equal(await useAlbumStore.getState().loadAlbumFromDb(project.id), true);
assert.equal(useAlbumStore.getState().currentAlbum?.spreads.length, 0);

// Recent projects restore the dirty recovery state instead of calling it a file save.
reset();
storage.set('afsn_dirty_p', '1');
native = (command) => command === 'get_project' ? project : command === 'load_album_structure' ? createInitialAlbum(project) : [];
await useProjectStore.getState().openProjectById('p');
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');

clearMocks();
console.log('✓ Project persistence regressions passed: failed writes, cancellation, ZIP protection, save serialization and concurrent edits.');
