import { create } from 'zustand';
import { Photo, PhotoFolder, ImportProgress, ImportNotice, PhotoFilter, PhotoSortBy, getRangeSelection } from '../domain/photo';

async function syncAlbumFramePhotoAssets(photos: Photo[], persist = true): Promise<void> {
  if (!Array.isArray(photos) || photos.length === 0) return;

  try {
    const { useAlbumStore } = await import('./albumStore');
    await useAlbumStore.getState().syncPhotoAssets(photos, { persist });
  } catch (err) {
    console.warn('[AFSN] sync album photo assets error:', err);
  }
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
  isImporting: boolean;
  isCancelling: boolean;
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
  isImporting: false,
  isCancelling: false,
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
        set((s) => {
          const nextPhotos = s.photos.some((p) => p.id === item.id) ? s.photos : [...s.photos, item];
          const nextFolderPhotoIds = { ...s.folderPhotoIds };
          if (s.activeFolderId) {
            const currentFolderIds = nextFolderPhotoIds[s.activeFolderId] || [];
            if (!currentFolderIds.includes(item.id)) {
              nextFolderPhotoIds[s.activeFolderId] = [...currentFolderIds, item.id];
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
                p.id === id ? { ...p, thumbnailPath, previewPath } : p
              );
              void syncAlbumFramePhotoAssets(nextPhotos, false);
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
          set({
            isImporting: false,
            isCancelling: false,
            importProgress: null,
            currentImportTask: null,
            ...(payload && (payload.existing > 0 || payload.relinked > 0 || (payload.total > 0 && payload.imported > 0))
              ? { importNotice: payload }
              : {}),
          });
        }
      );

      return () => {
        unlistenProgress();
        unlistenItem();
        unlistenPreview();
        unlistenComplete();
      };
    } catch (e) {
      console.warn('[AFSN] Error setting up event listeners:', e);
      return () => {};
    }
  },

  loadPhotos: async (projectId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const photos = await invoke<Photo[]>('get_project_photos', { projectId });
      set({ photos: photos || [], error: null });
      await get().loadFolders(projectId);
      await get().checkMissing(projectId);
      await syncAlbumFramePhotoAssets(get().photos);

      // Existing projects receive previews in the background without delaying the initial photo library load.
      void (async () => {
        try {
          const refreshedPhotos = await invoke<Photo[]>('generate_missing_previews', { projectId });
          const isCurrentProject = get().photos.some((photo) => photo.projectId === projectId);
          if (!isCurrentProject || !Array.isArray(refreshedPhotos)) return;

          set({ photos: refreshedPhotos });
          await syncAlbumFramePhotoAssets(refreshedPhotos);
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
        currentImportTask: task,
        importProgress: { current: 0, total: paths.length, currentFile: '', percent: 0 },
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
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('import_file_paths', {
        projectId: task.projectId,
        paths: task.paths,
        folderId: task.folderId,
      });

      const { useProjectStore } = await import('./projectStore');
      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj && currentProj.id === task.projectId && Array.isArray(updatedPhotos)) {
        set({ photos: updatedPhotos });
        void get().loadFolders(task.projectId);
      }
    } catch (err) {
      console.error('[AFSN] executeImportTask error:', err);
      set({ error: String(err) });
    } finally {
      const { useProjectStore } = await import('./projectStore');
      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj && currentProj.id === task.projectId && !get().isCancelling) {
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

    const queue = get().importQueue;
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
    set({ error: null });
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
    }
  },

  importFolder: async (projectId: string) => {
    set({ error: null });
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
    const remainingQueue = get().importQueue;
    if (remainingQueue.length === 0) {
      set({
        isImporting: false,
        isCancelling: false,
        importProgress: null,
        currentImportTask: null,
      });
    }
  },

  cancelAllImports: async () => {
    set({
      isCancelling: true,
      importQueue: [],
      currentImportTask: null,
    });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_photo_import');
    } catch (err) {
      console.warn('[AFSN] cancelAllImports error:', err);
    }
    set({
      isImporting: false,
      isCancelling: false,
      importProgress: null,
      currentImportTask: null,
      importQueue: [],
    });
  },

  toggleFavorite: async (photoId: string) => {
    const current = get().photos.find((p) => p.id === photoId);
    if (!current) return;
    const nextVal = !current.isFavorite;

    set((s) => ({
      photos: s.photos.map((p) => (p.id === photoId ? { ...p, isFavorite: nextVal } : p)),
    }));

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('toggle_photo_favorite', { photoId, isFavorite: nextVal });
    } catch (err) {
      console.error('[AFSN] toggle_photo_favorite error:', err);
    }
  },

  removePhoto: async (photoId: string) => {
    set((s) => ({
      photos: s.photos.filter((p) => p.id !== photoId),
      selectedPhotoIds: s.selectedPhotoIds.filter((id) => id !== photoId),
      lastSelectedPhotoId: s.lastSelectedPhotoId === photoId ? null : s.lastSelectedPhotoId,
    }));

    // Instantly remove / clear photo from all canvas spread frames
    try {
      const { useAlbumStore } = await import('./albumStore');
      const { currentAlbum, saveAlbumToDb } = useAlbumStore.getState();
      if (currentAlbum) {
        let modified = false;

        const updateElements = (elements: any[]) =>
          elements.map((el) => {
            if (el.photoId === photoId) {
              modified = true;
              return {
                ...el,
                photoId: null,
                filePath: '',
                previewPath: '',
                thumbnailPath: '',
                fileName: '',
                crop: undefined,
                cropScale: 1.0,
                cropX: 0,
                cropY: 0,
                photoAspect: undefined,
              };
            }
            return el;
          });

        const updatedCover = {
          ...currentAlbum.coverSpread,
          elements: updateElements(currentAlbum.coverSpread.elements || []),
        };

        const updatedSpreads = currentAlbum.spreads.map((spread) => ({
          ...spread,
          elements: updateElements(spread.elements || []),
        }));

        if (modified) {
          useAlbumStore.setState({
            currentAlbum: {
              ...currentAlbum,
              coverSpread: updatedCover,
              spreads: updatedSpreads,
            },
          });
          saveAlbumToDb();
        }
      }
    } catch (e) {
      console.error('[AFSN] Error clearing photo from canvas:', e);
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('remove_photo', { photoId });
    } catch (err) {
      console.error('[AFSN] remove_photo error:', err);
    }
  },

  checkMissing: async (projectId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('check_missing_photos', { projectId });
      if (Array.isArray(updatedPhotos)) {
        set({ photos: updatedPhotos });
        await syncAlbumFramePhotoAssets(updatedPhotos);
      }
    } catch (err) {
      console.warn('[AFSN] check_missing_photos error:', err);
    }
  },

  healThumbnail: async (photoId: string) => {
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
  },

  relinkFolder: async (projectId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('relink_folder', { projectId });
      if (Array.isArray(updatedPhotos)) {
        set({ photos: updatedPhotos, isRelinkOpen: false });
        await syncAlbumFramePhotoAssets(updatedPhotos);
      }
    } catch (err) {
      console.error('[AFSN] relink_folder error:', err);
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
    const { selectedPhotoIds, photos } = get();
    if (selectedPhotoIds.length === 0) return;

    const deletedSet = new Set(selectedPhotoIds);

    set({
      photos: photos.filter((p) => !deletedSet.has(p.id)),
      selectedPhotoIds: [],
      lastSelectedPhotoId: null,
    });

    // Instantly remove / clear all deleted photos from canvas spreads
    try {
      const { useAlbumStore } = await import('./albumStore');
      const { currentAlbum, saveAlbumToDb } = useAlbumStore.getState();
      if (currentAlbum) {
        let modified = false;

        const updateElements = (elements: any[]) =>
          elements.map((el) => {
            if (el.photoId && deletedSet.has(el.photoId)) {
              modified = true;
              return {
                ...el,
                photoId: null,
                filePath: '',
                previewPath: '',
                thumbnailPath: '',
                fileName: '',
                crop: undefined,
                cropScale: 1.0,
                cropX: 0,
                cropY: 0,
                photoAspect: undefined,
              };
            }
            return el;
          });

        const updatedCover = {
          ...currentAlbum.coverSpread,
          elements: updateElements(currentAlbum.coverSpread.elements || []),
        };

        const updatedSpreads = currentAlbum.spreads.map((spread) => ({
          ...spread,
          elements: updateElements(spread.elements || []),
        }));

        if (modified) {
          useAlbumStore.setState({
            currentAlbum: {
              ...currentAlbum,
              coverSpread: updatedCover,
              spreads: updatedSpreads,
            },
          });
          saveAlbumToDb();
        }
      }
    } catch (e) {
      console.error('[AFSN] Error clearing batch deleted photos from canvas:', e);
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('batch_delete_photos', { photoIds: selectedPhotoIds });
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] batch_delete_photos error:', err);
      await get().loadPhotos(projectId);
    }
  },

  batchToggleFavoritesSelected: async (isFavorite: boolean) => {
    const { selectedPhotoIds } = get();
    if (selectedPhotoIds.length === 0) return;

    set((s) => ({
      photos: s.photos.map((p) =>
        selectedPhotoIds.includes(p.id) ? { ...p, isFavorite } : p
      ),
    }));

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('batch_toggle_favorites', { photoIds: selectedPhotoIds, isFavorite });
    } catch (err) {
      console.error('[AFSN] batch_toggle_favorites error:', err);
    }
  },

  // Folder actions
  loadFolders: async (projectId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const folders = await invoke<PhotoFolder[]>('get_photo_folders', { projectId });
      const folderMap: Record<string, string[]> = {};

      if (Array.isArray(folders)) {
        for (const f of folders) {
          try {
            const fPhotos = await invoke<Photo[]>('get_photos_for_folder', { folderId: f.id });
            folderMap[f.id] = (fPhotos || []).map((p) => p.id);
          } catch (e) {
            folderMap[f.id] = [];
          }
        }
        set({ folders, folderPhotoIds: folderMap });
      }
    } catch (err) {
      console.warn('[AFSN] loadFolders error:', err);
    }
  },

  createFolder: async (projectId: string, name: string) => {
    if (!name.trim()) return null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const newFolder = await invoke<PhotoFolder>('create_photo_folder', { projectId, name: name.trim() });
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
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('rename_photo_folder', { folderId, name: name.trim() });
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
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_photo_folder', { folderId });
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
    }
  },

  setActiveFolder: (folderId: string | null) => {
    set({ activeFolderId: folderId, selectedPhotoIds: [], lastSelectedPhotoId: null });
  },

  addPhotosToFolder: async (projectId: string, folderId: string, photoIds: string[]) => {
    if (photoIds.length === 0) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('add_photos_to_folder', { folderId, photoIds });
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] add_photos_to_folder error:', err);
    }
  },

  removePhotosFromFolder: async (projectId: string, folderId: string, photoIds: string[]) => {
    if (photoIds.length === 0) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('remove_photos_from_folder', { folderId, photoIds });
      await get().loadFolders(projectId);
    } catch (err) {
      console.error('[AFSN] remove_photos_from_folder error:', err);
    }
  },

  movePhotosToFolder: async (projectId: string, fromFolderId: string, toFolderId: string, photoIds: string[]) => {
    if (photoIds.length === 0) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('move_photos_between_folders', { fromFolderId, toFolderId, photoIds });
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
  openRelink: () => set({ isRelinkOpen: true }),
  closeRelink: () => set({ isRelinkOpen: false }),
  openCreateFolderDialog: () => set({ isFolderDialogOpen: true, folderDialogMode: 'create', folderDialogTarget: null }),
  openRenameFolderDialog: (folder: PhotoFolder) => set({ isFolderDialogOpen: true, folderDialogMode: 'rename', folderDialogTarget: folder }),
  closeFolderDialog: () => set({ isFolderDialogOpen: false, folderDialogTarget: null }),
}));
