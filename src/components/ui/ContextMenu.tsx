import React, { useEffect, useRef, useState } from 'react';
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
  children?: ContextMenuItem[];
  onClick?: () => void;
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

interface FloatingSubmenuState {
  id: string;
  items: ContextMenuItem[];
  top: number;
  left: number;
}

export function ContextMenu({ isOpen, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [floatingSubmenu, setFloatingSubmenu] = useState<FloatingSubmenuState | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x, y });
  const closeSubmenuTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeSubmenuTimerRef.current) {
      clearTimeout(closeSubmenuTimerRef.current);
      closeSubmenuTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setFloatingSubmenu(null);
      clearCloseTimer();
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearCloseTimer();
    };
  }, [isOpen, onClose]);

  // Viewport boundary adjustment after DOM mount
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 12;

    let targetX = x;
    let targetY = y;

    if (x + rect.width > window.innerWidth - padding) {
      targetX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (y + rect.height > window.innerHeight - padding) {
      targetY = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setMenuPos({ x: targetX, y: targetY });
  }, [isOpen, x, y, items]);

  const handleItemMouseEnter = (item: ContextMenuItem, element: HTMLElement) => {
    clearCloseTimer();
    if (item.children && item.children.length > 0) {
      const rect = element.getBoundingClientRect();
      const submenuWidth = 220;
      const submenuHeight = item.children.length * 32 + 16;
      const isNearRight = rect.right + submenuWidth + 12 > window.innerWidth;

      const left = isNearRight
        ? Math.max(10, rect.left - submenuWidth - 4)
        : rect.right + 4;

      const top = Math.max(
        10,
        Math.min(rect.top - 4, window.innerHeight - submenuHeight - 12)
      );

      setFloatingSubmenu({
        id: item.id,
        items: item.children,
        top,
        left,
      });
    } else {
      setFloatingSubmenu(null);
    }
  };

  const handleMenuMouseLeave = () => {
    clearCloseTimer();
    closeSubmenuTimerRef.current = window.setTimeout(() => {
      setFloatingSubmenu(null);
    }, 250);
  };

  if (!isOpen || items.length === 0) return null;

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
      {/* Primary Menu Panel */}
      <div
        ref={menuRef}
        className={styles.menu}
        style={{ left: menuPos.x, top: menuPos.y }}
        onClick={(e) => e.stopPropagation()}
        onMouseLeave={handleMenuMouseLeave}
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

          const hasSubmenu = Boolean(item.children && item.children.length > 0);
          const isSubmenuOpen = floatingSubmenu?.id === item.id;

          return (
            <button
              key={item.id || `item-${idx}`}
              type="button"
              className={`${styles.menuItem} ${item.disabled ? styles.disabled : ''} ${item.danger ? styles.danger : ''} ${isSubmenuOpen ? styles.menuItemActive : ''}`}
              disabled={item.disabled}
              onMouseEnter={(e) => handleItemMouseEnter(item, e.currentTarget)}
              onClick={() => {
                if (hasSubmenu) {
                  return;
                }
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
              <div className={styles.itemRight}>
                {item.shortcut && <span className={styles.itemShortcut}>{item.shortcut}</span>}
                {hasSubmenu && <span className={styles.chevron}>›</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Independent Floating Flyout Submenu Panel */}
      {floatingSubmenu && (
        <div
          className={styles.submenu}
          style={{ top: floatingSubmenu.top, left: floatingSubmenu.left }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={handleMenuMouseLeave}
        >
          {floatingSubmenu.items.map((subItem, subIdx) => {
            if (subItem.divider) {
              return <div key={`subdiv-${subIdx}`} className={styles.divider} />;
            }
            if (subItem.header) {
              return (
                <div key={`subhead-${subIdx}`} className={styles.sectionHeader}>
                  {subItem.label}
                </div>
              );
            }
            return (
              <button
                key={subItem.id || `sub-${subIdx}`}
                type="button"
                className={`${styles.menuItem} ${subItem.disabled ? styles.disabled : ''} ${subItem.danger ? styles.danger : ''}`}
                disabled={subItem.disabled}
                onClick={() => {
                  if (!subItem.disabled && subItem.onClick) {
                    subItem.onClick();
                    onClose();
                  }
                }}
              >
                <div className={styles.itemLeft}>
                  {subItem.icon && <span className={styles.itemIcon}>{subItem.icon}</span>}
                  <span className={styles.itemLabel}>{subItem.label}</span>
                </div>
                {subItem.shortcut && <span className={styles.itemShortcut}>{subItem.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
