import React, { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dialog.module.css';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  height?: number;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 480,
  height,
  className = '',
  bodyClassName = '',
  noPadding = false,
  closeOnOverlayClick = false, // Default false: user must explicitly click the close button
  closeOnEscape = true,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === overlayRef.current) {
      onClose();
    }
  };

  return createPortal(
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div
        className={`${styles.dialog} ${className}`.trim()}
        style={{
          width: `${width}px`,
          ...(height ? { height: `${height}px` } : {}),
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className={styles.header}>
          <h2 id="dialog-title" className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close dialog" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div
          className={`${styles.body} ${bodyClassName}`.trim()}
          style={noPadding ? { padding: 0, overflow: 'hidden' } : undefined}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
