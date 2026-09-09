import assert from 'node:assert/strict';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { useProjectStore } from '../src/stores/projectStore';
import { useAlbumStore } from '../src/stores/albumStore';
import { usePhotoStore } from '../src/stores/photoStore';
import { useEditorStore } from '../src/stores/editorStore';
import { createInitialAlbum } from '../src/domain/album';
import { buildSpreadElementsFromVariation } from '../src/domain/adaptiveLayout';
import type { Photo } from '../src/domain/photo';
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

// Refreshing generated photo assets after a file save must not dirty the design.
const cachedPhoto: Photo = {
  id: 'cached-photo', projectId: project.id, filePath: 'C:/photos/photo.jpg', fileName: 'photo.jpg',
  width: 3000, height: 2000, fileSize: 1234, format: 'jpeg', isFavorite: false,
  usedCount: 1, isMissing: false, createdAt: '', updatedAt: '',
  previewPath: 'C:/cache/preview.jpg', thumbnailPath: 'C:/cache/thumb.jpg',
};
const resetWithPhoto = () => {
  reset();
  const album = useAlbumStore.getState().currentAlbum!;
  const elements = buildSpreadElementsFromVariation({ id: 'test', name: 'Test', description: '', tags: [],
    rects: [{ x: 10, y: 10, width: 120, height: 80 }] },
    [{ photoId: cachedPhoto.id, filePath: cachedPhoto.filePath, fileName: cachedPhoto.fileName, photoAspect: 1.5 }]);
  useAlbumStore.setState({ currentAlbum: { ...album, coverSpread: { ...album.coverSpread, elements } } });
};
resetWithPhoto();
assert.equal((await useProjectStore.getState().saveProject()).success, true);
const fileSavedAt = useAlbumStore.getState().lastSavedAt;
assert.equal(await useAlbumStore.getState().syncPhotoAssets([cachedPhoto], { persist: true }), true);
assert.equal(useAlbumStore.getState().saveStatus, 'saved', 'Cache refresh must preserve a successful file save');
assert.equal(useAlbumStore.getState().lastSavedAt, fileSavedAt);
assert.equal(useAlbumStore.getState().currentAlbum!.coverSpread.elements[0].previewPath, cachedPhoto.previewPath);

// Multiple cache writes queued behind one another must keep the saved status.
const cacheStarted = deferred(), cacheRelease = deferred();
native = async (command) => {
  if (command === 'save_album_structure') { cacheStarted.resolve(); await cacheRelease.promise; }
  return true;
};
const firstRefresh = useAlbumStore.getState().syncPhotoAssets([{ ...cachedPhoto, previewPath: 'C:/cache/preview-2.jpg' }], { persist: true });
await cacheStarted.promise;
const secondRefresh = useAlbumStore.getState().syncPhotoAssets([{ ...cachedPhoto, previewPath: 'C:/cache/preview-3.jpg' }], { persist: true });
cacheRelease.resolve();
assert.deepEqual(await Promise.all([firstRefresh, secondRefresh]), [true, true]);
assert.equal(useAlbumStore.getState().saveStatus, 'saved');
assert.equal(useAlbumStore.getState().currentAlbum!.coverSpread.elements[0].previewPath, 'C:/cache/preview-3.jpg');

// Cache refreshes cannot mark pre-existing or concurrent frame edits as saved.
for (const editDuringWrite of [false, true]) {
  resetWithPhoto();
  if (editDuringWrite) assert.equal((await useProjectStore.getState().saveProject()).success, true);
  const started = deferred(), release = deferred();
  native = async (command) => {
    if (command === 'save_album_structure') { started.resolve(); await release.promise; }
    return true;
  };
  const refresh = useAlbumStore.getState().syncPhotoAssets([cachedPhoto], { persist: true });
  await started.promise;
  if (editDuringWrite) {
    const cover = useAlbumStore.getState().currentAlbum!.coverSpread;
    useEditorStore.getState().updateFrameGeometry(cover.id, cover.elements[0].id, { x: 25 });
  }
  release.resolve();
  assert.equal(await refresh, true);
  assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
  if (editDuringWrite) assert.equal(useAlbumStore.getState().currentAlbum!.coverSpread.elements[0].x, 25);
}

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

// Missing recent files open as unsaved, even without a previous dirty marker.
reset();
native = (command) => command === 'get_project' ? project
  : command === 'load_album_structure' ? createInitialAlbum(project)
  : command === 'check_path_exists' ? false : [];
await useProjectStore.getState().openProjectById('p');
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.equal(useProjectStore.getState().currentProject?.filePath, project.filePath);

// Autosave checkpoints missing documents without recreating files or showing dialogs.
reset();
useAlbumStore.setState({ saveStatus: 'saved' });
native = (command) => command === 'check_path_exists' ? false : null;
assert.equal((await useProjectStore.getState().saveProject({ automatic: true })).success, false);
assert.ok(calls.includes('save_album_structure'));
assert.equal(calls.includes('export_afsn_package'), false);
assert.equal(calls.includes('export_afsn_with_dialog'), false);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.equal(useProjectStore.getState().error, null);

// Cancelling recovery Save keeps the old path, cached identity, and dirty state.
const recoveredBefore = useProjectStore.getState().currentProject;
assert.equal((await useProjectStore.getState().saveProject()).success, false);
assert.ok(calls.includes('export_afsn_with_dialog'));
assert.equal(useProjectStore.getState().currentProject, recoveredBefore);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.equal(useProjectStore.getState().isSaving, false);

// A chosen recovery destination replaces the path without forking the recent entry.
native = (command) => command === 'check_path_exists' ? false
  : command === 'export_afsn_with_dialog' ? 'D:/Albums/Recovered.afsn' : null;
assert.deepEqual(await useProjectStore.getState().saveProject(), {
  success: true, filePath: 'D:/Albums/Recovered.afsn', isSaveAs: true,
});
assert.equal(useProjectStore.getState().currentProject?.id, project.id);
assert.equal(useProjectStore.getState().currentProject?.name, 'Recovered');
assert.equal(useProjectStore.getState().recentProjects.length, 1);
assert.equal(JSON.parse(storage.get('afsn_recent_projects')!)[0].filePath, 'D:/Albums/Recovered.afsn');
assert.equal(useAlbumStore.getState().saveStatus, 'saved');
assert.equal(calls.includes('save_project_as_with_dialog'), false);
calls.length = 0;
native = (command, args) => {
  if (command === 'check_path_exists') return true;
  if (command === 'export_afsn_package') assert.equal(args.targetPath, 'D:/Albums/Recovered.afsn');
  return null;
};
assert.equal((await useProjectStore.getState().saveProject()).success, true);
assert.ok(calls.includes('export_afsn_package'));
assert.equal(calls.includes('export_afsn_with_dialog'), false);

// A failed recovery write must not change the association or report success.
reset();
native = (command) => {
  if (command === 'check_path_exists') return false;
  if (command === 'export_afsn_with_dialog') throw new Error('destination unavailable');
  return null;
};
assert.equal((await useProjectStore.getState().saveProject()).success, false);
assert.equal(useProjectStore.getState().currentProject?.filePath, project.filePath);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.ok(useProjectStore.getState().error?.includes('destination unavailable'));

// The recovery picker shares the save lock and preserves edits made while open.
reset();
const recoveryStarted = deferred(), recoveryRelease = deferred();
native = async (command) => {
  if (command === 'check_path_exists') return false;
  if (command === 'export_afsn_with_dialog') {
    recoveryStarted.resolve(); await recoveryRelease.promise;
    return 'D:/Albums/Recovered.afsn';
  }
  return null;
};
const recoverySave = useProjectStore.getState().saveProject();
await recoveryStarted.promise;
assert.equal((await useProjectStore.getState().saveProject({ automatic: true })).success, false);
const recoveryEdited = { ...useAlbumStore.getState().currentAlbum!, totalPages: 46 };
useAlbumStore.setState({ currentAlbum: recoveryEdited, saveStatus: 'unsaved' });
recoveryRelease.resolve();
assert.equal((await recoverySave).success, true);
assert.equal(useAlbumStore.getState().currentAlbum, recoveryEdited);
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved');
assert.equal(useProjectStore.getState().currentProject?.filePath, 'D:/Albums/Recovered.afsn');

clearMocks();
console.log('✓ Project persistence regressions passed: failed writes, cancellation, ZIP protection, save serialization, concurrent edits and missing-file recovery.');
