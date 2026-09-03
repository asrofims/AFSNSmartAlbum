import { useRef, useState, useMemo } from 'react';
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
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onElementChange: (newAttrs: Partial<TextNodeElement>) => void;
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
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  onElementChange,
  onDoubleClick,
}: TextNodeProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const [isHovered, setIsHovered] = useState(false);

  const unit = canvasUnit || 'mm';
  const currentDpi = dpi || 300;
  const style = { ...DEFAULT_TEXT_STYLE, ...(element.style || {}) };

  const pixelX = Number.isFinite(element.x * scaleFactor) ? element.x * scaleFactor : 0;
  const pixelY = Number.isFinite(element.y * scaleFactor) ? element.y * scaleFactor : 0;
  const pixelW = Math.max(20, Number.isFinite(element.width * scaleFactor) ? element.width * scaleFactor : 60);
  const pixelH = Math.max(14, Number.isFinite(element.height * scaleFactor) ? element.height * scaleFactor : 20);

  // Safe typographic point size conversion directly to screen pixels (supports down to 1pt)
  const fontPt = Number.isFinite(style.fontSize) && style.fontSize > 0 ? style.fontSize : 24;
  const rawFontSizePx = ptToScreenPx(fontPt, unit, currentDpi, scaleFactor);
  const fontSizePx = Math.max(1, Number.isFinite(rawFontSizePx) ? rawFontSizePx : 16);

  // Valid Konva fontStyle: 'normal', 'bold', 'italic', or 'italic bold'
  const isBold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
  const isItalic = style.fontStyle === 'italic';
  const fontStyle = isBold ? (isItalic ? 'italic bold' : 'bold') : (isItalic ? 'italic' : 'normal');

  const paddingPt = Number.isFinite(style.padding) ? style.padding : 6;
  const rawPaddingPx = ptToScreenPx(paddingPt, unit, currentDpi, scaleFactor);
  const paddingPx = Math.max(0, Math.min(Math.floor(pixelW / 4), Number.isFinite(rawPaddingPx) ? rawPaddingPx : 0));

  const letterSpacingPx = style.letterSpacing
    ? (convertPtToUnit(style.letterSpacing, unit, currentDpi) * scaleFactor) || 0
    : 0;

  // Rich Text Layout (Range selection or legacy markup)
  const hasRanges = Boolean(element.styledRanges && element.styledRanges.length > 0);
  const isMarkup = hasRichTextMarkup(element.text);
  const isRich = hasRanges || isMarkup;

  const richRuns = useMemo(() => {
    if (!isRich) return null;
    if (hasRanges) {
      return rangesToTextRuns(element.text, element.styledRanges, style);
    }
    return parseRichTextRuns(element.text, style);
  }, [isRich, hasRanges, element.text, element.styledRanges, style]);

  const richLayout = useMemo(() => {
    if (!isRich || !richRuns) return null;
    return layoutRichText(richRuns, style, pixelW, pixelH, scaleFactor, unit, currentDpi);
  }, [isRich, richRuns, style, pixelW, pixelH, scaleFactor, unit, currentDpi]);

  return (
    <Group
      id={element.id}
      ref={shapeRef}
      x={pixelX}
      y={pixelY}
      width={pixelW}
      height={pixelH}
      rotation={element.rotation || 0}
      draggable={!element.locked && !isEditing}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={(e) => {
        e.cancelBubble = true;
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
      onContextMenu={onContextMenu}
      onTransformEnd={() => {
        if (isMultiSelectActive) return;

        const node = shapeRef.current;
        if (!node) return;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        let rawW = (node.width() * scaleX) / scaleFactor;
        let rawH = (node.height() * scaleY) / scaleFactor;

        // Minimum boundary in canvas units (5mm x 3mm)
        const minW = Math.round(convertUnit(5, 'mm', unit, currentDpi, 2) * 100) / 100;
        const minH = Math.round(convertUnit(3, 'mm', unit, currentDpi, 2) * 100) / 100;
        rawW = Math.max(minW, rawW);
        rawH = Math.max(minH, rawH);

        // Check if this was a corner scale (uniform proportional scaling)
        // If corner scaling: update style.fontSize proportionally so canvas resize and panel slider are 100% consistent!
        const isCornerScale = Math.abs(scaleX - scaleY) < 0.08 && (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01);
        const currentFontSize = style.fontSize || 24;
        const newFontSize = isCornerScale
          ? Math.max(1, Math.min(200, Math.round((currentFontSize * scaleX) * 10) / 10))
          : currentFontSize;

        node.scaleX(1);
        node.scaleY(1);

        onElementChange({
          x: roundToHundredth(node.x() / scaleFactor),
          y: roundToHundredth(node.y() / scaleFactor),
          width: roundToHundredth(rawW),
          height: roundToHundredth(rawH),
          rotation: Math.round(node.rotation()),
          ...(isCornerScale ? {
            style: {
              ...style,
              fontSize: newFontSize,
            },
          } : {}),
        });
      }}
    >
      {/* Base Invisible Hit Box for clicking/dragging */}
      <Rect
        width={pixelW}
        height={pixelH}
        fill="rgba(0, 0, 0, 0.001)"
        listening={!isEditing}
      />

      {/* Rendered Text Element - Centered in middle of frame */}
      {isRich && richLayout ? (
        <KonvaShape
          width={pixelW}
          height={pixelH}
          opacity={isEditing ? 0 : 1}
          listening={!isEditing}
          sceneFunc={(context) => {
            const nativeCtx = (context as any)._context || context;
            drawRichTextLayout(nativeCtx, richLayout);
          }}
        />
      ) : (
        <KonvaText
          text={element.text || ' '}
          width={pixelW}
          height={pixelH}
          fontFamily={style.fontFamily || 'Inter'}
          fontSize={fontSizePx}
          fontStyle={fontStyle}
          textDecoration={style.textDecoration || 'none'}
          fill={style.fill || '#1e293b'}
          align={style.align || 'center'}
          verticalAlign={style.verticalAlign || 'middle'}
          lineHeight={style.lineHeight || 1.3}
          letterSpacing={letterSpacingPx}
          padding={paddingPx}
          wrap={style.wordWrap === 'char' ? 'char' : style.wordWrap === 'none' ? 'none' : 'word'}
          ellipsis={Boolean(style.ellipsis)}
          opacity={isEditing ? 0 : 1}
          listening={!isEditing}
        />
      )}

      {/* Subtle Hover Outline when not selected and not editing */}
      {isHovered && !isSelected && !isEditing && (
        <Rect
          width={pixelW}
          height={pixelH}
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
          width={pixelW}
          height={pixelH}
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
