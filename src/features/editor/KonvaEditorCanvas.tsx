import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Group, Image as KonvaImage, Transformer, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { usePhotoStore } from '../../stores/photoStore';
import {
  PhotoFrameElement,
  calculateSnapping,
  calculateImageOffset,
  getPhotoAspect,
  clamp,
} from '../../domain/editor';
import { getAllAlbumSpreads } from '../../domain/album';
import { convertUnit } from '../../domain/units';
import { Photo } from '../../domain/photo';
import styles from './KonvaEditorCanvas.module.css';

interface KonvaEditorCanvasProps {
  zoomLevel: number;
  activeTool: 'select' | 'pan';
  onZoomChange?: (updater: (prev: number) => number) => void;
}

// Single Photo Frame Component rendered with Konva
function PhotoFrameNode({
  frame,
  isMuted,
  isCropMode,
  scaleFactor,
  onSelect,
  onDragMove,
  onDragEnd,
  onFrameChange,
  onCropChange,
  onDoubleClick,
  unit,
}: {
  frame: PhotoFrameElement;
  isSelected: boolean;
  isMuted: boolean;
  isCropMode: boolean;
  scaleFactor: number;
  unit: string;
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onFrameChange: (newAttrs: Partial<PhotoFrameElement>) => void;
  onCropChange: (newAttrs: Partial<PhotoFrameElement>) => void;
  onDoubleClick: () => void;
}) {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [liveDimensions, setLiveDimensions] = useState<{ w: number; h: number } | null>(null);
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

  const assignCustomClientRect = (node: Konva.Group | null) => {
    if (!node) return;
    node.getClientRect = (config?: { skipTransform?: boolean; relativeTo?: Konva.Container }) => {
      const skipTransform = config?.skipTransform;
      const w = frame.width * scaleFactor;
      const h = frame.height * scaleFactor;

      if (skipTransform) {
        return { x: 0, y: 0, width: w, height: h };
      }

      const transform = node.getTransform();
      const p1 = transform.point({ x: 0, y: 0 });
      const p2 = transform.point({ x: w, y: 0 });
      const p3 = transform.point({ x: w, y: h });
      const p4 = transform.point({ x: 0, y: h });

      const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
      const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
      const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
      const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

      return {
        x: node.x() + minX,
        y: node.y() + minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    };
  };

  if (shapeRef.current) {
    assignCustomClientRect(shapeRef.current);
  }

  useEffect(() => {
    if (shapeRef.current) {
      assignCustomClientRect(shapeRef.current);
    }
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
      draggable={!isCropMode}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        if (!isCropMode) {
          onSelect(e);
        }
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
      onDragStart={(e) => {
        if (!isCropMode) {
          onSelect(e);
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransform={() => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        const liveW = Math.max(2, (node.width() * scaleX) / scaleFactor);
        const liveH = Math.max(2, (node.height() * scaleY) / scaleFactor);
        setLiveDimensions({
          w: Math.round(liveW * 10) / 10,
          h: Math.round(liveH * 10) / 10,
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        setLiveDimensions(null);
        if (!node) return;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        const newW = Math.max(2, (node.width() * scaleX) / scaleFactor);
        const newH = Math.max(2, (node.height() * scaleY) / scaleFactor);

        // Reset node scale and update width/height
        node.scaleX(1);
        node.scaleY(1);

        onFrameChange({
          x: Math.round((node.x() / scaleFactor) * 10) / 10,
          y: Math.round((node.y() / scaleFactor) * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
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

      {/* Frame Border */}
      {frame.borderEnabled && (
        <Rect
          width={pixelW}
          height={pixelH}
          stroke={frame.borderColor || '#FFFFFF'}
          strokeWidth={Math.max(1, (frame.borderWidth || 1) * (scaleFactor / 10))}
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

      {/* Real-time Dynamic Dimension Badge during resize */}
      {liveDimensions && (
        <Group y={-26} x={Math.max(0, (pixelW - 110) / 2)} listening={false}>
          <Rect
            x={0}
            y={0}
            width={110}
            height={20}
            fill="rgba(15, 23, 42, 0.94)"
            cornerRadius={4}
            stroke="#3b82f6"
            strokeWidth={1}
            shadowColor="rgba(0,0,0,0.6)"
            shadowBlur={8}
          />
          <KonvaText
            text={`${liveDimensions.w} × ${liveDimensions.h} ${unit}`}
            fill="#38bdf8"
            fontSize={11}
            fontStyle="bold"
            fontFamily="sans-serif"
            padding={4}
            width={110}
            align="center"
          />
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
    snapEnabled,
    selectFrame,
    clearSelection,
    addPhotoToSpread,
    updateFrameGeometry,
    updateCrop,
    deleteSelectedFrames,
    copySelectedFrames,
    pasteFrames,
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

  const [containerSize, setContainerSize] = useState({ width: 900, height: 500 });
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

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
      // In Normal Layout Mode: Transformer attaches to the Frame Window!
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
            const step = e.shiftKey ? 0.05 : 0.01;
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
          const step = e.shiftKey ? 5.0 : 1.0;
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

  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ${activeTool === 'pan' ? styles.panningMode : ''} ${editingCropFrameId ? styles.cropModeActive : ''} ${isDragOverCanvas ? styles.dragOverActive : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
          onMouseDown={(e) => {
            // Deselect when clicking on empty stage or background sheet
            if (e.target === e.target.getStage() || e.target.name() === 'background-sheet') {
              clearSelection();
              exitCropMode();
            }
          }}
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
              onClick={() => {
                clearSelection();
                exitCropMode();
              }}
              onMouseDown={() => {
                clearSelection();
                exitCropMode();
              }}
              onTap={() => {
                clearSelection();
                exitCropMode();
              }}
            />

            {/* Left & Right Page Dividers */}
            <Line
              points={[leftPagePixelW, 0, leftPagePixelW, screenSpreadH]}
              stroke="rgba(0,0,0,0.12)"
              strokeWidth={1}
            />
            {gutterPixelW > 0 && (
              <Line
                points={[leftPagePixelW + gutterPixelW, 0, leftPagePixelW + gutterPixelW, screenSpreadH]}
                stroke="rgba(0,0,0,0.12)"
                strokeWidth={1}
              />
            )}

            {/* Center Gutter / Spine Fold Guide */}
            {showGutterGuide && (
              <Group>
                <Line
                  points={[leftPagePixelW, 0, leftPagePixelW, screenSpreadH]}
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
                {gutterPixelW > 0 && (
                  <Line
                    points={[leftPagePixelW + gutterPixelW, 0, leftPagePixelW + gutterPixelW, screenSpreadH]}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={1}
                    dash={[4, 4]}
                  />
                )}
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
                  scaleFactor={scaleFactor}
                  unit={unit}
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
                      thresholdUnits
                    );

                    if (snapRes.snapLines.length > 0) {
                      e.target.x(snapRes.snappedX * scaleFactor);
                      e.target.y(snapRes.snappedY * scaleFactor);
                      setSnapLines(snapRes.snapLines);
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
                  onFrameChange={(updates) => updateFrameGeometry(activeSpread.id, frame.id, updates)}
                  onCropChange={(updates) => updateCrop(activeSpread.id, frame.id, updates)}
                  onDoubleClick={() => enterCropMode(frame.id)}
                />
              );
            })}

            {/* Dynamic Contextual Transformer */}
            <Transformer
              ref={trRef}
              visible={!editingCropFrameId}
              rotateEnabled
              keepRatio={false}
              enabledAnchors={[
                'top-left',
                'top-center',
                'top-right',
                'middle-right',
                'bottom-right',
                'bottom-center',
                'bottom-left',
                'middle-left',
              ]}
              anchorSize={8}
              anchorCornerRadius={2}
              anchorFill="#ffffff"
              anchorStroke={editingCropFrameId ? '#f59e0b' : '#3b82f6'}
              anchorStrokeWidth={1.5}
              borderStroke={editingCropFrameId ? '#f59e0b' : '#3b82f6'}
              borderStrokeWidth={1.5}
              borderDash={editingCropFrameId ? [5, 3] : [4, 3]}
              boundBoxFunc={(oldBox, newBox) => {
                // Minimum size limits
                if (newBox.width < 15 || newBox.height < 15) {
                  return oldBox;
                }
                return newBox;
              }}
            />

            {/* Magnetic Snap Lines overlay */}
            {activeSnapLines.map((line, idx) => (
              <Line
                key={idx}
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
    </div>
  );
}
