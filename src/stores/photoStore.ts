import { create } from 'zustand';
import { Photo, ImportProgress, PhotoFilter, PhotoSortBy } from '../domain/photo';

interface PhotoState {
  photos: Photo[];
  selectedPhotoId: string | null;
  filter: PhotoFilter;
  sortBy: PhotoSortBy;
  searchQuery: string;
  isImporting: boolean;
  importProgress: ImportProgress | null;
  isRelinkOpen: boolean;
  error: string | null;

  loadPhotos: (projectId: string) => Promise<void>;
  importFiles: (projectId: string) => Promise<void>;
  importFolder: (projectId: string) => Promise<void>;
  importPaths: (projectId: string, paths: string[]) => Promise<void>;
  toggleFavorite: (photoId: string) => Promise<void>;
  removePhoto: (photoId: string) => Promise<void>;
  checkMissing: (projectId: string) => Promise<void>;
  relinkFolder: (projectId: string) => Promise<void>;
  setupListeners: () => Promise<() => void>;

  setFilter: (filter: PhotoFilter) => void;
  setSortBy: (sortBy: PhotoSortBy) => void;
  setSearchQuery: (query: string) => void;
  selectPhoto: (photoId: string | null) => void;
  openRelink: () => void;
  closeRelink: () => void;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  selectedPhotoId: null,
  filter: 'all',
  sortBy: 'name',
  searchQuery: '',
  isImporting: false,
  importProgress: null,
  isRelinkOpen: false,
  error: null,

  setupListeners: async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');

      const unlistenProgress = await listen<ImportProgress>('photo-import-progress', (event) => {
        set({ isImporting: true, importProgress: event.payload });
      });

      const unlistenItem = await listen<Photo>('photo-imported', (event) => {
        const item = event.payload;
        set((s) => {
          if (s.photos.some((p) => p.id === item.id)) return s;
          return { photos: [...s.photos, item] };
        });
      });

      const unlistenComplete = await listen<{ total: number; imported: number }>('photo-import-complete', () => {
        set({ isImporting: false, importProgress: null });
      });

      return () => {
        unlistenProgress();
        unlistenItem();
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
    } catch (err) {
      console.warn('[AFSN] loadPhotos fallback or error:', err);
    }
  },

  importFiles: async (projectId: string) => {
    set({ isImporting: true, importProgress: null, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('select_and_import_files', { projectId });
      if (Array.isArray(updatedPhotos) && updatedPhotos.length > 0) {
        set({ photos: updatedPhotos });
      }
    } catch (err) {
      console.error('[AFSN] select_and_import_files error:', err);
      set({ error: String(err) });
    } finally {
      set({ isImporting: false, importProgress: null });
    }
  },

  importFolder: async (projectId: string) => {
    set({ isImporting: true, importProgress: null, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('select_and_import_folder', { projectId });
      if (Array.isArray(updatedPhotos) && updatedPhotos.length > 0) {
        set({ photos: updatedPhotos });
      }
    } catch (err) {
      console.error('[AFSN] select_and_import_folder error:', err);
      set({ error: String(err) });
    } finally {
      set({ isImporting: false, importProgress: null });
    }
  },

  importPaths: async (projectId: string, paths: string[]) => {
    if (paths.length === 0) return;
    set({ isImporting: true, importProgress: null, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('import_file_paths', { projectId, paths });
      if (Array.isArray(updatedPhotos) && updatedPhotos.length > 0) {
        set({ photos: updatedPhotos });
      }
    } catch (err) {
      console.error('[AFSN] import_file_paths error:', err);
      set({ error: String(err) });
    } finally {
      set({ isImporting: false, importProgress: null });
    }
  },

  toggleFavorite: async (photoId: string) => {
    const current = get().photos.find((p) => p.id === photoId);
    if (!current) return;
    const nextVal = !current.isFavorite;

    // Optimistic update
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
      selectedPhotoId: s.selectedPhotoId === photoId ? null : s.selectedPhotoId,
    }));

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
      }
    } catch (err) {
      console.warn('[AFSN] check_missing_photos error:', err);
    }
  },

  relinkFolder: async (projectId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedPhotos = await invoke<Photo[]>('relink_folder', { projectId });
      if (Array.isArray(updatedPhotos)) {
        set({ photos: updatedPhotos, isRelinkOpen: false });
      }
    } catch (err) {
      console.error('[AFSN] relink_folder error:', err);
    }
  },

  setFilter: (filter: PhotoFilter) => set({ filter }),
  setSortBy: (sortBy: PhotoSortBy) => set({ sortBy }),
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  selectPhoto: (selectedPhotoId: string | null) => set({ selectedPhotoId }),
  openRelink: () => set({ isRelinkOpen: true }),
  closeRelink: () => set({ isRelinkOpen: false }),
}));
