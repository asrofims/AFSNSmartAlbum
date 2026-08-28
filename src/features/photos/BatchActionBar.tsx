import { useState } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import styles from './BatchActionBar.module.css';

export function BatchActionBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    selectedPhotoIds,
    folders,
    activeFolderId,
    photos,
    clearSelection,
    batchDeleteSelected,
    batchToggleFavoritesSelected,
    addPhotosToFolder,
    movePhotosToFolder,
    removePhotosFromFolder,
    copySelectedPhotos,
  } = usePhotoStore();

  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [folderAction, setFolderAction] = useState<'move' | 'copy'>('copy');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Show batch toolbar when 2 or more photos are selected (Lightroom style)
  if (!currentProject || selectedPhotoIds.length < 2) return null;

  const count = selectedPhotoIds.length;
  const selectedPhotos = photos.filter((p) => selectedPhotoIds.includes(p.id));
  const allFav = selectedPhotos.length > 0 && selectedPhotos.every((p) => p.isFavorite);

  const handleConfirmBatchDelete = async () => {
    setIsDeleting(true);
    try {
      await batchDeleteSelected(currentProject.id);
      setIsConfirmDeleteOpen(false);
    } catch (err) {
      console.error('Batch delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFav = async () => {
    await batchToggleFavoritesSelected(!allFav);
  };

  const handleFolderTargetSelect = async (targetFolderId: string) => {
    setIsFolderMenuOpen(false);
    if (folderAction === 'move' && activeFolderId) {
      await movePhotosToFolder(currentProject.id, activeFolderId, targetFolderId, selectedPhotoIds);
    } else {
      await addPhotosToFolder(currentProject.id, targetFolderId, selectedPhotoIds);
    }
  };

  const handleRemoveFromCurrentFolder = async () => {
    if (!activeFolderId) return;
    setIsFolderMenuOpen(false);
    await removePhotosFromFolder(currentProject.id, activeFolderId, selectedPhotoIds);
  };

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.leftInfo}>
          <span className={styles.countBadge}>{count}</span>
          <span className={styles.title}>{count} Photos Selected</span>
          <button
            type="button"
            className={styles.deselectBtn}
            onClick={clearSelection}
            title="Clear selection (Esc or Ctrl+D)"
          >
            ✕ Deselect
          </button>
        </div>

        <div className={styles.actionsGroup}>
          {/* Favorite All */}
          <button
            type="button"
            className={`${styles.actionBtn} ${allFav ? styles.activeFav : ''}`}
            onClick={handleToggleFav}
            title={allFav ? 'Remove all from favorites' : 'Mark all selected as favorites'}
          >
            ★ {allFav ? 'Favorited' : 'Favorite'}
          </button>

          {/* Copy to Clipboard */}
          <button
            type="button"
            className={styles.actionBtn}
            onClick={copySelectedPhotos}
            title="Copy selected photos to clipboard (Ctrl+C)"
          >
            📋 Copy
          </button>

          {/* Add / Move to Folder Dropdown */}
          {folders.length > 0 && (
            <div className={styles.dropdownContainer}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                title="Organize selected photos into a folder"
              >
                📂 To Folder ▾
              </button>

              {isFolderMenuOpen && (
                <div className={styles.dropdownMenu}>
                  <div className={styles.menuHeader}>
                    <button
                      type="button"
                      className={`${styles.modeToggle} ${folderAction === 'copy' ? styles.modeActive : ''}`}
                      onClick={() => setFolderAction('copy')}
                    >
                      Copy to...
                    </button>
                    {activeFolderId && (
                      <button
                        type="button"
                        className={`${styles.modeToggle} ${folderAction === 'move' ? styles.modeActive : ''}`}
                        onClick={() => setFolderAction('move')}
                      >
                        Move to...
                      </button>
                    )}
                  </div>

                  <div className={styles.menuDivider} />

                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={styles.menuItem}
                      onClick={() => handleFolderTargetSelect(f.id)}
                    >
                      📂 {f.name}
                    </button>
                  ))}

                  {activeFolderId && (
                    <>
                      <div className={styles.menuDivider} />
                      <button
                        type="button"
                        className={`${styles.menuItem} ${styles.menuItemDanger}`}
                        onClick={handleRemoveFromCurrentFolder}
                      >
                        Remove from this folder
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delete Selected */}
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={() => setIsConfirmDeleteOpen(true)}
            title="Delete selected photos (Del)"
          >
            🗑 Delete ({count})
          </button>
        </div>
      </div>

      {/* Modern Confirm Dialog for Batch Photo Deletion */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title={`Delete ${count} Selected Photos?`}
        message={`Are you sure you want to delete ${count} photos from the project library?`}
        detail="The photos will be removed from your album project. The original image files on your drive will remain intact."
        confirmText={`Delete ${count} Photos`}
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmBatchDelete}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </>
  );
}
