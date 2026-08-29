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
  getAllAlbumSpreads,
} from '../domain/album';
import { useHistoryStore } from './historyStore';

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
  undo: () => void;
  redo: () => void;
  setActiveSpread: (spreadId: string) => void;
  setActiveSpreadByIndex: (index: number) => void;
  nextSpread: () => void;
  prevSpread: () => void;
  addSpread: (project: Project, afterIndex?: number) => void;
  deleteSpread: (spreadId: string) => void;
  duplicateSpread: (spreadId: string, project: Project) => void;
  updateGutterWidth: (width: number) => void;
  updateBleed: (bleed: number) => void;
  updateSafeArea: (safeArea: number) => void;
  toggleGuide: (guide: 'gutter' | 'bleed' | 'safeArea') => void;
  selectPage: (pageId: string | null) => void;
  setSpreadDrawerOpen: (isOpen: boolean) => void;
  toggleSpreadDrawer: () => void;
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

  setSpreadDrawerOpen: (isOpen: boolean) => set({ isSpreadDrawerOpen: isOpen }),
  toggleSpreadDrawer: () => set((s) => ({ isSpreadDrawerOpen: !s.isSpreadDrawerOpen })),
  setSaveStatus: (status) => set({ saveStatus: status }),

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
        return true;
      }
    } catch (err) {
      console.warn('Could not load album structure from SQLite DB:', err);
    }
    return false;
  },

  saveAlbumToDb: async () => {
    const { currentAlbum } = get();
    if (!currentAlbum) return false;

    set({ saveStatus: 'saving' });
    try {
      await invoke('save_album_structure', { album: currentAlbum });
      set({
        saveStatus: 'saved',
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      return true;
    } catch (err) {
      console.error('Failed to save album to SQLite DB:', err);
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

  updateGutterWidth: (width: number) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || !activeSpreadId) return;

    useHistoryStore.getState().pushState(currentAlbum);

    if (currentAlbum.coverSpread.id === activeSpreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            gutterWidth: width,
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === activeSpreadId ? { ...s, gutterWidth: width } : s
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
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
}));
