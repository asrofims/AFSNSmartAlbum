import React, { useState, useRef, useEffect } from 'react';
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
  '#FFFFFF', '#F5F5F0', '#E8E4DE', '#D4CFC6', '#C0C0C0', '#808080', 
  '#404040', '#1A1A1A', '#000000', '#F5E6D3', '#E8D5B7', '#2C1810'
];

export function ColorPicker({
  value,
  onChange,
  label,
  presetColors = DEFAULT_PRESETS,
  disabled,
  className = ''
}: ColorPickerProps) {
  const [localHex, setLocalHex] = useState(value);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalHex(value);
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalHex(e.target.value);
  };

  const handleHexBlur = () => {
    const hexRegex = /^#([0-9A-Fa-f]{3}){1,2}$/i;
    if (hexRegex.test(localHex)) {
      let normalizedHex = localHex;
      if (localHex.length === 4) {
        normalizedHex = '#' + localHex[1]+localHex[1] + localHex[2]+localHex[2] + localHex[3]+localHex[3];
      }
      onChange(normalizedHex.toUpperCase());
      setLocalHex(normalizedHex.toUpperCase());
    } else {
      setLocalHex(value);
    }
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleHexBlur();
    }
  };

  const triggerColorPicker = () => {
    if (!disabled && colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  return (
    <div className={`${styles.wrapper} ${className} ${disabled ? styles.disabled : ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.mainRow}>
        <div 
          className={styles.swatch} 
          style={{ backgroundColor: value }}
          onClick={triggerColorPicker}
        />
        <input 
          ref={colorInputRef}
          type="color" 
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={styles.hiddenInput}
          disabled={disabled}
        />
        <input
          type="text"
          className={styles.hexInput}
          value={localHex}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          onKeyDown={handleHexKeyDown}
          disabled={disabled}
        />
      </div>
      {presetColors && presetColors.length > 0 && (
        <div className={styles.presetGrid}>
          {presetColors.map((color, idx) => (
            <div
              key={idx}
              className={`${styles.presetSwatch} ${color.toUpperCase() === value.toUpperCase() ? styles.presetActive : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => {
                if (!disabled) onChange(color.toUpperCase());
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
