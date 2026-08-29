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

export function ContextMenu({ isOpen, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x, y });

  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenuId(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      <div
        ref={menuRef}
        className={styles.menu}
        style={{ left: menuPos.x, top: menuPos.y }}
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

          const hasSubmenu = Boolean(item.children && item.children.length > 0);
          const isSubmenuOpen = activeSubmenuId === item.id;

          return (
            <div
              key={item.id || `item-${idx}`}
              className={styles.itemWrapper}
              onMouseEnter={() => {
                if (hasSubmenu) {
                  setActiveSubmenuId(item.id);
                } else {
                  setActiveSubmenuId(null);
                }
              }}
            >
              <button
                type="button"
                className={`${styles.menuItem} ${item.disabled ? styles.disabled : ''} ${item.danger ? styles.danger : ''} ${isSubmenuOpen ? styles.menuItemActive : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  if (hasSubmenu) {
                    setActiveSubmenuId(isSubmenuOpen ? null : item.id);
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

              {/* Cascading Submenu */}
              {hasSubmenu && isSubmenuOpen && (
                <div
                  className={`${styles.submenu} ${
                    menuPos.x + 220 + 220 > window.innerWidth ? styles.submenuLeft : ''
                  }`}
                >
                  {item.children!.map((subItem, subIdx) => {
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
        })}
      </div>
    </div>
  );
}
