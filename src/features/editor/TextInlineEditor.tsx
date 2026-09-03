import React, { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import {
  TextNodeElement,
  DEFAULT_TEXT_STYLE,
  StyledRange,
  applyStyleToRange,
  shiftRangesOnTextEdit,
} from '../../domain/text';
import { Unit, ptToScreenPx, convertPtToUnit } from '../../domain/units';

interface TextInlineEditorProps {
  element: TextNodeElement;
  stageRef: React.RefObject<Konva.Stage | null>;
  scaleFactor: number;
  canvasUnit?: Unit;
  dpi?: number;
  onCommit: (newText: string, newRanges?: StyledRange[]) => void;
  onCancel: () => void;
}

export function TextInlineEditor({
  element,
  stageRef,
  scaleFactor,
  canvasUnit,
  dpi,
  onCommit,
  onCancel,
}: TextInlineEditorProps) {
  const [val, setVal] = useState(element.text || '');
  const [ranges, setRanges] = useState<StyledRange[]>(element.styledRanges || []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);

  const unit = canvasUnit || 'mm';
  const currentDpi = dpi || 300;
  const style = { ...DEFAULT_TEXT_STYLE, ...(element.style || {}) };

  const safeCommit = (textToCommit: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(textToCommit, ranges);
  };

  const safeCancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  const applyRangeStyle = (patch: Partial<Omit<StyledRange, 'id' | 'start' | 'end'>>) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    if (start >= end) return;

    const nextRanges = applyStyleToRange(ranges, start, end, patch);
    setRanges(nextRanges);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);
      }
    }, 0);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    const changeStart = e.target.selectionStart;
    const removedLen = Math.max(0, val.length - nextVal.length);
    const insertedLen = Math.max(0, nextVal.length - val.length);
    const nextRanges = shiftRangesOnTextEdit(ranges, changeStart, removedLen, insertedLen);
    setVal(nextVal);
    setRanges(nextRanges);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      safeCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter or Cmd+Enter commits
      e.stopPropagation();
      e.preventDefault();
      safeCommit(val);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyRangeStyle({ fontWeight: 'bold' });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyRangeStyle({ fontStyle: 'italic' });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      applyRangeStyle({ textDecoration: 'underline' });
    }
  };

  // Compute exact screen coordinate relative to stage container
  const stage = stageRef.current;
  const textGroupNode = stage?.findOne(`#${element.id}`) as Konva.Group | undefined;

  const pixelX = Number.isFinite(element.x * scaleFactor) ? element.x * scaleFactor : 0;
  const pixelY = Number.isFinite(element.y * scaleFactor) ? element.y * scaleFactor : 0;
  const pixelW = Math.max(40, Number.isFinite(element.width * scaleFactor) ? element.width * scaleFactor : 100);
  const pixelH = Math.max(30, Number.isFinite(element.height * scaleFactor) ? element.height * scaleFactor : 40);

  let posX = pixelX;
  let posY = pixelY;
  let rot = Number.isFinite(element.rotation) ? element.rotation : 0;

  if (textGroupNode) {
    try {
      const absPos = textGroupNode.getAbsolutePosition();
      if (absPos && Number.isFinite(absPos.x) && Number.isFinite(absPos.y)) {
        posX = absPos.x;
        posY = absPos.y;
      }
      rot = Number.isFinite(textGroupNode.rotation()) ? textGroupNode.rotation() : rot;
    } catch {}
  }

  // Safe typographic point size conversion
  const fontPt = Number.isFinite(style.fontSize) && style.fontSize > 0 ? style.fontSize : 24;
  const rawFontSizePx = ptToScreenPx(fontPt, unit, currentDpi, scaleFactor);
  const fontSizePx = Math.max(1, Number.isFinite(rawFontSizePx) ? rawFontSizePx : 16);
  const isBold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
  const isItalic = style.fontStyle === 'italic';

  const paddingPt = Number.isFinite(style.padding) ? style.padding : 6;
  const rawPaddingPx = ptToScreenPx(paddingPt, unit, currentDpi, scaleFactor);
  const paddingPx = Math.max(2, Math.min(Math.floor(pixelW / 4), Number.isFinite(rawPaddingPx) ? rawPaddingPx : 4));

  const letterSpacingPx = style.letterSpacing
    ? (convertPtToUnit(style.letterSpacing, unit, currentDpi) * scaleFactor) || 0
    : 0;

  // Focus & select all on mount without triggering parent scroll
  useEffect(() => {
    if (textareaRef.current) {
      try {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.select();
      } catch {
        textareaRef.current?.focus();
      }
    }
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 50,
      }}
      onClick={(e) => {
        // Clicking outside the textarea safely commits the edited text
        if (e.target === e.currentTarget) {
          safeCommit(val);
        }
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${posX}px`,
          top: `${posY}px`,
          width: `${pixelW}px`,
          transform: `rotate(${rot}deg)`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 51,
        }}
      >
        <textarea
          ref={textareaRef}
          value={val}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onBlur={() => safeCommit(val)}
          style={{
            width: '100%',
            minHeight: `${pixelH}px`,
            fontFamily: style.fontFamily || 'Inter',
            fontSize: `${fontSizePx}px`,
            fontWeight: isBold ? 'bold' : 'normal',
            fontStyle: isItalic ? 'italic' : 'normal',
            color: style.fill || '#f8fafc',
            textAlign: style.align || 'center',
            lineHeight: style.lineHeight || 1.3,
            letterSpacing: `${letterSpacingPx}px`,
            padding: `${paddingPx}px`,
            background: 'rgba(15, 23, 42, 0.55)',
            border: '2px solid var(--color-accent, #3b82f6)',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            resize: 'vertical',
            outline: 'none',
            overflow: 'auto',
            boxSizing: 'border-box',
            caretColor: '#60a5fa',
          }}
        />
        <div
          style={{
            alignSelf: 'flex-end',
            marginTop: '4px',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 600,
            borderRadius: '3px',
            background: '#0f172a',
            color: '#94a3b8',
            border: '1px solid #334155',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Ctrl+Enter apply · Esc cancel
        </div>
      </div>
    </div>
  );
}
