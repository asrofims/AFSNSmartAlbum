
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  label,
  disabled,
  placeholder,
  className = ''
}: SelectProps) {
  return (
    <div className={`${styles.wrapper} ${className} ${disabled ? styles.disabled : ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {placeholder && <option value="" disabled hidden>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
