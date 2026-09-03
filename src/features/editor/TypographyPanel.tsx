import { useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { useHistoryStore } from '../../stores/historyStore';
import {
  TextNodeElement,
  ALBUM_FONT_FAMILIES,
  TEXT_PRESETS,
  TextPresetKey,
  applyTextPreset,
  calculateTextFitHeight,
  DEFAULT_TEXT_STYLE,
  wrapSelectionWithMarkup,
} from '../../domain/text';
import { ColorPicker } from '../../components/ui/ColorPicker';

interface TypographyPanelProps {
  element: TextNodeElement;
  onToast?: (msg: string) => void;
}

const COMMON_TEXT_COLORS = [
  '#000000',
  '#1e293b',
  '#475569',
  '#94a3b8',
  '#ffffff',
  '#b91c1c',
  '#d97706',
  '#2563eb',
  '#059669',
  '#7c3aed',
];

export function TypographyPanel({ element, onToast }: TypographyPanelProps) {
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const updateTextElement = useEditorStore((s) => s.updateTextElement);
  const setEditingTextElementId = useEditorStore((s) => s.setEditingTextElementId);
  const panelTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (!activeSpreadId) return null;

  const handleApplyFormatToPanel = (openTag: string, closeTag: string) => {
    const el = panelTextareaRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const currentVal = element.text || '';
    const res = wrapSelectionWithMarkup(currentVal, s, e, openTag, closeTag);
    updateTextElement(activeSpreadId, element.id, { text: res.newText });
    setTimeout(() => {
      if (panelTextareaRef.current) {
        panelTextareaRef.current.focus();
        panelTextareaRef.current.setSelectionRange(res.newStart, res.newEnd);
      }
    }, 0);
  };

  const style = { ...DEFAULT_TEXT_STYLE, ...(element.style || {}) };

  const handleUpdateStyle = (updates: Partial<typeof style>, skipHistory: boolean = false) => {
    updateTextElement(activeSpreadId, element.id, {
      style: {
        ...style,
        ...updates,
      },
    }, skipHistory);
  };

  const handleApplyPreset = (presetKey: TextPresetKey) => {
    const updated = applyTextPreset(
      element,
      presetKey,
      currentProject?.canvasUnit || 'mm',
      currentProject?.canvasDpi || 300
    );
    updateTextElement(activeSpreadId, element.id, {
      width: updated.width,
      height: updated.height,
      style: updated.style,
    });
    if (onToast) {
      onToast(`✓ Applied style preset: ${TEXT_PRESETS[presetKey].label}`);
    }
  };

  const handleFitBoxToText = () => {
    const fittedH = calculateTextFitHeight(
      element.text || ' ',
      style,
      element.width,
      currentProject?.canvasUnit || 'mm',
      currentProject?.canvasDpi || 300
    );
    updateTextElement(activeSpreadId, element.id, {
      height: fittedH,
    });
    if (onToast) {
      onToast('✓ Fitted frame height tightly to text content');
    }
  };

  const isBold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
  const isItalic = style.fontStyle === 'italic';
  const isUnderline = style.textDecoration === 'underline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 4px' }}>
      {/* 1. Header & Icon Actions Underneath */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.3px' }}>
          Typography & Style
        </div>
        {/* Clean Icon-Only Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleFitBoxToText}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '5px',
              background: 'var(--color-surface-raised, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--color-border, #334155)',
              color: 'var(--color-text-secondary, #94a3b8)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Fit Box to Text"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setEditingTextElementId(element.id)}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '5px',
              background: 'var(--color-accent-subtle, rgba(59, 130, 246, 0.12))',
              border: '1px solid var(--color-accent, #3b82f6)',
              color: 'var(--color-accent, #3b82f6)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Canvas Inline Editor (Double-click text)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Direct Content Input Field with Quick Rich Format Bar */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
            Text Content
          </div>
          {/* Quick Rich Format Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <button
              type="button"
              title="Bold selection (Ctrl+B)"
              onMouseDown={(e) => {
                e.preventDefault();
                handleApplyFormatToPanel('**', '**');
              }}
              style={{
                padding: '1px 5px',
                fontSize: '10px',
                fontWeight: 800,
                color: '#ffffff',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              B
            </button>
            <button
              type="button"
              title="Italic selection (Ctrl+I)"
              onMouseDown={(e) => {
                e.preventDefault();
                handleApplyFormatToPanel('*', '*');
              }}
              style={{
                padding: '1px 5px',
                fontSize: '10px',
                fontStyle: 'italic',
                fontWeight: 600,
                color: '#ffffff',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              I
            </button>
            <button
              type="button"
              title="Underline selection (Ctrl+U)"
              onMouseDown={(e) => {
                e.preventDefault();
                handleApplyFormatToPanel('__', '__');
              }}
              style={{
                padding: '1px 5px',
                fontSize: '10px',
                textDecoration: 'underline',
                color: '#ffffff',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              U
            </button>
            <button
              type="button"
              title="Gold color tag"
              onMouseDown={(e) => {
                e.preventDefault();
                handleApplyFormatToPanel('{color:#f59e0b}', '{/color}');
              }}
              style={{
                padding: '1px 4px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#fbbf24',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Gold
            </button>
            <button
              type="button"
              title="Yellow highlight marker"
              onMouseDown={(e) => {
                e.preventDefault();
                handleApplyFormatToPanel('{highlight:#fef08a}', '{/highlight}');
              }}
              style={{
                padding: '1px 4px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#000000',
                background: '#fef08a',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Mark
            </button>
          </div>
        </div>
        <textarea
          ref={panelTextareaRef}
          value={element.text || ''}
          onChange={(e) => {
            const next = e.target.value;
            // Clear any active canvas inline editor so canvas TextNode renders cleanly and doesn't conflict
            setEditingTextElementId(null);
            updateTextElement(activeSpreadId, element.id, { text: next }, true);
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
              e.preventDefault();
              handleApplyFormatToPanel('**', '**');
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
              e.preventDefault();
              handleApplyFormatToPanel('*', '*');
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
              e.preventDefault();
              handleApplyFormatToPanel('__', '__');
            }
          }}
          onBlur={() => {
            const currentAlbum = useAlbumStore.getState().currentAlbum;
            if (currentAlbum) useHistoryStore.getState().pushState(currentAlbum);
          }}
          placeholder="Enter album text or **rich markup**..."
          rows={3}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            background: 'var(--color-surface-raised, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            color: 'var(--color-text-primary, #f8fafc)',
            resize: 'vertical',
            outline: 'none',
            fontFamily: style.fontFamily || 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 2. Quick Presets */}
      <div>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
          Style Presets
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
          {(Object.keys(TEXT_PRESETS) as TextPresetKey[]).map((key) => {
            const p = TEXT_PRESETS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                style={{
                  padding: '5px 4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  background: 'var(--color-surface-raised, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--color-text-secondary, #cbd5e1)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={p.description}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Font Family Selector */}
      <div>
        <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.5px' }}>
          Font Family
        </label>
        <select
          value={style.fontFamily}
          onChange={(e) => handleUpdateStyle({ fontFamily: e.target.value })}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: '4px',
            background: 'var(--color-surface-raised, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            color: 'var(--color-text-primary, #f8fafc)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {ALBUM_FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Font Size Slider & Direct Input Field */}
      <div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
            Size
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="range"
            min={1}
            max={120}
            step={1}
            value={style.fontSize || 24}
            onChange={(e) => handleUpdateStyle({ fontSize: Math.max(1, Number(e.target.value)) }, true)}
            onPointerUp={() => {
              const currentAlbum = useAlbumStore.getState().currentAlbum;
              if (currentAlbum) useHistoryStore.getState().pushState(currentAlbum);
            }}
            style={{ flex: 1, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="text"
              inputMode="numeric"
              value={style.fontSize || 24}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return;
                const val = parseInt(raw, 10);
                if (Number.isFinite(val)) {
                  handleUpdateStyle({ fontSize: Math.max(1, Math.min(200, val)) });
                }
              }}
              style={{
                width: '44px',
                padding: '4px 6px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                background: 'var(--color-surface-raised, #1e293b)',
                border: '1px solid var(--color-border, #334155)',
                color: 'var(--color-text-primary, #f8fafc)',
                textAlign: 'center',
                outline: 'none',
              }}
              title="Type font size (1 - 200 pt)"
            />
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>pt</span>
          </div>
        </div>
      </div>

      {/* 5. Typography Formatting & Alignment Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Style Buttons (B, I, U) */}
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
            Formatting
          </span>
          <div style={{ display: 'inline-flex', borderRadius: '5px', background: 'var(--color-surface-raised, #1e293b)', padding: '2px', border: '1px solid var(--color-border, #334155)', gap: '2px' }}>
            <button
              type="button"
              onClick={() => handleUpdateStyle({ fontWeight: isBold ? 'normal' : 'bold' })}
              style={{
                width: '32px',
                height: '26px',
                borderRadius: '3px',
                fontWeight: 700,
                fontSize: '12px',
                background: isBold ? 'var(--color-accent, #3b82f6)' : 'transparent',
                color: isBold ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => handleUpdateStyle({ fontStyle: isItalic ? 'normal' : 'italic' })}
              style={{
                width: '32px',
                height: '26px',
                borderRadius: '3px',
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: '12px',
                background: isItalic ? 'var(--color-accent, #3b82f6)' : 'transparent',
                color: isItalic ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => handleUpdateStyle({ textDecoration: isUnderline ? 'none' : 'underline' })}
              style={{
                width: '32px',
                height: '26px',
                borderRadius: '3px',
                textDecoration: 'underline',
                fontWeight: 600,
                fontSize: '12px',
                background: isUnderline ? 'var(--color-accent, #3b82f6)' : 'transparent',
                color: isUnderline ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Underline (Ctrl+U)"
            >
              U
            </button>
          </div>
        </div>

        {/* Alignment Grid: Horizontal & Vertical side-by-side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Horizontal Alignment */}
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
              Horizontal
            </span>
            <div style={{ display: 'flex', borderRadius: '5px', background: 'var(--color-surface-raised, #1e293b)', padding: '2px', border: '1px solid var(--color-border, #334155)', gap: '2px', justifyContent: 'space-between' }}>
              {/* Left */}
              <button
                type="button"
                onClick={() => handleUpdateStyle({ align: 'left' })}
                style={{
                  flex: 1,
                  height: '26px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: style.align === 'left' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                  color: style.align === 'left' ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Align Left"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="17" y1="10" x2="3" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="17" y1="18" x2="3" y2="18" />
                </svg>
              </button>
              {/* Center */}
              <button
                type="button"
                onClick={() => handleUpdateStyle({ align: 'center' })}
                style={{
                  flex: 1,
                  height: '26px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: style.align === 'center' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                  color: style.align === 'center' ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Align Center"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="10" x2="6" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="18" y1="18" x2="6" y2="18" />
                </svg>
              </button>
              {/* Right */}
              <button
                type="button"
                onClick={() => handleUpdateStyle({ align: 'right' })}
                style={{
                  flex: 1,
                  height: '26px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: style.align === 'right' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                  color: style.align === 'right' ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Align Right"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="21" y1="10" x2="7" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="21" y1="18" x2="7" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Vertical Alignment */}
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
              Vertical
            </span>
            <div style={{ display: 'flex', borderRadius: '5px', background: 'var(--color-surface-raised, #1e293b)', padding: '2px', border: '1px solid var(--color-border, #334155)', gap: '2px', justifyContent: 'space-between' }}>
              {/* Top */}
              <button
                type="button"
                onClick={() => handleUpdateStyle({ verticalAlign: 'top' })}
                style={{
                  flex: 1,
                  height: '26px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: style.verticalAlign === 'top' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                  color: style.verticalAlign === 'top' ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Align Top"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="20" y2="4" />
                  <rect x="7" y="9" width="10" height="9" rx="1" />
                </svg>
              </button>
              {/* Middle */}
              <button
                type="button"
                onClick={() => handleUpdateStyle({ verticalAlign: 'middle' })}
                style={{
                  flex: 1,
                  height: '26px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: (!style.verticalAlign || style.verticalAlign === 'middle') ? 'var(--color-accent, #3b82f6)' : 'transparent',
                  color: (!style.verticalAlign || style.verticalAlign === 'middle') ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Align Middle (Center Vertically)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <rect x="7" y="7.5" width="10" height="9" rx="1" />
                </svg>
              </button>
              {/* Bottom */}
              <button
                type="button"
                onClick={() => handleUpdateStyle({ verticalAlign: 'bottom' })}
                style={{
                  flex: 1,
                  height: '26px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: style.verticalAlign === 'bottom' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                  color: style.verticalAlign === 'bottom' ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Align Bottom"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="4" y1="20" x2="20" y2="20" />
                  <rect x="7" y="6" width="10" height="9" rx="1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Text Color Swatches & Picker */}
      <div>
        <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
          Text Color
        </label>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
          {COMMON_TEXT_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => handleUpdateStyle({ fill: hex })}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: hex,
                border: style.fill?.toLowerCase() === hex.toLowerCase() ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                padding: 0,
                outline: 'none',
              }}
              title={hex}
            />
          ))}
        </div>
        <ColorPicker
          value={style.fill || '#1e293b'}
          onChange={(newColor) => handleUpdateStyle({ fill: newColor })}
          label="Custom Color"
        />
      </div>

      {/* 7. Advanced Spacing: Line Height & Tracking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>
            Line Height
          </label>
          <input
            type="number"
            min={0.8}
            max={3.0}
            step={0.1}
            value={style.lineHeight || 1.3}
            onChange={(e) => handleUpdateStyle({ lineHeight: Number(e.target.value) || 1.3 })}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: '11px',
              borderRadius: '4px',
              background: 'var(--color-surface-raised, #1e293b)',
              border: '1px solid var(--color-border, #334155)',
              color: 'var(--color-text-primary, #f8fafc)',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>
            Letter Spacing
          </label>
          <input
            type="number"
            min={-2}
            max={20}
            step={0.5}
            value={style.letterSpacing || 0}
            onChange={(e) => handleUpdateStyle({ letterSpacing: Number(e.target.value) || 0 })}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: '11px',
              borderRadius: '4px',
              background: 'var(--color-surface-raised, #1e293b)',
              border: '1px solid var(--color-border, #334155)',
              color: 'var(--color-text-primary, #f8fafc)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
