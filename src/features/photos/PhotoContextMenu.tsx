import React, { useEffect, useRef } from 'react';
import { Photo, PhotoFolder, formatFileSize } from '../../domain/photo';
import styles from './PhotoContextMenu.module.css';

export interface PhotoContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  targetPhoto: Photo;
  selectedPhotos: Photo[];
  folders: PhotoFolder[];
  activeFolderId: string | null;
  onClose: () => void;
  onToggleFavorite: (photoId: string) => void;
  onBatchToggleFavorite: (isFavorite: boolean) => void;
  onAddToFolder: (folderId: string, photoIds: string[]) => void;
  onMoveToFolder: (fromFolderId: string, toFolderId: string, photoIds: string[]) => void;
  onRemoveFromFolder: (folderId: string, photoIds: string[]) => void;
  onRequestDelete: (photoIds: string[], photoNames: string) => void;
  onSelectAll: () => void;
}

export const PhotoContextMenu: React.FC<PhotoContextMenuProps> = ({
  isOpen,
  x,
  y,
  targetPhoto,
  selectedPhotos,
  folders,
  activeFolderId,
  onClose,
  onToggleFavorite,
  onBatchToggleFavorite,
  onAddToFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onRequestDelete,
  onSelectAll,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [folderSubmenuMode, setFolderSubmenuMode] = React.useState<'copy' | 'move' | null>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('mousedown', handleGlobalClick);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMulti = selectedPhotos.length > 1 && selectedPhotos.some((p) => p.id === targetPhoto.id);
  const photoIds = isMulti ? selectedPhotos.map((p) => p.id) : [targetPhoto.id];
  const count = photoIds.length;

  const allFav = isMulti
    ? selectedPhotos.every((p) => p.isFavorite)
    : targetPhoto.isFavorite;

  // Position adjustment to avoid viewport overflowing
  const menuWidth = 200;
  const menuHeight = 260;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.headerTitle}>
        <span className={styles.fileName}>
          {isMulti ? `${count} Photos Selected` : targetPhoto.fileName}
        </span>
        <span className={styles.fileMeta}>
          {targetPhoto.width}×{targetPhoto.height} • {formatFileSize(targetPhoto.fileSize)}
        </span>
      </div>

      <div className={styles.divider} />

      {/* Favorite Toggle */}
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          onClose();
          if (isMulti) {
            onBatchToggleFavorite(!allFav);
          } else {
            onToggleFavorite(targetPhoto.id);
          }
        }}
      >
        <span className={styles.menuIcon}>{allFav ? '★' : '☆'}</span>
        <span>{allFav ? 'Remove from Favorites' : 'Mark as Favorite'}</span>
      </button>

      {/* Folders Management */}
      {folders.length > 0 && (
        <div
          className={styles.submenuContainer}
          onMouseEnter={() => setFolderSubmenuMode('copy')}
          onMouseLeave={() => setFolderSubmenuMode(null)}
        >
          <button type="button" className={styles.menuItem}>
            <span className={styles.menuIcon}>📂</span>
            <span>Add to Folder</span>
            <span className={styles.submenuArrow}>▸</span>
          </button>

          {folderSubmenuMode === 'copy' && (
            <div className={styles.submenu}>
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    onClose();
                    onAddToFolder(f.id, photoIds);
                  }}
                >
                  <span className={styles.menuIcon}>📁</span>
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Move to folder (if in a folder) */}
      {activeFolderId && folders.length > 1 && (
        <div
          className={styles.submenuContainer}
          onMouseEnter={() => setFolderSubmenuMode('move')}
          onMouseLeave={() => setFolderSubmenuMode(null)}
        >
          <button type="button" className={styles.menuItem}>
            <span className={styles.menuIcon}>↗</span>
            <span>Move to Folder</span>
            <span className={styles.submenuArrow}>▸</span>
          </button>

          {folderSubmenuMode === 'move' && (
            <div className={styles.submenu}>
              {folders.filter((f) => f.id !== activeFolderId).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    onClose();
                    onMoveToFolder(activeFolderId, f.id, photoIds);
                  }}
                >
                  <span className={styles.menuIcon}>📁</span>
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove from folder option if viewing folder */}
      {activeFolderId && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onRemoveFromFolder(activeFolderId, photoIds);
          }}
        >
          <span className={styles.menuIcon}>✕</span>
          <span>Remove from this folder</span>
        </button>
      )}

      <div className={styles.divider} />

      {/* Select All */}
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          onClose();
          onSelectAll();
        }}
      >
        <span className={styles.menuIcon}>✓</span>
        <span>Select All (Ctrl+A)</span>
      </button>

      <div className={styles.divider} />

      {/* Delete from Library */}
      <button
        type="button"
        className={`${styles.menuItem} ${styles.menuItemDanger}`}
        onClick={() => {
          onClose();
          const names = isMulti ? `${count} photos` : targetPhoto.fileName;
          onRequestDelete(photoIds, names);
        }}
      >
        <span className={styles.menuIcon}>🗑</span>
        <span>{isMulti ? `Delete ${count} Photos` : 'Delete Photo'}</span>
      </button>
    </div>
  );
};
