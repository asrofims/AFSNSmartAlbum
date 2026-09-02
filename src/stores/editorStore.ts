import { create } from 'zustand';
import {
  alignFrames,
  applyFixedGap,
  calculateCenterRotatedPosition,
  calculateMultiFrameRotation,
  clampCropTransform,
  loadSavedSnappingConfig,
  saveSnappingConfig,
  distributeFrames,
  GapGuide,
  getPhotoAspect,
  matchFrameDimensions,
  PhotoFrameElement,
  SafeMarginBounds,
  SnapLine,
  SnappingConfig,
} from '../domain/editor';
import { Photo } from '../domain/photo';
import { Album, getAllAlbumSpreads } from '../domain/album';
import { getProjectDimensionsInCanvasUnit } from '../domain/templates';
import { useAlbumStore } from './albumStore';
import { useProjectStore } from './projectStore';
import { usePhotoStore } from './photoStore';
import { useHistoryStore } from './historyStore';

export interface EditorState {
  selectedFrameIds: string[];
  selectionGroupRotation: number | null;
  editingCropFrameId: string | null;
  setSelectionGroupRotation: (rot: number | null) => void;
  activeSnapLines: SnapLine[];
  activeGapGuides: GapGuide[];
  clipboardFrames: PhotoFrameElement[];
  snapEnabled: boolean;
  snappingConfig: SnappingConfig;
  multiResizeGapMode: 'proportional' | 'fixed_gap';
  isDragging: boolean;
  isResizing: boolean;

  // Selection
  selectFrame: (frameId: string, multi?: boolean) => void;
  selectFrames: (frameIds: string[]) => void;
  syncSelectionWithSpread: (spreadId: string, album?: Album) => void;
  clearSelection: () => void;

  // Frame Operations
  addPhotoToSpread: (
    spreadId: string,
    photo: Photo,
    pos?: { x: number; y: number },
    customSize?: { width: number; height: number }
  ) => void;
  updateFrameGeometry: (
    spreadId: string,
    frameId: string,
    geometry: Partial<PhotoFrameElement>
  ) => void;
  batchUpdateFrames: (
    spreadId: string,
    updates: { id: string; geometry: Partial<PhotoFrameElement> }[]
  ) => void;
  deleteSelectedFrames: (spreadId: string) => void;
  copySelectedFrames: (spreadId: string) => void;
  pasteFrames: (spreadId: string, targetPos?: { x: number; y: number }) => void;
  pasteFramesInPlace: (spreadId: string) => void;
  pasteFramesToAllSpreads: (options?: { includeCover?: boolean; replaceExisting?: boolean }) => { count: number; spreadsCount: number };
  duplicateSelectedFrames: (spreadId: string) => void;
  duplicateFramesToPosition: (
    spreadId: string,
    duplicates: { sourceId: string; x: number; y: number }[]
  ) => string[];
  replacePhotoInFrame: (spreadId: string, frameId: string, photo: Photo) => void;
  swapFrames: (spreadId: string, frameIdA: string, frameIdB: string) => void;
  bringToFront: (spreadId: string, frameId: string) => void;
  sendToBack: (spreadId: string, frameId: string) => void;
  bringSelectedToFront: (spreadId: string) => void;
  sendSelectedToBack: (spreadId: string) => void;
  rotateFrame90: (spreadId: string, frameId: string, direction?: 'cw' | 'ccw') => void;
  rotateSelectedFrames: (
    spreadId: string,
    deltaOrAngle: number | 'cw' | 'ccw',
    isAbsolute?: boolean
  ) => void;
  groupSelectedFrames: (spreadId: string) => void;
  ungroupSelectedFrames: (spreadId: string) => void;
  toggleLockSelectedFrames: (spreadId?: string, forceState?: boolean) => void;
  toggleLockSingleFrame: (spreadId: string, frameId: string, forceState?: boolean) => void;
  lockAllFramesOnSpread: (spreadId: string) => void;
  unlockAllFramesOnSpread: (spreadId: string) => void;

  // Batch Alignment & Distribution
  alignSelectedFrames: (
    spreadId: string,
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  ) => void;
  distributeSelectedFrames: (
    spreadId: string,
    direction: 'horizontal' | 'vertical'
  ) => void;
  applyFixedGapToSelected: (
    spreadId: string,
    direction: 'horizontal' | 'vertical',
    gap: number
  ) => void;
  matchSelectedDimensions: (
    spreadId: string,
    dimension: 'width' | 'height' | 'both'
  ) => void;

  // Crop Mode & Ratio Reset
  enterCropMode: (frameId: string) => void;
  exitCropMode: () => void;
  resetToOriginalRatio: (spreadId: string, frameId: string) => void;
  resetSelectedRatio: (spreadId: string) => void;
  resetCrop: (spreadId: string, frameId: string) => void;
  resetSelectedCrop: (spreadId: string) => void;
  updateCrop: (
    spreadId: string,
    frameId: string,
    crop: { cropX?: number; cropY?: number; cropScale?: number; cropRotation?: number }
  ) => void;

  // Snapping & Guides
  setSnapLines: (lines: SnapLine[], gaps?: GapGuide[]) => void;
  clearSnapLines: () => void;
  toggleSnap: () => void;
  updateSnappingConfig: (updates: Partial<SnappingConfig>) => void;
  setMultiResizeGapMode: (mode: 'proportional' | 'fixed_gap') => void;
  setDragging: (isDragging: boolean) => void;
  setResizing: (isResizing: boolean) => void;
  nudgeSelected: (spreadId: string, dx: number, dy: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedFrameIds: [],
  selectionGroupRotation: null,
  editingCropFrameId: null,
  activeSnapLines: [],
  activeGapGuides: [],
  clipboardFrames: [],
  snapEnabled: loadSavedSnappingConfig().enabled,
  snappingConfig: loadSavedSnappingConfig(),
  multiResizeGapMode: 'proportional',
  isDragging: false,
  isResizing: false,

  setSelectionGroupRotation: (rot: number | null) => set({ selectionGroupRotation: rot }),
  setMultiResizeGapMode: (mode: 'proportional' | 'fixed_gap') => set({ multiResizeGapMode: mode }),

  selectFrame: (frameId: string, multi = false) => {
    const { selectedFrameIds } = get();
    const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
    const spreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
    const activeSpread = spreads.find((s) => s.id === activeSpreadId) || spreads[0];
    const targetElement = activeSpread?.elements?.find((el) => el.id === frameId);

    // If element belongs to a group, resolve all group sibling IDs
    const targetGroupId = targetElement?.groupId;
    const targetIds = targetGroupId
      ? (activeSpread?.elements || []).filter((el) => el.groupId === targetGroupId).map((el) => el.id)
      : [frameId];

    let newSelectedIds: string[];
    if (multi) {
      const allSelected = targetIds.every((id) => selectedFrameIds.includes(id));
      if (allSelected) {
        newSelectedIds = selectedFrameIds.filter((id) => !targetIds.includes(id));
      } else {
        const uniqueSet = new Set([...selectedFrameIds, ...targetIds]);
        newSelectedIds = Array.from(uniqueSet);
      }
    } else {
      newSelectedIds = targetIds;
    }

    const selectedFrames = (activeSpread?.elements || []).filter((f) => newSelectedIds.includes(f.id));
    const sameSelection =
      newSelectedIds.length === selectedFrameIds.length &&
      newSelectedIds.every((id) => selectedFrameIds.includes(id));

    const firstGroupRot = selectedFrames[0]?.groupRotation;
    const allSameGroupRot =
      typeof firstGroupRot === 'number' &&
      selectedFrames.every(
        (f) =>
          typeof f.groupRotation === 'number' &&
          Math.abs(((((f.groupRotation % 360) + 360) % 360) - (((firstGroupRot % 360) + 360) % 360))) < 0.1
      );

    let groupRot: number | null = null;
    if (sameSelection && get().selectionGroupRotation !== null) {
      groupRot = get().selectionGroupRotation;
    } else if (allSameGroupRot && typeof firstGroupRot === 'number') {
      groupRot = (((firstGroupRot % 360) + 360) % 360);
    } else if (selectedFrames.length > 1) {
      const firstRot = (((selectedFrames[0]?.rotation || 0) % 360) + 360) % 360;
      const allSameRot = selectedFrames.every(
        (f) => Math.abs(((((f.rotation || 0) % 360) + 360) % 360) - firstRot) < 0.1
      );
      groupRot = allSameRot ? firstRot : 0;
    }

    set({
      selectedFrameIds: newSelectedIds,
      selectionGroupRotation: groupRot,
      editingCropFrameId: null,
    });
  },

  selectFrames: (frameIds: string[]) => {
    const { selectedFrameIds } = get();
    const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
    const spreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
    const activeSpread = spreads.find((s) => s.id === activeSpreadId) || spreads[0];
    const selectedFrames = (activeSpread?.elements || []).filter((f) => frameIds.includes(f.id));

    const sameSelection =
      frameIds.length === selectedFrameIds.length &&
      frameIds.every((id) => selectedFrameIds.includes(id));

    const firstGroupRot = selectedFrames[0]?.groupRotation;
    const allSameGroupRot =
      typeof firstGroupRot === 'number' &&
      selectedFrames.every(
        (f) =>
          typeof f.groupRotation === 'number' &&
          Math.abs(((((f.groupRotation % 360) + 360) % 360) - (((firstGroupRot % 360) + 360) % 360))) < 0.1
      );

    let groupRot: number | null = null;
    if (sameSelection && get().selectionGroupRotation !== null) {
      groupRot = get().selectionGroupRotation;
    } else if (allSameGroupRot && typeof firstGroupRot === 'number') {
      groupRot = (((firstGroupRot % 360) + 360) % 360);
    } else if (selectedFrames.length > 1) {
      const firstRot = (((selectedFrames[0]?.rotation || 0) % 360) + 360) % 360;
      const allSameRot = selectedFrames.every(
        (f) => Math.abs(((((f.rotation || 0) % 360) + 360) % 360) - firstRot) < 0.1
      );
      groupRot = allSameRot ? firstRot : 0;
    }

    set({
      selectedFrameIds: frameIds,
      selectionGroupRotation: groupRot,
      editingCropFrameId: null,
    });
  },

  clearSelection: () => {
    set({
      selectedFrameIds: [],
      selectionGroupRotation: null,
      editingCropFrameId: null,
      activeSnapLines: [],
    });
  },

  syncSelectionWithSpread: (spreadId: string, album?: Album) => {
    const currentAlbum = album || useAlbumStore.getState().currentAlbum;
    if (!currentAlbum) return;
    const spreads = getAllAlbumSpreads(currentAlbum);
    const spread = spreads.find((s) => s.id === spreadId);
    if (!spread) return;

    const { selectedFrameIds } = get();
    const validSelectedIds = selectedFrameIds.filter((id) =>
      (spread.elements || []).some((el) => el.id === id)
    );

    const selectedFrames = (spread.elements || []).filter((f) =>
      validSelectedIds.includes(f.id)
    );

    let groupRot: number | null = null;
    if (selectedFrames.length === 1) {
      groupRot = selectedFrames[0]?.rotation || 0;
    } else if (selectedFrames.length > 1) {
      const firstGroupRot = selectedFrames[0]?.groupRotation;
      const allSameGroupRot =
        typeof firstGroupRot === 'number' &&
        selectedFrames.every(
          (f) =>
            typeof f.groupRotation === 'number' &&
            Math.abs(((((f.groupRotation % 360) + 360) % 360) - (((firstGroupRot % 360) + 360) % 360))) < 0.1
        );

      if (allSameGroupRot && typeof firstGroupRot === 'number') {
        groupRot = (((firstGroupRot % 360) + 360) % 360);
      } else {
        const firstRot = (((selectedFrames[0]?.rotation || 0) % 360) + 360) % 360;
        const allSameRot = selectedFrames.every(
          (f) => Math.abs(((((f.rotation || 0) % 360) + 360) % 360) - firstRot) < 0.1
        );
        groupRot = allSameRot ? firstRot : 0;
      }
    }

    set({
      selectedFrameIds: validSelectedIds,
      selectionGroupRotation: groupRot,
    });
  },

  addPhotoToSpread: (spreadId, photo, pos, customSize) => {
    const { currentAlbum } = useAlbumStore.getState();
    const currentProject = useProjectStore.getState().currentProject;
    if (!currentAlbum || !currentProject) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const pageW = currentProject.canvasWidth;
    const pageH = currentProject.canvasHeight;

    const targetSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);

    const safeMargin = targetSpread?.safeArea ?? currentProject.marginValue ?? 10;
    const gutterW = targetSpread?.gutterWidth || 0;
    const maxSafeW = Math.max(10, pageW - safeMargin * 2);
    const maxSafeH = Math.max(10, pageH - safeMargin * 2);

    // Calculate default frame physical size based on photo aspect ratio
    const photoAspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
    let frameW = customSize?.width ?? Math.min(maxSafeW * 0.85, maxSafeH * 0.85 * photoAspect);
    let frameH = customSize?.height ?? (frameW / photoAspect);

    if (frameW > maxSafeW) {
      frameW = maxSafeW;
      frameH = frameW / photoAspect;
    }
    if (frameH > maxSafeH) {
      frameH = maxSafeH;
      frameW = frameH * photoAspect;
    }

    frameW = Math.round(frameW * 10) / 10;
    frameH = Math.round(frameH * 10) / 10;

    // Center in left or right page according to drop X or center in left page safe box
    let posX: number;
    let posY: number;

    if (pos?.x !== undefined && pos?.y !== undefined) {
      posX = Math.max(safeMargin, Math.min(pageW * 2 + gutterW - safeMargin - frameW, pos.x - frameW / 2));
      posY = Math.max(safeMargin, Math.min(pageH - safeMargin - frameH, pos.y - frameH / 2));
    } else {
      posX = safeMargin + (maxSafeW - frameW) / 2;
      posY = safeMargin + (maxSafeH - frameH) / 2;
    }

    const newFrame: PhotoFrameElement = {
      id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'photo',
      photoId: photo.id,
      filePath: photo.filePath,
      previewPath: photo.previewPath || photo.thumbnailPath || '',
      thumbnailPath: photo.thumbnailPath || '',
      fileName: photo.fileName,
      x: Math.max(0, posX),
      y: Math.max(0, posY),
      width: Math.round(frameW * 10) / 10,
      height: Math.round(frameH * 10) / 10,
      rotation: 0,
      zIndex: 1,
      photoAspect: photoAspect,
      originalWidth: Math.round(frameW * 10) / 10,
      originalHeight: Math.round(frameH * 10) / 10,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
      cropRotation: 0,
      borderEnabled: currentProject.borderEnabled || false,
      borderWidth: currentProject.borderWidth || 1,
      borderColor: currentProject.borderColor || '#FFFFFF',
      opacity: 1,
    };

    // Update album store
    if (currentAlbum.coverSpread.id === spreadId) {
      const existing = currentAlbum.coverSpread.elements || [];
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: [...existing, { ...newFrame, zIndex: existing.length + 1 }],
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          const existing = spread.elements || [];
          return {
            ...spread,
            elements: [...existing, { ...newFrame, zIndex: existing.length + 1 }],
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }

    set({ selectedFrameIds: [newFrame.id] });
  },

  updateFrameGeometry: (spreadId, frameId, geometry) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: (currentAlbum.coverSpread.elements || []).map((f) =>
          f.id === frameId ? { ...f, ...geometry } : f
        ),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: (spread.elements || []).map((f) =>
              f.id === frameId ? { ...f, ...geometry } : f
            ),
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  batchUpdateFrames: (_spreadId, updates) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || updates.length === 0) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateMap = new Map(updates.map((u) => [u.id, u.geometry]));

    const updatedCover = {
      ...currentAlbum.coverSpread,
      elements: (currentAlbum.coverSpread.elements || []).map((f) =>
        updateMap.has(f.id) ? { ...f, ...updateMap.get(f.id) } : f
      ),
    };

    const updatedSpreads = currentAlbum.spreads.map((spread) => ({
      ...spread,
      elements: (spread.elements || []).map((f) =>
        updateMap.has(f.id) ? { ...f, ...updateMap.get(f.id) } : f
      ),
    }));

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: updatedCover,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  deleteSelectedFrames: (_spreadId) => {
    const { selectedFrameIds } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length === 0) return;

    // Separate locked and unlocked frames
    const allElements = [
      ...(currentAlbum.coverSpread.elements || []),
      ...currentAlbum.spreads.flatMap((s) => s.elements || []),
    ];
    const lockedIds = new Set(allElements.filter((f) => f.locked).map((f) => f.id));
    const idsToDelete = new Set(selectedFrameIds.filter((id) => !lockedIds.has(id)));

    if (idsToDelete.size === 0) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updatedCover = {
      ...currentAlbum.coverSpread,
      elements: (currentAlbum.coverSpread.elements || []).filter(
        (f) => !idsToDelete.has(f.id)
      ),
    };

    const updatedSpreads = currentAlbum.spreads.map((spread) => ({
      ...spread,
      elements: (spread.elements || []).filter(
        (f) => !idsToDelete.has(f.id)
      ),
    }));

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: updatedCover,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });

    set({
      selectedFrameIds: selectedFrameIds.filter((id) => lockedIds.has(id)),
      editingCropFrameId: null,
    });
  },

  copySelectedFrames: (spreadId) => {
    const { selectedFrameIds } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length === 0) return;

    const activeSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!activeSpread) return;

    const toCopy = (activeSpread.elements || []).filter((f) =>
      selectedFrameIds.includes(f.id)
    );
    set({ clipboardFrames: toCopy });
  },

  pasteFrames: (spreadId, targetPos) => {
    const { clipboardFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    const currentProject = useProjectStore.getState().currentProject;
    if (!currentAlbum) return;

    // 1. If we have copied frames in editor clipboard
    if (clipboardFrames.length > 0) {
      const unit = currentProject?.canvasUnit || 'mm';
      const defaultOffset = unit === 'inch' ? 0.25 : unit === 'cm' ? 0.5 : unit === 'px' ? 20 : 5;

      let pasted: PhotoFrameElement[];

      if (targetPos) {
        const minX = Math.min(...clipboardFrames.map((f) => f.x));
        const minY = Math.min(...clipboardFrames.map((f) => f.y));
        const deltaX = targetPos.x - minX;
        const deltaY = targetPos.y - minY;

        pasted = clipboardFrames.map((f, idx) => ({
          ...f,
          id: `frame-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          x: Math.max(0, Number((f.x + deltaX).toFixed(1))),
          y: Math.max(0, Number((f.y + deltaY).toFixed(1))),
        }));
      } else {
        pasted = clipboardFrames.map((f, idx) => ({
          ...f,
          id: `frame-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          x: Math.max(0, Number((f.x + defaultOffset).toFixed(1))),
          y: Math.max(0, Number((f.y + defaultOffset).toFixed(1))),
        }));
      }

      if (currentAlbum.coverSpread.id === spreadId) {
        const existing = currentAlbum.coverSpread.elements || [];
        const updatedCover = {
          ...currentAlbum.coverSpread,
          elements: [
            ...existing,
            ...pasted.map((p, i) => ({ ...p, zIndex: existing.length + i + 1 })),
          ],
        };
        useAlbumStore.setState({
          currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
          saveStatus: 'unsaved',
        });
      } else {
        const updatedSpreads = currentAlbum.spreads.map((spread) => {
          if (spread.id === spreadId) {
            const existing = spread.elements || [];
            return {
              ...spread,
              elements: [
                ...existing,
                ...pasted.map((p, i) => ({ ...p, zIndex: existing.length + i + 1 })),
              ],
            };
          }
          return spread;
        });
        useAlbumStore.setState({
          currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
          saveStatus: 'unsaved',
        });
      }

      set({ selectedFrameIds: pasted.map((p) => p.id) });
      return;
    }

    // 2. If no frames in editor clipboard, check photo library clipboard
    const { clipboardPhotoIds, photos } = usePhotoStore.getState();
    if (clipboardPhotoIds.length > 0) {
      const selectedPhotos = photos.filter((p) => clipboardPhotoIds.includes(p.id));
      for (const p of selectedPhotos) {
        get().addPhotoToSpread(spreadId, p, targetPos);
      }
    }
  },

  pasteFramesInPlace: (spreadId) => {
    const { clipboardFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || clipboardFrames.length === 0) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const pasted: PhotoFrameElement[] = clipboardFrames.map((f, idx) => ({
      ...f,
      id: `frame-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      x: f.x,
      y: f.y,
    }));

    if (currentAlbum.coverSpread.id === spreadId) {
      const existing = currentAlbum.coverSpread.elements || [];
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: [
          ...existing,
          ...pasted.map((p, i) => ({ ...p, zIndex: existing.length + i + 1 })),
        ],
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          const existing = spread.elements || [];
          return {
            ...spread,
            elements: [
              ...existing,
              ...pasted.map((p, i) => ({ ...p, zIndex: existing.length + i + 1 })),
            ],
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }

    set({ selectedFrameIds: pasted.map((p) => p.id) });
  },

  pasteFramesToAllSpreads: (options) => {
    const { clipboardFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || clipboardFrames.length === 0) {
      return { count: 0, spreadsCount: 0 };
    }

    useHistoryStore.getState().pushState(currentAlbum);

    const includeCover = options?.includeCover ?? false;
    let spreadsModified = 0;

    const updatedSpreads = currentAlbum.spreads.map((spread, sIdx) => {
      const newFrames: PhotoFrameElement[] = clipboardFrames.map((f, idx) => ({
        ...f,
        id: `frame-${Date.now()}-${sIdx}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));

      const existing = options?.replaceExisting ? [] : (spread.elements || []);
      spreadsModified++;

      return {
        ...spread,
        elements: [
          ...existing,
          ...newFrames.map((p, i) => ({ ...p, zIndex: existing.length + i + 1 })),
        ],
      };
    });

    let updatedCover = currentAlbum.coverSpread;
    if (includeCover) {
      const coverFrames: PhotoFrameElement[] = clipboardFrames.map((f, idx) => ({
        ...f,
        id: `frame-${Date.now()}-c-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));
      const existing = options?.replaceExisting ? [] : (currentAlbum.coverSpread.elements || []);
      spreadsModified++;
      updatedCover = {
        ...currentAlbum.coverSpread,
        elements: [
          ...existing,
          ...coverFrames.map((p, i) => ({ ...p, zIndex: existing.length + i + 1 })),
        ],
      };
    }

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
        coverSpread: updatedCover,
      },
      saveStatus: 'unsaved',
    });

    return {
      count: clipboardFrames.length,
      spreadsCount: spreadsModified,
    };
  },

  duplicateSelectedFrames: (spreadId) => {
    get().copySelectedFrames(spreadId);
    get().pasteFrames(spreadId);
  },

  duplicateFramesToPosition: (spreadId, duplicates) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || duplicates.length === 0) return [];

    useHistoryStore.getState().pushState(currentAlbum);

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread) return [];

    const existing = targetSpread.elements || [];
    const newFrames: PhotoFrameElement[] = [];

    duplicates.forEach((d, idx) => {
      const source = existing.find((f) => f.id === d.sourceId);
      if (source) {
        newFrames.push({
          ...source,
          id: `frame-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          x: d.x,
          y: d.y,
          zIndex: existing.length + idx + 1,
        });
      }
    });

    if (newFrames.length === 0) return [];

    if (isCover) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: [...existing, ...newFrames],
          },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId
          ? { ...s, elements: [...existing, ...newFrames] }
          : s
      );
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        saveStatus: 'unsaved',
      });
    }

    const newIds = newFrames.map((f) => f.id);
    set({ selectedFrameIds: newIds });
    return newIds;
  },

  replacePhotoInFrame: (spreadId, frameId, photo) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const photoAspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;

    const updateFrame = (f: PhotoFrameElement): PhotoFrameElement => {
      if (f.id !== frameId) return f;
      return {
        ...f,
        photoId: photo.id,
        filePath: photo.filePath,
        previewPath: photo.previewPath || photo.thumbnailPath || '',
        thumbnailPath: photo.thumbnailPath || '',
        fileName: photo.fileName,
        photoAspect: photoAspect,
        // Reset crop for the new photo
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
      };
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: (currentAlbum.coverSpread.elements || []).map(updateFrame),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: (spread.elements || []).map(updateFrame),
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  swapFrames: (spreadId, frameIdA, frameIdB) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || frameIdA === frameIdB) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const swapInElements = (elements: PhotoFrameElement[]): PhotoFrameElement[] => {
      const elA = elements.find((f) => f.id === frameIdA);
      const elB = elements.find((f) => f.id === frameIdB);
      if (!elA || !elB || elA.locked || elB.locked) return elements;

      return elements.map((f) => {
        if (f.id === frameIdA) {
          return {
            ...f,
            photoId: elB.photoId,
            filePath: elB.filePath,
            previewPath: elB.previewPath,
            thumbnailPath: elB.thumbnailPath,
            fileName: elB.fileName,
            photoAspect: elB.photoAspect,
            cropX: 0,
            cropY: 0,
            cropScale: 1.0,
            cropRotation: 0,
          };
        }
        if (f.id === frameIdB) {
          return {
            ...f,
            photoId: elA.photoId,
            filePath: elA.filePath,
            previewPath: elA.previewPath,
            thumbnailPath: elA.thumbnailPath,
            fileName: elA.fileName,
            photoAspect: elA.photoAspect,
            cropX: 0,
            cropY: 0,
            cropScale: 1.0,
            cropRotation: 0,
          };
        }
        return f;
      });
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: swapInElements(currentAlbum.coverSpread.elements || []),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: swapInElements(spread.elements || []),
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  bringToFront: (spreadId, frameId) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateElements = (elements: PhotoFrameElement[]) => {
      const item = elements.find((f) => f.id === frameId);
      if (!item) return elements;
      const rest = elements.filter((f) => f.id !== frameId);
      return [...rest, item].map((f, idx) => ({ ...f, zIndex: idx + 1 }));
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: updateElements(currentAlbum.coverSpread.elements || []),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: updateElements(spread.elements || []),
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  sendToBack: (spreadId, frameId) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateElements = (elements: PhotoFrameElement[]) => {
      const item = elements.find((f) => f.id === frameId);
      if (!item) return elements;
      const rest = elements.filter((f) => f.id !== frameId);
      return [item, ...rest].map((f, idx) => ({ ...f, zIndex: idx + 1 }));
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: updateElements(currentAlbum.coverSpread.elements || []),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: updateElements(spread.elements || []),
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  bringSelectedToFront: (spreadId) => {
    const { selectedFrameIds } = get();
    if (selectedFrameIds.length === 0) return;

    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateElements = (elements: PhotoFrameElement[]) => {
      const selected = elements.filter((f) => selectedFrameIds.includes(f.id));
      const unselected = elements.filter((f) => !selectedFrameIds.includes(f.id));
      return [...unselected, ...selected].map((f, idx) => ({ ...f, zIndex: idx + 1 }));
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: updateElements(currentAlbum.coverSpread.elements || []),
          },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: updateElements(s.elements || []) } : s
      );
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  sendSelectedToBack: (spreadId) => {
    const { selectedFrameIds } = get();
    if (selectedFrameIds.length === 0) return;

    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateElements = (elements: PhotoFrameElement[]) => {
      const selected = elements.filter((f) => selectedFrameIds.includes(f.id));
      const unselected = elements.filter((f) => !selectedFrameIds.includes(f.id));
      return [...selected, ...unselected].map((f, idx) => ({ ...f, zIndex: idx + 1 }));
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: updateElements(currentAlbum.coverSpread.elements || []),
          },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: updateElements(s.elements || []) } : s
      );
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  rotateFrame90: (spreadId, frameId, direction = 'cw') => {
    const { selectedFrameIds, rotateSelectedFrames } = get();
    if (!selectedFrameIds.includes(frameId)) {
      set({ selectedFrameIds: [frameId] });
    }
    rotateSelectedFrames(spreadId, direction);
  },

  rotateSelectedFrames: (spreadId, deltaOrAngle, isAbsolute = false) => {
    const { selectedFrameIds } = get();
    if (selectedFrameIds.length === 0) return;

    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    const delta =
      deltaOrAngle === 'cw' ? 90 : deltaOrAngle === 'ccw' ? -90 : deltaOrAngle;

    const spreads = getAllAlbumSpreads(currentAlbum);
    const targetSpread = spreads.find((s) => s.id === spreadId);
    if (!targetSpread) return;

    const selectedFrames = (targetSpread.elements || []).filter((f) => selectedFrameIds.includes(f.id));
    if (selectedFrames.length === 0) return;

    if (selectedFrames.length === 1) {
      const f = selectedFrames[0];
      if (!f) return;
      let targetRotation: number;
      if (isAbsolute && typeof deltaOrAngle === 'number') {
        targetRotation = ((deltaOrAngle % 360) + 360) % 360;
      } else {
        targetRotation = (((f.rotation || 0) + delta) % 360 + 360) % 360;
      }

      if (Math.abs((f.rotation || 0) - targetRotation) < 0.001) {
        return;
      }

      useHistoryStore.getState().pushState(currentAlbum);
      const rotatedGeo = calculateCenterRotatedPosition(f, targetRotation);
      set({ selectionGroupRotation: targetRotation });

      const updateElements = (elements: PhotoFrameElement[]) =>
        elements.map((el) => {
          if (el.id !== f.id) return el;
          return {
            ...el,
            x: rotatedGeo.x,
            y: rotatedGeo.y,
            rotation: rotatedGeo.rotation,
          };
        });

      if (currentAlbum.coverSpread.id === spreadId) {
        useAlbumStore.setState({
          currentAlbum: {
            ...currentAlbum,
            coverSpread: {
              ...currentAlbum.coverSpread,
              elements: updateElements(currentAlbum.coverSpread.elements || []),
            },
          },
          saveStatus: 'unsaved',
        });
      } else {
        const updatedSpreads = currentAlbum.spreads.map((s) =>
          s.id === spreadId ? { ...s, elements: updateElements(s.elements || []) } : s
        );
        useAlbumStore.setState({
          currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
          saveStatus: 'unsaved',
        });
      }
      return;
    }

    // Multi-Frame Group Rotation with Invariant Centers, Dimensions, and Gaps
    let deltaDeg: number;
    let nextGroupRot: number;
    if (isAbsolute && typeof deltaOrAngle === 'number') {
      const targetGroupRot = ((deltaOrAngle % 360) + 360) % 360;
      const currentGroupRot = get().selectionGroupRotation ?? 0;
      deltaDeg = targetGroupRot - currentGroupRot;
      nextGroupRot = targetGroupRot;
    } else {
      deltaDeg = typeof delta === 'number' ? delta : 90;
      const prevRot = get().selectionGroupRotation ?? 0;
      nextGroupRot = (((prevRot + deltaDeg) % 360) + 360) % 360;
    }

    if (Math.abs(deltaDeg) < 0.001) {
      return;
    }

    useHistoryStore.getState().pushState(currentAlbum);
    const updates = calculateMultiFrameRotation(selectedFrames, deltaDeg);
    const updatedMap = new Map(updates.map((u) => [u.id, u.geometry]));
    set({ selectionGroupRotation: nextGroupRot });

    const updateElements = (elements: PhotoFrameElement[]) =>
      elements.map((el) => {
        const geom = updatedMap.get(el.id);
        if (!geom) return el;
        return {
          ...el,
          x: geom.x,
          y: geom.y,
          rotation: geom.rotation,
          groupRotation: geom.groupRotation ?? nextGroupRot,
        };
      });

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: updateElements(currentAlbum.coverSpread.elements || []),
          },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: updateElements(s.elements || []) } : s
      );
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  groupSelectedFrames: (spreadId: string) => {
    const { selectedFrameIds } = get();
    if (selectedFrameIds.length < 2) return;

    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    const targetSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);
    const targetElements = (targetSpread?.elements || []).filter((el) =>
      selectedFrameIds.includes(el.id)
    );

    const distinctGroupIds = new Set(targetElements.map((el) => el.groupId).filter(Boolean));
    const hasUngrouped = targetElements.some((el) => !el.groupId);

    // If all selected frames already belong to the exact same single group, no-op
    if (distinctGroupIds.size === 1 && !hasUngrouped) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const newGroupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const updateElements = (elements: PhotoFrameElement[]) =>
      elements.map((el) =>
        selectedFrameIds.includes(el.id) ? { ...el, groupId: newGroupId } : el
      );

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: updateElements(currentAlbum.coverSpread.elements || []),
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === spreadId ? { ...s, elements: updateElements(s.elements || []) } : s
    );

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  ungroupSelectedFrames: (spreadId: string) => {
    const { selectedFrameIds } = get();
    if (selectedFrameIds.length === 0) return;

    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const spreads = getAllAlbumSpreads(currentAlbum);
    const targetSpread = spreads.find((s) => s.id === spreadId);
    const targetElements = targetSpread?.elements || [];
    const selectedGroupIds = new Set(
      targetElements
        .filter((el) => selectedFrameIds.includes(el.id) && el.groupId)
        .map((el) => el.groupId as string)
    );

    if (selectedGroupIds.size === 0) return;

    const updateElements = (elements: PhotoFrameElement[]) =>
      elements.map((el) =>
        el.groupId && selectedGroupIds.has(el.groupId) ? { ...el, groupId: null } : el
      );

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: updateElements(currentAlbum.coverSpread.elements || []),
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === spreadId ? { ...s, elements: updateElements(s.elements || []) } : s
    );

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  toggleLockSelectedFrames: (_spreadId, forceState) => {
    const { selectedFrameIds } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length === 0) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const idsSet = new Set(selectedFrameIds);

    let targetLocked = forceState;
    if (targetLocked === undefined) {
      const allElements = [
        ...(currentAlbum.coverSpread.elements || []),
        ...currentAlbum.spreads.flatMap((s) => s.elements || []),
      ];
      const selected = allElements.filter((f) => idsSet.has(f.id));
      const hasUnlocked = selected.some((f) => !f.locked);
      targetLocked = hasUnlocked;
    }

    const updateElem = (f: PhotoFrameElement): PhotoFrameElement => {
      if (idsSet.has(f.id)) {
        return { ...f, locked: targetLocked };
      }
      return f;
    };

    const updatedCover = {
      ...currentAlbum.coverSpread,
      elements: (currentAlbum.coverSpread.elements || []).map(updateElem),
    };

    const updatedSpreads = currentAlbum.spreads.map((spread) => ({
      ...spread,
      elements: (spread.elements || []).map(updateElem),
    }));

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: updatedCover,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  toggleLockSingleFrame: (spreadId, frameId, forceState) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateElem = (f: PhotoFrameElement): PhotoFrameElement => {
      if (f.id === frameId) {
        const nextState = forceState !== undefined ? forceState : !f.locked;
        return { ...f, locked: nextState };
      }
      return f;
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: (currentAlbum.coverSpread.elements || []).map(updateElem),
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === spreadId
        ? { ...s, elements: (s.elements || []).map(updateElem) }
        : s
    );

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  lockAllFramesOnSpread: (spreadId) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateElem = (f: PhotoFrameElement): PhotoFrameElement => {
      if (!f.locked) {
        return { ...f, locked: true };
      }
      return f;
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: (currentAlbum.coverSpread.elements || []).map(updateElem),
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === spreadId
        ? { ...s, elements: (s.elements || []).map(updateElem) }
        : s
    );

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  unlockAllFramesOnSpread: (spreadId) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateElem = (f: PhotoFrameElement): PhotoFrameElement => {
      if (f.locked) {
        return { ...f, locked: false };
      }
      return f;
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      useAlbumStore.setState({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            elements: (currentAlbum.coverSpread.elements || []).map(updateElem),
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === spreadId
        ? { ...s, elements: (s.elements || []).map(updateElem) }
        : s
    );

    useAlbumStore.setState({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  alignSelectedFrames: (spreadId, alignment) => {
    const { selectedFrameIds, batchUpdateFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    const currentProject = useProjectStore.getState().currentProject;
    if (!currentAlbum || selectedFrameIds.length === 0) return;

    const spread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!spread) return;

    const selectedFrames = (spread.elements || []).filter((f) =>
      selectedFrameIds.includes(f.id) && !f.locked
    );
    if (selectedFrames.length === 0) return;

    let safeMarginBounds: SafeMarginBounds | undefined;
    if (currentProject) {
      const dims = getProjectDimensionsInCanvasUnit(currentProject, spread);
      safeMarginBounds = {
        singlePageWidth: dims.pageWidth,
        spreadHeight: dims.pageHeight,
        gutterWidth: dims.gutterWidth,
        safeMargin: dims.safeMargin,
      };
    }

    const updates = alignFrames(selectedFrames, alignment, safeMarginBounds);
    if (updates.length > 0) {
      batchUpdateFrames(spreadId, updates);
    }
  },

  distributeSelectedFrames: (spreadId, direction) => {
    const { selectedFrameIds, batchUpdateFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length < 3) return;

    const spread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!spread) return;

    const selectedFrames = (spread.elements || []).filter((f) =>
      selectedFrameIds.includes(f.id) && !f.locked
    );
    const updates = distributeFrames(selectedFrames, direction);
    if (updates.length > 0) {
      batchUpdateFrames(spreadId, updates);
    }
  },

  applyFixedGapToSelected: (spreadId, direction, gap) => {
    const { selectedFrameIds, batchUpdateFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length < 2) return;

    const spread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!spread) return;

    const selectedFrames = (spread.elements || []).filter((f) =>
      selectedFrameIds.includes(f.id) && !f.locked
    );
    const updates = applyFixedGap(selectedFrames, direction, gap);
    if (updates.length > 0) {
      batchUpdateFrames(spreadId, updates);
    }
  },

  matchSelectedDimensions: (spreadId, dimension) => {
    const { selectedFrameIds, batchUpdateFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length < 2) return;

    const spread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!spread) return;

    const selectedFrames = (spread.elements || []).filter((f) =>
      selectedFrameIds.includes(f.id) && !f.locked
    );
    const updates = matchFrameDimensions(selectedFrames, dimension);
    if (updates.length > 0) {
      batchUpdateFrames(spreadId, updates);
    }
  },

  enterCropMode: (frameId: string) => {
    set({ editingCropFrameId: frameId, selectedFrameIds: [frameId] });
  },

  exitCropMode: () => {
    const frameId = get().editingCropFrameId;
    set({
      editingCropFrameId: null,
      selectedFrameIds: frameId ? [frameId] : get().selectedFrameIds,
    });
  },

  resetToOriginalRatio: (spreadId, frameId) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    const activeSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);

    const frame = (activeSpread?.elements || []).find((f) => f.id === frameId);
    if (!frame) return;

    const aspect = getPhotoAspect(frame);
    const newHeight = Math.round((frame.width / aspect) * 10) / 10;

    const { updateFrameGeometry } = get();
    updateFrameGeometry(spreadId, frameId, {
      height: newHeight,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
    });
  },

  resetSelectedRatio: (spreadId) => {
    const { selectedFrameIds, batchUpdateFrames } = get();
    if (selectedFrameIds.length === 0) return;

    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    const activeSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!activeSpread) return;

    const updates = (activeSpread.elements || [])
      .filter((f) => selectedFrameIds.includes(f.id))
      .map((frame) => {
        const aspect = getPhotoAspect(frame);
        const newHeight = Math.round((frame.width / aspect) * 10) / 10;
        return {
          id: frame.id,
          geometry: {
            height: newHeight,
            cropX: 0,
            cropY: 0,
            cropScale: 1.0,
          },
        };
      });

    if (updates.length > 0) {
      batchUpdateFrames(spreadId, updates);
    }
  },

  resetCrop: (spreadId, frameId) => {
    const { updateFrameGeometry } = get();
    updateFrameGeometry(spreadId, frameId, {
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
    });
  },

  resetSelectedCrop: (spreadId) => {
    const { selectedFrameIds, batchUpdateFrames } = get();
    if (selectedFrameIds.length === 0) return;

    const updates = selectedFrameIds.map((id) => ({
      id,
      geometry: {
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
      },
    }));

    batchUpdateFrames(spreadId, updates);
  },

  updateCrop: (spreadId, frameId, crop) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    const activeSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);

    const frame = (activeSpread?.elements || []).find((f) => f.id === frameId);
    if (!frame) return;

    const nextCrop = clampCropTransform(frame, crop);
    get().updateFrameGeometry(spreadId, frameId, nextCrop);
  },

  setSnapLines: (lines: SnapLine[], gaps?: GapGuide[]) => {
    set({ activeSnapLines: lines, activeGapGuides: gaps || [] });
  },

  clearSnapLines: () => {
    set({ activeSnapLines: [], activeGapGuides: [] });
  },

  toggleSnap: () => {
    set((s) => {
      const next = !s.snapEnabled;
      const nextConfig = { ...s.snappingConfig, enabled: next };
      saveSnappingConfig(nextConfig);
      return {
        snapEnabled: next,
        snappingConfig: nextConfig,
      };
    });
  },

  updateSnappingConfig: (updates) => {
    set((s) => {
      const nextConfig = { ...s.snappingConfig, ...updates };
      saveSnappingConfig(nextConfig);
      return {
        snappingConfig: nextConfig,
        snapEnabled: nextConfig.enabled,
      };
    });
  },

  setDragging: (isDragging: boolean) => {
    set({ isDragging });
  },

  setResizing: (isResizing: boolean) => {
    set({ isResizing });
  },

  nudgeSelected: (spreadId, dx, dy) => {
    const { selectedFrameIds } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length === 0) return;

    const activeSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!activeSpread) return;

    const updates = (activeSpread.elements || [])
      .filter((f) => selectedFrameIds.includes(f.id) && !f.locked)
      .map((f) => ({
        id: f.id,
        geometry: { x: f.x + dx, y: f.y + dy },
      }));

    get().batchUpdateFrames(spreadId, updates);
  },
}));
