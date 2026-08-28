import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Group, Image as KonvaImage, Transformer, Text as KonvaText, Label, Tag } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { usePhotoStore } from '../../stores/photoStore';
import {
  PhotoFrameElement,
  calculateSnapping,
  calculateResizeSnapping,
  calculateImageOffset,
  calculateMultiFrameResize,
  FrameBounds,
  RectBounds,
  roundToHundredth,
  getPhotoAspect,
  clamp,
  intersectRect,
} from '../../domain/editor';
import { getAllAlbumSpreads } from '../../domain/album';
import { convertUnit } from '../../domain/units';
import { Photo } from '../../domain/photo';
import { ContextMenu, ContextMenuItem } from '../../components/ui';
import styles from './KonvaEditorCanvas.module.css';

interface KonvaEditorCanvasProps {
  zoomLevel: number;
  activeTool: 'select' | 'pan';
  onZoomChange?: (updater: (prev: number) => number) => void;
}

// Single Photo Frame Component rendered with Konva
function PhotoFrameNode({
  frame,
  isSelected,
  isMuted,
  isCropMode,
  isMultiSelectActive,
  scaleFactor,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  onFrameChange,
  onCropChange,
  onDoubleClick,
}: {
  frame: PhotoFrameElement;
  isSelected: boolean;
  isMuted: boolean;
  isCropMode: boolean;
  isMultiSelectActive?: boolean;
  scaleFactor: number;
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onFrameChange: (newAttrs: Partial<PhotoFrameElement>) => void;
  onCropChange: (newAttrs: Partial<PhotoFrameElement>) => void;
  onDoubleClick: () => void;
}) {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const shapeRef = useRef<Konva.Group>(null);

  // Load preview or thumbnail image
  useEffect(() => {
    const imgPath = frame.previewPath || frame.thumbnailPath || frame.filePath;
    if (!imgPath) return;

    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = convertFileSrc(imgPath);
    img.onload = () => {
      setImageObj(img);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const aspect = Math.round((img.naturalWidth / img.naturalHeight) * 1000) / 1000;
        if (!frame.photoAspect || Math.abs(frame.photoAspect - aspect) > 0.01) {
          onFrameChange({ photoAspect: aspect });
        }
      }
    };
  }, [frame.previewPath, frame.thumbnailPath, frame.filePath]);

  // Convert physical geometry (mm/cm) to screen pixels (px)
  const pixelX = frame.x * scaleFactor;
  const pixelY = frame.y * scaleFactor;
  const pixelW = frame.width * scaleFactor;
  const pixelH = frame.height * scaleFactor;

  // Real natural photo aspect ratio from loaded image
  const naturalAspect = (imageObj && imageObj.naturalWidth > 0 && imageObj.naturalHeight > 0)
    ? imageObj.naturalWidth / imageObj.naturalHeight
    : getPhotoAspect(frame);

  // Calculate cover dimensions and clamped pixel offset inside frame
  const { offsetX: baseOffsetPhysicalX, offsetY: baseOffsetPhysicalY, width: imgPhysicalW, height: imgPhysicalH } =
    calculateImageOffset(
      frame.width,
      frame.height,
      naturalAspect,
      Math.max(1.0, frame.cropScale || 1.0),
      frame.cropX || 0,
      frame.cropY || 0
    );

  const renderImgW = imgPhysicalW * scaleFactor;
  const renderImgH = imgPhysicalH * scaleFactor;
  const offsetX = baseOffsetPhysicalX * scaleFactor;
  const offsetY = baseOffsetPhysicalY * scaleFactor;

  const setCursor = (e: Konva.KonvaEventObject<any>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = cursor;
    }
  };

  const isDraggingRef = useRef(false);

  useEffect(() => {
    const node = shapeRef.current;
    if (!node) return;

    node.getClientRect = function (config?: { skipTransform?: boolean; relativeTo?: Konva.Container }) {
      const skipTransform = config?.skipTransform;
      const w = this.width();
      const h = this.height();

      if (skipTransform) {
        return { x: 0, y: 0, width: w, height: h };
      }

      const transform = this.getTransform();
      const p1 = transform.point({ x: 0, y: 0 });
      const p2 = transform.point({ x: w, y: 0 });
      const p3 = transform.point({ x: w, y: h });
      const p4 = transform.point({ x: 0, y: h });

      const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
      const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
      const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
      const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    };
  });

  return (
    <Group
      id={frame.id}
      ref={shapeRef}
      x={pixelX}
      y={pixelY}
      width={pixelW}
      height={pixelH}
      rotation={frame.rotation || 0}
      opacity={isMuted ? 0.38 : 1}
      listening={!isMuted}
      draggable={!isCropMode && !isMultiSelectActive}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        // Ignore right-clicks on mouse down
        if ('button' in e.evt && e.evt.button === 2) {
          return;
        }
        if (!isCropMode) {
          if (e.evt?.shiftKey) {
            onSelect(e);
          } else if (!isSelected) {
            onSelect(e);
          }
        }
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        if (!isCropMode && !isDraggingRef.current && isSelected && !e.evt?.shiftKey) {
          onSelect(e);
        }
        isDraggingRef.current = false;
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (!isCropMode) {
          onSelect(e);
        }
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onDoubleClick();
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        if (!isCropMode) {
          if (!isSelected) {
            onSelect(e);
          }
          onContextMenu?.(e);
        }
      }}
      onDragStart={(e) => {
        isDraggingRef.current = true;
        if (!isCropMode) {
          onDragStart?.(e);
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
        onDragEnd(e);
      }}
      onTransformEnd={() => {
        if (isMultiSelectActive) {
          // Multi-selection transform is handled globally by Transformer.onTransformEnd to preserve gaps!
          return;
        }

        const node = shapeRef.current;
        if (!node) return;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        let rawW = (node.width() * scaleX) / scaleFactor;
        let rawH = (node.height() * scaleY) / scaleFactor;

        // Maintain exact aspect ratio even when hitting minimum dimension limits
        const minDim = 1; // 1mm minimum limit
        if (rawW < minDim || rawH < minDim) {
          const origRatio = frame.width > 0 && frame.height > 0 ? frame.width / frame.height : 1;
          if (rawW < minDim) {
            rawW = minDim;
            rawH = minDim / origRatio;
          }
          if (rawH < minDim) {
            rawH = minDim;
            rawW = minDim * origRatio;
          }
        }

        // Reset scale and update geometry
        node.scaleX(1);
        node.scaleY(1);

        onFrameChange({
          x: roundToHundredth(node.x() / scaleFactor),
          y: roundToHundredth(node.y() / scaleFactor),
          width: roundToHundredth(rawW),
          height: roundToHundredth(rawH),
          rotation: Math.round(node.rotation()),
        });
      }}
    >
      {/* Ghost Reveal: Semi-transparent uncropped original image outside the frame in Crop Mode */}
      {isCropMode && imageObj && (
        <Group listening={false}>
          <KonvaImage
            image={imageObj}
            x={offsetX}
            y={offsetY}
            width={renderImgW}
            height={renderImgH}
            opacity={0.25}
          />
          <Rect
            x={offsetX}
            y={offsetY}
            width={renderImgW}
            height={renderImgH}
            stroke="rgba(245, 158, 11, 0.8)"
            strokeWidth={1.5}
            dash={[6, 4]}
          />
        </Group>
      )}

      {/* Clipped Photo Viewport */}
      <Group
        clipFunc={(ctx) => {
          ctx.rect(0, 0, pixelW, pixelH);
        }}
      >
        {imageObj ? (
          <KonvaImage
            id={`crop-img-${frame.id}`}
            image={imageObj}
            x={offsetX}
            y={offsetY}
            width={renderImgW}
            height={renderImgH}
            draggable={isCropMode}
            onMouseDown={(e) => {
              if (isCropMode) {
                e.cancelBubble = true;
              }
            }}
            onMouseEnter={(e) => {
              if (isCropMode) setCursor(e, 'move');
            }}
            onMouseLeave={(e) => setCursor(e, 'default')}
            onWheel={(e) => {
              if (isCropMode) {
                e.evt.preventDefault();
                e.cancelBubble = true;
                const scaleDelta = e.evt.deltaY < 0 ? 0.1 : -0.1;
                const newScale = clamp(Math.round(((frame.cropScale || 1.0) + scaleDelta) * 10) / 10, 1.0, 3.5);
                onCropChange({ cropScale: newScale });
              }
            }}
            onDragMove={(e) => {
              if (isCropMode) {
                e.cancelBubble = true;
                const maxExcessX = Math.max(0, renderImgW - pixelW);
                const maxExcessY = Math.max(0, renderImgH - pixelH);
                
                let targetX = -(maxExcessX / 2);
                let targetY = -(maxExcessY / 2);
                
                if (maxExcessX > 0.5) {
                  targetX = clamp(e.target.x(), -maxExcessX, 0);
                }
                if (maxExcessY > 0.5) {
                  targetY = clamp(e.target.y(), -maxExcessY, 0);
                }
                e.target.x(targetX);
                e.target.y(targetY);
              }
            }}
            onDragEnd={(e) => {
              if (isCropMode) {
                e.cancelBubble = true;
                const maxExcessX = Math.max(0, renderImgW - pixelW);
                const maxExcessY = Math.max(0, renderImgH - pixelH);
                
                let normX = 0;
                let normY = 0;
                if (maxExcessX > 0.5) {
                  const targetX = clamp(e.target.x(), -maxExcessX, 0);
                  normX = (targetX + maxExcessX / 2) / (maxExcessX / 2);
                }
                if (maxExcessY > 0.5) {
                  const targetY = clamp(e.target.y(), -maxExcessY, 0);
                  normY = (targetY + maxExcessY / 2) / (maxExcessY / 2);
                }
                
                onCropChange({
                  cropX: Math.round(clamp(normX, -1, 1) * 1000) / 1000,
                  cropY: Math.round(clamp(normY, -1, 1) * 1000) / 1000,
                  cropScale: frame.cropScale || 1.0,
                });
              }
            }}
          />
        ) : (
          <Rect
            width={pixelW}
            height={pixelH}
            fill="#334155"
          />
        )}
      </Group>

      {/* Frame Border (Inside Stroke to maintain exact outer bounds for snapping) */}
      {frame.borderEnabled && (() => {
        const strokePx = Math.max(1, (frame.borderWidth || 1) * (scaleFactor / 10));
        return (
          <Rect
            x={strokePx / 2}
            y={strokePx / 2}
            width={Math.max(0, pixelW - strokePx)}
            height={Math.max(0, pixelH - strokePx)}
            stroke={frame.borderColor || '#FFFFFF'}
            strokeWidth={strokePx}
            listening={false}
          />
        );
      })()}

      {/* Multiple Selection Visual Highlight Outline */}
      {isSelected && isMultiSelectActive && !isCropMode && (
        <Rect
          x={0}
          y={0}
          width={pixelW}
          height={pixelH}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 3]}
          listening={false}
        />
      )}

      {/* Crop Mode Grid & Indicator Overlay */}
      {isCropMode && (
        <Group listening={false}>
          <Rect
            width={pixelW}
            height={pixelH}
            stroke="#f59e0b"
            strokeWidth={2}
            dash={[6, 4]}
          />
          {/* Rule of Thirds Lines */}
          <Line points={[pixelW / 3, 0, pixelW / 3, pixelH]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
          <Line points={[(pixelW * 2) / 3, 0, (pixelW * 2) / 3, pixelH]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
          <Line points={[0, pixelH / 3, pixelW, pixelH / 3]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
          <Line points={[0, (pixelH * 2) / 3, pixelW, (pixelH * 2) / 3]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
        </Group>
      )}

    </Group>
  );
}

export function KonvaEditorCanvas({ zoomLevel, activeTool, onZoomChange }: KonvaEditorCanvasProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    currentAlbum,
    activeSpreadId,
    showGutterGuide,
    showBleedGuide,
    showSafeAreaGuide,
    initializeAlbum,
  } = useAlbumStore();

  const {
    selectedFrameIds,
    editingCropFrameId,
    activeSnapLines,
    activeGapGuides,
    snapEnabled,
    selectFrame,
    selectFrames,
    clearSelection,
    addPhotoToSpread,
    updateFrameGeometry,
    batchUpdateFrames,
    updateCrop,
    deleteSelectedFrames,
    copySelectedFrames,
    pasteFrames,
    bringToFront,
    sendToBack,
    rotateFrame90,
    alignSelectedFrames,
    distributeSelectedFrames,
    applyFixedGapToSelected,
    matchSelectedDimensions,
    enterCropMode,
    exitCropMode,
    resetCrop,
    setSnapLines,
    clearSnapLines,
    nudgeSelected,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const multiTransformInitialStateRef = useRef<{ frames: FrameBounds[]; bounds: RectBounds } | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 900, height: 500 });
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  // Marquee Selection State
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({ isOpen: false, x: 0, y: 0 });

  // Multi-frame synchronized dragging positions
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const primaryDragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const initialGroupBoundsRef = useRef<{ minX: number; minY: number; width: number; height: number } | null>(null);

  // Auto-initialize album if project is loaded but album state is null
  useEffect(() => {
    if (currentProject && (!currentAlbum || currentAlbum.projectId !== currentProject.id)) {
      initializeAlbum(currentProject);
    }
  }, [currentProject, currentAlbum, initializeAlbum]);

  // ResizeObserver for responsive full-width container scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const targetElem = containerRef.current.parentElement || containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: Math.max(400, entry.contentRect.width),
          height: Math.max(300, entry.contentRect.height),
        });
      }
    });

    observer.observe(targetElem);
    return () => observer.disconnect();
  }, []);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  // Sync Konva Transformer to selected node(s)
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;

    if (editingCropFrameId) {
      trRef.current.nodes([]);
      trRef.current.forceUpdate();
      trRef.current.getLayer()?.batchDraw();
    } else if (selectedFrameIds.length > 0) {
      const selectedNodes = selectedFrameIds
        .map((id) => stageRef.current?.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];

      trRef.current.nodes(selectedNodes);
      trRef.current.update();
      trRef.current.forceUpdate();
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
      trRef.current.forceUpdate();
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedFrameIds, editingCropFrameId, activeSpread?.elements, zoomLevel, containerSize]);

  // Global Keyboard shortcuts for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!activeSpread) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingCropFrameId) {
          e.preventDefault();
          return;
        }
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          deleteSelectedFrames(activeSpread.id);
        }
      } else if (e.key === 'Enter') {
        if (editingCropFrameId) {
          e.preventDefault();
          exitCropMode();
        }
      } else if (e.key === 'Escape') {
        if (editingCropFrameId) {
          e.preventDefault();
          exitCropMode();
        } else {
          clearSelection();
        }
      } else if (e.ctrlKey && e.key === 'c') {
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          copySelectedFrames(activeSpread.id);
        }
      } else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        pasteFrames(activeSpread.id);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (editingCropFrameId) {
          const cropFrame = (activeSpread.elements || []).find((frame) => frame.id === editingCropFrameId);
          if (cropFrame) {
            e.preventDefault();
            const step = e.shiftKey ? 0.05 : e.altKey || e.ctrlKey ? 0.002 : 0.01;
            let dx = 0;
            let dy = 0;
            if (e.key === 'ArrowLeft') dx = -step;
            if (e.key === 'ArrowRight') dx = step;
            if (e.key === 'ArrowUp') dy = -step;
            if (e.key === 'ArrowDown') dy = step;
            updateCrop(activeSpread.id, cropFrame.id, {
              cropX: clamp((cropFrame.cropX || 0) + dx, -1, 1),
              cropY: clamp((cropFrame.cropY || 0) + dy, -1, 1),
              cropScale: cropFrame.cropScale || 1.0,
            });
          }
          return;
        }
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          const canvasUnit = currentProject?.canvasUnit || 'mm';
          // Fine-grained physical increments:
          // - Default arrow: 0.5 mm (detailed & precise spacing)
          // - Alt / Ctrl + arrow: 0.1 mm (ultra-fine micro-precision)
          // - Shift + arrow: 2.0 mm (fast movement)
          let stepInMm = 0.5;
          if (e.shiftKey) {
            stepInMm = 2.0;
          } else if (e.altKey || e.ctrlKey) {
            stepInMm = 0.1;
          }
          const step = convertUnit(stepInMm, 'mm', canvasUnit);

          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          nudgeSelected(activeSpread.id, dx, dy);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedFrameIds,
    activeSpread?.id,
    editingCropFrameId,
    currentProject?.canvasUnit,
    deleteSelectedFrames,
    copySelectedFrames,
    pasteFrames,
    clearSelection,
    exitCropMode,
    updateFrameGeometry,
    updateCrop,
    nudgeSelected,
  ]);

  if (!currentProject || !currentAlbum || !activeSpread) {
    return (
      <div ref={containerRef} className={styles.canvasContainer}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Loading album workspace...
        </div>
      </div>
    );
  }

  const unit = currentProject.canvasUnit;

  // Single page physical dimensions
  const singlePageW = currentProject.canvasWidth;
  const singlePageH = currentProject.canvasHeight;
  const gutterPhysicalW = activeSpread.gutterWidth || 0;

  // Total spread physical dimensions
  const totalSpreadPhysicalW = singlePageW * 2 + gutterPhysicalW;
  const totalSpreadPhysicalH = singlePageH;

  // Physical bleed and safe area in mm
  const bleedInMm = convertUnit(activeSpread.bleed ?? 3, unit, 'mm');
  const safeAreaInMm = convertUnit(activeSpread.safeArea ?? 10, unit, 'mm');
  const pageWInMm = convertUnit(singlePageW, unit, 'mm');

  // Dynamic responsive canvas scaling (Fills ~88% of container workspace)
  const maxAvailableW = Math.max(300, containerSize.width - 60);
  const maxAvailableH = Math.max(200, containerSize.height - 60);
  const aspect = totalSpreadPhysicalW / Math.max(1, totalSpreadPhysicalH);

  let baseW = maxAvailableW;
  let baseH = Math.round(baseW / aspect);
  if (baseH > maxAvailableH) {
    baseH = maxAvailableH;
    baseW = Math.round(baseH * aspect);
  }

  // Zoom scale factor
  const zoomScale = zoomLevel / 100;
  const screenSpreadW = Math.round(baseW * zoomScale);
  const screenSpreadH = Math.round(baseH * zoomScale);

  // Conversion factor: multiply physical units (mm/cm/inch) by this to get screen pixels
  const scaleFactor = screenSpreadW / totalSpreadPhysicalW;

  const leftPagePixelW = Math.round((singlePageW / totalSpreadPhysicalW) * screenSpreadW);
  const rightPagePixelW = leftPagePixelW;
  const gutterPixelW = screenSpreadW - leftPagePixelW - rightPagePixelW;

  const bleedPixel = Math.max(1, Math.round((bleedInMm / pageWInMm) * leftPagePixelW));
  const safeAreaPixel = Math.max(1, Math.round((safeAreaInMm / pageWInMm) * leftPagePixelW));
  const activeCropFrame = editingCropFrameId
    ? (activeSpread.elements || []).find((frame) => frame.id === editingCropFrameId)
    : null;
  const currentCropZoom = activeCropFrame?.cropScale || 1.0;
  const cropHudWidth = 320;
  const cropHudLeft = activeCropFrame
    ? Math.max(
        8,
        Math.min(
          screenSpreadW - cropHudWidth - 8,
          activeCropFrame.x * scaleFactor + (activeCropFrame.width * scaleFactor - cropHudWidth) / 2
        )
      )
    : 8;
  const cropHudTop = activeCropFrame
    ? Math.min(
        screenSpreadH - 45,
        Math.max(8, (activeCropFrame.y + activeCropFrame.height) * scaleFactor + 12)
      )
    : 8;
  const updateActiveCropZoom = (nextZoom: number) => {
    if (!activeCropFrame) return;
    const clampedZoom = clamp(Math.round(nextZoom * 100) / 100, 1.0, 3.5);
    updateCrop(activeSpread.id, activeCropFrame.id, {
      cropScale: clampedZoom,
      cropX: activeCropFrame.cropX || 0,
      cropY: activeCropFrame.cropY || 0,
    });
  };

  // Multi-selection bounding box computation
  const selectedElements = (activeSpread.elements || []).filter((f) =>
    selectedFrameIds.includes(f.id)
  );
  const isMultiSelected = selectedElements.length > 1;

  let multiSelectBounds: {
    minX: number;
    minY: number;
    width: number;
    height: number;
    pixelX: number;
    pixelY: number;
    pixelW: number;
    pixelH: number;
  } | null = null;

  if (isMultiSelected && selectedElements.length > 0) {
    const minX = Math.min(...selectedElements.map((f) => f.x));
    const maxX = Math.max(...selectedElements.map((f) => f.x + f.width));
    const minY = Math.min(...selectedElements.map((f) => f.y));
    const maxY = Math.max(...selectedElements.map((f) => f.y + f.height));
    multiSelectBounds = {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
      pixelX: minX * scaleFactor,
      pixelY: minY * scaleFactor,
      pixelW: (maxX - minX) * scaleFactor,
      pixelH: (maxY - minY) * scaleFactor,
    };
  }

  // Handle Drag & Drop photo from filmstrip tray onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOverCanvas(true);
  };

  const handleDragLeave = () => {
    setIsDragOverCanvas(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(false);

    let photo: Photo | null = null;
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (rawData) {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          photo = usePhotoStore.getState().photos.find((p) => p.id === parsed[0]) || null;
        } else if (parsed && parsed.id) {
          photo = parsed as Photo;
        }
      }
    } catch {}

    if (!photo) {
      const textId = e.dataTransfer.getData('text/plain');
      if (textId) {
        photo = usePhotoStore.getState().photos.find((p) => p.id === textId) || null;
      }
    }

    if (!photo) {
      const selIds = usePhotoStore.getState().selectedPhotoIds;
      if (selIds.length > 0) {
        photo = usePhotoStore.getState().photos.find((p) => p.id === selIds[0]) || null;
      }
    }

    if (!photo) return;

    if (stageRef.current) {
      const stageBox = stageRef.current.container().getBoundingClientRect();
      const dropX = e.clientX - stageBox.left;
      const dropY = e.clientY - stageBox.top;

      const physicalX = Math.max(0, Math.min(totalSpreadPhysicalW, dropX / scaleFactor));
      const physicalY = Math.max(0, Math.min(totalSpreadPhysicalH, dropY / scaleFactor));

      addPhotoToSpread(activeSpread.id, photo, { x: physicalX, y: physicalY });
    } else {
      addPhotoToSpread(activeSpread.id, photo);
    }
  };

  // Marquee stage pointer events
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (activeTool === 'pan' || editingCropFrameId) return;

    // Ignore right clicks so right clicking never cancels selection or triggers marquee
    if ('button' in e.evt && e.evt.button === 2) return;

    const isBackground =
      e.target === e.target.getStage() ||
      e.target.name() === 'background-sheet' ||
      e.target.name() === 'canvas-bg';

    if (isBackground) {
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) {
        setSelectionRect({
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          visible: true,
          startX: pos.x,
          startY: pos.y,
        });

        if (!e.evt?.shiftKey) {
          clearSelection();
        }
        exitCropMode();
      }
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectionRect || !selectionRect.visible || activeTool === 'pan') return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const x1 = selectionRect.startX;
    const y1 = selectionRect.startY;
    const x2 = pos.x;
    const y2 = pos.y;

    const rectX = Math.min(x1, x2);
    const rectY = Math.min(y1, y2);
    const rectW = Math.abs(x2 - x1);
    const rectH = Math.abs(y2 - y1);

    setSelectionRect({
      x: rectX,
      y: rectY,
      width: rectW,
      height: rectH,
      visible: true,
      startX: x1,
      startY: y1,
    });

    if (rectW > 4 || rectH > 4) {
      const marqueePhysical = {
        x: rectX / scaleFactor,
        y: rectY / scaleFactor,
        width: rectW / scaleFactor,
        height: rectH / scaleFactor,
      };

      const matchedIds = (activeSpread.elements || [])
        .filter((f) =>
          intersectRect(marqueePhysical, {
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
          })
        )
        .map((f) => f.id);

      selectFrames(matchedIds);
    }
  };

  const handleStageMouseUp = () => {
    if (selectionRect) {
      setSelectionRect(null);
    }
  };

  // Context Menu Items builder
  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!activeSpread) return [];
    const count = selectedFrameIds.length;

    if (count === 0) {
      return [
        {
          id: 'paste',
          label: 'Tempel Foto (Paste)',
          icon: '📋',
          shortcut: 'Ctrl+V',
          disabled: useEditorStore.getState().clipboardFrames.length === 0,
          onClick: () => pasteFrames(activeSpread.id),
        },
      ];
    }

    const items: ContextMenuItem[] = [
      {
        id: 'delete',
        label: count > 1 ? `Hapus ${count} Foto Terpilih` : 'Hapus Foto',
        icon: '🗑️',
        shortcut: 'Del',
        danger: true,
        onClick: () => deleteSelectedFrames(activeSpread.id),
      },
      {
        id: 'copy',
        label: count > 1 ? `Salin ${count} Foto` : 'Salin Foto',
        icon: '📋',
        shortcut: 'Ctrl+C',
        onClick: () => copySelectedFrames(activeSpread.id),
      },
      {
        id: 'paste',
        label: 'Tempel Foto',
        icon: '📥',
        shortcut: 'Ctrl+V',
        disabled: useEditorStore.getState().clipboardFrames.length === 0,
        onClick: () => pasteFrames(activeSpread.id),
      },
      { divider: true, id: 'div-order', label: '' },
      {
        id: 'bring-to-front',
        label: 'Bawa ke Paling Depan',
        icon: '🔼',
        onClick: () => {
          selectedFrameIds.forEach((id) => bringToFront(activeSpread.id, id));
        },
      },
      {
        id: 'send-to-back',
        label: 'Kirim ke Paling Belakang',
        icon: '🔽',
        onClick: () => {
          selectedFrameIds.forEach((id) => sendToBack(activeSpread.id, id));
        },
      },
      {
        id: 'rotate-cw',
        label: 'Putar 90° Searah Jarum Jam',
        icon: '🔄',
        onClick: () => {
          selectedFrameIds.forEach((id) => rotateFrame90(activeSpread.id, id, 'cw'));
        },
      },
    ];

    if (count >= 2) {
      items.push(
        { divider: true, id: 'div-align', label: '' },
        { header: true, id: 'hdr-align', label: 'PENYELARASAN (ALIGN)' },
        {
          id: 'align-left',
          label: 'Rata Kiri (Align Left)',
          icon: '⇤',
          onClick: () => alignSelectedFrames(activeSpread.id, 'left'),
        },
        {
          id: 'align-center',
          label: 'Rata Tengah Horizontal (Center)',
          icon: '↔',
          onClick: () => alignSelectedFrames(activeSpread.id, 'center'),
        },
        {
          id: 'align-right',
          label: 'Rata Kanan (Align Right)',
          icon: '⇥',
          onClick: () => alignSelectedFrames(activeSpread.id, 'right'),
        },
        {
          id: 'align-top',
          label: 'Rata Atas (Align Top)',
          icon: '⤒',
          onClick: () => alignSelectedFrames(activeSpread.id, 'top'),
        },
        {
          id: 'align-middle',
          label: 'Rata Tengah Vertikal (Middle)',
          icon: '↕',
          onClick: () => alignSelectedFrames(activeSpread.id, 'middle'),
        },
        {
          id: 'align-bottom',
          label: 'Rata Bawah (Align Bottom)',
          icon: '⤓',
          onClick: () => alignSelectedFrames(activeSpread.id, 'bottom'),
        },
        { divider: true, id: 'div-size', label: '' },
        { header: true, id: 'hdr-size', label: 'SAMAKAN UKURAN (MATCH SIZE)' },
        {
          id: 'match-width',
          label: 'Samakan Lebar (Match Width)',
          icon: '⬌',
          onClick: () => matchSelectedDimensions(activeSpread.id, 'width'),
        },
        {
          id: 'match-height',
          label: 'Samakan Tinggi (Match Height)',
          icon: '⬍',
          onClick: () => matchSelectedDimensions(activeSpread.id, 'height'),
        },
        {
          id: 'match-both',
          label: 'Samakan Ukuran Penuh (Both)',
          icon: '⬚',
          onClick: () => matchSelectedDimensions(activeSpread.id, 'both'),
        },
        { divider: true, id: 'div-gap', label: '' },
        { header: true, id: 'hdr-gap', label: 'JARAK CELAH (GAP SPACING)' },
        {
          id: 'gap-h',
          label: `Set Celah (${currentProject.spacingValue} ${currentProject.spacingUnit}) Horizontal`,
          icon: '⇿',
          onClick: () => applyFixedGapToSelected(activeSpread.id, 'horizontal', currentProject.spacingValue),
        },
        {
          id: 'gap-v',
          label: `Set Celah (${currentProject.spacingValue} ${currentProject.spacingUnit}) Vertikal`,
          icon: '⇳',
          onClick: () => applyFixedGapToSelected(activeSpread.id, 'vertical', currentProject.spacingValue),
        }
      );
    }

    if (count >= 3) {
      items.push(
        { divider: true, id: 'div-distribute', label: '' },
        { header: true, id: 'hdr-distribute', label: 'DISTRIBUSI JARAK RATA' },
        {
          id: 'distribute-h',
          label: 'Bagi Jarak Rata Horizontal',
          icon: '⇿',
          onClick: () => distributeSelectedFrames(activeSpread.id, 'horizontal'),
        },
        {
          id: 'distribute-v',
          label: 'Bagi Jarak Rata Vertikal',
          icon: '⇳',
          onClick: () => distributeSelectedFrames(activeSpread.id, 'vertical'),
        }
      );
    }

    items.push(
      { divider: true, id: 'div-clear', label: '' },
      {
        id: 'clear-sel',
        label: 'Batalkan Pilihan',
        icon: '✕',
        onClick: () => clearSelection(),
      }
    );

    return items;
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ${activeTool === 'pan' ? styles.panningMode : ''} ${editingCropFrameId ? styles.cropModeActive : ''} ${isDragOverCanvas ? styles.dragOverActive : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
      }}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (onZoomChange) {
            const delta = e.deltaY < 0 ? 10 : -10;
            onZoomChange((z) => Math.max(25, Math.min(300, z + delta)));
          }
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 2) return;
        const target = e.target as HTMLElement;
        if (
          target === containerRef.current ||
          target.classList?.contains(styles.canvasContainer ?? '') ||
          target.classList?.contains(styles.stageWrapper ?? '')
        ) {
          clearSelection();
          exitCropMode();
        }
      }}
      onClick={(e) => {
        if (e.button === 2) return;
        const target = e.target as HTMLElement;
        if (
          target === containerRef.current ||
          target.classList?.contains(styles.canvasContainer ?? '') ||
          target.classList?.contains(styles.stageWrapper ?? '')
        ) {
          clearSelection();
          exitCropMode();
        }
      }}
    >
      {/* Visual Canvas Drop Shadow Box */}
      <div
        className={styles.stageWrapper}
        style={{
          width: `${screenSpreadW}px`,
          height: `${screenSpreadH}px`,
        }}
      >
        {/* Outer Bleed Guide Boundary */}
        {showBleedGuide && (
          <div
            className={styles.bleedGuideBox}
            style={{ inset: `-${bleedPixel}px` }}
            title={`Bleed Cut Line: ${activeSpread.bleed} ${unit}`}
          />
        )}

        {/* Konva Stage for Facing Pages and Photo Frames */}
        <Stage
          ref={stageRef}
          width={screenSpreadW}
          height={screenSpreadH}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onTouchStart={handleStageMouseDown}
          onTouchMove={handleStageMouseMove}
          onTouchEnd={handleStageMouseUp}
        >
          {/* Layer 1: Background & Page Sheet */}
          <Layer>
            {/* Spread Sheet Board */}
            <Rect
              name="background-sheet"
              x={0}
              y={0}
              width={screenSpreadW}
              height={screenSpreadH}
              fill={activeSpread.backgroundColor || '#FFFFFF'}
              shadowColor="rgba(0,0,0,0.6)"
              shadowBlur={16}
              shadowOffset={{ x: 0, y: 8 }}
            />

            {/* Center Gutter / Spine Fold Guide */}
            {showGutterGuide && (
              <Group listening={false}>
                {gutterPixelW > 0 ? (
                  <>
                    {/* Shaded Gutter Zone */}
                    <Rect
                      x={leftPagePixelW}
                      y={0}
                      width={gutterPixelW}
                      height={screenSpreadH}
                      fill="rgba(100, 116, 139, 0.12)"
                    />
                    {/* Left & Right Gutter Crease Lines */}
                    <Line
                      points={[leftPagePixelW, 0, leftPagePixelW, screenSpreadH]}
                      stroke="#475569"
                      strokeWidth={1.5}
                      dash={[6, 4]}
                    />
                    <Line
                      points={[leftPagePixelW + gutterPixelW, 0, leftPagePixelW + gutterPixelW, screenSpreadH]}
                      stroke="#475569"
                      strokeWidth={1.5}
                      dash={[6, 4]}
                    />
                  </>
                ) : (
                  <>
                    {/* Subtle Shadow on Left of Crease */}
                    <Line
                      points={[leftPagePixelW - 1, 0, leftPagePixelW - 1, screenSpreadH]}
                      stroke="rgba(0, 0, 0, 0.15)"
                      strokeWidth={2}
                    />
                    {/* Distinct Center Crease Dashed Line */}
                    <Line
                      points={[leftPagePixelW, 0, leftPagePixelW, screenSpreadH]}
                      stroke="#475569"
                      strokeWidth={1.5}
                      dash={[6, 3]}
                    />
                  </>
                )}

                {/* Top Notch Marker */}
                <Line
                  points={[
                    leftPagePixelW + gutterPixelW / 2 - 6, 0,
                    leftPagePixelW + gutterPixelW / 2 + 6, 0,
                    leftPagePixelW + gutterPixelW / 2, 8,
                  ]}
                  closed
                  fill="#334155"
                />

                {/* Bottom Notch Marker */}
                <Line
                  points={[
                    leftPagePixelW + gutterPixelW / 2 - 6, screenSpreadH,
                    leftPagePixelW + gutterPixelW / 2 + 6, screenSpreadH,
                    leftPagePixelW + gutterPixelW / 2, screenSpreadH - 8,
                  ]}
                  closed
                  fill="#334155"
                />
              </Group>
            )}

            {/* Safe Area Guides (Left & Right Facing Pages) */}
            {showSafeAreaGuide && (
              <Group listening={false}>
                {/* Left Page Safe Area */}
                <Rect
                  x={safeAreaPixel}
                  y={safeAreaPixel}
                  width={leftPagePixelW - safeAreaPixel - Math.max(safeAreaPixel, gutterPixelW / 2 + 2)}
                  height={screenSpreadH - safeAreaPixel * 2}
                  stroke="rgba(59, 130, 246, 0.65)"
                  strokeWidth={1}
                  dash={[5, 4]}
                />
                {/* Right Page Safe Area */}
                <Rect
                  x={leftPagePixelW + gutterPixelW + Math.max(safeAreaPixel, gutterPixelW / 2 + 2)}
                  y={safeAreaPixel}
                  width={rightPagePixelW - safeAreaPixel - Math.max(safeAreaPixel, gutterPixelW / 2 + 2)}
                  height={screenSpreadH - safeAreaPixel * 2}
                  stroke="rgba(59, 130, 246, 0.65)"
                  strokeWidth={1}
                  dash={[5, 4]}
                />
              </Group>
            )}
          </Layer>

          {/* Layer 2: Interactive Photo Frames */}
          <Layer>
            {(activeSpread.elements || []).map((frame) => {
              const isSelected = selectedFrameIds.includes(frame.id);
              const isCrop = editingCropFrameId === frame.id;

              return (
                <PhotoFrameNode
                  key={frame.id}
                  frame={frame}
                  isSelected={isSelected}
                  isMuted={Boolean(editingCropFrameId && editingCropFrameId !== frame.id)}
                  isCropMode={isCrop}
                  isMultiSelectActive={isMultiSelected}
                  scaleFactor={scaleFactor}
                  onSelect={(e) => {
                    if (e) {
                      e.cancelBubble = true;
                      selectFrame(frame.id, Boolean(e.evt?.shiftKey));
                    } else {
                      selectFrame(frame.id);
                    }
                  }}
                  onDragMove={(e) => {
                    if (!snapEnabled || e.evt?.altKey || e.evt?.ctrlKey) {
                      clearSnapLines();
                      return;
                    }
                    const physicalX = e.target.x() / scaleFactor;
                    const physicalY = e.target.y() / scaleFactor;
                    const otherRects = (activeSpread.elements || [])
                      .filter((f) => f.id !== frame.id)
                      .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));

                    const thresholdUnits = Math.max(0.8, 5 / scaleFactor);

                    const snapRes = calculateSnapping(
                      { x: physicalX, y: physicalY, width: frame.width, height: frame.height },
                      totalSpreadPhysicalW,
                      totalSpreadPhysicalH,
                      activeSpread.safeArea,
                      gutterPhysicalW,
                      otherRects,
                      thresholdUnits,
                      unit
                    );

                    if (snapRes.snapLines.length > 0 || snapRes.gapGuides.length > 0) {
                      e.target.x(snapRes.snappedX * scaleFactor);
                      e.target.y(snapRes.snappedY * scaleFactor);
                      setSnapLines(snapRes.snapLines, snapRes.gapGuides);
                    } else {
                      clearSnapLines();
                    }
                  }}
                  onDragEnd={(e) => {
                    clearSnapLines();
                    updateFrameGeometry(activeSpread.id, frame.id, {
                      x: Math.round((e.target.x() / scaleFactor) * 10) / 10,
                      y: Math.round((e.target.y() / scaleFactor) * 10) / 10,
                    });
                  }}
                  onContextMenu={(e) => {
                    setContextMenu({ isOpen: true, x: e.evt.clientX, y: e.evt.clientY });
                  }}
                  onFrameChange={(updates) => updateFrameGeometry(activeSpread.id, frame.id, updates)}
                  onCropChange={(updates) => updateCrop(activeSpread.id, frame.id, updates)}
                  onDoubleClick={() => enterCropMode(frame.id)}
                />
              );
            })}

            {/* Virtual Selection Drag Box for Smooth Multi-Frame Dragging & Snapping */}
            {multiSelectBounds && !editingCropFrameId && (
              <Rect
                name="multi-selection-drag-box"
                x={multiSelectBounds.pixelX}
                y={multiSelectBounds.pixelY}
                width={multiSelectBounds.pixelW}
                height={multiSelectBounds.pixelH}
                fill="rgba(59, 130, 246, 0.001)"
                draggable={activeTool !== 'pan'}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  setContextMenu({ isOpen: true, x: e.evt.clientX, y: e.evt.clientY });
                }}
                onDragStart={(e) => {
                  primaryDragStartPosRef.current = { x: e.target.x(), y: e.target.y() };
                  const startMap = new Map<string, { x: number; y: number }>();
                  selectedFrameIds.forEach((id) => {
                    const node = stageRef.current?.findOne(`#${id}`);
                    if (node) {
                      startMap.set(id, { x: node.x(), y: node.y() });
                    }
                  });
                  dragStartPositionsRef.current = startMap;
                  initialGroupBoundsRef.current = {
                    minX: multiSelectBounds.minX,
                    minY: multiSelectBounds.minY,
                    width: multiSelectBounds.width,
                    height: multiSelectBounds.height,
                  };
                }}
                onDragMove={(e) => {
                  if (!primaryDragStartPosRef.current || !initialGroupBoundsRef.current) return;

                  const rawDeltaX = (e.target.x() - primaryDragStartPosRef.current.x) / scaleFactor;
                  const rawDeltaY = (e.target.y() - primaryDragStartPosRef.current.y) / scaleFactor;

                  const group = initialGroupBoundsRef.current;
                  let finalDeltaX = rawDeltaX;
                  let finalDeltaY = rawDeltaY;

                  if (!snapEnabled || e.evt?.altKey || e.evt?.ctrlKey) {
                    clearSnapLines();
                  } else {
                    const currentGroupX = group.minX + rawDeltaX;
                    const currentGroupY = group.minY + rawDeltaY;

                    const otherRects = (activeSpread.elements || [])
                      .filter((f) => !selectedFrameIds.includes(f.id))
                      .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));

                    const thresholdUnits = Math.max(0.8, 5 / scaleFactor);

                    const snapRes = calculateSnapping(
                      { x: currentGroupX, y: currentGroupY, width: group.width, height: group.height },
                      totalSpreadPhysicalW,
                      totalSpreadPhysicalH,
                      activeSpread.safeArea,
                      gutterPhysicalW,
                      otherRects,
                      thresholdUnits,
                      unit
                    );

                    finalDeltaX = snapRes.snappedX - group.minX;
                    finalDeltaY = snapRes.snappedY - group.minY;

                    if (snapRes.snapLines.length > 0 || snapRes.gapGuides.length > 0) {
                      e.target.x(primaryDragStartPosRef.current.x + finalDeltaX * scaleFactor);
                      e.target.y(primaryDragStartPosRef.current.y + finalDeltaY * scaleFactor);
                      setSnapLines(snapRes.snapLines, snapRes.gapGuides);
                    } else {
                      clearSnapLines();
                    }
                  }

                  const deltaPixelsX = finalDeltaX * scaleFactor;
                  const deltaPixelsY = finalDeltaY * scaleFactor;

                  // Synchronously move all member photo nodes
                  selectedFrameIds.forEach((id) => {
                    const initPos = dragStartPositionsRef.current.get(id);
                    const node = stageRef.current?.findOne(`#${id}`);
                    if (initPos && node) {
                      node.x(initPos.x + deltaPixelsX);
                      node.y(initPos.y + deltaPixelsY);
                    }
                  });
                }}
                onDragEnd={(e) => {
                  clearSnapLines();
                  if (primaryDragStartPosRef.current && initialGroupBoundsRef.current) {
                    const finalDeltaPhysicalX = (e.target.x() - primaryDragStartPosRef.current.x) / scaleFactor;
                    const finalDeltaPhysicalY = (e.target.y() - primaryDragStartPosRef.current.y) / scaleFactor;

                    const updates = selectedFrameIds.map((id) => {
                      const f = (activeSpread.elements || []).find((el) => el.id === id);
                      return {
                        id,
                        geometry: {
                          x: Math.round(((f?.x || 0) + finalDeltaPhysicalX) * 10) / 10,
                          y: Math.round(((f?.y || 0) + finalDeltaPhysicalY) * 10) / 10,
                        },
                      };
                    });

                    batchUpdateFrames(activeSpread.id, updates);
                    primaryDragStartPosRef.current = null;
                    initialGroupBoundsRef.current = null;
                    dragStartPositionsRef.current.clear();
                  }
                }}
              />
            )}

            {/* Dynamic Contextual Transformer */}
            <Transformer
              ref={trRef}
              visible={!editingCropFrameId}
              rotateEnabled
              keepRatio={true}
              enabledAnchors={
                selectedFrameIds.length > 1
                  ? ['top-left', 'top-right', 'bottom-right', 'bottom-left']
                  : [
                      'top-left',
                      'top-center',
                      'top-right',
                      'middle-right',
                      'bottom-right',
                      'bottom-center',
                      'bottom-left',
                      'middle-left',
                    ]
              }
              anchorSize={8}
              anchorCornerRadius={2}
              anchorFill="#ffffff"
              anchorStroke={editingCropFrameId ? '#f59e0b' : '#3b82f6'}
              anchorStrokeWidth={1.5}
              borderStroke={editingCropFrameId ? '#f59e0b' : '#3b82f6'}
              borderStrokeWidth={1.5}
              borderDash={editingCropFrameId ? [5, 3] : [4, 3]}
              onTransformStart={() => {
                const tr = trRef.current;
                if (!tr) return;
                const anchor = tr.getActiveAnchor();
                const isCorner =
                  !anchor ||
                  anchor === 'top-left' ||
                  anchor === 'top-right' ||
                  anchor === 'bottom-left' ||
                  anchor === 'bottom-right';
                tr.keepRatio(isCorner || selectedFrameIds.length > 1);

                if (selectedFrameIds.length > 1 && activeSpread) {
                  const selectedFrames = (activeSpread.elements || [])
                    .filter((f) => selectedFrameIds.includes(f.id))
                    .map((f) => ({ id: f.id, x: f.x, y: f.y, width: f.width, height: f.height }));

                  if (selectedFrames.length > 0) {
                    const minX = Math.min(...selectedFrames.map((f) => f.x));
                    const minY = Math.min(...selectedFrames.map((f) => f.y));
                    const maxX = Math.max(...selectedFrames.map((f) => f.x + f.width));
                    const maxY = Math.max(...selectedFrames.map((f) => f.y + f.height));
                    multiTransformInitialStateRef.current = {
                      frames: selectedFrames,
                      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
                    };
                  }
                } else {
                  multiTransformInitialStateRef.current = null;
                }
              }}
              boundBoxFunc={(oldBox, newBox) => {
                // Minimum size limits (allow tiny micro sizes down to 4px)
                if (newBox.width < 4 || newBox.height < 4) {
                  return oldBox;
                }

                if (snapEnabled && selectedFrameIds.length === 1) {
                  const currentAnchor = trRef.current?.getActiveAnchor();
                  const selectedId = selectedFrameIds[0];
                  const otherRects = (activeSpread.elements || [])
                    .filter((f) => f.id !== selectedId)
                    .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));
                  const thresholdUnits = Math.max(0.6, 3.5 / scaleFactor);

                  const physicalX = newBox.x / scaleFactor;
                  const physicalY = newBox.y / scaleFactor;
                  const physicalW = newBox.width / scaleFactor;
                  const physicalH = newBox.height / scaleFactor;

                  const snapRes = calculateResizeSnapping(
                    { x: physicalX, y: physicalY, width: physicalW, height: physicalH },
                    totalSpreadPhysicalW,
                    totalSpreadPhysicalH,
                    activeSpread.safeArea,
                    gutterPhysicalW,
                    otherRects,
                    thresholdUnits,
                    unit,
                    currentAnchor || undefined
                  );

                  if (snapRes.snapLines.length > 0 || snapRes.gapGuides.length > 0) {
                    setSnapLines(snapRes.snapLines, snapRes.gapGuides);
                    return {
                      ...newBox,
                      x: snapRes.snappedBounds.x * scaleFactor,
                      y: snapRes.snappedBounds.y * scaleFactor,
                      width: Math.max(4, snapRes.snappedBounds.width * scaleFactor),
                      height: Math.max(4, snapRes.snappedBounds.height * scaleFactor),
                    };
                  } else {
                    clearSnapLines();
                  }
                }

                return newBox;
              }}
              onTransformEnd={() => {
                clearSnapLines();
                const tr = trRef.current;
                if (!tr) return;

                if (selectedFrameIds.length > 1 && multiTransformInitialStateRef.current && activeSpread) {
                  const { frames: initialFrames, bounds: initialBounds } = multiTransformInitialStateRef.current;
                  const selectedNodes = selectedFrameIds
                    .map((id) => stageRef.current?.findOne(`#${id}`))
                    .filter(Boolean) as Konva.Node[];

                  if (selectedNodes.length > 0) {
                    const pixelBoxes = selectedNodes.map((n) => {
                      const sx = Math.abs(n.scaleX());
                      const sy = Math.abs(n.scaleY());
                      return {
                        x: n.x(),
                        y: n.y(),
                        width: n.width() * sx,
                        height: n.height() * sy,
                      };
                    });

                    const minPxX = Math.min(...pixelBoxes.map((b) => b.x));
                    const minPxY = Math.min(...pixelBoxes.map((b) => b.y));
                    const maxPxX = Math.max(...pixelBoxes.map((b) => b.x + b.width));
                    const maxPxY = Math.max(...pixelBoxes.map((b) => b.y + b.height));

                    const newGroupBounds: RectBounds = {
                      x: minPxX / scaleFactor,
                      y: minPxY / scaleFactor,
                      width: (maxPxX - minPxX) / scaleFactor,
                      height: (maxPxY - minPxY) / scaleFactor,
                    };

                    selectedNodes.forEach((n) => {
                      n.scaleX(1);
                      n.scaleY(1);
                    });

                    const updates = calculateMultiFrameResize(initialFrames, initialBounds, newGroupBounds);
                    if (updates.length > 0) {
                      batchUpdateFrames(activeSpread.id, updates);
                    }
                  }
                  multiTransformInitialStateRef.current = null;
                }

                tr.keepRatio(true);
                tr.update();
                tr.getLayer()?.batchDraw();
              }}
            />

            {/* Rubber-band Marquee Selection Box */}
            {selectionRect && selectionRect.visible && (
              <Rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.width}
                height={selectionRect.height}
                fill="rgba(59, 130, 246, 0.18)"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dash={[5, 3]}
                listening={false}
              />
            )}

            {/* Magnetic Snap Lines overlay */}
            {activeSnapLines.map((line, idx) => (
              <Line
                key={`snap-${idx}`}
                points={
                  line.type === 'vertical'
                    ? [line.position * scaleFactor, 0, line.position * scaleFactor, screenSpreadH]
                    : [0, line.position * scaleFactor, screenSpreadW, line.position * scaleFactor]
                }
                stroke="#06b6d4"
                strokeWidth={1.5}
                dash={[4, 2]}
                listening={false}
              />
            ))}

            {/* Gap Guides & Equal Distance Indicators */}
            {activeGapGuides.map((gap, idx) => {
              const isHoriz = gap.type === 'horizontal';
              const startPx = gap.start * scaleFactor;
              const endPx = gap.end * scaleFactor;
              const crossPx = gap.crossPos * scaleFactor;
              const midPx = (startPx + endPx) / 2;
              const tickSize = 5;

              return (
                <Group key={`gap-${idx}`} listening={false}>
                  {/* Main Dimension Line */}
                  <Line
                    points={
                      isHoriz
                        ? [startPx, crossPx, endPx, crossPx]
                        : [crossPx, startPx, crossPx, endPx]
                    }
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                  />
                  {/* Start Tick */}
                  <Line
                    points={
                      isHoriz
                        ? [startPx, crossPx - tickSize, startPx, crossPx + tickSize]
                        : [crossPx - tickSize, startPx, crossPx + tickSize, startPx]
                    }
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                  />
                  {/* End Tick */}
                  <Line
                    points={
                      isHoriz
                        ? [endPx, crossPx - tickSize, endPx, crossPx + tickSize]
                        : [crossPx - tickSize, endPx, crossPx + tickSize, endPx]
                    }
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                  />
                  {/* Distance Pill Badge */}
                  <Group
                    x={isHoriz ? midPx : crossPx}
                    y={isHoriz ? crossPx : midPx}
                  >
                    <Label offsetX={26} offsetY={9}>
                      <Tag
                        fill="#082f49"
                        stroke="#06b6d4"
                        strokeWidth={1}
                        cornerRadius={3}
                        shadowColor="rgba(0,0,0,0.5)"
                        shadowBlur={4}
                      />
                      <KonvaText
                        text={gap.label}
                        fontSize={10}
                        fontStyle="bold"
                        fill="#38bdf8"
                        padding={3}
                        fontFamily="sans-serif"
                      />
                    </Label>
                  </Group>
                </Group>
              );
            })}
          </Layer>
        </Stage>

        {activeCropFrame && (
          <div
            className={styles.cropHud}
            style={{
              left: `${cropHudLeft}px`,
              top: `${cropHudTop}px`,
              width: `${cropHudWidth}px`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={styles.cropHudLabel}>Crop</span>
            <input
              type="range"
              min="1.0"
              max="3.5"
              step="0.05"
              value={currentCropZoom}
              onChange={(e) => updateActiveCropZoom(parseFloat(e.target.value))}
              className={styles.cropHudSlider}
              title={`Zoom: ${Math.round(currentCropZoom * 100)}%`}
            />
            <span className={styles.cropHudZoom}>{Math.round(currentCropZoom * 100)}%</span>
            <button
              type="button"
              className={styles.cropHudButton}
              onClick={() => resetCrop(activeSpread.id, activeCropFrame.id)}
              title="Reset position and zoom"
            >
              ↺ Reset
            </button>
            <button
              type="button"
              className={`${styles.cropHudButton} ${styles.cropHudDone}`}
              onClick={exitCropMode}
              title="Done (Enter / Esc)"
            >
              ✓ Selesai
            </button>
          </div>
        )}

      </div>

      {/* Drag & Drop Prompt Overlay when dragging from tray */}
      {isDragOverCanvas && (
        <div className={styles.dropOverlay}>
          <span>+ Drop Photo to Place on {activeSpread.name}</span>
        </div>
      )}

      {/* Desktop Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getContextMenuItems()}
        onClose={() => setContextMenu({ isOpen: false, x: 0, y: 0 })}
      />
    </div>
  );
}
