import React, { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_PRESETS = [
  '#FFFFFF', '#F8FAFC', '#CBD5E1', '#94A3B8', '#475569', '#1E293B',
  '#0F172A', '#000000', '#B91C1C', '#D97706', '#2563EB', '#059669'
];

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const r = (parseInt(clean.slice(0, 2), 16) || 0) / 255;
  const g = (parseInt(clean.slice(2, 4), 16) || 0) / 255;
  const b = (parseInt(clean.slice(4, 6), 16) || 0) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToHex(h: number, s: number, v: number): string {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const val = Math.round((n + m) * 255);
    return Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const EYEDROPPER_CURSOR_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M3 21l3-1 9-9-2-2-9 9-1 3z M15 9l2-2 1 1-2 2z M17 7l1-1c1-1 2.5-1 3.5 0s1 2.5 0 3.5l-1 1z' fill='%23000000' stroke='%23000000' stroke-width='2' stroke-linejoin='round'/%3E%3Cpath d='M3 21l3-1 9-9-2-2-9 9-1 3z' fill='%23ffffff' stroke='%23000000' stroke-width='1.2'/%3E%3Cpath d='M15 9l2-2 1 1-2 2z' fill='%233b82f6' stroke='%23000000' stroke-width='1.2'/%3E%3Cpath d='M17 7l1-1c.8-.8 2-.8 2.8 0s.8 2 0 2.8l-1 1z' fill='%23ef4444' stroke='%23000000' stroke-width='1.2'/%3E%3Ccircle cx='2' cy='22' r='1.5' fill='%23ef4444' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E`;

export function ColorPicker({
  value,
  onChange,
  label,
  presetColors = DEFAULT_PRESETS,
  disabled,
  className = ''
}: ColorPickerProps) {
  const [localHex, setLocalHex] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const satBoxRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // HSV state for the interactive color picker panel
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#1E293B'));

  useEffect(() => {
    setLocalHex(value);
    setHsv(hexToHsv(value || '#1E293B'));
  }, [value]);

  // Dismiss popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalHex(e.target.value);
  };

  const handleHexBlur = () => {
    let clean = localHex.trim().replace('#', '');
    const hexRegex = /^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (hexRegex.test(clean)) {
      if (clean.length === 3) {
        clean = clean.split('').map((c) => c + c).join('');
      }
      const finalHex = `#${clean.toUpperCase()}`;
      onChange(finalHex);
      setLocalHex(finalHex);
      setHsv(hexToHsv(finalHex));
    } else {
      setLocalHex(value);
    }
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleHexBlur();
    }
  };

  // Interactive Saturation / Value drag
  const handleSatBoxMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !satBoxRef.current) return;
    const rect = satBoxRef.current.getBoundingClientRect();

    const updateFromPosition = (clientX: number, clientY: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const s = (x / rect.width) * 100;
      const v = (1 - y / rect.height) * 100;

      const newHsv = { ...hsv, s, v };
      setHsv(newHsv);
      const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      onChange(newHex);
      setLocalHex(newHex);
    };

    updateFromPosition(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateFromPosition(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Interactive Hue Slider drag
  const handleHueSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();

    const updateFromPosition = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const h = (x / rect.width) * 360;

      const newHsv = { ...hsv, h };
      setHsv(newHsv);
      const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      onChange(newHex);
      setLocalHex(newHex);
    };

    updateFromPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateFromPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Eyedropper tool activation
  const startEyeDropper = useCallback((e?: React.MouseEvent) => {
    if (disabled) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    setIsSampling(true);
  }, [disabled]);

  // Screen and canvas pixel sampling listener
  useEffect(() => {
    if (!isSampling) return;

    // Inject global stylesheet to enforce the eyedropper cursor over Konva canvas and all elements
    const styleEl = document.createElement('style');
    styleEl.id = 'eyedropper-global-cursor-override';
    styleEl.textContent = `
      *, *:hover, *:active, canvas, .konvajs-content, .konvajs-content * {
        cursor: url("${EYEDROPPER_CURSOR_SVG}") 2 22, crosshair !important;
      }
    `;
    document.head.appendChild(styleEl);

    const activationTime = Date.now();

    const handlePointerDown = async (e: MouseEvent | PointerEvent) => {
      // Avoid immediate trigger from the click that started eyedropper
      if (Date.now() - activationTime < 100) return;

      e.preventDefault();
      e.stopPropagation();

      let pickedColor: string | null = null;

      // 1. Primary: Native hardware-level OS pixel sampling via Tauri Rust command
      // Works over ANY canvas, photo, text, border, or screen pixel without CORS/tainting issues
      try {
        const hex = await invoke<string>('sample_screen_color');
        if (hex && typeof hex === 'string' && hex.startsWith('#')) {
          pickedColor = hex.toUpperCase();
        }
      } catch (err) {
        console.warn('Native screen sampling fallback to DOM:', err);
      }

      // 2. Secondary fallback: DOM/Canvas sampling if not running under Tauri
      if (!pickedColor) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const canvases = elements.filter((el): el is HTMLCanvasElement => el.tagName === 'CANVAS');

        for (const canvas of canvases) {
          try {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);

            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
              const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
              if (ctx) {
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const alpha = pixel[3] ?? 0;
                if (alpha > 10) {
                  pickedColor = rgbToHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0);
                  break;
                }
              }
            }
          } catch (err) {
            console.warn('Canvas pixel sampling warning:', err);
          }
        }
      }

      if (pickedColor) {
        onChange(pickedColor);
        setLocalHex(pickedColor);
        setHsv(hexToHsv(pickedColor));
      }

      setIsSampling(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsSampling(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      const existing = document.getElementById('eyedropper-global-cursor-override');
      if (existing) existing.remove();
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isSampling, onChange]);

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className} ${disabled ? styles.disabled : ''}`}>
      {label && (
        <label className={styles.label} onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
          {label}
        </label>
      )}

      {/* Main Row: Swatch, Hex Code, and Eyedropper Button */}
      <div className={styles.mainRow}>
        <button
          type="button"
          className={styles.swatchBtn}
          style={{ backgroundColor: value || '#1E293B' }}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          title="Click to open color picker panel"
        />
        <div className={styles.hexInputWrapper}>
          <span className={styles.hashSymbol}>#</span>
          <input
            type="text"
            className={styles.hexInput}
            value={localHex.replace('#', '')}
            onChange={handleHexChange}
            onBlur={handleHexBlur}
            onKeyDown={handleHexKeyDown}
            disabled={disabled}
            placeholder="000000"
            maxLength={6}
          />
        </div>
        <button
          type="button"
          className={`${styles.eyedropperBtn} ${isSampling ? styles.eyedropperActive : ''}`}
          onClick={startEyeDropper}
          disabled={disabled}
          title="Pick color from canvas (Eyedropper)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 22 1-1h3l9-9" />
            <path d="M3 21v-3l9-9" />
            <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
          </svg>
        </button>
      </div>

      {/* Preset Palette: Tidy, spaced 6x2 grid */}
      {presetColors && presetColors.length > 0 && (
        <div className={styles.presetSection}>
          <div className={styles.presetGrid}>
            {presetColors.map((color, idx) => (
              <button
                key={idx}
                type="button"
                className={`${styles.presetSwatch} ${color.toUpperCase() === value.toUpperCase() ? styles.presetActive : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  if (!disabled) {
                    onChange(color.toUpperCase());
                    setLocalHex(color.toUpperCase());
                    setHsv(hexToHsv(color.toUpperCase()));
                  }
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Interactive Popover Panel */}
      {isOpen && (
        <div className={styles.popover}>
          {/* Saturation / Brightness 2D Box */}
          <div
            ref={satBoxRef}
            className={styles.saturationBox}
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`
            }}
            onMouseDown={handleSatBoxMouseDown}
          >
            <div
              className={styles.saturationThumb}
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                backgroundColor: value || '#1E293B'
              }}
            />
          </div>

          {/* Hue Slider */}
          <div
            ref={hueSliderRef}
            className={styles.hueSlider}
            onMouseDown={handleHueSliderMouseDown}
          >
            <div
              className={styles.hueThumb}
              style={{
                left: `${(hsv.h / 360) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Active Sampling Notification Badge */}
      {isSampling && (
        <div className={styles.samplingHud}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Click anywhere on canvas to pick color · Esc to cancel</span>
        </div>
      )}
    </div>
  );
}
