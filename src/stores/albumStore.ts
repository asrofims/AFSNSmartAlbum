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
import {
  LayoutTemplate,
  generateSpreadElementsFromTemplate,
  getProjectDimensionsInCanvasUnit,
} from '../domain/templates';
import {
  AdaptivePhoto,
  generateAdaptiveLayoutVariations,
  buildSpreadElementsFromVariation,
  shuffleElementsPhotos,
} from '../domain/adaptiveLayout';
import { useHistoryStore } from './historyStore';
import { useProjectStore } from './projectStore';
import { PhotoFrameElement } from '../domain/editor';

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
  updatePhotoInset: (photoInset: number) => void;
  toggleGuide: (guide: 'gutter' | 'bleed' | 'safeArea') => void;
  selectPage: (pageId: string | null) => void;
  setSpreadDrawerOpen: (isOpen: boolean) => void;
  toggleSpreadDrawer: () => void;
  // Adaptive Smart Layout State
  spreadLayoutIndices: Record<string, number>;
  cycleSpreadLayout: (spreadId: string, direction: 'next' | 'prev', project: Project) => void;
  shuffleSpreadPhotos: (spreadId: string) => void;
  applyAdaptiveLayoutByIndex: (spreadId: string, index: number, project: Project) => void;
  applyLayoutTemplate: (spreadId: string, template: LayoutTemplate, project: Project) => void;
}


function recomputeSpreadElementsWithParams(
  targetSpread: Spread,
  isCover: boolean,
  currentProject: Project | null,
  activeSpreadId: string,
  spreadLayoutIndices: Record<string, number>,
  overrides?: { safeArea?: number; photoInset?: number }
): PhotoFrameElement[] {
  if (!currentProject || !targetSpread.elements || targetSpread.elements.length === 0) {
    return targetSpread.elements;
  }

  const photos = targetSpread.elements.map((el) => ({
    id: el.id,
    photoId: el.photoId,
    filePath: el.filePath,
    fileName: el.fileName,
    previewPath: el.previewPath,
    thumbnailPath: el.thumbnailPath,
    photoAspect: el.photoAspect,
  }));

  const mergedSpread: Spread = {
    ...targetSpread,
    safeArea: overrides?.safeArea !== undefined ? overrides.safeArea : (targetSpread.safeArea ?? currentProject.marginValue ?? 10),
    photoInset: overrides?.photoInset !== undefined ? overrides.photoInset : (targetSpread.photoInset ?? currentProject.photoInset ?? 0),
  };

  const isSpread = !isCover;
  const dims = getProjectDimensionsInCanvasUnit(currentProject, mergedSpread);
  const spreadWidth = isCover
    ? (mergedSpread.leftPage ? mergedSpread.leftPage.width : dims.pageWidth) +
      (mergedSpread.rightPage ? mergedSpread.rightPage.width : 0) +
      dims.gutterWidth
    : dims.pageWidth * 2 + dims.gutterWidth;
  const spreadHeight = dims.pageHeight;

  const variations = generateAdaptiveLayoutVariations(
    {
      spreadWidth,
      spreadHeight,
      isSpread,
      safeMargin: dims.safeMargin,
      photoInset: dims.photoInset,
      gutterWidth: dims.gutterWidth,
      spacing: dims.spacing,
    },
    photos
  );

  const currentIndex = spreadLayoutIndices[activeSpreadId] || 0;
  const safeIndex = variations.length > 0 ? currentIndex % variations.length : 0;
  const chosenVar = variations[safeIndex];

  if (chosenVar) {
    return buildSpreadElementsFromVariation(
      chosenVar,
      photos,
      currentProject.borderEnabled,
      currentProject.borderWidth,
      currentProject.borderColor
    );
  }

  return targetSpread.elements;
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
    const { currentAlbum, activeSpreadId, spreadLayoutIndices } = get();
    if (!currentAlbum || !activeSpreadId) return;

    useHistoryStore.getState().pushState(currentAlbum);
    const currentProject = useProjectStore.getState().currentProject;

    if (currentAlbum.coverSpread.id === activeSpreadId) {
      const updatedElements = recomputeSpreadElementsWithParams(
        currentAlbum.coverSpread,
        true,
        currentProject,
        activeSpreadId,
        spreadLayoutIndices,
        { safeArea }
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, safeArea, elements: updatedElements },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) => {
      if (s.id !== activeSpreadId) return s;
      const updatedElements = recomputeSpreadElementsWithParams(
        s,
        false,
        currentProject,
        activeSpreadId,
        spreadLayoutIndices,
        { safeArea }
      );
      return { ...s, safeArea, elements: updatedElements };
    });

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  updatePhotoInset: (photoInset: number) => {
    const { currentAlbum, activeSpreadId, spreadLayoutIndices } = get();
    if (!currentAlbum || !activeSpreadId) return;

    useHistoryStore.getState().pushState(currentAlbum);
    const currentProject = useProjectStore.getState().currentProject;

    if (currentAlbum.coverSpread.id === activeSpreadId) {
      const updatedElements = recomputeSpreadElementsWithParams(
        currentAlbum.coverSpread,
        true,
        currentProject,
        activeSpreadId,
        spreadLayoutIndices,
        { photoInset }
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, photoInset, elements: updatedElements },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) => {
      if (s.id !== activeSpreadId) return s;
      const updatedElements = recomputeSpreadElementsWithParams(
        s,
        false,
        currentProject,
        activeSpreadId,
        spreadLayoutIndices,
        { photoInset }
      );
      return { ...s, photoInset, elements: updatedElements };
    });

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

  applyLayoutTemplate: (spreadId: string, template: LayoutTemplate, project: Project) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread) return;

    useHistoryStore.getState().pushState(currentAlbum);

    // Collect currently assigned photos from current elements
    const currentPhotos = targetSpread.elements.map((el) => ({
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

    const newElements = generateSpreadElementsFromTemplate(
      template,
      {
        spreadWidth,
        spreadHeight,
        isSpread,
        safeMargin: dims.safeMargin,
        gutterWidth: dims.gutterWidth,
        spacing: dims.spacing,
        currentPhotos,
      },
      project.borderEnabled,
      project.borderWidth,
      project.borderColor
    );

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: newElements,
          },
        },
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
        saveStatus: 'unsaved',
      });
    }
  },

  cycleSpreadLayout: (spreadId: string, direction: 'next' | 'prev', project: Project) => {
    const { currentAlbum, spreadLayoutIndices } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread || targetSpread.elements.length === 0) return;

    const currentPhotos: AdaptivePhoto[] = targetSpread.elements.map((el) => ({
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
      },
      currentPhotos
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

    const newElements = buildSpreadElementsFromVariation(
      chosenVariation,
      currentPhotos,
      project.borderEnabled,
      project.borderWidth,
      project.borderColor
    );

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

    const currentPhotos: AdaptivePhoto[] = targetSpread.elements.map((el) => ({
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
      },
      currentPhotos
    );

    if (variations.length === 0 || index < 0 || index >= variations.length) return;

    const chosenVariation = variations[index];
    if (!chosenVariation) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const newElements = buildSpreadElementsFromVariation(
      chosenVariation,
      currentPhotos,
      project.borderEnabled,
      project.borderWidth,
      project.borderColor
    );

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
