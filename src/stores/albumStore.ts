import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Project } from '../domain/project';
import {
  Album,
  Spread,
  createInitialAlbum,
  createInteriorSpread,
  duplicateAlbumSpread,
  recalculateAlbumPageNumbers,
  reorderAlbumSpreads,
  moveAlbumSpread,
  getAllAlbumSpreads,
  syncAlbumPhotoAssets,
} from '../domain/album';
import { getProjectDimensionsInCanvasUnit } from '../domain/templates';
import {
  AdaptivePhoto,
  generateAdaptiveLayoutVariations,
  buildSpreadElementsFromVariation,
  shuffleElementsPhotos,
} from '../domain/adaptiveLayout';
import { useHistoryStore } from './historyStore';
import type { PhotoFrameElement } from '../domain/editor';
import type { Photo } from '../domain/photo';

export interface AlbumState {
  currentAlbum: Album | null;
  activeSpreadId: string | null;
  activeSpreadIndex: number;
  selectedPageId: string | null;

  // Persistence State
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedAt: string | null;

  // Visual Guide Toggles
  showGutterGuide: boolean;
  showBleedGuide: boolean;
  showSafeAreaGuide: boolean;

  // Spread Drawer Open State
  isSpreadDrawerOpen: boolean;

  // Actions
  initializeAlbum: (project: Project) => void;
  loadAlbumFromDb: (projectId: string) => Promise<boolean>;
  saveAlbumToDb: () => Promise<boolean>;
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;
  syncPhotoAssets: (photos: Photo[], options?: { persist?: boolean }) => Promise<boolean>;
  undo: () => void;
  redo: () => void;
  setActiveSpread: (spreadId: string) => void;
  setActiveSpreadByIndex: (index: number) => void;
  nextSpread: () => void;
  prevSpread: () => void;
  addSpread: (project: Project, afterIndex?: number) => void;
  deleteSpread: (spreadId: string) => void;
  duplicateSpread: (spreadId: string, project: Project) => void;
  moveSpread: (spreadId: string, direction: 'left' | 'right') => void;
  reorderSpread: (fromIndex: number, toIndex: number) => void;
  updateBleed: (bleed: number) => void;
  updateSafeArea: (safeArea: number) => void;
  updatePhotoInset: (photoInset: number, side?: 'all' | 'top' | 'bottom' | 'left' | 'right') => void;
  toggleGuide: (guide: 'gutter' | 'bleed' | 'safeArea') => void;
  selectPage: (pageId: string | null) => void;
  setSpreadDrawerOpen: (isOpen: boolean) => void;
  toggleSpreadDrawer: () => void;
  // Adaptive Smart Layout State
  spreadLayoutIndices: Record<string, number>;
  cycleSpreadLayout: (spreadId: string, direction: 'next' | 'prev', project: Project) => void;
  shuffleSpreadPhotos: (spreadId: string) => void;
  applyAdaptiveLayoutByIndex: (spreadId: string, index: number, project: Project) => void;
}

export const useAlbumStore = create<AlbumState>((set, get) => ({
  currentAlbum: null,
  activeSpreadId: null,
  activeSpreadIndex: 0,
  selectedPageId: null,

  saveStatus: 'saved',
  lastSavedAt: null,

  showGutterGuide: true,
  showBleedGuide: true,
  showSafeAreaGuide: true,
  isSpreadDrawerOpen: false,
  spreadLayoutIndices: {},

  setSpreadDrawerOpen: (isOpen: boolean) => set({ isSpreadDrawerOpen: isOpen }),
  toggleSpreadDrawer: () => set((s) => ({ isSpreadDrawerOpen: !s.isSpreadDrawerOpen })),
  setSaveStatus: (status) => set({ saveStatus: status }),

  syncPhotoAssets: async (photos, options = {}) => {
    const { currentAlbum, saveAlbumToDb } = get();
    if (!currentAlbum || photos.length === 0) return false;

    const { album: syncedAlbum, changed } = syncAlbumPhotoAssets(currentAlbum, photos);
    if (!changed) return false;

    set({
      currentAlbum: syncedAlbum,
      saveStatus: options.persist ? 'saving' : 'unsaved',
    });

    if (options.persist) {
      return saveAlbumToDb();
    }

    return true;
  },

  initializeAlbum: (project: Project) => {
    const album = createInitialAlbum(project);
    useHistoryStore.getState().clearHistory();
    set({
      currentAlbum: album,
      activeSpreadId: album.spreads[0]?.id || '',
      activeSpreadIndex: 0, // Default to Spread 1 (Pages 1-2)
      selectedPageId: null,
      saveStatus: 'saved',
      lastSavedAt: new Date().toLocaleTimeString(),
    });
  },

  loadAlbumFromDb: async (projectId: string) => {
    try {
      const payload = await invoke<any>('load_album_structure', { projectId });
      if (payload && payload.spreads && payload.spreads.length > 0) {
        useHistoryStore.getState().clearHistory();
        set({
          currentAlbum: payload as Album,
          activeSpreadId: payload.spreads[0]?.id || payload.coverSpread?.id || '',
          activeSpreadIndex: 0,
          selectedPageId: null,
          saveStatus: 'saved',
          lastSavedAt: new Date().toLocaleTimeString(),
        });
        try {
          const { usePhotoStore } = await import('./photoStore');
          await get().syncPhotoAssets(usePhotoStore.getState().photos, { persist: true });
        } catch (err) {
          console.warn('[AFSN] sync loaded album photo assets error:', err);
        }
        return true;
      }
    } catch (err) {
      console.warn('Could not load album structure from SQLite DB, checking snapshot:', err);
    }

    // Fallback: Check local storage snapshot
    try {
      const raw = localStorage.getItem(`afsn_snapshot_${projectId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.album && parsed.album.spreads && parsed.album.spreads.length > 0) {
          useHistoryStore.getState().clearHistory();
          set({
            currentAlbum: parsed.album as Album,
            activeSpreadId: parsed.album.spreads[0]?.id || parsed.album.coverSpread?.id || '',
            activeSpreadIndex: 0,
            selectedPageId: null,
            saveStatus: 'saved',
            lastSavedAt: new Date().toLocaleTimeString(),
          });
          try {
            const { usePhotoStore } = await import('./photoStore');
            await get().syncPhotoAssets(usePhotoStore.getState().photos, { persist: true });
          } catch (err) {
            console.warn('[AFSN] sync loaded album photo assets error:', err);
          }
          // Resync to SQLite
          try {
            await invoke('save_album_structure', { album: parsed.album });
          } catch {}
          return true;
        }
      }
    } catch {}

    return false;
  },

  saveAlbumToDb: async () => {
    const { currentAlbum } = get();
    if (!currentAlbum) return false;

    set({ saveStatus: 'saving' });

    // Clean up / sanitize album payload so all fields are defined
    const sanitizeElement = (el: PhotoFrameElement): PhotoFrameElement => ({
      ...el,
      type: el.type || 'photo',
      photoId: el.photoId || null,
      filePath: el.filePath || '',
      fileName: el.fileName || '',
      previewPath: el.previewPath || '',
      thumbnailPath: el.thumbnailPath || '',
      x: Number.isFinite(el.x) ? el.x : 0,
      y: Number.isFinite(el.y) ? el.y : 0,
      width: Number.isFinite(el.width) ? el.width : 100,
      height: Number.isFinite(el.height) ? el.height : 100,
      rotation: Number.isFinite(el.rotation) ? el.rotation : 0,
      zIndex: Number.isFinite(el.zIndex) ? el.zIndex : 1,
      photoAspect: typeof el.photoAspect === 'number' && el.photoAspect > 0 ? el.photoAspect : 1.5,
      cropX: Number.isFinite(el.cropX) ? el.cropX : 0,
      cropY: Number.isFinite(el.cropY) ? el.cropY : 0,
      cropScale: Number.isFinite(el.cropScale) && el.cropScale > 0 ? el.cropScale : 1.0,
      borderEnabled: Boolean(el.borderEnabled),
      borderWidth: Number.isFinite(el.borderWidth) ? el.borderWidth : 0,
      borderColor: el.borderColor || '#FFFFFF',
      opacity: Number.isFinite(el.opacity) ? el.opacity : 1.0,
    });

    const sanitizedAlbum: Album = {
      ...currentAlbum,
      coverSpread: {
        ...currentAlbum.coverSpread,
        elements: (currentAlbum.coverSpread.elements || []).map(sanitizeElement),
      },
      spreads: (currentAlbum.spreads || []).map((spread) => ({
        ...spread,
        elements: (spread.elements || []).map(sanitizeElement),
      })),
    };

    try {
      await invoke('save_album_structure', { album: sanitizedAlbum });
      // Update local storage crash recovery snapshot
      try {
        localStorage.setItem(`afsn_snapshot_${sanitizedAlbum.projectId}`, JSON.stringify({
          projectId: sanitizedAlbum.projectId,
          savedAt: new Date().toISOString(),
          album: sanitizedAlbum,
        }));
      } catch {}

      set({
        currentAlbum: sanitizedAlbum,
        saveStatus: 'saved',
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      return true;
    } catch (err) {
      console.error('Failed to save album to SQLite DB:', err);
      // Fallback: save to localStorage snapshot so data is never lost
      try {
        localStorage.setItem(`afsn_snapshot_${sanitizedAlbum.projectId}`, JSON.stringify({
          projectId: sanitizedAlbum.projectId,
          savedAt: new Date().toISOString(),
          album: sanitizedAlbum,
        }));
        set({
          currentAlbum: sanitizedAlbum,
          saveStatus: 'saved',
          lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
        return true;
      } catch {}
      set({ saveStatus: 'unsaved' });
      return false;
    }
  },

  undo: () => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const previousAlbum = useHistoryStore.getState().undo(currentAlbum);
    if (previousAlbum) {
      const all = getAllAlbumSpreads(previousAlbum);
      const activeId = get().activeSpreadId;
      const validActiveId = all.some((s) => s.id === activeId)
        ? activeId
        : (all[0]?.id || previousAlbum.coverSpread?.id || '');
      const validIndex = all.findIndex((s) => s.id === validActiveId);

      set({
        currentAlbum: previousAlbum,
        activeSpreadId: validActiveId,
        activeSpreadIndex: Math.max(0, validIndex),
        saveStatus: 'unsaved',
      });
    }
  },

  redo: () => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const nextAlbum = useHistoryStore.getState().redo(currentAlbum);
    if (nextAlbum) {
      const all = getAllAlbumSpreads(nextAlbum);
      const activeId = get().activeSpreadId;
      const validActiveId = all.some((s) => s.id === activeId)
        ? activeId
        : (all[0]?.id || nextAlbum.coverSpread?.id || '');
      const validIndex = all.findIndex((s) => s.id === validActiveId);

      set({
        currentAlbum: nextAlbum,
        activeSpreadId: validActiveId,
        activeSpreadIndex: Math.max(0, validIndex),
        saveStatus: 'unsaved',
      });
    }
  },

  setActiveSpread: (spreadId: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const all = getAllAlbumSpreads(currentAlbum);
    const foundIndex = all.findIndex((s) => s.id === spreadId);
    if (foundIndex !== -1) {
      set({
        activeSpreadId: spreadId,
        activeSpreadIndex: foundIndex,
        selectedPageId: null,
      });
    }
  },

  setActiveSpreadByIndex: (index: number) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const all = getAllAlbumSpreads(currentAlbum);
    if (index >= 0 && index < all.length) {
      const targetSpread = all[index];
      if (targetSpread) {
        set({
          activeSpreadId: targetSpread.id,
          activeSpreadIndex: index,
          selectedPageId: null,
        });
      }
    }
  },

  nextSpread: () => {
    const { activeSpreadIndex, setActiveSpreadByIndex } = get();
    setActiveSpreadByIndex(activeSpreadIndex + 1);
  },

  prevSpread: () => {
    const { activeSpreadIndex, setActiveSpreadByIndex } = get();
    if (activeSpreadIndex > 0) {
      setActiveSpreadByIndex(activeSpreadIndex - 1);
    }
  },

  addSpread: (project: Project, afterIndex?: number) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const newSpreadNumber = currentAlbum.spreads.length + 1;
    const newSpread = createInteriorSpread(currentAlbum, project, newSpreadNumber);

    let updatedSpreads: Spread[];
    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex <= currentAlbum.spreads.length) {
      updatedSpreads = [
        ...currentAlbum.spreads.slice(0, afterIndex),
        newSpread,
        ...currentAlbum.spreads.slice(afterIndex),
      ];
    } else {
      updatedSpreads = [...currentAlbum.spreads, newSpread];
    }

    const updatedAlbum = recalculateAlbumPageNumbers({
      ...currentAlbum,
      spreads: updatedSpreads,
    });

    const newIndex = updatedAlbum.spreads.findIndex((s) => s.id === newSpread.id);

    set({
      currentAlbum: updatedAlbum,
      activeSpreadId: newSpread.id,
      activeSpreadIndex: Math.max(0, newIndex),
      selectedPageId: null,
      saveStatus: 'unsaved',
    });
  },

  deleteSpread: (spreadId: string) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum) return;

    // Must have at least 1 spread
    if (currentAlbum.spreads.length <= 1) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const filtered = currentAlbum.spreads.filter((s) => s.id !== spreadId);
    const updatedAlbum = recalculateAlbumPageNumbers({
      ...currentAlbum,
      spreads: filtered,
    });

    const all = getAllAlbumSpreads(updatedAlbum);
    let nextActiveId = activeSpreadId;
    let nextIndex = 0;

    if (activeSpreadId === spreadId) {
      const fallbackSpread = all[0];
      if (fallbackSpread) {
        nextActiveId = fallbackSpread.id;
        nextIndex = 0;
      }
    } else {
      nextIndex = all.findIndex((s) => s.id === activeSpreadId);
    }

    set({
      currentAlbum: updatedAlbum,
      activeSpreadId: nextActiveId,
      activeSpreadIndex: Math.max(0, nextIndex),
      selectedPageId: null,
      saveStatus: 'unsaved',
    });
  },

  duplicateSpread: (spreadId: string, project: Project) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const result = duplicateAlbumSpread(currentAlbum, project, spreadId);
    if (!result) return;

    set({
      currentAlbum: result.updatedAlbum,
      activeSpreadId: result.newSpreadId,
      activeSpreadIndex: result.newSpreadIndex,
      selectedPageId: null,
      saveStatus: 'unsaved',
    });
  },

  moveSpread: (spreadId: string, direction: 'left' | 'right') => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const result = moveAlbumSpread(currentAlbum, spreadId, direction);
    if (!result) return;

    const nextActiveId = activeSpreadId === spreadId ? spreadId : (result.updatedAlbum.spreads[result.newActiveIndex]?.id || activeSpreadId);
    const nextActiveIndex = result.updatedAlbum.spreads.findIndex((s) => s.id === nextActiveId);

    set({
      currentAlbum: result.updatedAlbum,
      activeSpreadId: nextActiveId,
      activeSpreadIndex: Math.max(0, nextActiveIndex),
      saveStatus: 'unsaved',
    });
  },

  reorderSpread: (fromIndex: number, toIndex: number) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updatedAlbum = reorderAlbumSpreads(currentAlbum, fromIndex, toIndex);
    const nextActiveIndex = updatedAlbum.spreads.findIndex((s) => s.id === activeSpreadId);

    set({
      currentAlbum: updatedAlbum,
      activeSpreadIndex: Math.max(0, nextActiveIndex),
      saveStatus: 'unsaved',
    });
  },

  updateBleed: (bleed: number) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || !activeSpreadId) return;

    useHistoryStore.getState().pushState(currentAlbum);

    if (currentAlbum.coverSpread.id === activeSpreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, bleed },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === activeSpreadId ? { ...s, bleed } : s
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  updateSafeArea: (safeArea: number) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || !activeSpreadId) return;

    useHistoryStore.getState().pushState(currentAlbum);

    if (currentAlbum.coverSpread.id === activeSpreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, safeArea },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === activeSpreadId ? { ...s, safeArea } : s
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  updatePhotoInset: (photoInset: number, side: 'all' | 'top' | 'bottom' | 'left' | 'right' = 'all') => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || !activeSpreadId) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const patch: Partial<Spread> = {};
    if (side === 'all') {
      patch.photoInset = photoInset;
      patch.photoInsetTop = photoInset;
      patch.photoInsetBottom = photoInset;
      patch.photoInsetLeft = photoInset;
      patch.photoInsetRight = photoInset;
    } else if (side === 'top') {
      patch.photoInsetTop = photoInset;
    } else if (side === 'bottom') {
      patch.photoInsetBottom = photoInset;
    } else if (side === 'left') {
      patch.photoInsetLeft = photoInset;
    } else if (side === 'right') {
      patch.photoInsetRight = photoInset;
    }

    if (currentAlbum.coverSpread.id === activeSpreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, ...patch },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === activeSpreadId ? { ...s, ...patch } : s
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  toggleGuide: (guide: 'gutter' | 'bleed' | 'safeArea') => {
    if (guide === 'gutter') {
      set((s) => ({ showGutterGuide: !s.showGutterGuide }));
    } else if (guide === 'bleed') {
      set((s) => ({ showBleedGuide: !s.showBleedGuide }));
    } else if (guide === 'safeArea') {
      set((s) => ({ showSafeAreaGuide: !s.showSafeAreaGuide }));
    }
  },

  selectPage: (pageId: string | null) => {
    set({ selectedPageId: pageId });
  },

  cycleSpreadLayout: (spreadId: string, direction: 'next' | 'prev', project: Project) => {
    const { currentAlbum, spreadLayoutIndices } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread || targetSpread.elements.length === 0) return;

    const lockedElements = targetSpread.elements.filter((el) => el.locked);
    const unlockedElements = targetSpread.elements.filter((el) => !el.locked);

    // If all elements are locked, no changes can be made
    if (unlockedElements.length === 0) return;

    const unlockedPhotos: AdaptivePhoto[] = unlockedElements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
    }));

    const isSpread = !isCover;
    const dims = getProjectDimensionsInCanvasUnit(project, targetSpread);
    const spreadWidth = isCover
      ? (targetSpread.leftPage ? targetSpread.leftPage.width : dims.pageWidth) +
        (targetSpread.rightPage ? targetSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    const variations = generateAdaptiveLayoutVariations(
      {
        spreadWidth,
        spreadHeight,
        isSpread,
        safeMargin: dims.safeMargin,
        gutterWidth: dims.gutterWidth,
        spacing: dims.spacing,
        lockedElements,
      },
      unlockedPhotos
    );

    if (variations.length === 0) return;

    const currentIndex = spreadLayoutIndices[spreadId] || 0;
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % variations.length
        : (currentIndex - 1 + variations.length) % variations.length;

    const chosenVariation = variations[nextIndex];
    if (!chosenVariation) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const newUnlockedElements = buildSpreadElementsFromVariation(
      chosenVariation,
      unlockedPhotos,
      project.borderEnabled,
      project.borderWidth,
      project.borderColor
    );

    const newElements = [...lockedElements, ...newUnlockedElements];

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: newElements },
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: nextIndex },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: newElements } : s
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: nextIndex },
        saveStatus: 'unsaved',
      });
    }
  },

  shuffleSpreadPhotos: (spreadId: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread || targetSpread.elements.length <= 1) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const shuffledElements = shuffleElementsPhotos(targetSpread.elements);

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: shuffledElements },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: shuffledElements } : s
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        saveStatus: 'unsaved',
      });
    }
  },

  applyAdaptiveLayoutByIndex: (spreadId: string, index: number, project: Project) => {
    const { currentAlbum, spreadLayoutIndices } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread || targetSpread.elements.length === 0) return;

    const lockedElements = targetSpread.elements.filter((el) => el.locked);
    const unlockedElements = targetSpread.elements.filter((el) => !el.locked);

    // If all elements are locked, no changes can be made
    if (unlockedElements.length === 0) return;

    const unlockedPhotos: AdaptivePhoto[] = unlockedElements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
    }));

    const isSpread = !isCover;
    const dims = getProjectDimensionsInCanvasUnit(project, targetSpread);
    const spreadWidth = isCover
      ? (targetSpread.leftPage ? targetSpread.leftPage.width : dims.pageWidth) +
        (targetSpread.rightPage ? targetSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    const variations = generateAdaptiveLayoutVariations(
      {
        spreadWidth,
        spreadHeight,
        isSpread,
        safeMargin: dims.safeMargin,
        gutterWidth: dims.gutterWidth,
        spacing: dims.spacing,
        lockedElements,
      },
      unlockedPhotos
    );

    if (variations.length === 0 || index < 0 || index >= variations.length) return;

    const chosenVariation = variations[index];
    if (!chosenVariation) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const newUnlockedElements = buildSpreadElementsFromVariation(
      chosenVariation,
      unlockedPhotos,
      project.borderEnabled,
      project.borderWidth,
      project.borderColor
    );

    const newElements = [...lockedElements, ...newUnlockedElements];

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: newElements },
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: index },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: newElements } : s
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: index },
        saveStatus: 'unsaved',
      });
    }
  },
}));
