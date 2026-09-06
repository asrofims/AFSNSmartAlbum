import { useRef, useState, useMemo, useEffect } from 'react';
import { Group, Rect, Text as KonvaText, Circle, Path as KonvaPath, Shape as KonvaShape } from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '../../stores/editorStore';
import {
  TextNodeElement,
  DEFAULT_TEXT_STYLE,
  hasRichTextMarkup,
  parseRichTextRuns,
  rangesToTextRuns,
  layoutRichText,
  drawRichTextLayout,
  calculateTextFitHeight,
  resolveCssFontFamily,
} from '../../domain/text';
import { roundToHundredth } from '../../domain/editor';
import { Unit, ptToScreenPx, convertPtToUnit, convertUnit } from '../../domain/units';

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
  const textChildRef = useRef<Konva.Text>(null);
  const [isHovered, setIsHovered] = useState(false);

  const unit = canvasUnit || 'mm';
  const currentDpi = dpi || 300;
  const style = { ...DEFAULT_TEXT_STYLE, ...(element.style || {}) };

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

  const [liveDimensions, setLiveDimensions] = useState<{
    width: number;
    height: number;
    fontSize?: number;
  } | null>(null);
  const displayPixelW = liveDimensions ? liveDimensions.width : pixelW;
  const displayPixelH = liveDimensions ? liveDimensions.height : pixelH;

  // Zoom-invariant base resolution for text measurement (prevents word-wrap jumping)
  const baseResolution = 10;
  const visualScale = scaleFactor / baseResolution;

  const internalW = (displayPixelW / scaleFactor) * baseResolution;
  const internalH = (displayPixelH / scaleFactor) * baseResolution;

  // Live typographic point size (dynamically scales when corner handles are dragged)
  const currentFontSize = liveDimensions?.fontSize ?? (style.fontSize || 24);
  const fontPt = Number.isFinite(currentFontSize) && currentFontSize > 0 ? currentFontSize : 24;
  
  // Calculate raw font size at base resolution to guarantee layout invariance across zoom levels
  const rawFontSizeUnscaled = ptToScreenPx(fontPt, unit, currentDpi, 1);
  const internalFontSize = Math.max(1, Number.isFinite(rawFontSizeUnscaled) ? rawFontSizeUnscaled * baseResolution : 16);

  // Valid Konva fontStyle: 'normal', 'bold', 'italic', or 'italic bold'
  const isBold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
  const isItalic = style.fontStyle === 'italic';
  const fontStyle = isBold ? (isItalic ? 'italic bold' : 'bold') : (isItalic ? 'italic' : 'normal');

  const paddingPt = Number.isFinite(style.padding) ? style.padding : 4;
  const paddingInUnit = convertPtToUnit(paddingPt, unit, currentDpi);
  const internalPadding = Math.max(0, paddingInUnit * baseResolution);

  const internalLetterSpacing = style.letterSpacing
    ? (convertPtToUnit(style.letterSpacing, unit, currentDpi) || 0) * baseResolution
    : 0;

  const effectiveStyle = useMemo(() => ({
    ...style,
    fontSize: currentFontSize,
  }), [style, currentFontSize]);

  // Rich Text Layout (Range selection or legacy markup)
  const hasRanges = Boolean(element.styledRanges && element.styledRanges.length > 0);
  const isMarkup = hasRichTextMarkup(element.text);
  const isRich = hasRanges || isMarkup;

  const richRuns = useMemo(() => {
    if (!isRich) return null;
    if (hasRanges) {
      const scaleRatio = currentFontSize / (style.fontSize || 24);
      const scaledRanges = scaleRatio === 1
        ? element.styledRanges
        : (element.styledRanges || []).map((r) => ({
            ...r,
            fontSize: r.fontSize
              ? Math.round(r.fontSize * scaleRatio * 10) / 10
              : undefined,
          }));
      return rangesToTextRuns(element.text, scaledRanges, effectiveStyle);
    }
    return parseRichTextRuns(element.text, effectiveStyle);
  }, [isRich, hasRanges, element.text, element.styledRanges, effectiveStyle, currentFontSize, style.fontSize]);

  const richLayout = useMemo(() => {
    if (!isRich || !richRuns) return null;
    return layoutRichText(richRuns, effectiveStyle, internalW, internalH, baseResolution, unit, currentDpi);
  }, [isRich, richRuns, effectiveStyle, internalW, internalH, baseResolution, unit, currentDpi]);

  // Zoom-independent box height auto-expansion:
  // Evaluates strictly in physical units (mm, cm, inch) using calculateTextFitHeight.
  // NEVER depends on scaleFactor, screen pixels, or canvas zoom!
  useEffect(() => {
    if (isEditing || liveDimensions) return;

    const requiredPhysicalH = calculateTextFitHeight(
      element.text || ' ',
      effectiveStyle,
      element.width,
      unit,
      currentDpi,
      element.styledRanges
    );

    if (requiredPhysicalH > element.height + 0.5) {
      onElementChange({
        height: roundToHundredth(requiredPhysicalH),
      }, true);
    }
  }, [
    element.text,
    element.width,
    element.height,
    currentFontSize,
    style.lineHeight,
    style.fontFamily,
    style.padding,
    style.wordWrap,
    unit,
    currentDpi,
    isEditing,
    liveDimensions,
    onElementChange,
  ]);

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
        onDoubleClick();
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        onDoubleClick();
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
        if (isMultiSelectActive) return;
        const node = shapeRef.current;
        if (!node) return;
        const tr = node.getStage()?.findOne('Transformer') as Konva.Transformer | undefined;
        const anchor = tr?.getActiveAnchor() || null;
        transformStartRef.current = {
          initialPixelW: node.width(),
          initialPixelH: node.height(),
          initialFontSize: style.fontSize || 24,
          anchor,
        };
      }}
      onTransform={() => {
        if (isMultiSelectActive) return;

        const node = shapeRef.current;
        if (!node) return;

        const tr = node.getStage()?.findOne('Transformer') as Konva.Transformer | undefined;
        const anchor = tr?.getActiveAnchor() || activeAnchor || transformStartRef.current?.anchor || null;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());

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
        const minW = Math.max(20, Math.round(convertUnit(10, 'mm', unit, currentDpi, 2) * scaleFactor));
        const minH = Math.max(12, Math.round(convertUnit(6, 'mm', unit, currentDpi, 2) * scaleFactor));

        const newPixelW = Math.max(minW, Math.round(node.width() * scaleX));
        const newPixelH = Math.max(minH, Math.round(node.height() * scaleY));

        // Immediately reset scale to 1.0 so typography stays crisp and NEVER stretches!
        node.scaleX(1);
        node.scaleY(1);
        node.width(newPixelW);
        node.height(newPixelH);

        let newFontSize = initialFontSize;
        let currentScaledRanges = element.styledRanges;

        if (isCorner && initialPixelW > 0) {
          const scaleRatio = newPixelW / initialPixelW;
          newFontSize = Math.max(1, Math.min(200, Math.round(initialFontSize * scaleRatio * 10) / 10));

          if (element.styledRanges && element.styledRanges.length > 0) {
            currentScaledRanges = element.styledRanges.map((r) => ({
              ...r,
              fontSize: r.fontSize
                ? Math.max(1, Math.min(200, Math.round(r.fontSize * scaleRatio * 10) / 10))
                : undefined,
            }));
          }
        }

        lastTransformStateRef.current = {
          fontSize: newFontSize,
          isCorner,
          scaledRanges: currentScaledRanges,
        };

        // Update child KonvaText (triggers instant 60 FPS text wrapping / reflow!)
        const textChild = textChildRef.current || (node.findOne('Text') as Konva.Text | undefined);
        let livePixelH = newPixelH;

        if (textChild) {
          textChild.width((newPixelW / scaleFactor) * baseResolution);
          if (isCorner) {
            const liveFontSizeUnscaled = ptToScreenPx(newFontSize, unit, currentDpi, 1);
            textChild.fontSize(Math.max(1, liveFontSizeUnscaled * baseResolution));
          }
          // Real-time live 60 FPS box room expansion: if wrapping text exceeds height, expand box downwards!
          const actualTextH_Internal = textChild.getTextHeight();
          const actualTextH_Scaled = Math.ceil((actualTextH_Internal + (4 * baseResolution)) * (scaleFactor / baseResolution));
          if (actualTextH_Scaled > livePixelH) {
            livePixelH = actualTextH_Scaled;
          }
          textChild.height((livePixelH / scaleFactor) * baseResolution);
        }

        node.height(livePixelH);

        // Update all child Rect shapes (hitbox, selection dash outline, hover outline)
        node.find('Rect').forEach((r) => {
          r.width(newPixelW);
          r.height(livePixelH);
        });

        // Update local React state so RichText layout and re-renders stay in sync
        setLiveDimensions({
          width: newPixelW,
          height: livePixelH,
          fontSize: newFontSize,
        });
      }}
      onTransformEnd={() => {
        if (isMultiSelectActive) return;

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

        // Minimum boundary in canvas units (10mm x 6mm)
        const minW = Math.round(convertUnit(10, 'mm', unit, currentDpi, 2) * 100) / 100;
        const minH = Math.round(convertUnit(6, 'mm', unit, currentDpi, 2) * 100) / 100;
        rawW = Math.max(minW, rawW);
        rawH = Math.max(minH, rawH);

        const finalX = node.x() / scaleFactor;
        const finalY = node.y() / scaleFactor;

        const effectiveFinalStyle = wasCorner ? { ...style, fontSize: finalFontSize } : style;

        // Auto-hug height guarantee: ensure box height accommodates all wrapped lines without clipping
        const fittedH = calculateTextFitHeight(
          element.text || ' ',
          effectiveFinalStyle,
          rawW,
          unit,
          currentDpi,
          finalRanges
        );
        const textChild = textChildRef.current || (node.findOne('Text') as Konva.Text | undefined);
        const actualKonvaH = textChild ? Math.ceil((((textChild.getTextHeight() + (4 * baseResolution)) / baseResolution) * 100)) / 100 : 0;
        rawH = Math.max(rawH, fittedH, actualKonvaH);

        node.scaleX(1);
        node.scaleY(1);
        setLiveDimensions(null);
        transformStartRef.current = null;
        lastTransformStateRef.current = null;

        onElementChange({
          x: roundToHundredth(finalX),
          y: roundToHundredth(finalY),
          width: roundToHundredth(rawW),
          height: roundToHundredth(rawH),
          rotation: Math.round(node.rotation()),
          ...(wasCorner
            ? {
                style: {
                  ...style,
                  fontSize: finalFontSize,
                },
                ...(finalRanges ? { styledRanges: finalRanges } : {}),
              }
            : {}),
        });
      }}
    >
      {/* Base Invisible Hit Box for clicking/dragging */}
      <Rect
        width={displayPixelW}
        height={displayPixelH}
        fill="rgba(0, 0, 0, 0.001)"
        listening={!isEditing}
      />

      {/* Rendered Text Element - Centered in middle of frame */}
      {isRich && richLayout ? (
        <KonvaShape
          width={internalW}
          height={internalH}
          scaleX={visualScale}
          scaleY={visualScale}
          opacity={isEditing ? 0 : 1}
          listening={!isEditing}
          sceneFunc={(context) => {
            const nativeCtx = (context as any)._context || context;
            drawRichTextLayout(nativeCtx, richLayout);
          }}
        />
      ) : (
        <KonvaText
          ref={textChildRef}
          text={element.text || ' '}
          width={internalW}
          height={internalH}
          fontFamily={resolveCssFontFamily(style.fontFamily)}
          fontSize={internalFontSize}
          fontStyle={fontStyle}
          textDecoration={style.textDecoration || 'none'}
          fill={style.fill || '#1e293b'}
          align={style.align || 'center'}
          verticalAlign={style.verticalAlign || 'top'}
          lineHeight={style.lineHeight || 1.3}
          letterSpacing={internalLetterSpacing}
          padding={internalPadding}
          wrap={style.wordWrap === 'char' ? 'char' : style.wordWrap === 'none' ? 'none' : 'word'}
          ellipsis={Boolean(style.ellipsis)}
          opacity={isEditing ? 0 : 1}
          listening={!isEditing}
          scaleX={visualScale}
          scaleY={visualScale}
        />
      )}

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
