import { useRef, useState, useMemo, useLayoutEffect } from 'react';
import { Group, Rect, Text as KonvaText, Circle, Path as KonvaPath, Shape as KonvaShape } from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '../../stores/editorStore';
import {
  TextNodeElement,
  DEFAULT_TEXT_STYLE,
  getTextRuns,
  layoutRichText,
  drawRichTextLayout,
  updateTextNode,

} from '../../domain/text';
import { Unit, convertPtToUnit, convertUnitToPt } from '../../domain/units';

interface TextNodeProps {
  element: TextNodeElement;
  isSelected: boolean;
  isEditing: boolean;
  isMultiSelectActive?: boolean;
  scaleFactor: number;
  canvasUnit?: Unit;
  dpi?: number;
  activeAnchor?: string | null;
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onElementChange: (newAttrs: Partial<TextNodeElement>, skipHistory?: boolean) => void;
  onDoubleClick: () => void;
}

export function TextNode({
  element,
  isSelected,
  isEditing,
  isMultiSelectActive = false,
  scaleFactor,
  canvasUnit,
  dpi,
  activeAnchor,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  onElementChange,
  onDoubleClick,
}: TextNodeProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const hitRef = useRef<Konva.Rect>(null);
  const textRef = useRef<Konva.Shape>(null);
  const overflowRef = useRef<Konva.Group>(null);
  const liveLayoutRef = useRef<ReturnType<typeof layoutRichText> | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useLayoutEffect(() => {
    const node = shapeRef.current;
    if (!node) return;
    const original = node.getClientRect;
    // Only the frame defines Transformer bounds, even while child text reflows.
    node.getClientRect = (config) => hitRef.current?.getClientRect(config) ?? original.call(node, config);
    return () => { node.getClientRect = original; };
  }, []);

  const unit = canvasUnit || 'mm';
  const currentDpi = dpi || 300;
  const style = useMemo(() => ({ ...DEFAULT_TEXT_STYLE, ...(element.style || {}) }), [element.style]);

  const pixelX = Number.isFinite(element.x * scaleFactor) ? element.x * scaleFactor : 0;
  const pixelY = Number.isFinite(element.y * scaleFactor) ? element.y * scaleFactor : 0;
  const pixelW = Math.max(1, Number.isFinite(element.width * scaleFactor) ? element.width * scaleFactor : 20);
  const pixelH = Math.max(1, Number.isFinite(element.height * scaleFactor) ? element.height * scaleFactor : 14);

  const transformStartRef = useRef<{
    initialPixelW: number;
    initialPixelH: number;
    initialFontSize: number;
    anchor: string | null;
  } | null>(null);

  const lastTransformStateRef = useRef<{
    fontSize: number;
    isCorner: boolean;
    scaledRanges?: typeof element.styledRanges;
  } | null>(null);

  const displayPixelW = pixelW;
  const displayPixelH = pixelH;

  // Zoom-invariant base resolution for text measurement (prevents word-wrap jumping)
  const baseResolution = convertUnitToPt(1, unit, currentDpi);
  const visualScale = scaleFactor / baseResolution;

  const internalW = (displayPixelW / scaleFactor) * baseResolution;
  const internalH = (displayPixelH / scaleFactor) * baseResolution;

  const richRuns = useMemo(() => getTextRuns(element.text, style, element.styledRanges),
    [element.text, element.styledRanges, style]);
  const richLayout = useMemo(() => layoutRichText(richRuns, style, internalW, internalH, 72, 'inch', currentDpi),
    [richRuns, style, internalW, internalH, currentDpi]);

  useLayoutEffect(() => {
    if (transformStartRef.current) return;
    // Restore imperative preview attributes even when a gesture returns to its
    // original dimensions and React sees no changed geometry props.
    liveLayoutRef.current = null;
    textRef.current?.setAttrs({ width: internalW, height: internalH, scaleX: visualScale, scaleY: visualScale });
    overflowRef.current?.setAttrs({
      x: Math.max(0, pixelW - 12), y: Math.max(0, pixelH - 12),
      scaleX: Math.min(1, pixelW / 12, pixelH / 12),
      scaleY: Math.min(1, pixelW / 12, pixelH / 12),
      visible: isSelected && !isEditing && richLayout.overflow,
    });
  });

  return (
    <Group
      id={element.id}
      ref={shapeRef}
      x={pixelX}
      y={pixelY}
      width={displayPixelW}
      height={displayPixelH}
      rotation={element.rotation || 0}
      draggable={!element.locked && !isEditing}
      onMouseDown={(e) => {
        // Ignore right clicks (button 2) or middle clicks (button 1)
        if ('button' in e.evt && (e.evt.button === 2 || e.evt.button === 1)) {
          return;
        }
        if ('which' in e.evt && (e.evt.which === 3 || e.evt.which === 2)) {
          return;
        }
      }}
      onClick={(e) => {
        // Ignore right clicks or secondary clicks on onClick
        if ('button' in e.evt && e.evt.button !== 0) {
          return;
        }
        if ('which' in e.evt && e.evt.which !== 1) {
          return;
        }
        onSelect?.(e);
      }}
      onTap={onSelect}
      onDblClick={(e) => {
        e.cancelBubble = true;
        if ('button' in e.evt && e.evt.button !== 0) {
          return;
        }
        if ('which' in e.evt && e.evt.which !== 1) {
          return;
        }
        if (!element.locked) onDoubleClick();
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        if (!element.locked) onDoubleClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        onContextMenu?.(e);
      }}
      onTransformStart={() => {
        if (isMultiSelectActive || element.locked) return;
        const node = shapeRef.current;
        if (!node) return;
        const tr = node.getStage()?.findOne('Transformer') as Konva.Transformer | undefined;
        const anchor = tr?.getActiveAnchor() || null;
        lastTransformStateRef.current = null;
        transformStartRef.current = {
          initialPixelW: node.width(),
          initialPixelH: node.height(),
          initialFontSize: style.fontSize || 24,
          anchor,
        };
      }}
      onTransform={() => {
        if (isMultiSelectActive || element.locked) return;

        const node = shapeRef.current;
        if (!node) return;

        const tr = node.getStage()?.findOne('Transformer') as Konva.Transformer | undefined;
        const anchor = tr?.getActiveAnchor() || activeAnchor || transformStartRef.current?.anchor || null;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        if (scaleX === 0 || scaleY === 0) return;

        const isCorner =
          anchor === 'top-left' ||
          anchor === 'top-right' ||
          anchor === 'bottom-left' ||
          anchor === 'bottom-right' ||
          (!anchor && Math.abs(scaleX - 1) > 0.001 && Math.abs(scaleY - 1) > 0.001);

        if (!transformStartRef.current) {
          transformStartRef.current = {
            initialPixelW: node.width(),
            initialPixelH: node.height(),
            initialFontSize: style.fontSize || 24,
            anchor: anchor || 'corner',
          };
        }

        const { initialPixelW, initialFontSize } = transformStartRef.current;

        // Minimum boundary in screen pixels
        const minW = convertPtToUnit(1, unit, currentDpi) * scaleFactor;
        const minH = convertPtToUnit(1, unit, currentDpi) * scaleFactor;

        const newPixelW = Math.max(minW, node.width() * scaleX);
        const newPixelH = Math.max(minH, node.height() * scaleY);

        let newFontSize = initialFontSize;
        let currentScaledRanges = element.styledRanges;

        if (isCorner && initialPixelW > 0) {
          const scaleRatio = newPixelW / initialPixelW;
          // Preserve fractional sizes: rounding can alternately wrap/unwrap a fitted
          // line as the frame grows continuously between font-size steps.
          newFontSize = Math.max(1, Math.min(200, initialFontSize * scaleRatio));
          const fontRatio = newFontSize / initialFontSize;

          if (element.styledRanges && element.styledRanges.length > 0) {
            currentScaledRanges = element.styledRanges.map((r) => ({
              ...r,
              fontSize: r.fontSize
                ? r.fontSize * fontRatio
                : undefined,
            }));
          }
        }

        lastTransformStateRef.current = {
          fontSize: newFontSize,
          isCorner,
          scaledRanges: currentScaledRanges,
        };

        // Leave frame geometry/scales entirely under Konva during the gesture.
        // Compensate only the text child so side handles reflow without stretching.
        // Measure at the original font size to avoid fractional glyph-metric jumps.
        const fontRatio = newFontSize / initialFontSize;
        const layoutW = newPixelW / visualScale / fontRatio;
        const layoutH = newPixelH / visualScale / fontRatio;
        const layout = Math.abs(layoutW - internalW) < 1e-6 && Math.abs(layoutH - internalH) < 1e-6
          ? richLayout
          : layoutRichText(richRuns, style, layoutW, layoutH, 72, 'inch', currentDpi);
        liveLayoutRef.current = layout;
        textRef.current?.setAttrs({
          width: layoutW, height: layoutH,
          scaleX: visualScale * fontRatio / node.scaleX(),
          scaleY: visualScale * fontRatio / node.scaleY(),
        });
        const badgeScale = Math.min(1, newPixelW / 12, newPixelH / 12);
        overflowRef.current?.setAttrs({
          x: Math.max(0, newPixelW - 12) / scaleX,
          y: Math.max(0, newPixelH - 12) / scaleY,
          scaleX: badgeScale / scaleX, scaleY: badgeScale / scaleY,
          visible: isSelected && !isEditing && layout.overflow,
        });
        node.getLayer()?.batchDraw();
      }}
      onTransformEnd={() => {
        if (isMultiSelectActive || element.locked) return;

        const node = shapeRef.current;
        if (!node) return;

        const lastState = lastTransformStateRef.current;
        const wasCorner = lastState ? lastState.isCorner : false;
        const finalFontSize = lastState ? lastState.fontSize : (style.fontSize || 24);
        const finalRanges = lastState?.scaledRanges || element.styledRanges;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        let rawW = (node.width() * scaleX) / scaleFactor;
        let rawH = (node.height() * scaleY) / scaleFactor;

        // One typographic point, independent of zoom and project units.
        const minW = convertPtToUnit(1, unit, currentDpi);
        const minH = convertPtToUnit(1, unit, currentDpi);
        rawW = Math.max(minW, rawW);
        rawH = Math.max(minH, rawH);

        const finalX = node.x() / scaleFactor;
        const finalY = node.y() / scaleFactor;

        transformStartRef.current = null;
        lastTransformStateRef.current = null;

        const updates: Partial<TextNodeElement> = {
          x: finalX,
          y: finalY,
          width: rawW,
          height: rawH,
          rotation: node.rotation(),
          style: {
            ...style,
            ...(wasCorner ? {
              fontSize: finalFontSize,
              padding: style.padding * finalFontSize / style.fontSize,
              letterSpacing: style.letterSpacing * finalFontSize / style.fontSize,
            } : {}),
          },
          ...(wasCorner && finalRanges ? { styledRanges: finalRanges } : {}),
        };
        // Normalize once, using the same auto-size operation as the store, so
        // releasing the pointer cannot paint the old dimensions for one frame.
        const next = updateTextNode(element, updates, unit, currentDpi);
        const width = next.width * scaleFactor;
        const height = next.height * scaleFactor;
        const nextLayout = layoutRichText(getTextRuns(next.text, next.style, next.styledRanges),
          next.style, width / visualScale, height / visualScale, 72, 'inch', currentDpi);
        liveLayoutRef.current = nextLayout;
        node.setAttrs({ x: next.x * scaleFactor, y: next.y * scaleFactor, width, height, scaleX: 1, scaleY: 1 });
        hitRef.current?.setAttrs({ width, height });
        textRef.current?.setAttrs({ width: width / visualScale, height: height / visualScale, scaleX: visualScale, scaleY: visualScale });
        overflowRef.current?.setAttrs({
          x: Math.max(0, width - 12), y: Math.max(0, height - 12),
          scaleX: Math.min(1, width / 12, height / 12),
          scaleY: Math.min(1, width / 12, height / 12),
          visible: isSelected && !isEditing && nextLayout.overflow,
        });
        onElementChange(updates);
        node.getLayer()?.batchDraw();
      }}
    >
      {/* Base Invisible Hit Box for clicking/dragging */}
      <Rect
        ref={hitRef}
        width={displayPixelW}
        height={displayPixelH}
        fill="rgba(0, 0, 0, 0.001)"
        listening={!isEditing}
      />

      {/* Rendered Text Element - Centered in middle of frame */}
      <KonvaShape
        ref={textRef}
        width={internalW}
        height={internalH}
        scaleX={visualScale}
        scaleY={visualScale}
        opacity={isEditing ? 0 : 1}
        listening={false}
        sceneFunc={(context) => drawRichTextLayout(context._context, liveLayoutRef.current ?? richLayout)}
      />
      <Group ref={overflowRef} visible={isSelected && !isEditing && richLayout.overflow}
        x={Math.max(0, displayPixelW - 12)} y={Math.max(0, displayPixelH - 12)}
        scaleX={Math.min(1, displayPixelW / 12, displayPixelH / 12)}
        scaleY={Math.min(1, displayPixelW / 12, displayPixelH / 12)} listening={false}>
        {/* Keep the overflow badge stroke inside the frame. */}
        <Rect x={0.5} y={0.5} width={11} height={11} fill="#fff" stroke="#e11d48" strokeWidth={1} />
        <KonvaText text="+" width={12} height={12} align="center" verticalAlign="middle" fill="#e11d48" fontSize={12} />
      </Group>

      {/* Subtle Hover Outline when not selected and not editing */}
      {isHovered && !isSelected && !isEditing && (
        <Rect
          width={displayPixelW}
          height={displayPixelH}
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth={1}
          dash={[3, 3]}
          fillEnabled={false}
          listening={false}
        />
      )}

      {/* Locked Text Box Selection / Status Outline (Yellow dashed bounding box) */}
      {element.locked && (
        <Rect
          width={displayPixelW}
          height={displayPixelH}
          stroke="#f59e0b"
          strokeWidth={isSelected ? 1.5 : 1}
          dash={[4, 4]}
          opacity={isSelected ? 1 : 0.8}
          listening={false}
          strokeScaleEnabled={false}
        />
      )}

      {/* Locked Vector Padlock Badge (top-right corner) - Identical to Photo Frame */}
      {element.locked && (
        <Group
          x={Math.max(14, displayPixelW - 16)}
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
