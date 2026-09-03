import React, { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { TextNodeElement, DEFAULT_TEXT_STYLE, wrapSelectionWithMarkup } from '../../domain/text';
import { Unit, ptToScreenPx, convertPtToUnit } from '../../domain/units';

interface TextInlineEditorProps {
  element: TextNodeElement;
  stageRef: React.RefObject<Konva.Stage | null>;
  scaleFactor: number;
  canvasUnit?: Unit;
  dpi?: number;
  onCommit: (newText: string) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);

  const unit = canvasUnit || 'mm';
  const currentDpi = dpi || 300;
  const style = { ...DEFAULT_TEXT_STYLE, ...(element.style || {}) };

  const safeCommit = (textToCommit: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(textToCommit);
  };

  const safeCancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
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

  const applyFormat = (openTag: string, closeTag: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const res = wrapSelectionWithMarkup(val, start, end, openTag, closeTag);
    setVal(res.newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(res.newStart, res.newEnd);
      }
    }, 0);
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
      applyFormat('**', '**');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyFormat('*', '*');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      applyFormat('__', '__');
    }
    // Note: Plain Enter is intentionally allowed to insert newlines (\n) for multi-line text!
  };

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
          top: `${Math.max(10, posY - 36)}px`,
          width: `${Math.max(pixelW, 240)}px`,
          transform: `rotate(${rot}deg)`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 51,
        }}
      >
        {/* Sleek Floating Rich Text Format Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            marginBottom: '4px',
            padding: '2px 6px',
            background: 'rgba(24, 24, 27, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(63, 63, 70, 0.8)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            alignSelf: 'flex-start',
          }}
        >
          <button
            type="button"
            title="Bold (Ctrl+B)"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat('**', '**');
            }}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: 800,
              color: '#ffffff',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            B
          </button>
          <button
            type="button"
            title="Italic (Ctrl+I)"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat('*', '*');
            }}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              fontStyle: 'italic',
              fontWeight: 600,
              color: '#ffffff',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            I
          </button>
          <button
            type="button"
            title="Underline (Ctrl+U)"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat('__', '__');
            }}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              textDecoration: 'underline',
              color: '#ffffff',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            U
          </button>
          <button
            type="button"
            title="Strikethrough"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat('~~', '~~');
            }}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              textDecoration: 'line-through',
              color: '#a1a1aa',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            S
          </button>
          <div style={{ width: '1px', height: '14px', background: '#3f3f46', margin: '0 2px' }} />
          <button
            type="button"
            title="Golden Color Tag"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat('{color:#f59e0b}', '{/color}');
            }}
            style={{
              padding: '2px 5px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#fbbf24',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            🎨 Gold
          </button>
          <button
            type="button"
            title="Yellow Background Highlight"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat('{highlight:#fef08a}', '{/highlight}');
            }}
            style={{
              padding: '2px 5px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#000000',
              background: '#fef08a',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              marginLeft: '2px',
            }}
          >
            🖍 Marker
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => safeCommit(val)}
          style={{
            width: '100%',
            minHeight: `${pixelH}px`,
            fontFamily: style.fontFamily || 'Inter',
            fontSize: `${fontSizePx}px`,
            fontWeight: isBold ? 'bold' : 'normal',
            fontStyle: isItalic ? 'italic' : 'normal',
            color: style.fill || '#1e293b',
            textAlign: style.align || 'center',
            lineHeight: style.lineHeight || 1.3,
            letterSpacing: `${letterSpacingPx}px`,
            padding: `${paddingPx}px`,
            background: 'rgba(255, 255, 255, 0.98)',
            border: '2px solid var(--color-accent, #3b82f6)',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            resize: 'vertical',
            outline: 'none',
            overflow: 'auto',
            boxSizing: 'border-box',
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
