import React, { useState, useEffect } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { PhotoFolder } from '../../domain/photo';
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

  useEffect(() => {
    const handleGlobalClick = () => setMenuOpenFolderId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
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

  const handleDelete = async (e: React.MouseEvent, folder: PhotoFolder) => {
    e.stopPropagation();
    setMenuOpenFolderId(null);
    if (window.confirm(`Delete folder "${folder.name}"? Photos in this folder will remain in your project library.`)) {
      await deleteFolder(currentProject.id, folder.id);
    }
  };

  const handleRename = (e: React.MouseEvent, folder: PhotoFolder) => {
    e.stopPropagation();
    setMenuOpenFolderId(null);
    openRenameFolderDialog(folder);
  };

  return (
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
            className={`${styles.tabWrapper} ${isDragOver ? styles.dragOver : ''}`}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
          >
            <button
              type="button"
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveFolder(folder.id);
                setMenuOpenFolderId(null);
              }}
              title={`Folder: ${folder.name} (${folder.photoCount} photos). Drag selected photos here to add.`}
            >
              <span className={styles.folderIcon}>📂</span>
              <span className={styles.tabName}>{folder.name}</span>
              <span className={styles.tabCount}>{folder.photoCount}</span>
            </button>

            {/* Ellipsis Options Menu Button */}
            <button
              type="button"
              className={styles.menuTriggerBtn}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenFolderId(isMenuOpen ? null : folder.id);
              }}
              title="Folder options"
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
                  ✎ Rename Folder
                </button>
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={(e) => handleDelete(e, folder)}
                >
                  ✕ Delete Folder
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
  );
}
