import { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { Stage, Layer, Rect, Line, Circle, Path as KonvaPath, Text as KonvaText, Group, Image as KonvaImage, Transformer, Label, Tag } from 'react-konva';
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
  calculateRotatedMultiFrameResize,
  calculateMultiFrameRotation,
  computeMultiFrameGroupInfo,
  RectBounds,
  roundToHundredth,
  getPhotoAspect,
  clamp,
  doesMarqueeIntersectFrame,
  calculateCropRotationSnap,
  normalizeAngle,
} from '../../domain/editor';
import { getAllAlbumSpreads, mergeFramePhotoAsset } from '../../domain/album';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import { Photo } from '../../domain/photo';
import { TextNode } from './TextNode';
import { TextInlineEditor } from './TextInlineEditor';
import { TextNodeElement, calculateTextFitHeight, calculateTextFitDimensions } from '../../domain/text';
import { ContextMenu, ContextMenuItem } from '../../components/ui';
import styles from './KonvaEditorCanvas.module.css';

interface KonvaEditorCanvasProps {
  zoomLevel: number;
  activeTool?: 'select' | 'pan';
  onZoomChange?: (updater: (prev: number) => number) => void;
  onToast?: (msg: string) => void;
}

// High-Contrast Professional Rotation Cursor (Adobe InDesign / Figma style)
// Crisp dark body with white outline to guarantee 100% visibility on all backgrounds (white, black, photos)
const ROTATE_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/><path d="M19 4v4.5h-4.5M5 20v-4.5h4.5" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4" stroke="#090d16" stroke-width="2" stroke-linecap="round"/><path d="M19 4v4.5h-4.5M5 20v-4.5h4.5" stroke="#090d16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ROTATE_CURSOR_SVG)}") 12 12, crosshair`;

// Bounded LRU Image Cache for Konva Canvas (Max 24 active decoded bitmaps in RAM/VRAM)
// Evicts oldest decoded HTMLImageElement and clears its src to allow instantaneous GC
const MAX_CANVAS_IMAGE_CACHE = 24;
const photoImageCache = new Map<string, HTMLImageElement>();

function getCachedPhotoImage(key: string): HTMLImageElement | null {
  const img = photoImageCache.get(key);
  if (img) {
    photoImageCache.delete(key);
    photoImageCache.set(key, img);
    return img;
  }
  return null;
}

function setCachedPhotoImage(key: string, img: HTMLImageElement) {
  if (photoImageCache.has(key)) {
    photoImageCache.delete(key);
  } else if (photoImageCache.size >= MAX_CANVAS_IMAGE_CACHE) {
    const oldestKey = photoImageCache.keys().next().value;
    if (oldestKey) {
      const evicted = photoImageCache.get(oldestKey);
      if (evicted) {
        evicted.onload = null;
        evicted.onerror = null;
        evicted.src = ''; // Release decoded bitmap texture immediately from GPU/RAM!
      }
      photoImageCache.delete(oldestKey);
    }
  }
  photoImageCache.set(key, img);
}

function deleteCachedPhotoImage(key: string) {
  const evicted = photoImageCache.get(key);
  if (evicted) {
    evicted.onload = null;
    evicted.onerror = null;
    evicted.src = '';
  }
  photoImageCache.delete(key);
}

// Single Photo Frame Component rendered with Konva
function PhotoFrameNode({
  frame,
  isSelected,
  isMuted,
  isCropMode,
  isMultiSelectActive,
  isHoveredForDrop,
  isAltDrop,
  scaleFactor,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  onFrameChange,
  onCropChange,
  onDoubleClick,
  isShiftPressed = false,
}: {
  frame: PhotoFrameElement;
  isSelected: boolean;
  isMuted: boolean;
  isCropMode: boolean;
  isMultiSelectActive?: boolean;
  isHoveredForDrop?: boolean;
  isAltDrop?: boolean;
  scaleFactor: number;
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onFrameChange: (newAttrs: Partial<PhotoFrameElement>) => void;
  onCropChange: (newAttrs: Partial<PhotoFrameElement>) => void;
  onDoubleClick: () => void;
  isShiftPressed?: boolean;
}) {
  // Strict guard: NEVER load raw full-resolution camera original (filePath).
  // Only generated thumbnails/previews in cache are permitted.
  const isCachePath = (p?: string | null) => {
    if (!p) return false;
    const norm = p.replace(/\\/g, '/').toLowerCase();
    return norm.includes('/thumbnails/') || norm.includes('/previews/');
  };
  const safeThumb = isCachePath(frame.thumbnailPath) ? frame.thumbnailPath : null;
  const safePreview = isCachePath(frame.previewPath) ? frame.previewPath : null;
  const imgPath = !frame.isMissing ? (safePreview || safeThumb || null) : null;
  const cacheKey = frame.photoId && imgPath ? `${frame.photoId}::${imgPath}` : null;
  const cachedCandidate = cacheKey ? getCachedPhotoImage(cacheKey) : null;
  const cachedImg = cachedCandidate && cachedCandidate.naturalWidth > 0 ? cachedCandidate : null;
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(cachedImg);
  const [liveRotation, setLiveRotation] = useState<number | null>(null);
  const [liveScale, setLiveScale] = useState<number | null>(null);
  const [rotatingAngleDisplay, setRotatingAngleDisplay] = useState<number | null>(null);
  const [isAngleSnapped, setIsAngleSnapped] = useState(false);

  const zoomDragStartRef = useRef<{ initialScale: number; initialDist: number } | null>(null);
  const currentDragScaleRef = useRef<number>(frame.cropScale || 1.0);
  const currentDragRotRef = useRef<number>(frame.cropRotation || 0);

  const shapeRef = useRef<Konva.Group>(null);
  const cropGroupRef = useRef<Konva.Group>(null);
  const cropImgRef = useRef<Konva.Image>(null);
  const ghostGroupRef = useRef<Konva.Group>(null);
  const ghostImgRef = useRef<Konva.Image>(null);
  const ghostRectRef = useRef<Konva.Rect>(null);
  const stalkRef = useRef<Konva.Line>(null);
  const rotHandleRef = useRef<Konva.Circle>(null);
  const tlHandleRef = useRef<Konva.Rect>(null);
  const trHandleRef = useRef<Konva.Rect>(null);
  const brHandleRef = useRef<Konva.Rect>(null);
  const blHandleRef = useRef<Konva.Rect>(null);

  // Load preview or thumbnail image (uses cache to avoid flash on remount)
  useEffect(() => {
    if (!frame.photoId || frame.isMissing) {
      setImageObj(null);
      return;
    }

    if (!imgPath) {
      setImageObj(null);
      return;
    }

    const currentCacheKey = `${frame.photoId}::${imgPath}`;

    // Check cache first – if already loaded, use immediately
    const cached = getCachedPhotoImage(currentCacheKey);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      setImageObj(cached);
      return;
    }

    let isMounted = true;
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = convertFileSrc(imgPath);
    img.onload = () => {
      if (!isMounted) return;
      setCachedPhotoImage(currentCacheKey, img);
      setImageObj(img);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const aspect = Math.round((img.naturalWidth / img.naturalHeight) * 1000) / 1000;
        if (!frame.photoAspect || Math.abs(frame.photoAspect - aspect) > 0.01) {
          onFrameChange({ photoAspect: aspect });
        }
      }
    };
    img.onerror = () => {
      if (isMounted) {
        deleteCachedPhotoImage(currentCacheKey);
        setImageObj(null);
        if (frame.photoId) {
          void usePhotoStore.getState().healThumbnail(frame.photoId);
        }
      }
    };

    return () => {
      isMounted = false;
    };
  }, [frame.photoId, frame.previewPath, frame.thumbnailPath, frame.isMissing]);

  // Convert physical geometry (mm/cm) to screen pixels (px)
  const pixelX = frame.x * scaleFactor;
  const pixelY = frame.y * scaleFactor;
  const pixelW = frame.width * scaleFactor;
  const pixelH = frame.height * scaleFactor;

  // Real natural photo aspect ratio from loaded image
  const naturalAspect = (imageObj && imageObj.naturalWidth > 0 && imageObj.naturalHeight > 0)
    ? imageObj.naturalWidth / imageObj.naturalHeight
    : getPhotoAspect(frame);

  const effectiveCropRot = liveRotation !== null ? liveRotation : (frame.cropRotation || 0);
  const effectiveCropScale = liveScale !== null ? liveScale : Math.max(1.0, frame.cropScale || 1.0);

  // Calculate cover dimensions and clamped pixel offset inside frame
  const { offsetX: baseOffsetPhysicalX, offsetY: baseOffsetPhysicalY, width: imgPhysicalW, height: imgPhysicalH } =
    calculateImageOffset(
      frame.width,
      frame.height,
      naturalAspect,
      effectiveCropScale,
      frame.cropX || 0,
      frame.cropY || 0
    );

  const renderImgW = imgPhysicalW * scaleFactor;
  const renderImgH = imgPhysicalH * scaleFactor;
  const offsetX = baseOffsetPhysicalX * scaleFactor;
  const offsetY = baseOffsetPhysicalY * scaleFactor;

  // Exact center of photo relative to frame (frame top-left is 0,0)
  const photoCenterX = offsetX + renderImgW / 2;
  const photoCenterY = offsetY + renderImgH / 2;

  const setCursor = (e: Konva.KonvaEventObject<any>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = cursor;
    }
  };

  const isDraggingRef = useRef(false);

  const handleZoomDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const stage = e.target.getStage();
    const ptr = stage?.getPointerPosition();
    if (ptr && shapeRef.current) {
      const absCenter = shapeRef.current.getAbsoluteTransform().point({ x: photoCenterX, y: photoCenterY });
      const initialDist = Math.hypot(ptr.x - absCenter.x, ptr.y - absCenter.y);
      zoomDragStartRef.current = {
        initialScale: effectiveCropScale,
        initialDist: Math.max(10, initialDist),
      };
      currentDragScaleRef.current = effectiveCropScale;
    }
  };

  const handleZoomDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (!zoomDragStartRef.current) return;
    const stage = e.target.getStage();
    const ptr = stage?.getPointerPosition();
    if (ptr && shapeRef.current) {
      const absCenter = shapeRef.current.getAbsoluteTransform().point({ x: photoCenterX, y: photoCenterY });
      const currentDist = Math.hypot(ptr.x - absCenter.x, ptr.y - absCenter.y);
      const ratio = currentDist / zoomDragStartRef.current.initialDist;
      const targetScale = clamp(roundToHundredth(zoomDragStartRef.current.initialScale * ratio), 1.0, 3.5);
      currentDragScaleRef.current = targetScale;
      setLiveScale(targetScale);
    }
  };

  const handleZoomDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const finalScale = currentDragScaleRef.current;
    zoomDragStartRef.current = null;
    setLiveScale(null);
    if (tlHandleRef.current) { tlHandleRef.current.x(-renderImgW / 2); tlHandleRef.current.y(-renderImgH / 2); }
    if (trHandleRef.current) { trHandleRef.current.x(renderImgW / 2); trHandleRef.current.y(-renderImgH / 2); }
    if (brHandleRef.current) { brHandleRef.current.x(renderImgW / 2); brHandleRef.current.y(renderImgH / 2); }
    if (blHandleRef.current) { blHandleRef.current.x(-renderImgW / 2); blHandleRef.current.y(renderImgH / 2); }
    onCropChange({
      cropScale: finalScale,
      cropRotation: effectiveCropRot,
      cropX: frame.cropX || 0,
      cropY: frame.cropY || 0,
    });
  };

  const handleRotationDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    setCursor(e, ROTATE_CURSOR);
  };

  const handleRotationDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    setCursor(e, ROTATE_CURSOR);
    // Anchor handle firmly to stalk tip so it never drifts during drag
    e.target.x(0);
    e.target.y(-renderImgH / 2 - 26);
    const stage = e.target.getStage();
    const ptr = stage?.getPointerPosition();
    if (ptr && shapeRef.current) {
      const absCenter = shapeRef.current.getAbsoluteTransform().point({ x: photoCenterX, y: photoCenterY });
      const dx = ptr.x - absCenter.x;
      const dy = ptr.y - absCenter.y;
      let pointerAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90 - (frame.rotation || 0);
      const { angle: snappedAngle, isSnapped } = calculateCropRotationSnap(
        normalizeAngle(pointerAngleDeg),
        isShiftPressed
      );

      currentDragRotRef.current = snappedAngle;
      setLiveRotation(snappedAngle);
      setRotatingAngleDisplay(snappedAngle);
      setIsAngleSnapped(isSnapped);
    }
  };

  const handleRotationDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    setCursor(e, 'default');
    e.target.x(0);
    e.target.y(-renderImgH / 2 - 26);
    const finalRot = currentDragRotRef.current;
    setLiveRotation(null);
    setRotatingAngleDisplay(null);
    setIsAngleSnapped(false);

    onCropChange({
      cropRotation: finalRot,
      cropScale: frame.cropScale || 1.0,
      cropX: frame.cropX || 0,
      cropY: frame.cropY || 0,
    });
  };

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
      draggable={!frame.locked && !isCropMode}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        // Ignore right-clicks & middle-clicks on mouse down
        if ('button' in e.evt && (e.evt.button === 2 || e.evt.button === 1)) {
          return;
        }
        if ('which' in e.evt && (e.evt.which === 3 || e.evt.which === 2)) {
          return;
        }
        if (!isCropMode) {
          const isMulti = Boolean(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
          if (isMulti) {
            onSelect(e);
          } else if (!isSelected) {
            onSelect(e);
          }
        }
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        if ('button' in e.evt && e.evt.button !== 0) {
          return;
        }
        if ('which' in e.evt && e.evt.which !== 1) {
          return;
        }
        const isMulti = Boolean(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
        if (!isCropMode && !isDraggingRef.current && isSelected && !isMulti) {
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
        // Double-click to crop MUST ONLY trigger on primary left button, NEVER during multi-select or on locked frames
        if ('button' in e.evt && e.evt.button !== 0) {
          return;
        }
        if ('which' in e.evt && e.evt.which !== 1) {
          return;
        }
        if (isMultiSelectActive || frame.locked) {
          return;
        }
        onDoubleClick();
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        if (!isCropMode) {
          if (!isSelected) {
            onSelect();
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
      {/* Base Solid Hit Rect for robust selection & drag events */}
      <Rect width={pixelW} height={pixelH} fill="rgba(0, 0, 0, 0.001)" listening={!isCropMode} />

      {/* Ghost Reveal and Interactive Crop Overlay */}
      {isCropMode && imageObj && (
        <Group
          ref={ghostGroupRef}
          x={photoCenterX}
          y={photoCenterY}
          rotation={effectiveCropRot}
        >
          {/* Semi-transparent uncropped original image outside the frame */}
          <KonvaImage
            ref={ghostImgRef}
            image={imageObj}
            x={-renderImgW / 2}
            y={-renderImgH / 2}
            width={renderImgW}
            height={renderImgH}
            opacity={0.28}
            listening={false}
          />

          {/* Dashed outer boundary of original uncropped image */}
          <Rect
            ref={ghostRectRef}
            x={-renderImgW / 2}
            y={-renderImgH / 2}
            width={renderImgW}
            height={renderImgH}
            stroke="rgba(245, 158, 11, 0.85)"
            strokeWidth={1.5}
            dash={[6, 4]}
            listening={false}
          />

          {/* Rotation Stalk Line from top center of image to rotation handle */}
          <Line
            ref={stalkRef}
            points={[0, -renderImgH / 2, 0, -renderImgH / 2 - 26]}
            stroke="#0284c7"
            strokeWidth={1.5}
            dash={[4, 3]}
            listening={false}
          />

          {/* Rotation Handle Circle */}
          <Circle
            ref={rotHandleRef}
            x={0}
            y={-renderImgH / 2 - 26}
            radius={7}
            fill="#ffffff"
            stroke={isAngleSnapped ? '#0284c7' : '#38bdf8'}
            strokeWidth={2.5}
            shadowColor="rgba(0, 0, 0, 0.35)"
            shadowBlur={5}
            shadowOffset={{ x: 0, y: 1 }}
            draggable
            dragBoundFunc={() => {
              if (ghostGroupRef.current) {
                return ghostGroupRef.current.getAbsoluteTransform().point({ x: 0, y: -renderImgH / 2 - 26 });
              }
              return { x: 0, y: 0 };
            }}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onMouseEnter={(e) => setCursor(e, ROTATE_CURSOR)}
            onMouseLeave={(e) => setCursor(e, 'default')}
            onDragStart={handleRotationDragStart}
            onDragMove={handleRotationDragMove}
            onDragEnd={handleRotationDragEnd}
          />

          {/* Live Angle HUD Tooltip Badge */}
          {rotatingAngleDisplay !== null && (
            <Group
              x={0}
              y={-renderImgH / 2 - 54}
              rotation={-effectiveCropRot}
              listening={false}
            >
              <Label offsetX={rotatingAngleDisplay >= 100 ? 24 : 18} offsetY={12}>
                <Tag
                  fill="#090d16"
                  stroke={isAngleSnapped ? '#0284c7' : 'rgba(245, 158, 11, 0.8)'}
                  strokeWidth={isAngleSnapped ? 2 : 1}
                  cornerRadius={4}
                  shadowColor={isAngleSnapped ? 'rgba(2, 132, 199, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                  shadowBlur={isAngleSnapped ? 12 : 6}
                  shadowOffset={{ x: 0, y: 1 }}
                />
                <KonvaText
                  text={isAngleSnapped ? `🧲 ${rotatingAngleDisplay}°` : `${rotatingAngleDisplay}°`}
                  fill={isAngleSnapped ? '#38bdf8' : '#f8fafc'}
                  fontSize={11}
                  fontStyle="bold"
                  padding={5}
                  align="center"
                />
              </Label>
            </Group>
          )}

          {/* 4 Corner Zoom Handles */}
          {/* Top-Left */}
          <Rect
            ref={tlHandleRef}
            x={-renderImgW / 2}
            y={-renderImgH / 2}
            width={10}
            height={10}
            offsetX={5}
            offsetY={5}
            cornerRadius={2}
            fill="#ffffff"
            stroke="#f59e0b"
            strokeWidth={2}
            shadowColor="rgba(0, 0, 0, 0.35)"
            shadowBlur={4}
            draggable
            dragBoundFunc={() => {
              if (ghostGroupRef.current) {
                return ghostGroupRef.current.getAbsoluteTransform().point({ x: -renderImgW / 2, y: -renderImgH / 2 });
              }
              return { x: 0, y: 0 };
            }}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onMouseEnter={(e) => setCursor(e, 'nwse-resize')}
            onMouseLeave={(e) => setCursor(e, 'default')}
            onDragStart={handleZoomDragStart}
            onDragMove={handleZoomDragMove}
            onDragEnd={handleZoomDragEnd}
          />

          {/* Top-Right */}
          <Rect
            ref={trHandleRef}
            x={renderImgW / 2}
            y={-renderImgH / 2}
            width={10}
            height={10}
            offsetX={5}
            offsetY={5}
            cornerRadius={2}
            fill="#ffffff"
            stroke="#f59e0b"
            strokeWidth={2}
            shadowColor="rgba(0, 0, 0, 0.35)"
            shadowBlur={4}
            draggable
            dragBoundFunc={() => {
              if (ghostGroupRef.current) {
                return ghostGroupRef.current.getAbsoluteTransform().point({ x: renderImgW / 2, y: -renderImgH / 2 });
              }
              return { x: 0, y: 0 };
            }}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onMouseEnter={(e) => setCursor(e, 'nesw-resize')}
            onMouseLeave={(e) => setCursor(e, 'default')}
            onDragStart={handleZoomDragStart}
            onDragMove={handleZoomDragMove}
            onDragEnd={handleZoomDragEnd}
          />

          {/* Bottom-Right */}
          <Rect
            ref={brHandleRef}
            x={renderImgW / 2}
            y={renderImgH / 2}
            width={10}
            height={10}
            offsetX={5}
            offsetY={5}
            cornerRadius={2}
            fill="#ffffff"
            stroke="#f59e0b"
            strokeWidth={2}
            shadowColor="rgba(0, 0, 0, 0.35)"
            shadowBlur={4}
            draggable
            dragBoundFunc={() => {
              if (ghostGroupRef.current) {
                return ghostGroupRef.current.getAbsoluteTransform().point({ x: renderImgW / 2, y: renderImgH / 2 });
              }
              return { x: 0, y: 0 };
            }}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onMouseEnter={(e) => setCursor(e, 'nwse-resize')}
            onMouseLeave={(e) => setCursor(e, 'default')}
            onDragStart={handleZoomDragStart}
            onDragMove={handleZoomDragMove}
            onDragEnd={handleZoomDragEnd}
          />

          {/* Bottom-Left */}
          <Rect
            ref={blHandleRef}
            x={-renderImgW / 2}
            y={renderImgH / 2}
            width={10}
            height={10}
            offsetX={5}
            offsetY={5}
            cornerRadius={2}
            fill="#ffffff"
            stroke="#f59e0b"
            strokeWidth={2}
            shadowColor="rgba(0, 0, 0, 0.35)"
            shadowBlur={4}
            draggable
            dragBoundFunc={() => {
              if (ghostGroupRef.current) {
                return ghostGroupRef.current.getAbsoluteTransform().point({ x: -renderImgW / 2, y: renderImgH / 2 });
              }
              return { x: 0, y: 0 };
            }}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onMouseEnter={(e) => setCursor(e, 'nesw-resize')}
            onMouseLeave={(e) => setCursor(e, 'default')}
            onDragStart={handleZoomDragStart}
            onDragMove={handleZoomDragMove}
            onDragEnd={handleZoomDragEnd}
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
          <Group
            id={`crop-group-${frame.id}`}
            ref={cropGroupRef}
            x={photoCenterX}
            y={photoCenterY}
            rotation={effectiveCropRot}
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
                const scaleDelta = e.evt.deltaY < 0 ? 0.02 : -0.02;
                const newScale = clamp(Math.round(((frame.cropScale || 1.0) + scaleDelta) * 100) / 100, 1.0, 3.5);
                onCropChange({ cropScale: newScale });
              }
            }}
            onDragMove={(e) => {
              if (isCropMode) {
                e.cancelBubble = true;
                const maxExcessX = Math.max(0, renderImgW - pixelW);
                const maxExcessY = Math.max(0, renderImgH - pixelH);
                const maxShiftX = maxExcessX / 2;
                const maxShiftY = maxExcessY / 2;
                const fcX = pixelW / 2;
                const fcY = pixelH / 2;

                let targetX = fcX;
                let targetY = fcY;
                if (maxShiftX > 0.5) {
                  targetX = clamp(e.target.x(), fcX - maxShiftX, fcX + maxShiftX);
                }
                if (maxShiftY > 0.5) {
                  targetY = clamp(e.target.y(), fcY - maxShiftY, fcY + maxShiftY);
                }
                e.target.x(targetX);
                e.target.y(targetY);

                if (ghostGroupRef.current) {
                  ghostGroupRef.current.x(targetX);
                  ghostGroupRef.current.y(targetY);
                }

                e.target.getLayer()?.batchDraw();
              }
            }}
            onDragEnd={(e) => {
              if (isCropMode) {
                e.cancelBubble = true;
                const maxExcessX = Math.max(0, renderImgW - pixelW);
                const maxExcessY = Math.max(0, renderImgH - pixelH);
                const maxShiftX = maxExcessX / 2;
                const maxShiftY = maxExcessY / 2;
                const fcX = pixelW / 2;
                const fcY = pixelH / 2;

                let normX = 0;
                let normY = 0;
                if (maxShiftX > 0.5) {
                  normX = (e.target.x() - fcX) / maxShiftX;
                }
                if (maxShiftY > 0.5) {
                  normY = (e.target.y() - fcY) / maxShiftY;
                }

                onCropChange({
                  cropX: Math.round(clamp(normX, -1, 1) * 1000) / 1000,
                  cropY: Math.round(clamp(normY, -1, 1) * 1000) / 1000,
                  cropScale: effectiveCropScale,
                  cropRotation: effectiveCropRot,
                });
              }
            }}
          >
            <KonvaImage
              id={`crop-img-${frame.id}`}
              ref={cropImgRef}
              image={imageObj}
              x={-renderImgW / 2}
              y={-renderImgH / 2}
              width={renderImgW}
              height={renderImgH}
            />
          </Group>
        ) : (
          <Rect
            width={pixelW}
            height={pixelH}
            fill="#1e293b"
            listening={false}
          />
        )}
      </Group>

      {/* Frame Border (Inside Stroke to maintain exact outer bounds for snapping) */}
      {frame.borderEnabled && (() => {
        const strokePx = Math.max(1, Math.round((frame.borderWidth || 0) * scaleFactor));
        return (
          <Rect
            x={strokePx / 2}
            y={strokePx / 2}
            width={Math.max(0, pixelW - strokePx)}
            height={Math.max(0, pixelH - strokePx)}
            stroke={frame.borderColor || '#FFFFFF'}
            strokeWidth={strokePx}
            strokeScaleEnabled={false}
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
          strokeScaleEnabled={false}
          listening={false}
        />
      )}

      {/* Drag & Drop Replace / Overlay Visual Feedback Glow & Badge */}
      {isHoveredForDrop && (
        <Group listening={false}>
          <Rect
            x={0}
            y={0}
            width={pixelW}
            height={pixelH}
            fill={isAltDrop ? "rgba(16, 185, 129, 0.22)" : "rgba(59, 130, 246, 0.12)"}
            stroke={isAltDrop ? "#10b981" : "#3b82f6"}
            strokeWidth={isAltDrop ? 3 : 2}
            dash={isAltDrop ? [8, 4] : [6, 4]}
            strokeScaleEnabled={false}
          />
          <Rect
            x={Math.max(0, (pixelW - (isAltDrop ? 130 : 145)) / 2)}
            y={Math.max(0, (pixelH - 28) / 2)}
            width={isAltDrop ? 130 : 145}
            height={28}
            fill={isAltDrop ? "rgba(6, 78, 59, 0.94)" : "rgba(15, 23, 42, 0.94)"}
            cornerRadius={6}
            stroke={isAltDrop ? "#10b981" : "#3b82f6"}
            strokeWidth={1}
            strokeScaleEnabled={false}
          />
          <KonvaText
            x={Math.max(0, (pixelW - (isAltDrop ? 130 : 145)) / 2)}
            y={Math.max(0, (pixelH - 28) / 2) + 7}
            width={isAltDrop ? 130 : 145}
            align="center"
            text={isAltDrop ? "🔄 Replace Photo" : "Hold Alt to Replace"}
            fontSize={11}
            fontStyle="bold"
            fill={isAltDrop ? "#ffffff" : "#93c5fd"}
            fontFamily="Inter, system-ui, -apple-system, sans-serif"
          />
        </Group>
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
            strokeScaleEnabled={false}
          />
          {/* Rule of Thirds Lines */}
          <Line points={[pixelW / 3, 0, pixelW / 3, pixelH]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[(pixelW * 2) / 3, 0, (pixelW * 2) / 3, pixelH]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[0, pixelH / 3, pixelW, pixelH / 3]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[0, (pixelH * 2) / 3, pixelW, (pixelH * 2) / 3]} stroke="rgba(255,255,255,0.7)" strokeWidth={1} strokeScaleEnabled={false} />
        </Group>
      )}

      {/* Locked Frame Selection Outline */}
      {isSelected && frame.locked && !isCropMode && (
        <Rect
          width={pixelW}
          height={pixelH}
          stroke="#f59e0b"
          strokeWidth={1.5}
          dash={[4, 4]}
          listening={false}
          strokeScaleEnabled={false}
        />
      )}

      {/* Locked Vector Padlock Badge (top-right corner) */}
      {frame.locked && (
        <Group
          x={Math.max(14, pixelW - 16)}
          y={16}
          listening={true}
          onClick={(e) => {
            e.cancelBubble = true;
            useEditorStore.getState().toggleLockSelectedFrames(undefined, false);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            useEditorStore.getState().toggleLockSelectedFrames(undefined, false);
          }}
        >
          <Circle
            radius={11}
            fill="rgba(15, 23, 42, 0.92)"
            stroke="#f59e0b"
            strokeWidth={1.5}
            shadowColor="rgba(0, 0, 0, 0.6)"
            shadowBlur={4}
            shadowOffset={{ x: 0, y: 1 }}
          />
          <KonvaPath
            data="M7 11V7a5 5 0 0 1 10 0v4M4 11h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
            stroke="#fbbf24"
            strokeWidth={2}
            fill="#f59e0b"
            scale={{ x: 0.5, y: 0.5 }}
            x={-6}
            y={-6}
            listening={false}
          />
        </Group>
      )}

    </Group>
  );
}

export function KonvaEditorCanvas({ zoomLevel, activeTool, onZoomChange: _onZoomChange, onToast }: KonvaEditorCanvasProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    currentAlbum,
    activeSpreadId,
    showGutterGuide,
    showBleedGuide,
    showSafeAreaGuide,
    initializeAlbum,
    duplicateSpread,
    addSpread,
  } = useAlbumStore();

  const {
    selectedFrameIds,
    editingCropFrameId,
    activeSnapLines,
    activeGapGuides,
    snapEnabled,
    snappingConfig,
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
    pasteFramesInPlace,
    pasteFramesToAllSpreads,
    duplicateSelectedFrames,
    duplicateFramesToPosition,
    replacePhotoInFrame,
    swapFrames,
    groupSelectedFrames,
    ungroupSelectedFrames,
    bringSelectedToFront,
    sendSelectedToBack,
    rotateSelectedFrames,
    resetSelectedRatio,
    alignSelectedFrames,
    distributeSelectedFrames,
    applyFixedGapToSelected,
    matchSelectedDimensions,
    enterCropMode,
    exitCropMode,
    resetSelectedCrop,
    setSnapLines,
    clearSnapLines,
    nudgeSelected,
    editingTextElementId,
    setEditingTextElementId,
    updateTextElement,
  } = useEditorStore();
  const photos = usePhotoStore((s) => s.photos);
  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const multiGroupRef = useRef<Konva.Rect>(null);
  const multiTransformInitialStateRef = useRef<{
    frames: PhotoFrameElement[];
    initialGroupRot?: number;
    bounds: RectBounds;
  } | null>(null);
  const activeTransformAnchorRef = useRef<string | null>(null);
  const [rotationHud, setRotationHud] = useState<{ angle: number; snapped: boolean; x: number; y: number } | null>(null);
  const [resizeHud, setResizeHud] = useState<{
    width: number;
    height: number;
    unit: string;
    fontSize?: number;
    isText: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const isAltPressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Alt') isAltPressedRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.key === 'Alt') isAltPressedRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const [containerSize, setContainerSize] = useState({ width: 900, height: 500 });
  const [hoveredDropFrameId, setHoveredDropFrameId] = useState<string | null>(null);
  const [isHoveredDropAlt, setIsHoveredDropAlt] = useState(false);
  const justDroppedRef = useRef(false);

  // Window & Drag lifecycle safety guards to guarantee clean reset
  useEffect(() => {
    const handleResetDragState = () => {
      setIsHoveredDropAlt(false);
      setHoveredDropFrameId(null);
      isAltPressedRef.current = false;
    };

    window.addEventListener('blur', handleResetDragState);
    window.addEventListener('dragend', handleResetDragState);
    window.addEventListener('drop', handleResetDragState);
    document.addEventListener('visibilitychange', handleResetDragState);

    return () => {
      window.removeEventListener('blur', handleResetDragState);
      window.removeEventListener('dragend', handleResetDragState);
      window.removeEventListener('drop', handleResetDragState);
      document.removeEventListener('visibilitychange', handleResetDragState);
    };
  }, []);

  // Natural Pan Navigation State (Spacebar + Drag or Middle-Click Drag)
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  useEffect(() => {
    const handleSpaceDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };
    const handleSpaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
        panStartRef.current = null;
      }
    };
    window.addEventListener('keydown', handleSpaceDown);
    window.addEventListener('keyup', handleSpaceUp);
    return () => {
      window.removeEventListener('keydown', handleSpaceDown);
      window.removeEventListener('keyup', handleSpaceUp);
    };
  }, []);

  // Attach native drag events directly to the Konva canvas DOM element.
  // Konva's <canvas> element can eat HTML5 drag events in some browsers,
  // preventing them from bubbling to the parent React container div.
  // The dragover handler MUST call preventDefault() to make the element a valid drop target.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const canvasContainer = stage.container();
    if (!canvasContainer) return;

    const nativeDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    canvasContainer.addEventListener('dragover', nativeDragOver);
    return () => {
      canvasContainer.removeEventListener('dragover', nativeDragOver);
    };
  });

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
  const marqueeInitialSelectedIdsRef = useRef<string[]>([]);

  // Context Menu State & Click Location Tracking
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({ isOpen: false, x: 0, y: 0 });
  const contextMenuPhysicalPosRef = useRef<{ x: number; y: number } | null>(null);

  const openContextMenuAt = (clientX: number, clientY: number) => {
    if (stageRef.current) {
      const stageBox = stageRef.current.container().getBoundingClientRect();
      const relativeX = (clientX - stageBox.left) / scaleFactor;
      const relativeY = (clientY - stageBox.top) / scaleFactor;
      if (
        relativeX >= 0 &&
        relativeY >= 0 &&
        relativeX <= totalSpreadPhysicalW &&
        relativeY <= totalSpreadPhysicalH
      ) {
        contextMenuPhysicalPosRef.current = {
          x: Math.round(relativeX * 10) / 10,
          y: Math.round(relativeY * 10) / 10,
        };
      } else {
        contextMenuPhysicalPosRef.current = null;
      }
    } else {
      contextMenuPhysicalPosRef.current = null;
    }
    setContextMenu({ isOpen: true, x: clientX, y: clientY });
  };

  // Multi-frame synchronized dragging positions
  const dragInitialPhysicalPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

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

  // Re-draw canvas once web fonts (Inter, Playfair Display, Montserrat, etc.) finish loading
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        stageRef.current?.batchDraw();
      });
    }
  }, []);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  const editingTextElement = useMemo(() => {
    if (!editingTextElementId || !activeSpread) return null;
    const found = (activeSpread.elements || []).find((el) => el.id === editingTextElementId);
    return found && found.type === 'text' ? (found as TextNodeElement) : null;
  }, [editingTextElementId, activeSpread]);

  const selectedFramesList = useMemo(() => {
    return (activeSpread?.elements || []).filter((el) => selectedFrameIds.includes(el.id));
  }, [activeSpread?.elements, selectedFrameIds]);

  const selectionGroupRotation = useEditorStore((s) => s.selectionGroupRotation);
  const multiGroupInfo = useMemo(() => {
    if (selectedFramesList.length <= 1) return null;
    return computeMultiFrameGroupInfo(selectedFramesList as PhotoFrameElement[], selectionGroupRotation ?? undefined);
  }, [selectedFramesList, selectionGroupRotation]);

  const isSelectionFullyLocked = useMemo(() => {
    if (!activeSpread || selectedFrameIds.length === 0) return false;
    const selected = (activeSpread.elements || []).filter((f) => selectedFrameIds.includes(f.id));
    return selected.length > 0 && selected.every((f) => f.locked);
  }, [activeSpread, selectedFrameIds]);

  // Sync Konva Transformer to selected node(s)
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;

    if (editingCropFrameId || editingTextElementId || isSelectionFullyLocked) {
      trRef.current.nodes([]);
      trRef.current.forceUpdate();
      trRef.current.getLayer()?.batchDraw();
    } else if (selectedFrameIds.length === 1) {
      const singleNode = stageRef.current.findOne(`#${selectedFrameIds[0]}`);
      if (singleNode) {
        singleNode.scaleX(1);
        singleNode.scaleY(1);
        trRef.current.nodes([singleNode]);
        trRef.current.update();
        trRef.current.forceUpdate();
        trRef.current.getLayer()?.batchDraw();
      } else {
        trRef.current.nodes([]);
        trRef.current.forceUpdate();
        trRef.current.getLayer()?.batchDraw();
      }
    } else if (selectedFrameIds.length > 1) {
      const proxyNode = multiGroupRef.current || stageRef.current.findOne('#multi-selection-proxy');
      if (proxyNode && multiGroupInfo) {
        proxyNode.x(multiGroupInfo.groupX * scaleFactor);
        proxyNode.y(multiGroupInfo.groupY * scaleFactor);
        proxyNode.width(multiGroupInfo.groupWidth * scaleFactor);
        proxyNode.height(multiGroupInfo.groupHeight * scaleFactor);
        proxyNode.rotation(multiGroupInfo.groupRotation);
        proxyNode.scaleX(1);
        proxyNode.scaleY(1);
        trRef.current.nodes([proxyNode]);
        trRef.current.update();
        trRef.current.forceUpdate();
        trRef.current.getLayer()?.batchDraw();
      } else {
        const selectedNodes = selectedFrameIds
          .map((id) => stageRef.current?.findOne(`#${id}`))
          .filter(Boolean) as Konva.Node[];
        if (selectedNodes.length > 0) {
          trRef.current.nodes(selectedNodes);
          trRef.current.update();
          trRef.current.forceUpdate();
          trRef.current.getLayer()?.batchDraw();
        }
      }
    } else {
      trRef.current.nodes([]);
      trRef.current.forceUpdate();
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedFrameIds, editingCropFrameId, editingTextElementId, activeSpread?.elements, zoomLevel, containerSize, multiGroupInfo, selectionGroupRotation, isSelectionFullyLocked]);

  // Immediately detach Transformer synchronously before paint when editing text or crop mode
  useLayoutEffect(() => {
    if ((editingTextElementId || editingCropFrameId) && trRef.current) {
      trRef.current.nodes([]);
      trRef.current.forceUpdate();
      trRef.current.getLayer()?.batchDraw();
    }
  }, [editingTextElementId, editingCropFrameId]);

  // When zooming in, center scroll position so the view remains focused and both left & right pages are accessible
  const prevZoomRef = useRef(zoomLevel);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevZoomRef.current !== zoomLevel) {
      if (zoomLevel > 100 && prevZoomRef.current <= 100) {
        const targetScrollLeft = (container.scrollWidth - container.clientWidth) / 2;
        const targetScrollTop = (container.scrollHeight - container.clientHeight) / 2;
        container.scrollLeft = Math.max(0, targetScrollLeft);
        container.scrollTop = Math.max(0, targetScrollTop);
      } else if (zoomLevel > 100 && prevZoomRef.current > 100) {
        const ratio = zoomLevel / prevZoomRef.current;
        const currentCenterX = container.scrollLeft + container.clientWidth / 2;
        const currentCenterY = container.scrollTop + container.clientHeight / 2;
        const newCenterX = currentCenterX * ratio;
        const newCenterY = currentCenterY * ratio;
        container.scrollLeft = Math.max(0, newCenterX - container.clientWidth / 2);
        container.scrollTop = Math.max(0, newCenterY - container.clientHeight / 2);
      }
      prevZoomRef.current = zoomLevel;
    }
  }, [zoomLevel]);

  // Global Keyboard shortcuts for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!activeSpread) return;

      // Do not process canvas keyboard shortcuts if a modal/dialog is open
      const isModalOpen = Boolean(document.querySelector('[role="dialog"]') || document.querySelector('.modal'));
      if (isModalOpen) return;

      // If focus is inside the spread drawer, let the drawer handle the Delete key!
      const targetElement = e.target as HTMLElement;
      const isFocusedInDrawer = Boolean(targetElement?.closest('[data-spread-drawer="true"]'));
      if (isFocusedInDrawer && (e.key === 'Delete' || e.key === 'Backspace')) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingCropFrameId) {
          e.preventDefault();
          return;
        }
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          deleteSelectedFrames(activeSpread.id);
          return;
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const isHoveredOnSpreadDrawer = Boolean(document.querySelector('[data-spread-drawer="true"]:hover'));
        const isHoveredOnFilmstrip = Boolean(document.querySelector('[aria-label="Photo Library Filmstrip"]:hover'));
        if (!isHoveredOnSpreadDrawer && !isHoveredOnFilmstrip && activeSpread) {
          e.preventDefault();
          const allFrameIds = (activeSpread.elements || []).map((f) => f.id);
          if (allFrameIds.length > 0) {
            selectFrames(allFrameIds);
            usePhotoStore.getState().clearSelection();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (e.altKey && selectedFrameIds.length === 1) {
          const selEl = (activeSpread?.elements || []).find((el) => el.id === selectedFrameIds[0]);
          if (selEl && selEl.type === 'text') {
            e.preventDefault();
            const textEl = selEl as TextNodeElement;
            const maxTextW = currentProject ? currentProject.canvasWidth * 0.95 : 800;
            const fitted = calculateTextFitDimensions(
              textEl.text || ' ',
              textEl.style || {},
              dims.unit,
              dims.dpi,
              textEl.width,
              maxTextW,
              textEl.styledRanges
            );
            const deltaW = textEl.width - fitted.width;

            let newX = textEl.x;
            if (textEl.style?.align === 'center') {
              newX = textEl.x + deltaW / 2;
            } else if (textEl.style?.align === 'right') {
              newX = textEl.x + deltaW;
            }

            // Keep top edge anchored at textEl.y so text NEVER jumps or shifts downwards!
            updateTextElement(activeSpread.id, textEl.id, {
              x: roundToHundredth(newX),
              y: roundToHundredth(textEl.y),
              width: fitted.width,
              height: fitted.height,
            });
            if (onToast) onToast('✓ Fitted frame tightly around text content');
            return;
          }
        }
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          copySelectedFrames(activeSpread.id);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (e.altKey) {
          const res = pasteFramesToAllSpreads();
          if (res.spreadsCount > 0 && onToast) {
            onToast(`✓ Pasted ${res.count} element(s) to all ${res.spreadsCount} spreads`);
          }
        } else if (e.shiftKey) {
          pasteFramesInPlace(activeSpread.id);
          if (onToast) onToast('✓ Pasted in place');
        } else {
          pasteFrames(activeSpread.id);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedFrameIds.length > 0) {
          e.preventDefault();
          duplicateSelectedFrames(activeSpread.id);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          ungroupSelectedFrames(activeSpread.id);
        } else {
          groupSelectedFrames(activeSpread.id);
        }
      } else if (e.key.toLowerCase() === 'l') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.altKey || e.shiftKey) {
            useEditorStore.getState().toggleLockSelectedFrames(activeSpread.id, false);
            if (onToast) onToast(`🔓 Unlocked ${selectedFrameIds.length} selected element(s)`);
          } else {
            if (selectedFrameIds.length > 0) {
              useEditorStore.getState().toggleLockSelectedFrames(activeSpread.id, true);
              if (onToast) onToast(`🔒 Locked ${selectedFrameIds.length} selected element(s)`);
            } else if (onToast) {
              onToast('⚠️ Select photo(s) or text(s) to lock (Ctrl+L)');
            }
          }
        } else if (e.altKey) {
          e.preventDefault();
          if (selectedFrameIds.length > 0) {
            useEditorStore.getState().toggleLockSelectedFrames(activeSpread.id, false);
            if (onToast) onToast(`🔓 Unlocked ${selectedFrameIds.length} selected element(s)`);
          } else {
            const lockedCount = (activeSpread.elements || []).filter((el) => el.locked).length;
            if (lockedCount > 0) {
              useEditorStore.getState().unlockAllFramesOnSpread(activeSpread.id);
              if (onToast) onToast(`🔓 Unlocked all ${lockedCount} element(s) on spread`);
            } else if (onToast) {
              onToast('⚠️ No locked elements found on spread');
            }
          }
        }
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectedFrameIds.length === 2 && selectedFrameIds[0] && selectedFrameIds[1]) {
          e.preventDefault();
          swapFrames(activeSpread.id, selectedFrameIds[0], selectedFrameIds[1]);
        }
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectedFrameIds.length > 0 && !editingCropFrameId) {
          e.preventDefault();
          rotateSelectedFrames(activeSpread.id, e.shiftKey ? 'ccw' : 'cw');
        } else if (editingCropFrameId) {
          e.preventDefault();
          const cropFrame = (activeSpread.elements || []).find((frame) => frame.id === editingCropFrameId);
          if (cropFrame && cropFrame.type === 'photo') {
            const photoEl = cropFrame as PhotoFrameElement;
            const currentRot = photoEl.cropRotation || 0;
            const delta = e.shiftKey ? -90 : 90;
            const nextRot = (currentRot + delta + 360) % 360;
            updateCrop(activeSpread.id, photoEl.id, { cropRotation: nextRot });
          }
        }
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (editingCropFrameId) {
          const cropFrame = (activeSpread.elements || []).find((frame) => frame.id === editingCropFrameId);
          if (cropFrame && cropFrame.type === 'photo') {
            const photoEl = cropFrame as PhotoFrameElement;
            e.preventDefault();
            const step = e.shiftKey ? 0.05 : 0.01;
            const currentX = photoEl.cropX ?? 0;
            const currentY = photoEl.cropY ?? 0;
            let newX = currentX;
            let newY = currentY;
            if (e.key === 'ArrowLeft') newX = clamp(currentX - step, -1, 1);
            if (e.key === 'ArrowRight') newX = clamp(currentX + step, -1, 1);
            if (e.key === 'ArrowUp') newY = clamp(currentY - step, -1, 1);
            if (e.key === 'ArrowDown') newY = clamp(currentY + step, -1, 1);
            updateCrop(activeSpread.id, editingCropFrameId, {
              cropX: Math.round(newX * 1000) / 1000,
              cropY: Math.round(newY * 1000) / 1000,
            });
          }
        } else if (selectedFrameIds.length > 0) {
          e.preventDefault();
          const unit = currentProject?.canvasUnit || 'mm';
          const defaultStep = unit === 'inch' ? 0.05 : unit === 'cm' ? 0.1 : 1;
          const step = e.shiftKey ? defaultStep * 5 : defaultStep;
          let deltaX = 0;
          let deltaY = 0;
          if (e.key === 'ArrowLeft') deltaX = -step;
          if (e.key === 'ArrowRight') deltaX = step;
          if (e.key === 'ArrowUp') deltaY = -step;
          if (e.key === 'ArrowDown') deltaY = step;
          nudgeSelected(activeSpread.id, deltaX, deltaY);
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
    pasteFramesInPlace,
    pasteFramesToAllSpreads,
    clearSelection,
    exitCropMode,
    updateFrameGeometry,
    updateCrop,
    nudgeSelected,
    onToast,
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

  const dims = getProjectDimensionsInCanvasUnit(currentProject, activeSpread);
  const unit = dims.unit;
  const safeAreaMargins = {
    top: dims.safeMarginTop,
    bottom: dims.safeMarginBottom,
    outside: dims.safeMarginOutside,
    spine: dims.safeMarginSpine,
  };

  // Single page physical dimensions (strictly in canvasUnit)
  const singlePageW = dims.pageWidth;
  const singlePageH = dims.pageHeight;
  const gutterPhysicalW = 0; // Pure layflat spread (strictly 2 * singlePageW)

  // Total spread physical dimensions (strictly 2 * singlePageW)
  const totalSpreadPhysicalW = singlePageW * 2;
  const totalSpreadPhysicalH = singlePageH;

  // Dynamic responsive canvas scaling (Fills workspace comfortably with breathing margin)
  const marginH = 110;
  const marginV = 100;
  const maxAvailableW = Math.max(200, (containerSize.width - marginH) * 0.92);
  const maxAvailableH = Math.max(150, (containerSize.height - marginV) * 0.92);
  const aspect = totalSpreadPhysicalW / Math.max(0.001, totalSpreadPhysicalH);

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

  // Conversion factor: multiply physical units (in canvasUnit) by this to get screen pixels
  const scaleFactor = screenSpreadW / totalSpreadPhysicalW;

  const leftPagePixelW = Math.round(screenSpreadW / 2);
  const rightPagePixelW = screenSpreadW - leftPagePixelW;
  const gutterPixelW = 0;

  const bleedPixel = Math.max(1, Math.round(dims.bleed * scaleFactor));

  // Multi-selection status
  const selectedElements = (activeSpread.elements || []).filter((f) =>
    selectedFrameIds.includes(f.id)
  );
  const isMultiSelected = selectedElements.length > 1;

  // Handle Drag & Drop photo from filmstrip tray onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    if (stageRef.current && activeSpread?.elements) {
      const stageBox = stageRef.current.container().getBoundingClientRect();
      const dropX = e.clientX - stageBox.left;
      const dropY = e.clientY - stageBox.top;
      const physicalX = dropX / scaleFactor;
      const physicalY = dropY / scaleFactor;

      const targetFrame = [...activeSpread.elements].reverse().find((f) =>
        !f.locked &&
        physicalX >= f.x &&
        physicalX <= f.x + f.width &&
        physicalY >= f.y &&
        physicalY <= f.y + f.height
      );

      const isAlt = Boolean(e.altKey);
      setHoveredDropFrameId(targetFrame ? targetFrame.id : null);
      setIsHoveredDropAlt(isAlt);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setHoveredDropFrameId(null);
      setIsHoveredDropAlt(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredDropFrameId(null);
    setIsHoveredDropAlt(false);
    justDroppedRef.current = true;
    setTimeout(() => {
      justDroppedRef.current = false;
    }, 250);

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

      const isAlt = Boolean(e.altKey);
      // Replace photo only if ALT key was held during drop AND frame is not locked
      if (isAlt) {
        const targetFrame = [...(activeSpread.elements || [])].reverse().find((f) =>
          !f.locked &&
          physicalX >= f.x &&
          physicalX <= f.x + f.width &&
          physicalY >= f.y &&
          physicalY <= f.y + f.height
        );

        if (targetFrame) {
          replacePhotoInFrame(activeSpread.id, targetFrame.id, photo);
          clearSelection();
          return;
        }
      }

      // Default: Add as new frame at drop position (stacking / overlaying freely)
      addPhotoToSpread(activeSpread.id, photo, { x: physicalX, y: physicalY });
    } else {
      addPhotoToSpread(activeSpread.id, photo);
    }
  };

  // Marquee stage pointer events
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isSpacePressed || isPanning || activeTool === 'pan' || editingCropFrameId) return;

    // Ignore middle & right clicks
    if ('button' in e.evt && (e.evt.button === 1 || e.evt.button === 2)) return;

    const targetName = e.target.name() || '';
    const isBackground =
      e.target === e.target.getStage() ||
      targetName === 'background-sheet' ||
      targetName.startsWith('background-') ||
      targetName === 'canvas-bg';

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

        const isMulti = Boolean(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
        if (!isMulti) {
          clearSelection();
          marqueeInitialSelectedIdsRef.current = [];
        } else {
          marqueeInitialSelectedIdsRef.current = [...selectedFrameIds];
        }
        exitCropMode();
      }
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isSpacePressed || isPanning || !selectionRect || !selectionRect.visible || activeTool === 'pan') return;

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
        .filter((f) => doesMarqueeIntersectFrame(marqueePhysical, f))
        .map((f) => f.id);

      const combined = Array.from(new Set([...marqueeInitialSelectedIdsRef.current, ...matchedIds]));
      selectFrames(combined);
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
    const clipboardFrames = useEditorStore.getState().clipboardFrames || [];
    const clipboardPhotoIds = usePhotoStore.getState().clipboardPhotoIds || [];
    const hasClipboard = clipboardFrames.length > 0 || clipboardPhotoIds.length > 0;

    let dynamicPasteLabel = 'Paste';
    let pasteToastNoun = 'Element';
    if (clipboardFrames.length > 0) {
      const clipTextCount = clipboardFrames.filter((f) => f.type === 'text').length;
      const clipPhotoCount = clipboardFrames.filter((f) => f.type === 'photo').length;
      if (clipTextCount > 0 && clipPhotoCount === 0) {
        dynamicPasteLabel = clipTextCount > 1 ? `Paste ${clipTextCount} Texts` : 'Paste Text';
        pasteToastNoun = clipTextCount > 1 ? `${clipTextCount} Texts` : 'Text';
      } else if (clipPhotoCount > 0 && clipTextCount === 0) {
        dynamicPasteLabel = clipPhotoCount > 1 ? `Paste ${clipPhotoCount} Photos` : 'Paste Photo';
        pasteToastNoun = clipPhotoCount > 1 ? `${clipPhotoCount} Photos` : 'Photo';
      } else {
        dynamicPasteLabel = `Paste ${clipboardFrames.length} Elements`;
        pasteToastNoun = `${clipboardFrames.length} Elements`;
      }
    } else if (clipboardPhotoIds.length > 0) {
      dynamicPasteLabel = clipboardPhotoIds.length > 1 ? `Paste ${clipboardPhotoIds.length} Photos` : 'Paste Photo';
      pasteToastNoun = clipboardPhotoIds.length > 1 ? `${clipboardPhotoIds.length} Photos` : 'Photo';
    }

    const targetPos = contextMenuPhysicalPosRef.current;

    const handleExecutePaste = () => {
      pasteFrames(activeSpread.id, targetPos || undefined);
      if (onToast) onToast(`✓ Pasted ${pasteToastNoun}`);
    };

    if (count === 0) {
      return [
        {
          id: 'paste',
          label: dynamicPasteLabel,
          icon: '📥',
          shortcut: 'Ctrl+V',
          disabled: !hasClipboard,
          onClick: handleExecutePaste,
        },
        {
          id: 'paste-in-place',
          label: 'Paste in Place',
          icon: '📍',
          shortcut: 'Ctrl+Shift+V',
          disabled: !hasClipboard,
          onClick: () => {
            pasteFramesInPlace(activeSpread.id);
            if (onToast) onToast('✓ Pasted in place');
          },
        },
        {
          id: 'paste-to-all-spreads',
          label: `Paste to All Spreads (${currentAlbum?.spreads.length || 0})`,
          icon: '📑',
          shortcut: 'Ctrl+Alt+V',
          disabled: !hasClipboard,
          onClick: () => {
            const res = pasteFramesToAllSpreads();
            if (res.spreadsCount > 0 && onToast) {
              onToast(`✓ Pasted ${res.count} element(s) to all ${res.spreadsCount} spreads`);
            }
          },
        },
        { divider: true, id: 'div-spread', label: '' },
        {
          id: 'duplicate-spread',
          label: 'Duplicate Spread',
          icon: '📋',
          onClick: () => {
            if (currentProject) {
              duplicateSpread(activeSpread.id, currentProject);
            }
          },
        },
        {
          id: 'add-spread',
          label: 'Add New Spread',
          icon: '➕',
          onClick: () => {
            if (currentProject) {
              addSpread(currentProject);
            }
          },
        },
      ];
    }

    const selectedElements = (activeSpread.elements || []).filter((f) =>
      selectedFrameIds.includes(f.id)
    );
    const textCount = selectedElements.filter((el) => el.type === 'text').length;
    const photoCount = selectedElements.filter((el) => el.type === 'photo').length;
    const isAllText = textCount > 0 && photoCount === 0;
    const isAllPhotos = photoCount > 0 && textCount === 0;

    const itemNounSingular = isAllText ? 'Text' : isAllPhotos ? 'Photo' : 'Item';
    const itemNounPlural = isAllText ? 'Texts' : isAllPhotos ? 'Photos' : 'Elements';
    const itemNoun = count > 1 ? itemNounPlural : itemNounSingular;

    const items: ContextMenuItem[] = [];

    // If single text element selected, allow direct edit via context menu
    if (count === 1 && isAllText && selectedElements[0]) {
      const textEl = selectedElements[0] as TextNodeElement;
      items.push(
        {
          id: 'edit-text',
          label: 'Edit Text',
          icon: '✏️',
          shortcut: 'Double-Click',
          onClick: () => setEditingTextElementId(textEl.id),
        },
        { divider: true, id: 'div-text-edit', label: '' }
      );
    }

    items.push(
      {
        id: 'delete',
        label: count > 1 ? `Delete ${count} Selected ${itemNounPlural}` : `Delete ${itemNounSingular}`,
        icon: '🗑️',
        shortcut: 'Del',
        danger: true,
        onClick: () => deleteSelectedFrames(activeSpread.id),
      },
      {
        id: 'copy',
        label: count > 1 ? `Copy ${count} ${itemNounPlural}` : `Copy ${itemNounSingular}`,
        icon: '📋',
        shortcut: 'Ctrl+C',
        onClick: () => {
          copySelectedFrames(activeSpread.id);
          if (onToast) onToast(`✓ Copied ${count > 1 ? `${count} ${itemNounPlural}` : itemNounSingular}`);
        },
      },
      {
        id: 'paste',
        label: dynamicPasteLabel,
        icon: '📥',
        shortcut: 'Ctrl+V',
        disabled: !hasClipboard,
        onClick: handleExecutePaste,
      },
      {
        id: 'paste-in-place',
        label: 'Paste in Place',
        icon: '📍',
        shortcut: 'Ctrl+Shift+V',
        disabled: !hasClipboard,
        onClick: () => {
          pasteFramesInPlace(activeSpread.id);
          if (onToast) onToast('✓ Pasted in place');
        },
      },
      {
        id: 'paste-to-all-spreads',
        label: `Paste to All Spreads (${currentAlbum?.spreads.length || 0})`,
        icon: '📑',
        shortcut: 'Ctrl+Alt+V',
        disabled: !hasClipboard,
        onClick: () => {
          const res = pasteFramesToAllSpreads();
          if (res.spreadsCount > 0 && onToast) {
            onToast(`✓ Pasted ${res.count} element(s) to all ${res.spreadsCount} spreads`);
          }
        },
      },
      {
        id: 'duplicate',
        label: count > 1 ? `Duplicate ${count} ${itemNounPlural}` : `Duplicate ${itemNounSingular}`,
        icon: '⧉',
        shortcut: 'Ctrl+D',
        onClick: () => duplicateSelectedFrames(activeSpread.id),
      }
    );

    const distinctGroupIds = new Set(selectedElements.map((f) => f.groupId).filter(Boolean));
    const hasUngrouped = selectedElements.some((f) => !f.groupId);
    const canGroup = selectedElements.length >= 2 && (distinctGroupIds.size > 1 || hasUngrouped);
    const canUngroup = distinctGroupIds.size > 0;

    if (canGroup) {
      items.push({
        id: 'group-elements',
        label: `Group ${count} ${itemNounPlural}`,
        icon: '👥',
        shortcut: 'Ctrl+G',
        onClick: () => {
          groupSelectedFrames(activeSpread.id);
          if (onToast) onToast(`👥 Grouped ${count} ${itemNounPlural.toLowerCase()}`);
        },
      });
    }

    if (canUngroup) {
      items.push({
        id: 'ungroup-elements',
        label: `Ungroup ${itemNounPlural}`,
        icon: '⊘',
        shortcut: 'Ctrl+Shift+G',
        onClick: () => {
          ungroupSelectedFrames(activeSpread.id);
          if (onToast) onToast(`⊘ Ungrouped ${itemNounPlural.toLowerCase()}`);
        },
      });
    }

    const hasLocked = selectedElements.some((f) => f.locked);
    const hasUnlocked = selectedElements.some((f) => !f.locked);

    if (count >= 1 && hasUnlocked) {
      items.push({
        id: 'lock-elements',
        label: count > 1 ? `Lock ${count} ${itemNounPlural}` : `Lock ${itemNounSingular}`,
        icon: '🔒',
        shortcut: 'Ctrl+L',
        onClick: () => {
          useEditorStore.getState().toggleLockSelectedFrames(activeSpread.id, true);
          if (onToast) onToast(`🔒 Locked ${count} ${itemNoun.toLowerCase()}`);
        },
      });
    }

    if (count >= 1 && hasLocked) {
      items.push({
        id: 'unlock-elements',
        label: count > 1 ? `Unlock ${count} ${itemNounPlural}` : `Unlock ${itemNounSingular}`,
        icon: '🔓',
        shortcut: 'Alt+L',
        onClick: () => {
          useEditorStore.getState().toggleLockSelectedFrames(activeSpread.id, false);
          if (onToast) onToast(`🔓 Unlocked ${count} ${itemNoun.toLowerCase()}`);
        },
      });
    }

    if (count === 2 && !hasLocked && isAllPhotos) {
      items.push({
        id: 'swap-photos',
        label: 'Swap 2 Photos',
        icon: '⇄',
        shortcut: 'S',
        onClick: () => {
          if (selectedFrameIds[0] && selectedFrameIds[1]) {
            swapFrames(activeSpread.id, selectedFrameIds[0], selectedFrameIds[1]);
          }
        },
      });
    }

    if (count >= 1) {
      const alignLabel = count === 1 || (!canGroup && canUngroup) ? 'Align to Safe Margin' : 'Align';
      items.push(
        { divider: true, id: 'div-align', label: '' },
        {
          id: 'submenu-align',
          label: alignLabel,
          icon: '📐',
          children: [
            {
              id: 'align-left',
              label: 'Align Left',
              icon: '⇤',
              onClick: () => alignSelectedFrames(activeSpread.id, 'left'),
            },
            {
              id: 'align-center',
              label: 'Align Center Horizontal',
              icon: '↔',
              onClick: () => alignSelectedFrames(activeSpread.id, 'center'),
            },
            {
              id: 'align-right',
              label: 'Align Right',
              icon: '⇥',
              onClick: () => alignSelectedFrames(activeSpread.id, 'right'),
            },
            { divider: true, id: 'div-subalign', label: '' },
            {
              id: 'align-top',
              label: 'Align Top',
              icon: '⤒',
              onClick: () => alignSelectedFrames(activeSpread.id, 'top'),
            },
            {
              id: 'align-middle',
              label: 'Align Center Vertical',
              icon: '↕',
              onClick: () => alignSelectedFrames(activeSpread.id, 'middle'),
            },
            {
              id: 'align-bottom',
              label: 'Align Bottom',
              icon: '⤓',
              onClick: () => alignSelectedFrames(activeSpread.id, 'bottom'),
            },
          ],
        },
        {
          id: 'submenu-size',
          label: 'Match Size',
          icon: '⬚',
          children: [
            {
              id: 'match-width',
              label: 'Match Width',
              icon: '⬌',
              onClick: () => matchSelectedDimensions(activeSpread.id, 'width'),
            },
            {
              id: 'match-height',
              label: 'Match Height',
              icon: '⬍',
              onClick: () => matchSelectedDimensions(activeSpread.id, 'height'),
            },
            {
              id: 'match-both',
              label: 'Match Both (Full Size)',
              icon: '⬚',
              onClick: () => matchSelectedDimensions(activeSpread.id, 'both'),
            },
          ],
        },
        {
          id: 'submenu-spacing',
          label: 'Spacing & Distribution',
          icon: '⇿',
          children: [
            {
              id: 'gap-h',
              label: `Set Horizontal Gap (${activeSpread.spacingValue ?? currentProject.spacingValue} ${activeSpread.spacingUnit ?? currentProject.spacingUnit})`,
              icon: '⇿',
              onClick: () => applyFixedGapToSelected(activeSpread.id, 'horizontal', activeSpread.spacingValue ?? currentProject.spacingValue),
            },
            {
              id: 'gap-v',
              label: `Set Vertical Gap (${activeSpread.spacingValue ?? currentProject.spacingValue} ${activeSpread.spacingUnit ?? currentProject.spacingUnit})`,
              icon: '⇳',
              onClick: () => applyFixedGapToSelected(activeSpread.id, 'vertical', activeSpread.spacingValue ?? currentProject.spacingValue),
            },
            ...(count >= 3
              ? [
                  { divider: true, id: 'div-subdist', label: '' },
                  {
                    id: 'distribute-h',
                    label: 'Distribute Horizontally',
                    icon: '⇿',
                    onClick: () => distributeSelectedFrames(activeSpread.id, 'horizontal'),
                  },
                  {
                    id: 'distribute-v',
                    label: 'Distribute Vertically',
                    icon: '⇳',
                    onClick: () => distributeSelectedFrames(activeSpread.id, 'vertical'),
                  },
                ]
              : []),
          ],
        }
      );
    }

    // Submenu: Arrange & Transform
    items.push(
      { divider: true, id: 'div-order', label: '' },
      {
        id: 'submenu-arrange',
        label: 'Arrange & Transform',
        icon: '🔄',
        children: [
          {
            id: 'bring-to-front',
            label: 'Bring to Front',
            icon: '🔼',
            onClick: () => {
              bringSelectedToFront(activeSpread.id);
            },
          },
          {
            id: 'send-to-back',
            label: 'Send to Back',
            icon: '🔽',
            onClick: () => {
              sendSelectedToBack(activeSpread.id);
            },
          },
          { divider: true, id: 'div-subrot', label: '' },
          {
            id: 'rotate-cw',
            label: 'Rotate 90° Clockwise',
            icon: '↻',
            shortcut: 'R',
            onClick: () => {
              rotateSelectedFrames(activeSpread.id, 'cw');
            },
          },
          {
            id: 'rotate-ccw',
            label: 'Rotate 90° Counter-Clockwise',
            icon: '↺',
            shortcut: 'Shift+R',
            onClick: () => {
              rotateSelectedFrames(activeSpread.id, 'ccw');
            },
          },
          ...(photoCount > 0
            ? [
                {
                  id: 'reset-ratio',
                  label: '↺ Reset Aspect Ratio',
                  icon: '⇱',
                  onClick: () => {
                    resetSelectedRatio(activeSpread.id);
                  },
                },
                {
                  id: 'reset-crop',
                  label: '↺ Reset Crop & Center',
                  icon: '🎯',
                  onClick: () => {
                    resetSelectedCrop(activeSpread.id);
                  },
                },
              ]
            : []),
        ],
      },
      { divider: true, id: 'div-clear', label: '' },
      {
        id: 'clear-sel',
        label: 'Deselect All',
        icon: '✕',
        onClick: () => clearSelection(),
      }
    );

    return items;
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ${isPanning ? styles.spacePanningActive : isSpacePressed ? styles.spacePanning : activeTool === 'pan' ? styles.panningMode : ''} ${editingCropFrameId ? styles.cropModeActive : ''}`}
      style={{
        overflow: zoomLevel > 100 ? 'auto' : 'hidden',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenuAt(e.clientX, e.clientY);
      }}
      onMouseDownCapture={() => {
        usePhotoStore.getState().clearSelection();
      }}
      onPointerDownCapture={() => {
        usePhotoStore.getState().clearSelection();
      }}
      onMouseDown={(e) => {
        if (isSpacePressed || e.button === 1 || activeTool === 'pan') {
          e.preventDefault();
          setIsPanning(true);
          if (containerRef.current) {
            panStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              scrollLeft: containerRef.current.scrollLeft,
              scrollTop: containerRef.current.scrollTop,
            };
          }
          return;
        }
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
      onMouseMove={(e) => {
        if (isPanning && panStartRef.current && containerRef.current) {
          e.preventDefault();
          const dx = e.clientX - panStartRef.current.x;
          const dy = e.clientY - panStartRef.current.y;
          containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
          containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
        }
      }}
      onMouseUp={() => {
        if (isPanning) {
          setIsPanning(false);
          panStartRef.current = null;
        }
      }}
      onClick={(e) => {
        if (isSpacePressed || isPanning || e.button === 1 || e.button === 2) return;
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          e.preventDefault();
          openContextMenuAt(e.clientX, e.clientY);
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
          onContextMenu={(e) => {
            e.evt.preventDefault();
            openContextMenuAt(e.evt.clientX, e.evt.clientY);
          }}
        >
          {/* Layer 1: Background & Page Sheet */}
          <Layer>
            {/* Spread Sheet Board (Drop Shadow & Base) */}
            <Rect
              name="background-sheet"
              x={0}
              y={0}
              width={screenSpreadW}
              height={screenSpreadH}
              fill={activeSpread.backgroundColor || currentProject?.backgroundColor || '#FFFFFF'}
              shadowColor="rgba(0,0,0,0.6)"
              shadowBlur={16}
              shadowOffset={{ x: 0, y: 8 }}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                openContextMenuAt(e.evt.clientX, e.evt.clientY);
              }}
            />

            {/* Left Page Background */}
            <Rect
              name="background-left-page"
              listening={false}
              x={0}
              y={0}
              width={leftPagePixelW}
              height={screenSpreadH}
              fill={
                activeSpread.leftPage?.backgroundColor ||
                activeSpread.backgroundColor ||
                currentProject?.backgroundColor ||
                '#FFFFFF'
              }
            />

            {/* Center Gutter / Spine Background (if gutter > 0) */}
            {gutterPixelW > 0 && (
              <Rect
                name="background-gutter-spine"
                listening={false}
                x={leftPagePixelW}
                y={0}
                width={gutterPixelW}
                height={screenSpreadH}
                fill={activeSpread.backgroundColor || currentProject?.backgroundColor || '#FFFFFF'}
              />
            )}

            {/* Right Page Background */}
            <Rect
              name="background-right-page"
              listening={false}
              x={leftPagePixelW + gutterPixelW}
              y={0}
              width={rightPagePixelW}
              height={screenSpreadH}
              fill={
                activeSpread.rightPage?.backgroundColor ||
                activeSpread.backgroundColor ||
                currentProject?.backgroundColor ||
                '#FFFFFF'
              }
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
                {/* Left Page Safe Area (Blue) */}
                <Rect
                  x={Math.round(dims.safeMarginOutside * scaleFactor)}
                  y={Math.round(dims.safeMarginTop * scaleFactor)}
                  width={Math.max(1, Math.round((dims.pageWidth - dims.safeMarginOutside - dims.safeMarginSpine) * scaleFactor))}
                  height={Math.max(1, Math.round((dims.pageHeight - dims.safeMarginTop - dims.safeMarginBottom) * scaleFactor))}
                  stroke="rgba(59, 130, 246, 0.65)"
                  strokeWidth={1}
                  dash={[5, 4]}
                />
                {/* Right Page Safe Area (Blue) */}
                <Rect
                  x={Math.round((dims.pageWidth + dims.gutterWidth + dims.safeMarginSpine) * scaleFactor)}
                  y={Math.round(dims.safeMarginTop * scaleFactor)}
                  width={Math.max(1, Math.round((dims.pageWidth - dims.safeMarginSpine - dims.safeMarginOutside) * scaleFactor))}
                  height={Math.max(1, Math.round((dims.pageHeight - dims.safeMarginTop - dims.safeMarginBottom) * scaleFactor))}
                  stroke="rgba(59, 130, 246, 0.65)"
                  strokeWidth={1}
                  dash={[5, 4]}
                />
              </Group>
            )}
          </Layer>

          {/* Layer 2: Interactive Photo Frames & Text Nodes */}
          <Layer>
            {(activeSpread.elements || []).map((element) => {
              if (element.type === 'text') {
                const textEl = element as TextNodeElement;
                const isSelected = selectedFrameIds.includes(textEl.id);
                const isEditing = editingTextElementId === textEl.id;

                return (
                  <TextNode
                    key={textEl.id}
                    element={textEl}
                    isSelected={isSelected}
                    isEditing={isEditing}
                    isMultiSelectActive={isMultiSelected}
                    scaleFactor={scaleFactor}
                    canvasUnit={dims.unit}
                    dpi={dims.dpi}
                    activeAnchor={activeTransformAnchorRef.current}
                    onSelect={(e) => {
                      if (justDroppedRef.current) return;
                      if (e) {
                        e.cancelBubble = true;
                        if ('button' in e.evt && e.evt.button !== 0) return;
                        if ('which' in e.evt && e.evt.which !== 1) return;
                        const isMulti = Boolean(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
                        selectFrame(textEl.id, isMulti);
                      } else {
                        selectFrame(textEl.id);
                      }
                    }}
                    onDragStart={() => {
                      const isThisSelected = selectedFrameIds.includes(textEl.id);
                      let currentGroupIds = isThisSelected ? [...selectedFrameIds] : [textEl.id];
                      if (!isThisSelected) {
                        selectFrame(textEl.id);
                        currentGroupIds = [textEl.id];
                      }

                      const initialPositions = new Map<string, { x: number; y: number }>();
                      currentGroupIds.forEach((id) => {
                        const f = (activeSpread.elements || []).find((el) => el.id === id);
                        if (f) {
                          initialPositions.set(id, { x: f.x, y: f.y });
                        }
                      });
                      dragInitialPhysicalPositionsRef.current = initialPositions;
                    }}
                    onDragMove={(e) => {
                      if (dragInitialPhysicalPositionsRef.current.size === 0) return;
                      const draggedNode = (stageRef.current?.findOne(`#${textEl.id}`) || e.currentTarget || e.target) as Konva.Node;
                      if (!draggedNode) return;

                      let currentPhysX = draggedNode.x() / scaleFactor;
                      let currentPhysY = draggedNode.y() / scaleFactor;
                      let deltaPhysX = currentPhysX - textEl.x;
                      let deltaPhysY = currentPhysY - textEl.y;

                      if (e.evt?.shiftKey) {
                        if (Math.abs(deltaPhysX) >= Math.abs(deltaPhysY)) {
                          deltaPhysY = 0;
                          currentPhysY = textEl.y;
                          draggedNode.y(textEl.y * scaleFactor);
                        } else {
                          deltaPhysX = 0;
                          currentPhysX = textEl.x;
                          draggedNode.x(textEl.x * scaleFactor);
                        }
                      }

                      if (!snapEnabled || e.evt?.ctrlKey) {
                        clearSnapLines();
                      } else {
                        const otherRects = (activeSpread.elements || [])
                          .filter((f) => !dragInitialPhysicalPositionsRef.current.has(f.id))
                          .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));

                        const thresholdUnits =
                          typeof snappingConfig.threshold === 'number'
                            ? snappingConfig.threshold
                            : 0.1;

                        const snapRes = calculateSnapping(
                          { x: currentPhysX, y: currentPhysY, width: textEl.width, height: textEl.height },
                          totalSpreadPhysicalW,
                          totalSpreadPhysicalH,
                          safeAreaMargins,
                          gutterPhysicalW,
                          otherRects,
                          { ...snappingConfig, threshold: thresholdUnits },
                          unit
                        );

                        if (snapRes.snapLines.length > 0 || snapRes.gapGuides.length > 0) {
                          setSnapLines(snapRes.snapLines, snapRes.gapGuides);
                          const snappedPhysX = snapRes.snappedX;
                          const snappedPhysY = snapRes.snappedY;
                          deltaPhysX = snappedPhysX - textEl.x;
                          deltaPhysY = snappedPhysY - textEl.y;
                          draggedNode.x(snappedPhysX * scaleFactor);
                          draggedNode.y(snappedPhysY * scaleFactor);
                        } else {
                          clearSnapLines();
                        }
                      }

                      if (dragInitialPhysicalPositionsRef.current.size > 1) {
                        dragInitialPhysicalPositionsRef.current.forEach((initPhys, id) => {
                          if (id !== textEl.id) {
                            const node = stageRef.current?.findOne(`#${id}`) as Konva.Node | undefined;
                            if (node) {
                              node.x((initPhys.x + deltaPhysX) * scaleFactor);
                              node.y((initPhys.y + deltaPhysY) * scaleFactor);
                            }
                          }
                        });
                        if (multiGroupRef.current && multiGroupInfo) {
                          multiGroupRef.current.x((multiGroupInfo.groupX + deltaPhysX) * scaleFactor);
                          multiGroupRef.current.y((multiGroupInfo.groupY + deltaPhysY) * scaleFactor);
                        }
                      }
                    }}
                    onDragEnd={(e) => {
                      clearSnapLines();
                      const draggedNode = (stageRef.current?.findOne(`#${textEl.id}`) || e.currentTarget || e.target) as Konva.Node;
                      const isAltPressed = Boolean(e.evt?.altKey || isAltPressedRef.current);

                      if (draggedNode && dragInitialPhysicalPositionsRef.current.size > 0) {
                        let finalCurrentPhysX = draggedNode.x() / scaleFactor;
                        let finalCurrentPhysY = draggedNode.y() / scaleFactor;
                        const isShiftConstrained = Boolean(e.evt?.shiftKey);
                        const initPos = dragInitialPhysicalPositionsRef.current.get(textEl.id) || { x: textEl.x, y: textEl.y };
                        const rawDx = finalCurrentPhysX - initPos.x;
                        const rawDy = finalCurrentPhysY - initPos.y;
                        const isHorizontalConstraint = Math.abs(rawDx) >= Math.abs(rawDy);

                        const otherRects = (activeSpread.elements || [])
                          .filter((f) => !dragInitialPhysicalPositionsRef.current.has(f.id))
                          .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));

                        const snapRes =
                          !snapEnabled || e.evt?.ctrlKey
                            ? { snappedX: finalCurrentPhysX, snappedY: finalCurrentPhysY }
                            : calculateSnapping(
                                { x: finalCurrentPhysX, y: finalCurrentPhysY, width: textEl.width, height: textEl.height },
                                totalSpreadPhysicalW,
                                totalSpreadPhysicalH,
                                safeAreaMargins,
                                gutterPhysicalW,
                                otherRects,
                                snappingConfig,
                                unit
                              );

                        let deltaPhysX = snapRes.snappedX - textEl.x;
                        let deltaPhysY = snapRes.snappedY - textEl.y;

                        if (isShiftConstrained) {
                          if (isHorizontalConstraint) {
                            deltaPhysY = 0;
                          } else {
                            deltaPhysX = 0;
                          }
                        }

                        if (Number.isFinite(deltaPhysX) && Number.isFinite(deltaPhysY)) {
                          const pixelDist = Math.hypot(deltaPhysX, deltaPhysY) * scaleFactor;
                          if (isAltPressed && (pixelDist >= 3 || Math.abs(deltaPhysX) > 0.05 || Math.abs(deltaPhysY) > 0.05)) {
                            dragInitialPhysicalPositionsRef.current.forEach((initPhys, id) => {
                              const node = stageRef.current?.findOne(`#${id}`) as Konva.Node | undefined;
                              if (node) {
                                node.x(initPhys.x * scaleFactor);
                                node.y(initPhys.y * scaleFactor);
                              }
                            });

                            const duplicates = Array.from(dragInitialPhysicalPositionsRef.current.entries()).map(([id, initPhys]) => ({
                              sourceId: id,
                              x: Math.round((initPhys.x + deltaPhysX) * 10) / 10,
                              y: Math.round((initPhys.y + deltaPhysY) * 10) / 10,
                            }));

                            duplicateFramesToPosition(activeSpread.id, duplicates);
                            if (onToast) {
                              onToast(`✓ Duplicated ${duplicates.length} item(s) via Alt+Drag`);
                            }
                          } else if (Math.abs(deltaPhysX) > 0.05 || Math.abs(deltaPhysY) > 0.05) {
                            const updates = Array.from(dragInitialPhysicalPositionsRef.current.entries()).map(([id, initPhys]) => ({
                              id,
                              geometry: {
                                x: Math.round((initPhys.x + deltaPhysX) * 10) / 10,
                                y: Math.round((initPhys.y + deltaPhysY) * 10) / 10,
                              },
                            }));

                            batchUpdateFrames(activeSpread.id, updates);
                          }
                        }
                      }
                      dragInitialPhysicalPositionsRef.current.clear();
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if (!isSelected) {
                        selectFrame(textEl.id);
                      }
                      openContextMenuAt(e.evt.clientX, e.evt.clientY);
                    }}
                    onElementChange={(updates, skipHistory) => updateTextElement(activeSpread.id, textEl.id, updates, skipHistory)}
                    onDoubleClick={() => setEditingTextElementId(textEl.id)}
                  />
                );
              }

              const frame = element as PhotoFrameElement;
              const hydratedFrame = mergeFramePhotoAsset(frame, frame.photoId ? photoById.get(frame.photoId) : null);
              const isSelected = selectedFrameIds.includes(frame.id);
              const isCrop = editingCropFrameId === frame.id;

              return (
                <PhotoFrameNode
                  key={frame.id}
                  frame={hydratedFrame}
                  isSelected={isSelected}
                  isMuted={Boolean(editingCropFrameId && editingCropFrameId !== frame.id)}
                  isCropMode={isCrop}
                  isMultiSelectActive={isMultiSelected}
                  isHoveredForDrop={hoveredDropFrameId === frame.id}
                  isAltDrop={isHoveredDropAlt}
                  scaleFactor={scaleFactor}
                  isShiftPressed={isShiftPressed}
                  onSelect={(e) => {
                    if (justDroppedRef.current) return;
                    if (e) {
                      e.cancelBubble = true;
                      const isMulti = Boolean(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
                      selectFrame(frame.id, isMulti);
                    } else {
                      selectFrame(frame.id);
                    }
                  }}
                  onDragStart={() => {
                    const isThisSelected = selectedFrameIds.includes(frame.id);
                    let currentGroupIds = isThisSelected ? [...selectedFrameIds] : [frame.id];
                    if (!isThisSelected) {
                      selectFrame(frame.id);
                      currentGroupIds = [frame.id];
                    }

                    const initialPositions = new Map<string, { x: number; y: number }>();
                    currentGroupIds.forEach((id) => {
                      const f = (activeSpread.elements || []).find((el) => el.id === id);
                      if (f) {
                        initialPositions.set(id, { x: f.x, y: f.y });
                      }
                    });
                    dragInitialPhysicalPositionsRef.current = initialPositions;
                  }}
                  onDragMove={(e) => {
                    if (dragInitialPhysicalPositionsRef.current.size === 0) return;
                    const draggedNode = (stageRef.current?.findOne(`#${frame.id}`) || e.currentTarget || e.target) as Konva.Node;
                    if (!draggedNode) return;

                    let currentPhysX = draggedNode.x() / scaleFactor;
                    let currentPhysY = draggedNode.y() / scaleFactor;
                    let deltaPhysX = currentPhysX - frame.x;
                    let deltaPhysY = currentPhysY - frame.y;

                    if (e.evt?.shiftKey) {
                      if (Math.abs(deltaPhysX) >= Math.abs(deltaPhysY)) {
                        deltaPhysY = 0;
                        currentPhysY = frame.y;
                        draggedNode.y(frame.y * scaleFactor);
                      } else {
                        deltaPhysX = 0;
                        currentPhysX = frame.x;
                        draggedNode.x(frame.x * scaleFactor);
                      }
                    }

                    if (!snapEnabled || e.evt?.ctrlKey) {
                      clearSnapLines();
                    } else {
                      const otherRects = (activeSpread.elements || [])
                        .filter((f) => !dragInitialPhysicalPositionsRef.current.has(f.id))
                        .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));

                      const thresholdUnits =
                        typeof snappingConfig.threshold === 'number'
                          ? snappingConfig.threshold
                          : 0.1;

                      const snapRes = calculateSnapping(
                        { x: currentPhysX, y: currentPhysY, width: frame.width, height: frame.height },
                        totalSpreadPhysicalW,
                        totalSpreadPhysicalH,
                        safeAreaMargins,
                        gutterPhysicalW,
                        otherRects,
                        { ...snappingConfig, threshold: thresholdUnits },
                        unit
                      );

                      if (snapRes.snapLines.length > 0 || snapRes.gapGuides.length > 0) {
                        setSnapLines(snapRes.snapLines, snapRes.gapGuides);
                        const snappedPhysX = snapRes.snappedX;
                        const snappedPhysY = snapRes.snappedY;
                        deltaPhysX = snappedPhysX - frame.x;
                        deltaPhysY = snappedPhysY - frame.y;
                        draggedNode.x(snappedPhysX * scaleFactor);
                        draggedNode.y(snappedPhysY * scaleFactor);
                      } else {
                        clearSnapLines();
                      }
                    }

                    dragInitialPhysicalPositionsRef.current.forEach((initPhys, id) => {
                      if (id !== frame.id) {
                        const node = stageRef.current?.findOne(`#${id}`) as Konva.Node | undefined;
                        if (node) {
                          node.x((initPhys.x + deltaPhysX) * scaleFactor);
                          node.y((initPhys.y + deltaPhysY) * scaleFactor);
                        }
                      }
                    });

                    if (multiGroupRef.current && multiGroupInfo) {
                      multiGroupRef.current.x((multiGroupInfo.groupX + deltaPhysX) * scaleFactor);
                      multiGroupRef.current.y((multiGroupInfo.groupY + deltaPhysY) * scaleFactor);
                    }

                    trRef.current?.update();
                    trRef.current?.getLayer()?.batchDraw();
                  }}
                  onDragEnd={(e) => {
                    clearSnapLines();
                    setHoveredDropFrameId(null);
                    setIsHoveredDropAlt(false);
                    const draggedNode = (stageRef.current?.findOne(`#${frame.id}`) || e.currentTarget || e.target) as Konva.Node;
                    if (draggedNode && dragInitialPhysicalPositionsRef.current.size > 0) {
                      let finalCurrentPhysX = draggedNode.x() / scaleFactor;
                      let finalCurrentPhysY = draggedNode.y() / scaleFactor;

                      const isShiftConstrained = Boolean(e.evt?.shiftKey);
                      let isHorizontalConstraint = true;
                      if (isShiftConstrained) {
                        const rawDeltaX = finalCurrentPhysX - frame.x;
                        const rawDeltaY = finalCurrentPhysY - frame.y;
                        if (Math.abs(rawDeltaX) >= Math.abs(rawDeltaY)) {
                          finalCurrentPhysY = frame.y;
                          draggedNode.y(frame.y * scaleFactor);
                          isHorizontalConstraint = true;
                        } else {
                          finalCurrentPhysX = frame.x;
                          draggedNode.x(frame.x * scaleFactor);
                          isHorizontalConstraint = false;
                        }
                      }

                      const isAltPressed = Boolean(e.evt?.altKey || isAltPressedRef.current);

                      const otherRects = (activeSpread.elements || [])
                        .filter((f) => !dragInitialPhysicalPositionsRef.current.has(f.id))
                        .map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height }));

                      const snapRes = (!snapEnabled || e.evt?.ctrlKey)
                        ? { snappedX: finalCurrentPhysX, snappedY: finalCurrentPhysY }
                        : calculateSnapping(
                            { x: finalCurrentPhysX, y: finalCurrentPhysY, width: frame.width, height: frame.height },
                            totalSpreadPhysicalW,
                            totalSpreadPhysicalH,
                            safeAreaMargins,
                            gutterPhysicalW,
                            otherRects,
                            snappingConfig,
                            unit
                          );

                      let deltaPhysX = snapRes.snappedX - frame.x;
                      let deltaPhysY = snapRes.snappedY - frame.y;

                      if (isShiftConstrained) {
                        if (isHorizontalConstraint) {
                          deltaPhysY = 0;
                        } else {
                          deltaPhysX = 0;
                        }
                      }

                      if (Number.isFinite(deltaPhysX) && Number.isFinite(deltaPhysY)) {
                        const pixelDist = Math.hypot(deltaPhysX, deltaPhysY) * scaleFactor;
                        if (isAltPressed && (pixelDist >= 3 || Math.abs(deltaPhysX) > 0.05 || Math.abs(deltaPhysY) > 0.05)) {
                          dragInitialPhysicalPositionsRef.current.forEach((initPhys, id) => {
                            const node = stageRef.current?.findOne(`#${id}`) as Konva.Node | undefined;
                            if (node) {
                              node.x(initPhys.x * scaleFactor);
                              node.y(initPhys.y * scaleFactor);
                            }
                          });

                          const duplicates = Array.from(dragInitialPhysicalPositionsRef.current.entries()).map(([id, initPhys]) => ({
                            sourceId: id,
                            x: Math.round((initPhys.x + deltaPhysX) * 10) / 10,
                            y: Math.round((initPhys.y + deltaPhysY) * 10) / 10,
                          }));

                          duplicateFramesToPosition(activeSpread.id, duplicates);
                          if (onToast) {
                            onToast(`✓ Duplicated ${duplicates.length} frame(s) via Alt+Drag`);
                          }
                        } else if (Math.abs(deltaPhysX) > 0.05 || Math.abs(deltaPhysY) > 0.05) {
                          const updates = Array.from(dragInitialPhysicalPositionsRef.current.entries()).map(([id, initPhys]) => ({
                            id,
                            geometry: {
                              x: Math.round((initPhys.x + deltaPhysX) * 10) / 10,
                              y: Math.round((initPhys.y + deltaPhysY) * 10) / 10,
                            },
                          }));

                          batchUpdateFrames(activeSpread.id, updates);
                        }
                      }
                    }
                    dragInitialPhysicalPositionsRef.current.clear();
                  }}
                  onContextMenu={(e) => {
                    openContextMenuAt(e.evt.clientX, e.evt.clientY);
                  }}
                  onFrameChange={(updates) => updateFrameGeometry(activeSpread.id, frame.id, updates)}
                  onCropChange={(updates) => updateCrop(activeSpread.id, frame.id, updates)}
                  onDoubleClick={() => enterCropMode(frame.id)}
                />
              );
            })}

            {/* 2. Multi-Selection Proxy Rect for Rotated Transformer Envelope */}
            {selectedFrameIds.length > 1 && multiGroupInfo && (
              <Rect
                id="multi-selection-proxy"
                ref={multiGroupRef}
                x={multiGroupInfo.groupX * scaleFactor}
                y={multiGroupInfo.groupY * scaleFactor}
                width={multiGroupInfo.groupWidth * scaleFactor}
                height={multiGroupInfo.groupHeight * scaleFactor}
                rotation={multiGroupInfo.groupRotation}
                listening={false}
              />
            )}

            {/* Multi-Selection Locked Indicator Outline */}
            {selectedFrameIds.length > 1 && multiGroupInfo && isSelectionFullyLocked && (
              <Rect
                x={multiGroupInfo.groupX * scaleFactor}
                y={multiGroupInfo.groupY * scaleFactor}
                width={multiGroupInfo.groupWidth * scaleFactor}
                height={multiGroupInfo.groupHeight * scaleFactor}
                rotation={multiGroupInfo.groupRotation}
                stroke="#f59e0b"
                strokeWidth={1.5}
                dash={[4, 4]}
                listening={false}
              />
            )}

            {/* Dynamic Contextual Transformer */}
            <Transformer
            ref={trRef}
            visible={!editingCropFrameId && !editingTextElementId}
            rotateEnabled
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={isShiftPressed ? 180 : 5}
            keepRatio={true}
            rotateAnchorOffset={24}
            rotateAnchorCursor={ROTATE_CURSOR}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                openContextMenuAt(e.evt.clientX, e.evt.clientY);
              }}
              onMouseDown={(e) => {
                if ('button' in e.evt && e.evt.button === 2) {
                  e.cancelBubble = true;
                }
              }}
              onClick={(e) => {
                if ('button' in e.evt && e.evt.button === 2) {
                  e.cancelBubble = true;
                }
              }}
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
                activeTransformAnchorRef.current = anchor;
                setRotationHud(null);
                setResizeHud(null);
                const isSingleTextSelected =
                  selectedFrameIds.length === 1 &&
                  (activeSpread?.elements || []).find((el) => el.id === selectedFrameIds[0])?.type === 'text';

                const isCorner =
                  !anchor ||
                  anchor === 'top-left' ||
                  anchor === 'top-right' ||
                  anchor === 'bottom-left' ||
                  anchor === 'bottom-right';

                // For text box: corner handles scale box and font proportionally (keepRatio: true) unless Shift is pressed.
                // Side handles (middle-left, middle-right, top-center, bottom-center) allow free unconstrained width/height reflow.
                if (isSingleTextSelected) {
                  tr.keepRatio(isCorner ? !isShiftPressed : false);
                } else {
                  tr.keepRatio(isCorner || selectedFrameIds.length > 1);
                }

                // Lock to high-contrast curved rotation cursor during active rotation
                if (anchor === 'rotater') {
                  if (stageRef.current) {
                    stageRef.current.container().style.cursor = ROTATE_CURSOR;
                  }
                  const targetNode = selectedFrameIds.length > 1
                    ? multiGroupRef.current
                    : (tr.getNode() || (selectedFrameIds[0] ? (stageRef.current?.findOne(`#${selectedFrameIds[0]}`) as Konva.Node | undefined) : null));
                  if (targetNode) {
                    const rawRot = targetNode.rotation();
                    const normalizedRot = Math.round((((rawRot % 360) + 360) % 360) * 10) / 10;
                    const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360];
                    const isSnapped = SNAP_ANGLES.some((snap) => Math.abs(normalizedRot - (snap % 360)) < 0.8);
                    const rotaterAnchor = tr.findOne('.rotater');
                    let hudX = targetNode.x();
                    let hudY = targetNode.y() - 32;
                    if (rotaterAnchor) {
                      const absPos = rotaterAnchor.getAbsolutePosition();
                      const stageTransform = stageRef.current?.getAbsoluteTransform().copy().invert();
                      if (stageTransform) {
                        const local = stageTransform.point(absPos);
                        hudX = local.x;
                        hudY = local.y - 28;
                      }
                    }
                    setRotationHud({
                      angle: normalizedRot === 360 ? 0 : Math.round(normalizedRot),
                      snapped: isSnapped,
                      x: hudX,
                      y: hudY,
                    });
                  }
                }

                if (selectedFrameIds.length > 1 && activeSpread && multiGroupInfo) {
                  const selectedFrames = (activeSpread.elements || [])
                    .filter((f) => selectedFrameIds.includes(f.id))
                    .map((f) => ({ ...f }));
                  multiTransformInitialStateRef.current = {
                    frames: selectedFrames as PhotoFrameElement[],
                    initialGroupRot: multiGroupInfo.groupRotation,
                    bounds: {
                      x: multiGroupInfo.groupX,
                      y: multiGroupInfo.groupY,
                      width: multiGroupInfo.groupWidth,
                      height: multiGroupInfo.groupHeight,
                    },
                  };
                } else {
                  multiTransformInitialStateRef.current = null;
                }
              }}
              onTransform={() => {
                const activeAnchor = activeTransformAnchorRef.current || trRef.current?.getActiveAnchor();

                // Live WYSIWYG Rotation Snapping HUD
                if (activeAnchor === 'rotater') {
                  setResizeHud(null);
                  if (stageRef.current) {
                    stageRef.current.container().style.cursor = ROTATE_CURSOR;
                  }
                  const tr = trRef.current;
                  const targetNode = selectedFrameIds.length > 1
                    ? multiGroupRef.current
                    : (tr?.getNode() || (selectedFrameIds[0] ? (stageRef.current?.findOne(`#${selectedFrameIds[0]}`) as Konva.Node | undefined) : null));

                  if (targetNode && tr) {
                    const rawRot = targetNode.rotation();
                    const normalizedRot = Math.round((((rawRot % 360) + 360) % 360) * 10) / 10;
                    const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360];
                    const isSnapped = SNAP_ANGLES.some((snap) => Math.abs(normalizedRot - (snap % 360)) < 0.8);

                    const rotaterAnchor = tr.findOne('.rotater');
                    let hudX = targetNode.x();
                    let hudY = targetNode.y() - 32;
                    if (rotaterAnchor) {
                      const absPos = rotaterAnchor.getAbsolutePosition();
                      const stageTransform = stageRef.current?.getAbsoluteTransform().copy().invert();
                      if (stageTransform) {
                        const local = stageTransform.point(absPos);
                        hudX = local.x;
                        hudY = local.y - 28;
                      }
                    }

                    setRotationHud({
                      angle: normalizedRot === 360 ? 0 : Math.round(normalizedRot),
                      snapped: isSnapped,
                      x: hudX,
                      y: hudY,
                    });
                  }
                } else if (activeAnchor) {
                  // Live WYSIWYG Resize HUD Badge (Bounding Box & Scaling Font Size)
                  setRotationHud(null);
                  const tr = trRef.current;
                  if (tr && stageRef.current) {
                    let targetNode: Konva.Node | null = null;
                    if (selectedFrameIds.length === 1) {
                      targetNode = tr.getNode() || (selectedFrameIds[0] ? (stageRef.current.findOne(`#${selectedFrameIds[0]}`) as Konva.Node | null) : null);
                    } else if (selectedFrameIds.length > 1) {
                      targetNode = multiGroupRef.current;
                    }

                    if (targetNode) {
                      const scaleX = Math.abs(targetNode.scaleX());
                      const scaleY = Math.abs(targetNode.scaleY());
                      const physW = (targetNode.width() * scaleX) / scaleFactor;
                      const physH = (targetNode.height() * scaleY) / scaleFactor;

                      const selEl = selectedFrameIds.length === 1
                        ? (activeSpread?.elements || []).find((el) => el.id === selectedFrameIds[0])
                        : null;
                      const isText = selEl?.type === 'text';

                      let liveFontSize: number | undefined;
                      if (isText && selEl) {
                        const textEl = selEl as TextNodeElement;
                        const baseSize = textEl.style?.fontSize || 24;
                        const isCorner =
                          activeAnchor === 'top-left' ||
                          activeAnchor === 'top-right' ||
                          activeAnchor === 'bottom-left' ||
                          activeAnchor === 'bottom-right';

                        if (isCorner && textEl.width > 0) {
                          const scaleRatio = physW / textEl.width;
                          liveFontSize = Math.max(1, Math.min(200, Math.round(baseSize * scaleRatio * 10) / 10));
                        } else {
                          liveFontSize = baseSize;
                        }
                      }

                      let hudX = targetNode.x();
                      let hudY = targetNode.y() - 28;
                      const anchorNode = tr.findOne(`.${activeAnchor}`);
                      if (anchorNode) {
                        const absPos = anchorNode.getAbsolutePosition();
                        const stageTransform = stageRef.current.getAbsoluteTransform().copy().invert();
                        if (stageTransform) {
                          const local = stageTransform.point(absPos);
                          hudX = local.x;
                          hudY = local.y - 24;
                        }
                      }

                      setResizeHud({
                        width: physW,
                        height: physH,
                        unit,
                        fontSize: liveFontSize,
                        isText: Boolean(isText),
                        x: hudX,
                        y: hudY,
                      });
                    }
                  }
                }

                // Live Real-Time WYSIWYG 60 FPS Multi-Frame Transform during mouse dragging
                if (selectedFrameIds.length > 1 && multiGroupInfo && activeSpread) {
                  const proxyNode = multiGroupRef.current;
                  if (!proxyNode) return;

                  if (activeAnchor === 'rotater') {
                    if (stageRef.current) {
                      stageRef.current.container().style.cursor = ROTATE_CURSOR;
                    }
                    const currentGroupRot = proxyNode.rotation();
                    const initialGroupRot = (multiTransformInitialStateRef.current as any)?.initialGroupRot ?? multiGroupInfo.groupRotation;
                    const deltaAngle = currentGroupRot - initialGroupRot;

                    const initialFrames = (multiTransformInitialStateRef.current?.frames ||
                      (activeSpread.elements || []).filter((f) => selectedFrameIds.includes(f.id))) as PhotoFrameElement[];

                    const updates = calculateMultiFrameRotation(initialFrames, deltaAngle);
                    updates.forEach((u) => {
                      const node = stageRef.current?.findOne(`#${u.id}`) as Konva.Node | undefined;
                      if (node) {
                        node.x(u.geometry.x * scaleFactor);
                        node.y(u.geometry.y * scaleFactor);
                        node.rotation(u.geometry.rotation);
                      }
                    });

                    const updatedLiveFrames = initialFrames.map((f) => {
                      const u = updates.find((up) => up.id === f.id);
                      return u ? { ...f, ...u.geometry } : f;
                    });

                    const liveGroupInfo = computeMultiFrameGroupInfo(updatedLiveFrames, currentGroupRot);
                    proxyNode.x(liveGroupInfo.groupX * scaleFactor);
                    proxyNode.y(liveGroupInfo.groupY * scaleFactor);
                    proxyNode.width(liveGroupInfo.groupWidth * scaleFactor);
                    proxyNode.height(liveGroupInfo.groupHeight * scaleFactor);
                    proxyNode.rotation(liveGroupInfo.groupRotation);

                    trRef.current?.update();
                    proxyNode.getLayer()?.batchDraw();
                  } else {
                    const sx = Math.abs(proxyNode.scaleX());
                    const sy = Math.abs(proxyNode.scaleY());
                    const newX = proxyNode.x() / scaleFactor;
                    const newY = proxyNode.y() / scaleFactor;

                    const initialFrames = multiTransformInitialStateRef.current?.frames ||
                      (activeSpread.elements || []).filter((f) => selectedFrameIds.includes(f.id));

                    const updates = calculateRotatedMultiFrameResize(
                      multiGroupInfo,
                      initialFrames,
                      newX,
                      newY,
                      sx,
                      sy
                    );

                    updates.forEach((u) => {
                      const node = stageRef.current?.findOne(`#${u.id}`) as Konva.Group | undefined;
                      const initialFrame = initialFrames.find((f) => f.id === u.id);
                      if (node && initialFrame && initialFrame.width > 0 && initialFrame.height > 0) {
                        node.x((u.geometry.x ?? initialFrame.x) * scaleFactor);
                        node.y((u.geometry.y ?? initialFrame.y) * scaleFactor);
                        node.rotation(u.geometry.rotation ?? initialFrame.rotation ?? 0);
                        const targetW = u.geometry.width ?? initialFrame.width;
                        const targetH = u.geometry.height ?? initialFrame.height;
                        node.scaleX(targetW / initialFrame.width);
                        node.scaleY(targetH / initialFrame.height);
                      }
                    });
                    proxyNode.getLayer()?.batchDraw();
                  }
                }
              }}
              boundBoxFunc={(oldBox, newBox) => {
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

                if (selectedFrameIds.length > 1 && multiGroupInfo && activeSpread) {
                  const activeAnchor = activeTransformAnchorRef.current || tr.getActiveAnchor();
                  const proxyNode = multiGroupRef.current;

                  // Reset temporary transform scales on individual Konva frame groups
                  selectedFrameIds.forEach((id) => {
                    const node = stageRef.current?.findOne(`#${id}`) as Konva.Node | undefined;
                    if (node) {
                      node.scaleX(1);
                      node.scaleY(1);
                    }
                  });

                  if (proxyNode) {
                    if (activeAnchor === 'rotater') {
                      const finalGroupRot = Math.round(proxyNode.rotation() * 10) / 10;
                      const initialGroupRot = (multiTransformInitialStateRef.current as any)?.initialGroupRot ?? multiGroupInfo.groupRotation;
                      const deltaAngle = finalGroupRot - initialGroupRot;

                      proxyNode.scaleX(1);
                      proxyNode.scaleY(1);

                      const initialFrames = (multiTransformInitialStateRef.current?.frames ||
                        (activeSpread.elements || []).filter((f) => selectedFrameIds.includes(f.id))) as PhotoFrameElement[];

                      const updates = calculateMultiFrameRotation(initialFrames, deltaAngle);
                      if (updates.length > 0) {
                        batchUpdateFrames(activeSpread.id, updates);
                      }
                      const newSelGroupRot = (((initialGroupRot + deltaAngle) % 360) + 360) % 360;
                      useEditorStore.getState().setSelectionGroupRotation(newSelGroupRot);
                    } else {
                      const sx = Math.abs(proxyNode.scaleX());
                      const sy = Math.abs(proxyNode.scaleY());
                      const newX = proxyNode.x() / scaleFactor;
                      const newY = proxyNode.y() / scaleFactor;

                      proxyNode.scaleX(1);
                      proxyNode.scaleY(1);

                      const initialFrames = multiTransformInitialStateRef.current?.frames ||
                        (activeSpread.elements || []).filter((f) => selectedFrameIds.includes(f.id));

                      const updates = calculateRotatedMultiFrameResize(
                        multiGroupInfo,
                        initialFrames,
                        newX,
                        newY,
                        sx,
                        sy
                      );

                      if (updates.length > 0) {
                        batchUpdateFrames(activeSpread.id, updates);
                      }
                    }
                  }
                  multiTransformInitialStateRef.current = null;
                }

                activeTransformAnchorRef.current = null;
                setRotationHud(null);
                setResizeHud(null);

                tr.keepRatio(true);
                tr.update();
                tr.getLayer()?.batchDraw();

                // Restore cursor after transform (especially after rotation)
                if (stageRef.current) {
                  stageRef.current.container().style.cursor = 'default';
                }
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
                strokeScaleEnabled={false}
                listening={false}
              />
            )}

            {/* Magnetic Snap Lines overlay with color-coded guidelines & HUD position badges */}
            {activeSnapLines.map((line, idx) => {
              const isCenter = line.kind === 'center' || line.label?.includes('Center') || line.label?.includes('Spine');
              const isMargin = line.kind === 'margin' || line.label?.includes('Safe Margin');
              const isFrame = line.kind === 'frame' || line.label?.includes('Align');

              const strokeColor = isCenter ? '#ec4899' : isMargin ? '#06b6d4' : isFrame ? '#f59e0b' : '#94a3b8';
              const tagFill = isCenter ? '#831843' : isMargin ? '#082f49' : isFrame ? '#451a03' : '#1e293b';
              const tagText = isCenter ? '#fce7f3' : isMargin ? '#e0f2fe' : isFrame ? '#fef3c7' : '#f1f5f9';

              const isVert = line.type === 'vertical';
              const linePx = line.position * scaleFactor;
              // Stagger badges near the spread edges so center crosshair labels stay readable.
              const badgeX = isVert ? linePx : Math.max(16, screenSpreadW * 0.12);
              const badgeY = isVert ? Math.max(16, screenSpreadH * 0.12) : linePx;

              return (
                <Group key={`snap-${idx}`} listening={false}>
                  <Line
                    points={
                      isVert
                        ? [linePx, 0, linePx, screenSpreadH]
                        : [0, linePx, screenSpreadW, linePx]
                    }
                    stroke={strokeColor}
                    strokeWidth={isCenter ? 2 : 1.5}
                    dash={isCenter ? [6, 3] : [4, 2]}
                    strokeScaleEnabled={false}
                  />
                  {line.label && (
                    <Group x={badgeX} y={badgeY}>
                      <Label offsetX={isVert ? -8 : 0} offsetY={isVert ? 0 : -8}>
                        <Tag
                          fill={tagFill}
                          stroke={strokeColor}
                          strokeWidth={1}
                          cornerRadius={3}
                          shadowColor="rgba(0,0,0,0.6)"
                          shadowBlur={4}
                          shadowOffset={{ x: 0, y: 1 }}
                        />
                        <KonvaText
                          text={`${line.label} (${Math.round(line.position * 10) / 10} ${unit})`}
                          fill={tagText}
                          fontSize={9.5}
                          fontStyle="bold"
                          padding={4}
                        />
                      </Label>
                    </Group>
                  )}
                </Group>
              );
            })}

            {/* Full spread center crosshair when both center axes are active. */}
            {(() => {
              const hasSpreadX = activeSnapLines.some((l) => l.type === 'vertical' && (l.label?.includes('Spread Center') || l.label?.includes('Center Spine')));
              const hasSpreadY = activeSnapLines.some((l) => l.type === 'horizontal' && (l.label?.includes('Spread Center Y') || l.label?.includes('Vertical Center')));
              if (hasSpreadX && hasSpreadY) {
                return (
                  <Group key="full-spread-center-indicator" x={screenSpreadW / 2} y={screenSpreadH / 2} listening={false}>
                    <Circle radius={7} stroke="#ec4899" strokeWidth={2.5} fill="#831843" shadowColor="#ec4899" shadowBlur={10} />
                    <Line points={[-12, 0, 12, 0]} stroke="#fce7f3" strokeWidth={1.5} />
                    <Line points={[0, -12, 0, 12]} stroke="#fce7f3" strokeWidth={1.5} />
                    <Label offsetX={70} offsetY={-18}>
                      <Tag fill="#831843" stroke="#ec4899" strokeWidth={1.5} cornerRadius={4} shadowColor="rgba(0,0,0,0.7)" shadowBlur={8} />
                      <KonvaText text="Spread Center" fill="#fce7f3" fontSize={10} fontStyle="bold" padding={5} />
                    </Label>
                  </Group>
                );
              }
              return null;
            })()}

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

            {/* Live Interactive Rotation Snapping HUD Badge */}
            {rotationHud && (
              <Group
                key="rotation-angle-hud"
                x={rotationHud.x}
                y={rotationHud.y}
                listening={false}
              >
                <Label offsetX={rotationHud.angle >= 100 ? 20 : 16} offsetY={12}>
                  <Tag
                    fill="#090d16"
                    stroke={rotationHud.snapped ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth={rotationHud.snapped ? 1.5 : 1}
                    cornerRadius={4}
                    shadowColor={rotationHud.snapped ? 'rgba(59, 130, 246, 0.5)' : 'rgba(0, 0, 0, 0.6)'}
                    shadowBlur={rotationHud.snapped ? 10 : 6}
                    shadowOffset={{ x: 0, y: 1 }}
                  />
                  <KonvaText
                    text={`${rotationHud.angle}°`}
                    fill={rotationHud.snapped ? '#60a5fa' : '#f8fafc'}
                    fontSize={11}
                    fontStyle="bold"
                    padding={5}
                    align="center"
                  />
                </Label>
              </Group>
            )}

            {/* Live Interactive Resize Dimension & Scaling Font Size HUD Badge */}
            {resizeHud && (
              <Group
                key="resize-dimension-hud"
                x={resizeHud.x}
                y={resizeHud.y}
                listening={false}
              >
                <Label offsetX={resizeHud.isText && resizeHud.fontSize ? 52 : 36} offsetY={12}>
                  <Tag
                    fill="#090d16"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    cornerRadius={4}
                    shadowColor="rgba(0, 0, 0, 0.6)"
                    shadowBlur={6}
                    shadowOffset={{ x: 0, y: 1 }}
                  />
                  <KonvaText
                    text={
                      resizeHud.isText && resizeHud.fontSize
                        ? `Font: ${resizeHud.fontSize} pt | ${Math.round(resizeHud.width * 10) / 10} × ${Math.round(resizeHud.height * 10) / 10} ${resizeHud.unit}`
                        : `${Math.round(resizeHud.width * 10) / 10} × ${Math.round(resizeHud.height * 10) / 10} ${resizeHud.unit}`
                    }
                    fill="#f8fafc"
                    fontSize={10.5}
                    fontStyle="bold"
                    padding={5}
                    align="center"
                  />
                </Label>
              </Group>
            )}
          </Layer>
        </Stage>

        {/* Inline Text Editor Overlay */}
        {editingTextElement && (
          <TextInlineEditor
            key={editingTextElement.id}
            element={editingTextElement}
            stageRef={stageRef}
            scaleFactor={scaleFactor}
            canvasUnit={dims.unit}
            dpi={dims.dpi}
            onCommit={(newText, newRanges) => {
              const currentId = editingTextElement?.id;
              if (currentId) {
                const boxW = editingTextElement.width;
                const fittedH = calculateTextFitHeight(
                  newText,
                  editingTextElement.style || {},
                  boxW,
                  dims.unit,
                  dims.dpi,
                  newRanges
                );
                updateTextElement(activeSpread.id, currentId, {
                  text: newText,
                  height: fittedH,
                  ...(newRanges !== undefined ? { styledRanges: newRanges } : {}),
                });
              }
              setEditingTextElementId(null);
            }}
            onCancel={() => setEditingTextElementId(null)}
          />
        )}
      </div>




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
