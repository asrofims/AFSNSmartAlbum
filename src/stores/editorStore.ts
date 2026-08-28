import { create } from 'zustand';
import {
  alignFrames,
  applyFixedGap,
  clampCropTransform,
  distributeFrames,
  GapGuide,
  getPhotoAspect,
  matchFrameDimensions,
  PhotoFrameElement,
  SnapLine,
} from '../domain/editor';
import { Photo } from '../domain/photo';
import { useAlbumStore } from './albumStore';
import { useProjectStore } from './projectStore';

export interface EditorState {
  selectedFrameIds: string[];
  editingCropFrameId: string | null;
  activeSnapLines: SnapLine[];
  activeGapGuides: GapGuide[];
  clipboardFrames: PhotoFrameElement[];
  snapEnabled: boolean;
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
  pasteFrames: (spreadId: string) => void;
  bringToFront: (spreadId: string, frameId: string) => void;
  sendToBack: (spreadId: string, frameId: string) => void;
  rotateFrame90: (spreadId: string, frameId: string, direction?: 'cw' | 'ccw') => void;

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
  isDragging: false,
  isResizing: false,

  selectFrame: (frameId: string, multi = false) => {
    const { selectedFrameIds } = get();
    if (multi) {
      if (selectedFrameIds.includes(frameId)) {
        set({ selectedFrameIds: selectedFrameIds.filter((id) => id !== frameId) });
      } else {
        set({ selectedFrameIds: [...selectedFrameIds, frameId] });
      }
    } else {
      set({ selectedFrameIds: [frameId], editingCropFrameId: null });
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

    const pageW = currentProject.canvasWidth;
    const pageH = currentProject.canvasHeight;

    // Calculate default frame physical size based on photo aspect ratio
    const photoAspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
    let frameW = customSize?.width ?? (pageW * 0.45);
    let frameH = customSize?.height ?? (frameW / photoAspect);

    if (frameH > pageH * 0.8) {
      frameH = pageH * 0.8;
      frameW = frameH * photoAspect;
    }
    frameW = Math.round(frameW * 10) / 10;
    frameH = Math.round((frameW / photoAspect) * 10) / 10;

    // Default position centered on left page or at drop point
    const posX = pos?.x !== undefined ? pos.x - frameW / 2 : (pageW - frameW) / 2;
    const posY = pos?.y !== undefined ? pos.y - frameH / 2 : (pageH - frameH) / 2;

    const newFrame: PhotoFrameElement = {
      id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'photo',
      photoId: photo.id,
      filePath: photo.filePath,
      previewPath: photo.previewPath || '',
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
      });
    }

    set({ selectedFrameIds: [newFrame.id] });
  },

  updateFrameGeometry: (spreadId, frameId, geometry) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: (currentAlbum.coverSpread.elements || []).map((f) =>
          f.id === frameId ? { ...f, ...geometry } : f
        ),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
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
      });
    }
  },

  batchUpdateFrames: (spreadId, updates) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

    const updateMap = new Map(updates.map((u) => [u.id, u.geometry]));

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: (currentAlbum.coverSpread.elements || []).map((f) =>
          updateMap.has(f.id) ? { ...f, ...updateMap.get(f.id) } : f
        ),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: (spread.elements || []).map((f) =>
              updateMap.has(f.id) ? { ...f, ...updateMap.get(f.id) } : f
            ),
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
      });
    }
  },

  deleteSelectedFrames: (spreadId) => {
    const { selectedFrameIds } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || selectedFrameIds.length === 0) return;

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: (currentAlbum.coverSpread.elements || []).filter(
          (f) => !selectedFrameIds.includes(f.id)
        ),
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: (spread.elements || []).filter(
              (f) => !selectedFrameIds.includes(f.id)
            ),
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
      });
    }

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

  pasteFrames: (spreadId) => {
    const { clipboardFrames } = get();
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum || clipboardFrames.length === 0) return;

    const pasted = clipboardFrames.map((f, idx) => ({
      ...f,
      id: `frame-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      x: f.x + 10, // Offset pasted frames slightly
      y: f.y + 10,
    }));

    if (currentAlbum.coverSpread.id === spreadId) {
      const existing = currentAlbum.coverSpread.elements || [];
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: [...existing, ...pasted],
      };
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          const existing = spread.elements || [];
          return {
            ...spread,
            elements: [...existing, ...pasted],
          };
        }
        return spread;
      });
      useAlbumStore.setState({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
      });
    }

    set({ selectedFrameIds: pasted.map((p) => p.id) });
  },

  bringToFront: (spreadId, frameId) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

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
      });
    }
  },

  sendToBack: (spreadId, frameId) => {
    const { currentAlbum } = useAlbumStore.getState();
    if (!currentAlbum) return;

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
    set((s) => ({ snapEnabled: !s.snapEnabled }));
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
