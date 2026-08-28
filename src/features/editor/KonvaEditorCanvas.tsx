import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Group, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
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
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
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

  if (imgAspect > frameAspect) {
    // Image is wider than frame
    renderImgH = pixelH * (frame.cropScale || 1.0);
    renderImgW = renderImgH * imgAspect;
    offsetX = (pixelW - renderImgW) / 2 + (frame.cropX || 0) * scaleFactor;
    offsetY = (frame.cropY || 0) * scaleFactor;
  } else {
    // Image is taller than frame
    renderImgW = pixelW * (frame.cropScale || 1.0);
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
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDoubleClick}
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
            onDragEnd={(e) => {
              if (isCropMode) {
                onChange({
                  cropX: (e.target.x() - (pixelW - renderImgW) / 2) / scaleFactor,
                  cropY: (e.target.y() - (pixelH - renderImgH) / 2) / scaleFactor,
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

      {/* Crop Mode Indicator Overlay */}
      {isCropMode && (
        <Rect
          width={pixelW}
          height={pixelH}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
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

  if (!currentProject || !currentAlbum) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  if (!activeSpread) return null;

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
  const bleedInMm = convertUnit(activeSpread.bleed, unit, 'mm');
  const safeAreaInMm = convertUnit(activeSpread.safeArea, unit, 'mm');
  const pageWInMm = convertUnit(singlePageW, unit, 'mm');

  // Dynamic responsive canvas scaling (Fills ~88% of container workspace)
  const maxAvailableW = Math.max(300, containerSize.width - 60);
  const maxAvailableH = Math.max(200, containerSize.height - 60);
  const aspect = totalSpreadPhysicalW / totalSpreadPhysicalH;

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
  }, [selectedFrameIds, editingCropFrameId, activeSpread.elements]);

  // Global Keyboard shortcuts for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

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
    activeSpread.id,
    deleteSelectedFrames,
    copySelectedFrames,
    pasteFrames,
    clearSelection,
    exitCropMode,
    nudgeSelected,
  ]);

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
    setIsDragOverCanvas(false);

    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const photo: Photo = JSON.parse(rawData);

      if (stageRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dropClientX = e.clientX - rect.left - (containerSize.width - screenSpreadW) / 2;
        const dropClientY = e.clientY - rect.top - (containerSize.height - screenSpreadH) / 2;

        const physicalX = Math.max(0, Math.min(totalSpreadPhysicalW, dropClientX / scaleFactor));
        const physicalY = Math.max(0, Math.min(totalSpreadPhysicalH, dropClientY / scaleFactor));

        addPhotoToSpread(activeSpread.id, photo, { x: physicalX, y: physicalY });
      } else {
        addPhotoToSpread(activeSpread.id, photo);
      }
    } catch (err) {
      console.error('[AFSN] Error parsing dropped photo:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ${activeTool === 'pan' ? styles.panningMode : ''} ${isDragOverCanvas ? styles.dragOverActive : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        // Clear selection if clicking empty canvas container
        if (e.target === containerRef.current) {
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
            // Deselect when clicking on empty stage
            if (e.target === e.target.getStage()) {
              clearSelection();
              exitCropMode();
            }
          }}
        >
          {/* Layer 1: Background & Page Sheet */}
          <Layer>
            {/* Spread Sheet Board */}
            <Rect
              x={0}
              y={0}
              width={screenSpreadW}
              height={screenSpreadH}
              fill={activeSpread.backgroundColor || '#FFFFFF'}
              shadowColor="rgba(0,0,0,0.6)"
              shadowBlur={16}
              shadowOffset={{ x: 0, y: 8 }}
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
                  dash={[6, 4]}
                />
                {gutterPixelW > 0 && (
                  <Line
                    points={[leftPagePixelW + gutterPixelW, 0, leftPagePixelW + gutterPixelW, screenSpreadH]}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={1}
                    dash={[6, 4]}
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
                    e.cancelBubble = true;
                    selectFrame(frame.id, e.evt.shiftKey);
                  }}
                  onDragMove={(e) => {
                    if (!snapEnabled) return;
                    const physicalX = e.target.x() / scaleFactor;
                    const physicalY = e.target.y() / scaleFactor;
                    const otherRects = (activeSpread.elements || [])
                      .filter((f) => f.id !== frame.id)
                      .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));

                    const snapRes = calculateSnapping(
                      { x: physicalX, y: physicalY, width: frame.width, height: frame.height },
                      totalSpreadPhysicalW,
                      totalSpreadPhysicalH,
                      activeSpread.safeArea,
                      gutterPhysicalW,
                      otherRects
                    );

                    e.target.x(snapRes.snappedX * scaleFactor);
                    e.target.y(snapRes.snappedY * scaleFactor);
                    setSnapLines(snapRes.snapLines);
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
