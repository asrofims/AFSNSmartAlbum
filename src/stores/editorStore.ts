import { create } from 'zustand';
import {
  alignFrames,
  applyFixedGap,
  clampCropTransform,
  DEFAULT_SNAPPING_CONFIG,
  distributeFrames,
  GapGuide,
  getPhotoAspect,
  matchFrameDimensions,
  PhotoFrameElement,
  SnapLine,
  SnappingConfig,
} from '../domain/editor';
import { Photo } from '../domain/photo';
import { getAllAlbumSpreads } from '../domain/album';
import { useAlbumStore } from './albumStore';
import { useProjectStore } from './projectStore';
import { usePhotoStore } from './photoStore';
import { useHistoryStore } from './historyStore';

export interface EditorState {
  selectedFrameIds: string[];
  editingCropFrameId: string | null;
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
  duplicateSelectedFrames: (spreadId: string) => void;
  replacePhotoInFrame: (spreadId: string, frameId: string, photo: Photo) => void;
  swapFrames: (spreadId: string, frameIdA: string, frameIdB: string) => void;
  bringToFront: (spreadId: string, frameId: string) => void;
  sendToBack: (spreadId: string, frameId: string) => void;
  rotateFrame90: (spreadId: string, frameId: string, direction?: 'cw' | 'ccw') => void;
  groupSelectedFrames: (spreadId: string) => void;
  ungroupSelectedFrames: (spreadId: string) => void;

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
  resetCrop: (spreadId: string, frameId: string) => void;
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
  editingCropFrameId: null,
  activeSnapLines: [],
  activeGapGuides: [],
  clipboardFrames: [],
  snapEnabled: true,
  snappingConfig: { ...DEFAULT_SNAPPING_CONFIG },
  multiResizeGapMode: 'proportional',
  isDragging: false,
  isResizing: false,

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

    if (multi) {
      const allSelected = targetIds.every((id) => selectedFrameIds.includes(id));
      if (allSelected) {
        set({ selectedFrameIds: selectedFrameIds.filter((id) => !targetIds.includes(id)) });
      } else {
        const uniqueSet = new Set([...selectedFrameIds, ...targetIds]);
        set({ selectedFrameIds: Array.from(uniqueSet) });
      }
    } else {
      set({ selectedFrameIds: targetIds, editingCropFrameId: null });
    }
  },

  selectFrames: (frameIds: string[]) => {
    set({ selectedFrameIds: frameIds, editingCropFrameId: null });
  },

  clearSelection: () => {
    set({ selectedFrameIds: [], editingCropFrameId: null, activeSnapLines: [] });
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
      previewPath: photo.previewPath || photo.filePath || '',
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

    useHistoryStore.getState().pushState(currentAlbum);

    const idsToDelete = new Set(selectedFrameIds);

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

    set({ selectedFrameIds: [], editingCropFrameId: null });
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

  duplicateSelectedFrames: (spreadId) => {
    get().copySelectedFrames(spreadId);
    get().pasteFrames(spreadId);
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
        previewPath: photo.previewPath || photo.filePath || '',
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

    set({ selectedFrameIds: [frameId] });
  },

  swapFrames: (spreadId, frameIdA, frameIdB) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || frameIdA === frameIdB) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const swapInElements = (elements: PhotoFrameElement[]): PhotoFrameElement[] => {
      const elA = elements.find((f) => f.id === frameIdA);
      const elB = elements.find((f) => f.id === frameIdB);
      if (!elA || !elB) return elements;

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

    set({ selectedFrameIds: [frameIdA, frameIdB] });
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

  rotateFrame90: (spreadId, frameId, direction = 'cw') => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    const delta = direction === 'cw' ? 90 : -90;
    const { updateFrameGeometry } = get();

    const activeSpread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);

    const frame = (activeSpread?.elements || []).find((f) => f.id === frameId);
    if (!frame) return;

    const newRotation = (frame.rotation + delta + 360) % 360;
    updateFrameGeometry(spreadId, frameId, { rotation: newRotation });
  },

  groupSelectedFrames: (spreadId: string) => {
    const { selectedFrameIds } = get();
    if (selectedFrameIds.length < 2) return;

    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

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

  alignSelectedFrames: (spreadId, alignment) => {
    const { selectedFrameIds, batchUpdateFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length < 2) return;

    const spread =
      currentAlbum.coverSpread.id === spreadId
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!spread) return;

    const selectedFrames = (spread.elements || []).filter((f) =>
      selectedFrameIds.includes(f.id)
    );
    const updates = alignFrames(selectedFrames, alignment);
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
      selectedFrameIds.includes(f.id)
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
      selectedFrameIds.includes(f.id)
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
      selectedFrameIds.includes(f.id)
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

  resetCrop: (spreadId, frameId) => {
    const { updateFrameGeometry } = get();
    updateFrameGeometry(spreadId, frameId, {
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
    });
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
      return {
        snapEnabled: next,
        snappingConfig: { ...s.snappingConfig, enabled: next },
      };
    });
  },

  updateSnappingConfig: (updates) => {
    set((s) => {
      const nextConfig = { ...s.snappingConfig, ...updates };
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
      .filter((f) => selectedFrameIds.includes(f.id))
      .map((f) => ({
        id: f.id,
        geometry: { x: f.x + dx, y: f.y + dy },
      }));

    get().batchUpdateFrames(spreadId, updates);
  },
}));
