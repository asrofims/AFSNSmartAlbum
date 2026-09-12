import { create } from 'zustand';
import { Photo, PhotoFolder, ImportProgress, ImportNotice, PhotoFilter, PhotoSortBy, getRangeSelection } from '../domain/photo';
import { detachRemovedAlbumPhotos, detachRemovedPhotos } from '../domain/photoRemoval';

interface PhotoRemovalResult { removedIds: string[]; warnings: string[] }

async function markLibraryChanged(projectId: string): Promise<void> {
  // Preserve the recovery marker even if the user switched projects during the write.
  try { localStorage.setItem(`afsn_dirty_${projectId}`, '1'); } catch {}
  const { useAlbumStore } = await import('./albumStore');
  const album = useAlbumStore.getState().currentAlbum;
  if (album?.projectId === projectId) {
    // A new reference also prevents an in-flight file save from marking newer library edits saved.
    useAlbumStore.setState({ currentAlbum: { ...album }, saveStatus: 'unsaved' });
  }
}

async function persistLibraryChange<T = void>(
  projectId: string,
  command: string,
  args: Record<string, unknown> | (() => Record<string, unknown>),
  apply?: (args: Record<string, unknown>) => void,
): Promise<T> {
  const { persistInOrder } = await import('./albumStore');
  const { useProjectStore } = await import('./projectStore');
  try {
    return await persistInOrder(async () => {
      const project = useProjectStore.getState();
      const photos = usePhotoStore.getState();
      if (project.currentProject?.id !== projectId || project.isSaving || project.isLoading || photos.isRemoving || photos.isRelinking) {
        throw new Error('The project is busy or has changed. Try the library action again when it is ready.');
      }
      usePhotoStore.setState({ error: null });
      const { invoke } = await import('@tauri-apps/api/core');
      const parameters = typeof args === 'function' ? args() : args;
      for (const key of ['folderId', 'fromFolderId', 'toFolderId']) {
        const id = parameters[key];
        if (typeof id === 'string' && !photos.folders.some((folder) => folder.id === id && folder.projectId === projectId)) {
          throw new Error('This collection is no longer available in the current project.');
        }
      }
      const photoIds = parameters.photoIds;
      if (Array.isArray(photoIds)) {
        const liveIds = new Set(photos.photos.filter((photo) => photo.projectId === projectId).map((photo) => photo.id));
        if (photoIds.some((id) => !liveIds.has(id))) {
          throw new Error('Some selected photos are no longer available in the current project.');
        }
      }
      photoLoadEpoch += 1;
      const result = await invoke<T>(command, parameters);
      apply?.(parameters);
      await markLibraryChanged(projectId);
      return result;
    });
  } catch (error) {
    usePhotoStore.setState({ error: `Library update failed: ${String(error)}` });
    throw error;
  }
}

async function reconcileRemovedPhotos(projectId: string, photoIds: string[]): Promise<void> {
  if (!photoIds.length) return;
  const { useAlbumStore } = await import('./albumStore');
  const { useHistoryStore } = await import('./historyStore');
  const { useEditorStore } = await import('./editorStore');
  const album = useAlbumStore.getState().currentAlbum;
  if (album?.projectId !== projectId) return;
  const ids = new Set(photoIds);
  useAlbumStore.setState({ currentAlbum: detachRemovedAlbumPhotos(album, ids), saveStatus: 'unsaved' });
  // Preserve unrelated undo steps, but never resurrect a permanently removed library asset.
  useHistoryStore.setState((s) => ({
    past: s.past.map((a) => a.projectId === projectId ? detachRemovedAlbumPhotos(a, ids) : a),
    future: s.future.map((a) => a.projectId === projectId ? detachRemovedAlbumPhotos(a, ids) : a),
  }));
  useEditorStore.setState((s) => ({ clipboardFrames: detachRemovedPhotos(s.clipboardFrames, ids), editingCropFrameId: null }));
  usePhotoStore.setState((s) => ({
    photos: s.photos.filter((p) => !ids.has(p.id)),
    selectedPhotoIds: s.selectedPhotoIds.filter((id) => !ids.has(id)),
    clipboardPhotoIds: s.clipboardPhotoIds.filter((id) => !ids.has(id)),
    lastSelectedPhotoId: s.lastSelectedPhotoId && !ids.has(s.lastSelectedPhotoId) ? s.lastSelectedPhotoId : null,
    folderPhotoIds: Object.fromEntries(Object.entries(s.folderPhotoIds).map(([id, members]) => [id, members.filter((member) => !ids.has(member))])),
    folders: s.folders.map((folder) => ({ ...folder, photoCount: (s.folderPhotoIds[folder.id] || []).filter((id) => !ids.has(id)).length })),
  }));
}

async function syncAlbumFramePhotoAssets(photos: Photo[], persist = true): Promise<void> {
  if (!Array.isArray(photos) || photos.length === 0) return;

  try {
    const { useAlbumStore } = await import('./albumStore');
    await useAlbumStore.getState().syncPhotoAssets(photos, { persist });
  } catch (err) {
    console.warn('[AFSN] sync album photo assets error:', err);
  }
}

export interface RelinkProgress {
  phase: 'scanning' | 'matching' | 'rebuilding' | 'completed';
  current: number;
  total: number;
  percent: number;
  currentFile?: string;
  relinkedCount: number;
}

export interface RelinkSummary {
  relinkedCount: number;
  unresolvedCount: number;
  failures: string[];
  cancelled?: boolean;
}

interface RelinkProgressPayload {
  projectId: string;
  phase: 'scanning' | 'matching' | 'rebuilding' | 'completed';
  current: number;
  total: number;
  percent: number;
  currentFile?: string;
  relinkedCount: number;
}

export interface ImportTask {
  id: string;
  projectId: string;
  paths: string[];
  folderId: string | null;
  label: string;
  totalCount: number;
}

interface PhotoState {
  photos: Photo[];
  folders: PhotoFolder[];
  folderPhotoIds: Record<string, string[]>; // folderId -> list of photo IDs in folder
  activeFolderId: string | null; // null = "All Photos"

  selectedPhotoIds: string[];
  lastSelectedPhotoId: string | null;
  clipboardPhotoIds: string[];

  filter: PhotoFilter;
  sortBy: PhotoSortBy;
  searchQuery: string;
  isBrowsing: boolean;
  isImporting: boolean;
  isCancelling: boolean;
  isRemoving: boolean;
  isRelinking: boolean;
  isCancellingRelink: boolean;
  cancelRelink: () => Promise<void>;
  relinkProgress: RelinkProgress | null;
  relinkSummary: RelinkSummary | null;
  clearRelinkSummary: () => void;
  removalNotice: string | null;
  dismissRemovalNotice: () => void;
  importProgress: ImportProgress | null;
  importNotice: ImportNotice | null;
  importQueue: ImportTask[];
  currentImportTask: ImportTask | null;
  isRelinkOpen: boolean;
  isFolderDialogOpen: boolean;
  folderDialogMode: 'create' | 'rename';
  folderDialogTarget: PhotoFolder | null;
  error: string | null;

  // Photo actions
  loadPhotos: (projectId: string) => Promise<void>;
  enqueueImport: (projectId: string, paths: string[], folderId: string | null, label: string) => void;
  executeImportTask: (task: ImportTask) => Promise<void>;
  processNextQueueItem: () => Promise<void>;
  importFiles: (projectId: string) => Promise<void>;
  importFolder: (projectId: string) => Promise<void>;
  importPaths: (projectId: string, paths: string[]) => Promise<void>;
  cancelImport: () => Promise<void>;
  cancelAllImports: () => Promise<void>;
  dismissImportNotice: () => void;
  toggleFavorite: (photoId: string) => Promise<void>;
  removePhoto: (photoId: string) => Promise<void>;
  removePhotos: (projectId: string, photoIds: string[]) => Promise<PhotoRemovalResult>;
  checkMissing: (projectId: string) => Promise<void>;
  healThumbnail: (photoId: string) => Promise<string | null>;
  relinkFolder: (projectId: string) => Promise<void>;
  setupListeners: () => Promise<() => void>;

  // Selection actions
  selectPhoto: (photoId: string, mode?: 'single' | 'toggle' | 'range', currentVisibleList?: Photo[]) => void;
  selectAll: (currentVisibleList?: Photo[]) => void;
  clearSelection: () => void;

  // Batch actions
  batchDeleteSelected: (projectId: string) => Promise<void>;
  batchToggleFavoritesSelected: (isFavorite: boolean) => Promise<void>;

  // Folder actions
  loadFolders: (projectId: string) => Promise<void>;
  createFolder: (projectId: string, name: string) => Promise<PhotoFolder | null>;
  renameFolder: (projectId: string, folderId: string, name: string) => Promise<void>;
  deleteFolder: (projectId: string, folderId: string) => Promise<void>;
  setActiveFolder: (folderId: string | null) => void;
  addPhotosToFolder: (projectId: string, folderId: string, photoIds: string[]) => Promise<void>;
  removePhotosFromFolder: (projectId: string, folderId: string, photoIds: string[]) => Promise<void>;
  movePhotosToFolder: (projectId: string, fromFolderId: string, toFolderId: string, photoIds: string[]) => Promise<void>;

  // Clipboard (Copy & Paste)
  copySelectedPhotos: () => void;
  pastePhotosToActiveFolder: (projectId: string) => Promise<void>;

  // View options & dialogs
  setFilter: (filter: PhotoFilter) => void;
  setSortBy: (sortBy: PhotoSortBy) => void;
  setSearchQuery: (query: string) => void;
  openRelink: () => void;
  closeRelink: () => void;
  openCreateFolderDialog: () => void;
  openRenameFolderDialog: (folder: PhotoFolder) => void;
  closeFolderDialog: () => void;
}

let activeListenersCount = 0;
let unlistenFn: (() => void) | null = null;
let setupPromise: Promise<() => void> | null = null;
let photoLoadEpoch = 0;
const thumbnailHeals = new Map<string, Promise<string | null>>();

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  folders: [],
  folderPhotoIds: {},
  activeFolderId: null,

  selectedPhotoIds: [],
  lastSelectedPhotoId: null,
  clipboardPhotoIds: [],

  filter: 'all',
  sortBy: 'name',
  searchQuery: '',
  isBrowsing: false,
  isImporting: false,
  isCancelling: false,
  isRemoving: false,
  isRelinking: false,
  isCancellingRelink: false,
  cancelRelink: async () => {
    if (!get().isRelinking || get().isCancellingRelink) return;
    set({ isCancellingRelink: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_relink');
    } catch (err) {
      console.warn('[AFSN] cancel_relink error:', err);
    }
  },
  relinkProgress: null,
  relinkSummary: null,
  clearRelinkSummary: () => set({ relinkSummary: null }),
  removalNotice: null,
  dismissRemovalNotice: () => set({ removalNotice: null }),
  importProgress: null,
  importNotice: null,
  importQueue: [],
  currentImportTask: null,
  isRelinkOpen: false,
  isFolderDialogOpen: false,
  folderDialogMode: 'create',
  folderDialogTarget: null,
  error: null,

  dismissImportNotice: () => set({ importNotice: null }),

  setupListeners: async () => {
    activeListenersCount += 1;

    if (unlistenFn) {
      return () => {
        activeListenersCount = Math.max(0, activeListenersCount - 1);
        if (activeListenersCount === 0 && unlistenFn) {
          unlistenFn();
          unlistenFn = null;
          setupPromise = null;
        }
      };
    }

    if (setupPromise) {
      await setupPromise;
      return () => {
        activeListenersCount = Math.max(0, activeListenersCount - 1);
        if (activeListenersCount === 0 && unlistenFn) {
          unlistenFn();
          unlistenFn = null;
          setupPromise = null;
        }
      };
    }

    setupPromise = (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { useProjectStore } = await import('./projectStore');

        const isCurrentProject = (projectId?: string) => {
          const activeId = useProjectStore.getState().currentProject?.id;
          if (!activeId) return false;
          if (projectId && projectId !== activeId) return false;
          return true;
        };

        const unlistenProgress = await listen<ImportProgress>('photo-import-progress', (event) => {
          if (!isCurrentProject(event.payload?.projectId)) return;
          if (event.payload && event.payload.total > 0 && !get().isCancelling) {
            set({ isImporting: true, importProgress: event.payload });
          }
        });

        const unlistenItem = await listen<Photo>('photo-imported', (event) => {
          const item = event.payload;
          if (!isCurrentProject(item.projectId)) return;
          photoLoadEpoch += 1;
          void markLibraryChanged(item.projectId);
          set((s) => {
            const nextPhotos = s.photos.some((p) => p.id === item.id) ? s.photos : [...s.photos, item];
            const nextFolderPhotoIds = { ...s.folderPhotoIds };
            const targetFolderId = s.currentImportTask ? s.currentImportTask.folderId : null;
            if (targetFolderId) {
              const currentFolderIds = nextFolderPhotoIds[targetFolderId] || [];
              if (!currentFolderIds.includes(item.id)) {
                nextFolderPhotoIds[targetFolderId] = [...currentFolderIds, item.id];
              }
            }
            return { photos: nextPhotos, folderPhotoIds: nextFolderPhotoIds };
          });
        });

        const unlistenPreview = await listen<{ projectId?: string; id: string; thumbnailPath: string; previewPath: string }>(
          'photo-preview-ready',
          (event) => {
            if (!isCurrentProject(event.payload?.projectId)) return;
            if (event.payload && event.payload.id) {
              const { id, thumbnailPath, previewPath } = event.payload;
              set((s) => {
                const nextPhotos = s.photos.map((p) =>
                  p.id === id ? { ...p, thumbnailPath, previewPath, updatedAt: String(Date.now()) } : p
                );
                const updated = nextPhotos.find((photo) => photo.id === id);
                if (updated) void syncAlbumFramePhotoAssets([updated], false);
                return { photos: nextPhotos };
              });
            }
          }
        );

        const unlistenComplete = await listen<ImportNotice>(
          'photo-import-complete',
          (event) => {
            const payload = event.payload;
            if (!isCurrentProject(payload?.projectId)) return;
            if (payload) {
              if (payload.cancelled) {
                set({ importNotice: payload });
              } else if (payload.total > 0) {
                set((s) => {
                  // Only accumulate if part of an ongoing multi-batch import queue session
                  const isOngoingQueueSession = s.isImporting || s.importQueue.length > 0;
                  const currentNotice = isOngoingQueueSession && s.importNotice && !s.importNotice.cancelled
                    ? s.importNotice
                    : null;

                  if (!currentNotice) {
                    return { importNotice: payload };
                  }
                  return {
                    importNotice: {
                      ...currentNotice,
                      total: currentNotice.total + payload.total,
                      imported: currentNotice.imported + payload.imported,
                      existing: currentNotice.existing + payload.existing,
                      relinked: currentNotice.relinked + payload.relinked,
                      failed: (currentNotice.failed || 0) + (payload.failed || 0),
                      previewFailed: (currentNotice.previewFailed || 0) + (payload.previewFailed || 0),
                      failures: [...(currentNotice.failures || []), ...(payload.failures || [])],
                      cancelled: false,
                    },
                  };
                });
              }
              if (payload.failures?.length) {
                set({ error: payload.failures.map((failure) => `${failure.file}: ${failure.message}`).join('\n') });
              }
            }
          }
        );

        const unlistenError = await listen<{ projectId: string; message: string }>('photo-processing-error', (event) => {
          if (isCurrentProject(event.payload.projectId)) set({ error: event.payload.message });
        });

        const unlistenRelink = await listen<RelinkProgressPayload>('relink-progress', (event) => {
          if (!isCurrentProject(event.payload?.projectId)) return;
          if (event.payload) {
            set({
              isRelinking: event.payload.phase !== 'completed',
              relinkProgress: {
                phase: event.payload.phase,
                current: event.payload.current,
                total: event.payload.total,
                percent: event.payload.percent,
                currentFile: event.payload.currentFile,
                relinkedCount: event.payload.relinkedCount,
              },
            });
          }
        });

        const unlistenAll = () => {
          unlistenError();
          unlistenProgress();
          unlistenItem();
          unlistenPreview();
          unlistenComplete();
          unlistenRelink();
        };

        if (activeListenersCount === 0) {
          unlistenAll();
          return () => {};
        }

        unlistenFn = unlistenAll;
        return () => {
          activeListenersCount = Math.max(0, activeListenersCount - 1);
          if (activeListenersCount === 0 && unlistenFn) {
            unlistenFn();
            unlistenFn = null;
            setupPromise = null;
          }
        };
      } catch (e) {
        console.warn('[AFSN] Error setting up event listeners:', e);
        return () => {};
      }
    })();

    return setupPromise;
  },

  loadPhotos: async (projectId: string) => {
    const epoch = ++photoLoadEpoch;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { useProjectStore } = await import('./projectStore');
      const photos = await invoke<Photo[]>('get_project_photos', { projectId });
      if (epoch !== photoLoadEpoch || useProjectStore.getState().currentProject?.id !== projectId) return;
      const liveIds = new Set((photos || []).map((photo) => photo.id));
      await reconcileRemovedPhotos(projectId, get().photos.filter((photo) => photo.projectId === projectId && !liveIds.has(photo.id)).map((photo) => photo.id));
      set({ photos: photos || [], error: null });
      await get().loadFolders(projectId);
      await get().checkMissing(projectId);
      await syncAlbumFramePhotoAssets(get().photos);

      // Existing projects receive previews in the background without delaying the initial photo library load.
      void (async () => {
        try {
          // Preview events merge by ID; never replace the library with a stale recovery snapshot.
          await invoke('generate_missing_previews', { projectId });
        } catch (err) {
          console.warn('[AFSN] generate_missing_previews error:', err);
        }
      })();
    } catch (err) {
      console.warn('[AFSN] loadPhotos fallback or error:', err);
    }
  },

  enqueueImport: (projectId: string, paths: string[], folderId: string | null, label: string) => {
    if (!paths || paths.length === 0) return;
    if (get().isRemoving || get().isRelinking) { set({ error: 'Wait for the current photo operation to finish before importing.' }); return; }
    photoLoadEpoch += 1;
    const task: ImportTask = {
      id: crypto.randomUUID(),
      projectId,
      paths,
      folderId,
      label,
      totalCount: paths.length,
    };

    const isRunning = get().isImporting;
    if (!isRunning) {
      set({
        isImporting: true,
        isCancelling: false,
        importNotice: null,
        currentImportTask: task,
        importProgress: { projectId, current: 0, total: paths.length, currentFile: '', percent: 0 },
      });
      void get().executeImportTask(task);
    } else {
      set((s) => ({
        importQueue: [...s.importQueue, task],
      }));
    }
  },

  executeImportTask: async (task: ImportTask) => {
    try {
      const { useProjectStore } = await import('./projectStore');
      const project = useProjectStore.getState();
      if (project.currentProject?.id !== task.projectId || project.isSaving || project.isLoading) {
        throw new Error('The project is busy or has changed. Import the photos again when it is ready.');
      }
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('import_file_paths', {
        projectId: task.projectId,
        paths: task.paths,
        folderId: task.folderId,
      });

      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj && currentProj.id === task.projectId && Array.isArray(updatedPhotos)) {
        const liveIds = new Set(updatedPhotos.map((p) => p.id));
        await reconcileRemovedPhotos(task.projectId, get().photos.filter((p) => p.projectId === task.projectId && !liveIds.has(p.id)).map((p) => p.id));
        set({ photos: updatedPhotos });
        await markLibraryChanged(task.projectId);
        await syncAlbumFramePhotoAssets(updatedPhotos);
        await get().loadFolders(task.projectId);
      }
    } catch (err) {
      console.error('[AFSN] executeImportTask error:', err);
      const { useProjectStore } = await import('./projectStore');
      if (useProjectStore.getState().currentProject?.id === task.projectId) {
        await get().loadPhotos(task.projectId);
        await markLibraryChanged(task.projectId);
        set({ error: String(err) });
      }
    } finally {
      const { useProjectStore } = await import('./projectStore');
      if (get().currentImportTask?.id !== task.id) return;
      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj && currentProj.id === task.projectId) {
        set({ isCancelling: false });
        void get().processNextQueueItem();
      } else {
        set({
          isImporting: false,
          isCancelling: false,
          currentImportTask: null,
          importProgress: null,
          importQueue: [],
        });
      }
    }
  },

  processNextQueueItem: async () => {
    const { useProjectStore } = await import('./projectStore');
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) {
      set({
        isImporting: false,
        isCancelling: false,
        currentImportTask: null,
        importProgress: null,
        importQueue: [],
      });
      return;
    }

    const queue = get().importQueue.filter((task) => task.projectId === currentProj.id);
    if (queue.length > 0) {
      const nextTask = queue[0];
      if (nextTask) {
        set({
          importQueue: queue.slice(1),
          currentImportTask: nextTask,
          isImporting: true,
          isCancelling: false,
          importProgress: { projectId: nextTask.projectId, current: 0, total: nextTask.paths.length, currentFile: '', percent: 0 },
        });
        void get().executeImportTask(nextTask);
      }
    } else {
      set({
        isImporting: false,
        isCancelling: false,
        currentImportTask: null,
        importProgress: null,
      });
    }
  },

  importFiles: async (projectId: string) => {
    if (get().isBrowsing) return;
    set({ error: null, isBrowsing: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const paths = await invoke<string[] | null>('pick_photo_files_dialog');
      if (paths && paths.length > 0) {
        const folderId = get().activeFolderId || null;
        const activeFolderName = folderId
          ? get().folders.find((f) => f.id === folderId)?.name || 'Folder'
          : 'Library';
        get().enqueueImport(
          projectId,
          paths,
          folderId,
          `${paths.length} file${paths.length > 1 ? 's' : ''} to ${activeFolderName}`
        );
      }
    } catch (err) {
      console.error('[AFSN] importFiles error:', err);
      set({ error: String(err) });
    } finally {
      set({ isBrowsing: false });
    }
  },

  importFolder: async (projectId: string) => {
    if (get().isBrowsing) return;
    set({ error: null, isBrowsing: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const paths = await invoke<string[] | null>('pick_photo_folder_dialog');
      if (paths && paths.length > 0) {
        const folderId = get().activeFolderId || null;
        const activeFolderName = folderId
          ? get().folders.find((f) => f.id === folderId)?.name || 'Folder'
          : 'Library';
        const firstPath = paths[0] || '';
        const folderName = firstPath ? firstPath.replace(/[\\/][^\\/]+$/, '').replace(/^.*[\\/]/, '') || 'Folder' : 'Folder';
        get().enqueueImport(
          projectId,
          paths,
          folderId,
          `"${folderName}" (${paths.length} photos) to ${activeFolderName}`
        );
      }
    } catch (err) {
      console.error('[AFSN] importFolder error:', err);
      set({ error: String(err) });
    } finally {
      set({ isBrowsing: false });
    }
  },

  importPaths: async (projectId: string, paths: string[]) => {
    if (!paths || paths.length === 0) return;
    set({ error: null });
    const folderId = get().activeFolderId || null;
    const activeFolderName = folderId
      ? get().folders.find((f) => f.id === folderId)?.name || 'Folder'
      : 'Library';
    get().enqueueImport(
      projectId,
      paths,
      folderId,
      `${paths.length} dropped file${paths.length > 1 ? 's' : ''} to ${activeFolderName}`
    );
  },

  cancelImport: async () => {
    set({ isCancelling: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_photo_import');
    } catch (err) {
      console.warn('[AFSN] cancel_photo_import error:', err);
    }
  },

  cancelAllImports: async () => {
    const wasImporting = get().isImporting;
    set({
      isCancelling: wasImporting,
      importQueue: [],
    });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_photo_import');
    } catch (err) {
      console.warn('[AFSN] cancelAllImports error:', err);
    }
    if (!wasImporting) {
      set({
        isImporting: false,
        isCancelling: false,
        currentImportTask: null,
        importProgress: null,
        importQueue: [],
      });
    }
  },

  toggleFavorite: async (photoId: string) => {
    const current = get().photos.find((p) => p.id === photoId);
    if (!current) return;
    try {
      await persistLibraryChange(current.projectId, 'toggle_photo_favorite', () => {
        const photo = get().photos.find((p) => p.id === photoId);
        if (!photo) throw new Error('This photo is no longer in the library.');
        return { photoId, isFavorite: !photo.isFavorite };
      }, ({ isFavorite }) => {
        set((s) => ({ photos: s.photos.map((p) => p.id === photoId ? { ...p, isFavorite: Boolean(isFavorite) } : p) }));
      });
    } catch (err) {
      console.error('[AFSN] toggle_photo_favorite error:', err);
    }
  },

  removePhoto: async (photoId: string) => {
    const photo = get().photos.find((p) => p.id === photoId);
    if (photo) await get().removePhotos(photo.projectId, [photoId]);
  },

  removePhotos: async (projectId, photoIds) => {
    if (get().isRemoving) throw new Error('Photo removal is already in progress.');
    if (get().isImporting || get().isRelinking) throw new Error('Wait for the current photo operation to finish before removing photos.');
    const ids = [...new Set(photoIds)];
    if (!ids.length) throw new Error('No photos were selected for removal.');
    set({ isRemoving: true, removalNotice: null, error: null });
    photoLoadEpoch += 1;
    try {
      const { useProjectStore } = await import('./projectStore');
      const project = useProjectStore.getState();
      if (project.currentProject?.id !== projectId || project.isSaving || project.isLoading) {
        throw new Error('Wait for the current project operation to finish before removing photos.');
      }
      const { invoke } = await import('@tauri-apps/api/core');
      const { persistInOrder, useAlbumStore } = await import('./albumStore');
      const result = await persistInOrder(async () => {
        const removed = await invoke<PhotoRemovalResult>('batch_delete_photos', { projectId, photoIds: ids });
        await reconcileRemovedPhotos(projectId, ids);
        await markLibraryChanged(projectId);
        return removed;
      });
      // The database removal has committed. Checkpoint failure is a separate warning.
      if (!await useAlbumStore.getState().saveAlbumToDb()) {
        result.warnings.push('The library was updated, but the recovery checkpoint could not be saved. Save the project again.');
      }
      const count = result.removedIds.length;
      set({ removalNotice: `${count} ${count === 1 ? 'photo removed' : 'photos removed'} from the library. Original files were kept.${result.warnings.length ? ' Some cache or recovery work is pending. ' + result.warnings.join(' ') : ''}` });
      return result;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    } finally {
      set({ isRemoving: false });
    }
  },

  checkMissing: async (projectId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('check_missing_photos', { projectId });
      if (Array.isArray(updatedPhotos)) {
        const byId = new Map(updatedPhotos.map((photo) => [photo.id, photo]));
        set((s) => ({ photos: s.photos.map((photo) => photo.projectId === projectId && byId.has(photo.id)
          ? { ...photo, isMissing: byId.get(photo.id)!.isMissing } : photo) }));
        await syncAlbumFramePhotoAssets(get().photos);
      }
    } catch (err) {
      console.warn('[AFSN] check_missing_photos error:', err);
    }
  },

  healThumbnail: async (photoId: string) => {
    const pending = thumbnailHeals.get(photoId);
    if (pending) return pending;
    const operation = (async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const regeneratedPhoto = await invoke<Photo>('regenerate_single_thumbnail', { photoId });
      if (regeneratedPhoto?.thumbnailPath) {
        let nextPhotos: Photo[] = [];
        set((s) => ({
          photos: (nextPhotos = s.photos.map((p) =>
            p.id === photoId ? regeneratedPhoto : p
          )),
        }));
        await syncAlbumFramePhotoAssets(nextPhotos);
        return regeneratedPhoto.thumbnailPath;
      }
      return null;
    } catch (err) {
      console.warn(`[AFSN] healThumbnail error for ${photoId}:`, err);
      return null;
    }
    })();
    thumbnailHeals.set(photoId, operation);
    try { return await operation; } finally { thumbnailHeals.delete(photoId); }
  },

  relinkFolder: async (projectId: string) => {
    if (get().isRelinking || get().isRemoving || get().isImporting) return;
    set({ isRelinking: true, isCancellingRelink: false, error: null, relinkSummary: null, relinkProgress: null });
    photoLoadEpoch += 1;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { useProjectStore } = await import('./projectStore');
      if (useProjectStore.getState().isSaving || useProjectStore.getState().isLoading) throw new Error('The project is busy. Try relinking again when it is ready.');
      const result = await invoke<{
        photos: Photo[];
        failures: string[];
        relinkedCount: number;
        unresolvedCount: number;
        cancelled: boolean;
      }>('relink_folder', { projectId });

      if (useProjectStore.getState().currentProject?.id !== projectId) return;

      const relinked = result.relinkedCount ?? 0;
      const unresolved = result.unresolvedCount ?? result.failures.length;
      const didCancelPicker = !result.cancelled && relinked === 0 && unresolved === 0 && result.failures.length === 0;

      set({
        photos: result.photos,
        isRelinkOpen: true,
        relinkSummary: didCancelPicker ? null : {
          relinkedCount: relinked,
          unresolvedCount: unresolved,
          failures: result.failures,
          cancelled: result.cancelled,
        },
        error: null,
      });
      await markLibraryChanged(projectId);
      await syncAlbumFramePhotoAssets(result.photos);
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ isRelinking: false, isCancellingRelink: false });
    }
  },

  // Selection actions
  selectPhoto: (photoId: string, mode: 'single' | 'toggle' | 'range' = 'single', currentVisibleList?: Photo[]) => {
    const { selectedPhotoIds, lastSelectedPhotoId, photos } = get();
    const list = currentVisibleList || photos;

    if (mode === 'toggle') {
      const isAlreadySelected = selectedPhotoIds.includes(photoId);
      const nextSelected = isAlreadySelected
        ? selectedPhotoIds.filter((id) => id !== photoId)
        : [...selectedPhotoIds, photoId];
      set({
        selectedPhotoIds: nextSelected,
        lastSelectedPhotoId: isAlreadySelected ? lastSelectedPhotoId : photoId,
      });
    } else if (mode === 'range') {
      const nextSelected = getRangeSelection(list, lastSelectedPhotoId, photoId, selectedPhotoIds);
      set({
        selectedPhotoIds: nextSelected,
        lastSelectedPhotoId: photoId,
      });
    } else {
      set({
        selectedPhotoIds: [photoId],
        lastSelectedPhotoId: photoId,
      });
    }
  },

  selectAll: (currentVisibleList?: Photo[]) => {
    const list = currentVisibleList || get().photos;
    const firstPhoto = list[0];
    set({
      selectedPhotoIds: list.map((p) => p.id),
      lastSelectedPhotoId: firstPhoto ? firstPhoto.id : null,
    });
  },

  clearSelection: () => {
    set({
      selectedPhotoIds: [],
      lastSelectedPhotoId: null,
    });
  },

  // Batch actions
  batchDeleteSelected: async (projectId: string) => {
    await get().removePhotos(projectId, [...get().selectedPhotoIds]);
  },

  batchToggleFavoritesSelected: async (isFavorite: boolean) => {
    const selectedPhotoIds = [...get().selectedPhotoIds];
    if (selectedPhotoIds.length === 0) return;
    const selected = get().photos.filter((p) => selectedPhotoIds.includes(p.id));
    const projectId = selected[0]?.projectId;
    if (!projectId || selected.some((p) => p.projectId !== projectId)) return;

    try {
      await persistLibraryChange(projectId, 'batch_toggle_favorites', { photoIds: selected.map((p) => p.id), isFavorite }, () => {
        set((s) => ({ photos: s.photos.map((p) => selectedPhotoIds.includes(p.id) ? { ...p, isFavorite } : p) }));
      });
    } catch (err) {
      console.error('[AFSN] batch_toggle_favorites error:', err);
    }
  },

  // Folder actions
  loadFolders: async (projectId: string) => {
    const epoch = photoLoadEpoch;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const folders = await invoke<PhotoFolder[]>('get_photo_folders', { projectId });
      const folderMap: Record<string, string[]> = {};

      if (Array.isArray(folders)) {
        for (const f of folders) {
          const fPhotos = await invoke<Photo[]>('get_photos_for_folder', { folderId: f.id });
          folderMap[f.id] = (fPhotos || []).map((p) => p.id);
        }
        const { useProjectStore } = await import('./projectStore');
        if (epoch === photoLoadEpoch && useProjectStore.getState().currentProject?.id === projectId) {
          set({ folders, folderPhotoIds: folderMap });
        }
      }
    } catch (err) {
      console.warn('[AFSN] loadFolders error:', err);
      const { useProjectStore } = await import('./projectStore');
      if (epoch === photoLoadEpoch && useProjectStore.getState().currentProject?.id === projectId) {
        set({ error: `Collections could not be refreshed. Reopen the project to reload them. ${String(err)}` });
      }
    }
  },

  createFolder: async (projectId: string, name: string) => {
    if (!name.trim()) return null;
    try {
      const newFolder = await persistLibraryChange<PhotoFolder>(projectId, 'create_photo_folder', { projectId, name: name.trim() });
      const { useProjectStore } = await import('./projectStore');
      if (useProjectStore.getState().currentProject?.id !== projectId) return newFolder;
      if (newFolder) {
        set((s) => ({
          folders: [...s.folders, newFolder],
          folderPhotoIds: { ...s.folderPhotoIds, [newFolder.id]: [] },
          activeFolderId: newFolder.id,
          isFolderDialogOpen: false,
          folderDialogTarget: null,
        }));
        await get().loadFolders(projectId);
        return newFolder;
      }
      return null;
    } catch (err) {
      console.error('[AFSN] create_photo_folder error:', err);
      throw err;
    }
  },

  renameFolder: async (projectId: string, folderId: string, name: string) => {
    if (!name.trim()) return;
    try {
      await persistLibraryChange(projectId, 'rename_photo_folder', { folderId, name: name.trim() });
      const { useProjectStore } = await import('./projectStore');
      if (useProjectStore.getState().currentProject?.id !== projectId) return;
      set((s) => ({
        folders: s.folders.map((f) => (f.id === folderId ? { ...f, name: name.trim() } : f)),
        isFolderDialogOpen: false,
        folderDialogTarget: null,
      }));
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] rename_photo_folder error:', err);
      throw err;
    }
  },

  deleteFolder: async (projectId: string, folderId: string) => {
    try {
      await persistLibraryChange(projectId, 'delete_photo_folder', { folderId });
      set((s) => {
        const nextFolderPhotoIds = { ...s.folderPhotoIds };
        delete nextFolderPhotoIds[folderId];
        return {
          folders: s.folders.filter((f) => f.id !== folderId),
          folderPhotoIds: nextFolderPhotoIds,
          activeFolderId: s.activeFolderId === folderId ? null : s.activeFolderId,
        };
      });
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] delete_photo_folder error:', err);
      throw err;
    }
  },

  setActiveFolder: (folderId: string | null) => {
    set({ activeFolderId: folderId, selectedPhotoIds: [], lastSelectedPhotoId: null });
  },

  addPhotosToFolder: async (projectId: string, folderId: string, photoIds: string[]) => {
    if (photoIds.length === 0) return;
    try {
      await persistLibraryChange(projectId, 'add_photos_to_folder', { folderId, photoIds: [...photoIds] });
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] add_photos_to_folder error:', err);
    }
  },

  removePhotosFromFolder: async (projectId: string, folderId: string, photoIds: string[]) => {
    if (photoIds.length === 0) return;
    try {
      await persistLibraryChange(projectId, 'remove_photos_from_folder', { folderId, photoIds: [...photoIds] });
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] remove_photos_from_folder error:', err);
    }
  },

  movePhotosToFolder: async (projectId: string, fromFolderId: string, toFolderId: string, photoIds: string[]) => {
    if (photoIds.length === 0) return;
    try {
      await persistLibraryChange(projectId, 'move_photos_between_folders', { fromFolderId, toFolderId, photoIds: [...photoIds] });
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] move_photos_between_folders error:', err);
    }
  },

  // Clipboard
  copySelectedPhotos: () => {
    const { selectedPhotoIds } = get();
    if (selectedPhotoIds.length > 0) {
      set({ clipboardPhotoIds: [...selectedPhotoIds] });
    }
  },

  pastePhotosToActiveFolder: async (projectId: string) => {
    const { activeFolderId, clipboardPhotoIds } = get();
    if (!activeFolderId || clipboardPhotoIds.length === 0) return;
    await get().addPhotosToFolder(projectId, activeFolderId, clipboardPhotoIds);
  },

  // View options & dialogs
  setFilter: (filter: PhotoFilter) => set({ filter, selectedPhotoIds: [], lastSelectedPhotoId: null }),
  setSortBy: (sortBy: PhotoSortBy) => set({ sortBy }),
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  openRelink: () => set({ isRelinkOpen: true, relinkProgress: null, relinkSummary: null, isCancellingRelink: false, error: null }),
  closeRelink: () => set({ isRelinkOpen: false, relinkProgress: null, relinkSummary: null, isCancellingRelink: false, error: null }),
  openCreateFolderDialog: () => set({ isFolderDialogOpen: true, folderDialogMode: 'create', folderDialogTarget: null }),
  openRenameFolderDialog: (folder: PhotoFolder) => set({ isFolderDialogOpen: true, folderDialogMode: 'rename', folderDialogTarget: folder }),
  closeFolderDialog: () => set({ isFolderDialogOpen: false, folderDialogTarget: null }),
}));
