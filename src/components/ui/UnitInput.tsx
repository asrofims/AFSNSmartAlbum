import React, { useState, useEffect } from 'react';
import styles from './UnitInput.module.css';

interface UnitInputProps {
  value: number;
  unit: string;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: string) => void;
  units: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function UnitInput({
  value,
  unit,
  onValueChange,
  onUnitChange,
  units,
  min,
  max,
  step = 1,
  label,
  disabled,
  className = ''
}: UnitInputProps) {
  const [localValue, setLocalValue] = useState<string>(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    let numVal = parseFloat(localValue);
    if (isNaN(numVal)) {
      numVal = value;
    }
    
    if (min !== undefined && numVal < min) numVal = min;
    if (max !== undefined && numVal > max) numVal = max;
    
    setLocalValue(numVal.toString());
    if (numVal !== value) {
      onValueChange(numVal);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const numVal = parseFloat(localValue) || 0;
      const nextVal = numVal + step;
      const finalVal = max !== undefined ? Math.min(max, nextVal) : nextVal;
      setLocalValue(finalVal.toString());
      onValueChange(finalVal);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const numVal = parseFloat(localValue) || 0;
      const nextVal = numVal - step;
      const finalVal = min !== undefined ? Math.max(min, nextVal) : nextVal;
      setLocalValue(finalVal.toString());
      onValueChange(finalVal);
    }
  };

  return (
    <div className={`${styles.wrapper} ${className} ${disabled ? styles.disabled : ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.group}>
        <input
          type="number"
          className={styles.input}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
        />
        <select
          className={styles.select}
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          disabled={disabled}
        >
          {units.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
