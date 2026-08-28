import React, { useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string | React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  header?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ isOpen, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || items.length === 0) return null;

  // Screen overflow boundary prevention
  const menuWidth = 220;
  const menuHeight = items.length * 32 + 20;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        className={styles.menu}
        style={{ left: Math.max(10, adjustedX), top: Math.max(10, adjustedY) }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, idx) => {
          if (item.divider) {
            return <div key={`div-${idx}`} className={styles.divider} />;
          }

          if (item.header) {
            return (
              <div key={`head-${idx}`} className={styles.sectionHeader}>
                {item.label}
              </div>
            );
          }

          return (
            <button
              key={item.id || `item-${idx}`}
              type="button"
              className={`${styles.menuItem} ${item.disabled ? styles.disabled : ''} ${item.danger ? styles.danger : ''}`}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled && item.onClick) {
                  item.onClick();
                  onClose();
                }
              }}
            >
              <div className={styles.itemLeft}>
                {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
                <span className={styles.itemLabel}>{item.label}</span>
              </div>
              {item.shortcut && <span className={styles.itemShortcut}>{item.shortcut}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
