import styles from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: SwitchProps) {
  return (
    <label
      className={`${styles.switchLabel} ${disabled ? styles.disabled : ''} ${size === 'sm' ? styles.small : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`${styles.track} ${checked ? styles.checked : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <div className={styles.thumb} />
      </div>
      {label && <span className={styles.text}>{label}</span>}
    </label>
  );
}
