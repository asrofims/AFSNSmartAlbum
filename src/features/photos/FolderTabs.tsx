import React, { useState, useEffect } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { PhotoFolder } from '../../domain/photo';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import styles from './FolderTabs.module.css';

export function FolderTabs() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    photos,
    folders,
    activeFolderId,
    selectedPhotoIds,
    setActiveFolder,
    addPhotosToFolder,
    deleteFolder,
    openCreateFolderDialog,
    openRenameFolderDialog,
  } = usePhotoStore();

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [menuOpenFolderId, setMenuOpenFolderId] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<PhotoFolder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpenFolderId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!currentProject) return null;

  const totalPhotoCount = photos.length;

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    // If dragged from internal photo selection
    if (selectedPhotoIds.length > 0) {
      await addPhotosToFolder(currentProject.id, folderId, selectedPhotoIds);
    }
  };

  const handleDeleteRequest = (e: React.MouseEvent, folder: PhotoFolder) => {
    e.stopPropagation();
    setMenuOpenFolderId(null);
    setFolderToDelete(folder);
  };

  const handleConfirmDelete = async () => {
    if (!folderToDelete) return;
    setIsDeleting(true);
    try {
      await deleteFolder(currentProject.id, folderToDelete.id);
      setFolderToDelete(null);
    } catch (err) {
      console.error('Delete folder error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = (e: React.MouseEvent, folder: PhotoFolder) => {
    e.stopPropagation();
    setMenuOpenFolderId(null);
    openRenameFolderDialog(folder);
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenFolderId(folderId);
  };

  return (
    <>
      {/* Backdrop overlay for reliable outside click dismissal */}
      {menuOpenFolderId && (
        <div
          className={styles.backdrop}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenFolderId(null);
          }}
        />
      )}

      <div className={styles.container}>
        {/* Tab: All Photos */}
        <button
          type="button"
          className={`${styles.tab} ${activeFolderId === null ? styles.tabActive : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setActiveFolder(null);
            setMenuOpenFolderId(null);
          }}
          title="Show all project photos"
        >
          <span className={styles.folderIcon}>📁</span>
          <span className={styles.tabName}>All Photos</span>
          <span className={styles.tabCount}>{totalPhotoCount}</span>
        </button>

        {/* Custom Folder Tabs */}
        {folders.map((folder) => {
          const isActive = activeFolderId === folder.id;
          const isDragOver = dragOverFolderId === folder.id;
          const isMenuOpen = menuOpenFolderId === folder.id;

          return (
            <div
              key={folder.id}
              className={`${styles.tabWrapper} ${isDragOver ? styles.dragOver : ''} ${isActive ? styles.wrapperActive : ''}`}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
              onContextMenu={(e) => handleContextMenu(e, folder.id)}
            >
              <button
                type="button"
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFolder(folder.id);
                  setMenuOpenFolderId(null);
                }}
                onDoubleClick={(e) => handleRename(e, folder)}
                title={`Folder: ${folder.name} (${folder.photoCount} photos). Double-click to rename. Drag selected photos here to add.`}
              >
                <span className={styles.folderIcon}>📂</span>
                <span className={styles.tabName}>{folder.name}</span>
                <span className={styles.tabCount}>{folder.photoCount}</span>
              </button>

              {/* Ellipsis Options Menu Button */}
              <button
                type="button"
                className={`${styles.menuTriggerBtn} ${isMenuOpen ? styles.menuTriggerActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenFolderId(isMenuOpen ? null : folder.id);
                }}
                title="Folder options (Rename / Delete)"
              >
                ⋮
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={(e) => handleRename(e, folder)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      <path d="m15 5 4 4"/>
                    </svg>
                    Rename Folder
                  </button>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={(e) => handleDeleteRequest(e, folder)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete Folder
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Folder Button */}
        <button
          type="button"
          className={styles.addFolderBtn}
          onClick={(e) => {
            e.stopPropagation();
            openCreateFolderDialog();
          }}
          title="Create a new photo folder / collection"
        >
          <span>+ Folder</span>
        </button>
      </div>

      {/* Modern Confirm Dialog for Folder Deletion */}
      <ConfirmDialog
        isOpen={folderToDelete !== null}
        title="Delete Folder Collection?"
        message={`Are you sure you want to delete the folder "${folderToDelete?.name}"?`}
        detail="Photos inside this folder will remain safely in your library. Only the folder organization tag is removed."
        confirmText="Delete Folder"
        cancelText="Keep Folder"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFolderToDelete(null)}
      />
    </>
  );
}
