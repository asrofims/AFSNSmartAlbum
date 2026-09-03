import React, { useState, useEffect, useRef } from 'react';
import styles from './NumberInput.module.css';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label?: string;
  disabled?: boolean;
  suffix?: string;
  className?: string;
}

function formatNumber(val: number, precision?: number): string {
  if (isNaN(val) || !isFinite(val)) return '0';
  if (precision !== undefined) {
    return Number(val.toFixed(precision)).toString();
  }
  // Default clean floating-point display: round to 2 decimal places maximum, avoiding 124.5829104
  return Number((Math.round(val * 100) / 100).toFixed(2)).toString();
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision,
  label,
  disabled,
  suffix,
  className = '',
}: NumberInputProps) {
  const [localValue, setLocalValue] = useState<string>(() => formatNumber(value, precision));
  const isFocusedRef = useRef(false);

  // Sync from props only when NOT focused (avoids cursor jumping & typing overwrites)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(formatNumber(value, precision));
    }
  }, [value, precision]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);

    // When user deletes everything (empty string), immediately treat as 0
    if (raw.trim() === '') {
      onChange(0);
      return;
    }

    // If valid number, notify parent immediately so live preview updates in real-time
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && isFinite(parsed)) {
      if ((min === undefined || parsed >= min) && (max === undefined || parsed <= max)) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (localValue.trim() === '') {
      const formatted = formatNumber(0, precision);
      setLocalValue(formatted);
      onChange(0);
      return;
    }

    let numVal = parseFloat(localValue);

    if (isNaN(numVal)) {
      numVal = 0;
    }

    if (min !== undefined && numVal < min) numVal = min;
    if (max !== undefined && numVal > max) numVal = max;

    const formatted = formatNumber(numVal, precision);
    const finalNum = parseFloat(formatted);

    setLocalValue(formatted);
    if (finalNum !== value) {
      onChange(finalNum);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseFloat(localValue) || 0;
      const next = current + step;
      const clamped = max !== undefined ? Math.min(max, next) : next;
      const formatted = formatNumber(clamped, precision);
      setLocalValue(formatted);
      onChange(parseFloat(formatted));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseFloat(localValue) || 0;
      const next = current - step;
      const clamped = min !== undefined ? Math.max(min, next) : next;
      const formatted = formatNumber(clamped, precision);
      setLocalValue(formatted);
      onChange(parseFloat(formatted));
    }
  };

  return (
    <div className={`${styles.wrapper} ${className} ${disabled ? styles.disabled : ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputContainer}>
        <input
          type="text"
          inputMode="decimal"
          className={styles.input}
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </div>
  );
}
