import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Group, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { usePhotoStore } from '../../stores/photoStore';
import { PhotoFrameElement, calculateSnapping } from '../../domain/editor';
import { getAllAlbumSpreads } from '../../domain/album';
import { convertUnit, formatDimensions } from '../../domain/units';
import { Photo } from '../../domain/photo';
import styles from './KonvaEditorCanvas.module.css';

interface KonvaEditorCanvasProps {
  zoomLevel: number;
  activeTool: 'select' | 'pan';
}

// Single Photo Frame Component rendered with Konva
function PhotoFrameNode({
  frame,
  isCropMode,
  scaleFactor,
  onSelect,
  onDragMove,
  onDragEnd,
  onChange,
  onDoubleClick,
}: {
  frame: PhotoFrameElement;
  isSelected: boolean;
  isCropMode: boolean;
  scaleFactor: number;
  unit: string;
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onChange: (newAttrs: Partial<PhotoFrameElement>) => void;
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
    img.onload = () => setImageObj(img);
  }, [frame.previewPath, frame.thumbnailPath, frame.filePath]);

  // Convert physical geometry (mm) to screen pixels (px)
  const pixelX = frame.x * scaleFactor;
  const pixelY = frame.y * scaleFactor;
  const pixelW = frame.width * scaleFactor;
  const pixelH = frame.height * scaleFactor;

  // Calculate cover fit scale and dimensions for photo inside frame
  let naturalW = imageObj ? imageObj.naturalWidth : pixelW;
  let naturalH = imageObj ? imageObj.naturalHeight : pixelH;
  if (naturalW === 0) naturalW = 1;
  if (naturalH === 0) naturalH = 1;

  const frameAspect = pixelW / Math.max(1, pixelH);
  const imgAspect = naturalW / naturalH;

  let renderImgW = pixelW;
  let renderImgH = pixelH;
  let offsetX = 0;
  let offsetY = 0;

  const currentScale = frame.cropScale || 1.0;

  if (imgAspect > frameAspect) {
    // Image is wider than frame
    renderImgH = pixelH * currentScale;
    renderImgW = renderImgH * imgAspect;
    offsetX = (pixelW - renderImgW) / 2 + (frame.cropX || 0) * scaleFactor;
    offsetY = (frame.cropY || 0) * scaleFactor;
  } else {
    // Image is taller than frame
    renderImgW = pixelW * currentScale;
    renderImgH = renderImgW / imgAspect;
    offsetX = (frame.cropX || 0) * scaleFactor;
    offsetY = (pixelH - renderImgH) / 2 + (frame.cropY || 0) * scaleFactor;
  }

  return (
    <Group
      id={frame.id}
      ref={shapeRef}
      x={pixelX}
      y={pixelY}
      width={pixelW}
      height={pixelH}
      rotation={frame.rotation || 0}
      draggable={!isCropMode}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect(e);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(e);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onDoubleClick();
      }}
      onDragStart={(e) => {
        onSelect(e);
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        // Reset node scale and update width/height
        node.scaleX(1);
        node.scaleY(1);

        const newW = Math.max(5, (node.width() * scaleX) / scaleFactor);
        const newH = Math.max(5, (node.height() * scaleY) / scaleFactor);

        onChange({
          x: Math.round((node.x() / scaleFactor) * 10) / 10,
          y: Math.round((node.y() / scaleFactor) * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
          rotation: Math.round(node.rotation()),
        });
      }}
    >
      {/* Background clipping rect */}
      <Group
        clipFunc={(ctx) => {
          ctx.rect(0, 0, pixelW, pixelH);
        }}
      >
        {imageObj ? (
          <KonvaImage
            image={imageObj}
            x={offsetX}
            y={offsetY}
            width={renderImgW}
            height={renderImgH}
            draggable={isCropMode}
            onWheel={(e) => {
              if (isCropMode) {
                e.evt.preventDefault();
                e.cancelBubble = true;
                const scaleDelta = e.evt.deltaY < 0 ? 0.1 : -0.1;
                const newScale = Math.max(1.0, Math.min(3.5, (frame.cropScale || 1.0) + scaleDelta));
                onChange({ cropScale: Math.round(newScale * 10) / 10 });
              }
            }}
            onDragMove={(e) => {
              if (isCropMode) {
                e.cancelBubble = true;
              }
            }}
            onDragEnd={(e) => {
              if (isCropMode) {
                e.cancelBubble = true;
                const defaultOffsetX = (pixelW - renderImgW) / 2;
                const defaultOffsetY = (pixelH - renderImgH) / 2;
                const deltaX = (e.target.x() - defaultOffsetX) / scaleFactor;
                const deltaY = (e.target.y() - defaultOffsetY) / scaleFactor;
                onChange({
                  cropX: Math.round(deltaX * 10) / 10,
                  cropY: Math.round(deltaY * 10) / 10,
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
            stroke="#3b82f6"
            strokeWidth={2}
            dash={[6, 4]}
          />
          {/* Rule of Thirds Lines */}
          <Line points={[pixelW / 3, 0, pixelW / 3, pixelH]} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Line points={[(pixelW * 2) / 3, 0, (pixelW * 2) / 3, pixelH]} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Line points={[0, pixelH / 3, pixelW, pixelH / 3]} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Line points={[0, (pixelH * 2) / 3, pixelW, (pixelH * 2) / 3]} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        </Group>
      )}
    </Group>
  );
}

export function KonvaEditorCanvas({ zoomLevel, activeTool }: KonvaEditorCanvasProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    currentAlbum,
    activeSpreadId,
    showGutterGuide,
    showBleedGuide,
    showSafeAreaGuide,
    isSpreadDrawerOpen,
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
    deleteSelectedFrames,
    copySelectedFrames,
    pasteFrames,
    enterCropMode,
    exitCropMode,
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
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: Math.max(400, entry.contentRect.width),
          height: Math.max(300, entry.contentRect.height),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  // Sync Konva Transformer to selected node(s)
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;

    if (selectedFrameIds.length > 0 && !editingCropFrameId) {
      const selectedNodes = selectedFrameIds
        .map((id) => stageRef.current?.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];

      trRef.current.nodes(selectedNodes);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedFrameIds, editingCropFrameId, activeSpread?.elements]);

  // Global Keyboard shortcuts for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!activeSpread) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          deleteSelectedFrames(activeSpread.id);
        }
      } else if (e.key === 'Escape') {
        clearSelection();
        exitCropMode();
      } else if (e.ctrlKey && e.key === 'c') {
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          copySelectedFrames(activeSpread.id);
        }
      } else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        pasteFrames(activeSpread.id);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
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
    deleteSelectedFrames,
    copySelectedFrames,
    pasteFrames,
    clearSelection,
    exitCropMode,
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

  const isCover = activeSpread.type === 'cover';
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
      className={`${styles.canvasContainer} ${activeTool === 'pan' ? styles.panningMode : ''} ${isDragOverCanvas ? styles.dragOverActive : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
                  onChange={(updates) => updateFrameGeometry(activeSpread.id, frame.id, updates)}
                  onDoubleClick={() => enterCropMode(frame.id)}
                />
              );
            })}

            {/* Konva Multi-Handle Transformer */}
            <Transformer
              ref={trRef}
              rotateEnabled={true}
              keepRatio={true}
              anchorSize={8}
              anchorFill="#3b82f6"
              anchorStroke="#ffffff"
              anchorStrokeWidth={1}
              borderStroke="#3b82f6"
              borderStrokeWidth={1.5}
              borderDash={[4, 3]}
              boundBoxFunc={(oldBox, newBox) => {
                // Minimum size limits
                if (newBox.width < 20 || newBox.height < 20) {
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

        {/* Page Badges in Corners */}
        <div className={`${styles.pageBadge} ${styles.leftBadge}`}>
          {isCover ? 'Back Cover' : `Page ${activeSpread.leftPage?.pageNumber ?? 1}`}
        </div>
        <div className={`${styles.pageBadge} ${styles.rightBadge}`}>
          {isCover ? 'Front Cover' : `Page ${activeSpread.rightPage?.pageNumber ?? 2}`}
        </div>
      </div>

      {/* Floating Canvas Footer Info Badge (hides when spread thumbnail drawer is open) */}
      {!isSpreadDrawerOpen && (
        <div className={styles.spreadInfoBadge}>
          <span className={styles.spreadNameText}>{activeSpread.name}</span>
          <span className={styles.spreadDimText}>
            {formatDimensions(singlePageW, singlePageH, unit)} per page (Spread: {formatDimensions(totalSpreadPhysicalW, totalSpreadPhysicalH, unit)})
          </span>
        </div>
      )}

      {/* Drag & Drop Prompt Overlay when dragging from tray */}
      {isDragOverCanvas && (
        <div className={styles.dropOverlay}>
          <span>+ Drop Photo to Place on {activeSpread.name}</span>
        </div>
      )}
    </div>
  );
}
