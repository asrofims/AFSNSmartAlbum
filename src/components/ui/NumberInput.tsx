import React, { useState, useEffect, useRef } from 'react';
import styles from './NumberInput.module.css';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  suffix?: string;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  disabled,
  suffix,
  className = '',
}: NumberInputProps) {
  const [localValue, setLocalValue] = useState<string>(value.toString());
  const isFocusedRef = useRef(false);

  // Sync from props only when NOT focused (avoids cursor jumping & typing overwrites)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);

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
    let numVal = parseFloat(localValue);

    if (isNaN(numVal)) {
      numVal = min !== undefined ? min : value;
    }

    if (min !== undefined && numVal < min) numVal = min;
    if (max !== undefined && numVal > max) numVal = max;

    // Clean floating point rounding
    numVal = Math.round(numVal * 100) / 100;

    setLocalValue(numVal.toString());
    onChange(numVal);
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
      const next = Math.round((current + step) * 100) / 100;
      const clamped = max !== undefined ? Math.min(max, next) : next;
      setLocalValue(clamped.toString());
      onChange(clamped);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseFloat(localValue) || 0;
      const next = Math.round((current - step) * 100) / 100;
      const clamped = min !== undefined ? Math.max(min, next) : next;
      setLocalValue(clamped.toString());
      onChange(clamped);
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
