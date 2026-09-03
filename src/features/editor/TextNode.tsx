import { useRef, useState } from 'react';
import { Group, Rect, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import { TextNodeElement, DEFAULT_TEXT_STYLE } from '../../domain/text';
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

      {/* Lock Badge if locked */}
      {element.locked && (
        <Rect
          x={pixelW - 16}
          y={2}
          width={14}
          height={14}
          fill="rgba(245, 158, 11, 0.9)"
          cornerRadius={3}
          listening={false}
        />
      )}
    </Group>
  );
}
