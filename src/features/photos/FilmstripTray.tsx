import React, { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Button } from '../../components/ui/Button';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { filterPhotos, sortPhotos, formatFileSize, PhotoSortBy, Photo } from '../../domain/photo';
import { FolderTabs } from './FolderTabs';
import { BatchActionBar } from './BatchActionBar';
import { FolderDialog } from './FolderDialog';
import styles from './FilmstripTray.module.css';

interface FilmstripTrayProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function FilmstripTray({ isOpen, onToggle }: FilmstripTrayProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    photos,
    folders,
    folderPhotoIds,
    activeFolderId,
    selectedPhotoIds,
    filter,
    sortBy,
    searchQuery,
    isImporting,
    isCancelling,
    importProgress,
    loadPhotos,
    loadFolders,
    importFiles,
    importFolder,
    importPaths,
    cancelImport,
    toggleFavorite,
    removePhoto,
    checkMissing,
    setupListeners,
    selectPhoto,
    selectAll,
    clearSelection,
    copySelectedPhotos,
    pastePhotosToActiveFolder,
    batchDeleteSelected,
    setFilter,
    setSortBy,
    setSearchQuery,
    openRelink,
  } = usePhotoStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const filmstripRef = useRef<HTMLElement>(null);

  // Set up real-time Tauri event streaming
  useEffect(() => {
    let cleanupFn: (() => void) | undefined;
    setupListeners().then((cleanup) => {
      cleanupFn = cleanup;
    });
    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [setupListeners]);

  // Load photos and folders when project changes
  useEffect(() => {
    if (currentProject) {
      loadPhotos(currentProject.id);
      loadFolders(currentProject.id);
      checkMissing(currentProject.id);
    }
  }, [currentProject?.id, loadPhotos, loadFolders, checkMissing]);

  // Determine current photo pool based on active folder
  const currentPhotoPool = React.useMemo(() => {
    if (!activeFolderId) return photos;
    const allowedIds = folderPhotoIds[activeFolderId] || [];
    return photos.filter((p) => allowedIds.includes(p.id));
  }, [photos, activeFolderId, folderPhotoIds]);

  const filtered = filterPhotos(currentPhotoPool, filter, searchQuery);
  const sortedPhotos = sortPhotos(filtered, sortBy);

  // Global Keyboard Shortcuts for Filmstrip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentProject) return;

      // Ignore if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll(sortedPhotos);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelectedPhotos();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pastePhotosToActiveFolder(currentProject.id);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPhotoIds.length > 0) {
          e.preventDefault();
          if (window.confirm(`Delete ${selectedPhotoIds.length} selected photos?`)) {
            batchDeleteSelected(currentProject.id);
          }
        }
      } else if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProject, sortedPhotos, selectedPhotoIds, selectAll, copySelectedPhotos, pastePhotosToActiveFolder, batchDeleteSelected, clearSelection]);

  if (!currentProject) return null;

  const totalCount = currentPhotoPool.length;
  const unusedCount = currentPhotoPool.filter((p) => p.usedCount === 0).length;
  const usedCount = currentPhotoPool.filter((p) => p.usedCount > 0).length;
  const favCount = currentPhotoPool.filter((p) => p.isFavorite).length;
  const missingCount = currentPhotoPool.filter((p) => p.isMissing).length;

  // External Drag & Drop handlers (Importing files/folders from Windows Explorer)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0 && e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    if (!currentProject) return;

    const files = Array.from(e.dataTransfer.files);
    const nativePaths: string[] = [];

    for (const f of files) {
      const p = (f as any).path;
      if (typeof p === 'string' && p.length > 0) {
        nativePaths.push(p);
      }
    }

    if (nativePaths.length > 0) {
      await importPaths(currentProject.id, nativePaths);
    }
  };

  // Internal Card Click Handler
  const handleCardClick = (e: React.MouseEvent, photo: Photo) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      selectPhoto(photo.id, 'toggle', sortedPhotos);
    } else if (e.shiftKey) {
      selectPhoto(photo.id, 'range', sortedPhotos);
    } else {
      selectPhoto(photo.id, 'single', sortedPhotos);
    }
  };

  // Card Drag Handler for Folder Organization
  const handleCardDragStart = (e: React.DragEvent, photo: Photo) => {
    if (!selectedPhotoIds.includes(photo.id)) {
      selectPhoto(photo.id, 'single', sortedPhotos);
    }
    e.dataTransfer.setData('application/json', JSON.stringify(selectedPhotoIds.includes(photo.id) ? selectedPhotoIds : [photo.id]));
  };

  const showProgressBar = isImporting && importProgress && importProgress.total > 0;
  const activeFolderName = activeFolderId
    ? folders.find((f) => f.id === activeFolderId)?.name || 'Folder'
    : null;

  return (
    <section
      ref={filmstripRef}
      className={`${styles.filmstrip} ${!isOpen ? styles.collapsed : ''} ${isDragOver ? styles.dragOver : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="Photo Library Filmstrip"
    >
      {/* Batch Action Bar (Visible when photos are selected) */}
      {selectedPhotoIds.length > 0 && <BatchActionBar />}

      {/* Real-time Import Progress Bar Banner */}
      {showProgressBar && (
        <div className={styles.progressBarContainer}>
          <div className={styles.progressTopRow}>
            <div className={styles.progressInfo}>
              <div className={styles.spinner} />
              <span className={styles.progressTitle}>
                Importing {importProgress.current} of {importProgress.total} photos {activeFolderName ? `to [${activeFolderName}]` : ''}...
              </span>
            </div>

            <div className={styles.progressRightControls}>
              <span className={styles.progressPercent}>{importProgress.percent}%</span>
              <button
                type="button"
                className={styles.cancelImportBtn}
                onClick={cancelImport}
                disabled={isCancelling}
                title="Safely cancel photo import"
              >
                {isCancelling ? 'Cancelling...' : '✕ Cancel'}
              </button>
            </div>
          </div>

          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${Math.max(4, importProgress.percent)}%` }}
            />
          </div>

          {importProgress.currentFile && (
            <span className={styles.progressFileName}>
              {importProgress.currentFile}
            </span>
          )}
        </div>
      )}

      {/* Top Header Bar */}
      <div className={styles.header}>
        {/* Left: Title, Counts, Filters, and Folder Collections */}
        <div className={styles.leftHeader}>
          <span className={styles.title}>PHOTOS</span>
          <span className={styles.countBadge}>{totalCount}</span>

          {isOpen && (
            <>
              {/* Folder Collections Tabs */}
              <div className={styles.divider} />
              <FolderTabs />
              <div className={styles.divider} />

              {/* Status Filters */}
              <div className={styles.filtersGroup}>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${filter === 'unused' ? styles.active : ''}`}
                  onClick={() => setFilter('unused')}
                >
                  Unused ({unusedCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${filter === 'used' ? styles.active : ''}`}
                  onClick={() => setFilter('used')}
                >
                  Used ({usedCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${filter === 'favorites' ? styles.active : ''}`}
                  onClick={() => setFilter('favorites')}
                >
                  ★ ({favCount})
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Search, Sort, Missing Alert, Import Buttons, Toggle */}
        <div className={styles.rightHeader}>
          {isOpen && (
            <>
              {missingCount > 0 && (
                <button
                  type="button"
                  className={styles.missingAlertBtn}
                  onClick={openRelink}
                  title="Click to relink missing photos"
                >
                  ⚠️ {missingCount} Missing (Relink)
                </button>
              )}

              <input
                type="text"
                placeholder="Search photos..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as PhotoSortBy)}
                title="Sort photos by"
              >
                <option value="name">Sort: Name</option>
                <option value="date">Sort: Date</option>
                <option value="size">Sort: Size</option>
              </select>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => importFiles(currentProject.id)}
                disabled={isImporting}
                title={activeFolderName ? `Import photos into ${activeFolderName}` : 'Import photos into project library'}
              >
                + Import Files
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => importFolder(currentProject.id)}
                disabled={isImporting}
                title={activeFolderName ? `Import folder into ${activeFolderName}` : 'Import folder into project library'}
              >
                + Import Folder
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            title={isOpen ? 'Collapse Photo Filmstrip' : 'Expand Photo Filmstrip'}
            className={styles.toggleBtn}
          >
            {isOpen ? '▼' : '▲ Photos'}
          </Button>
        </div>
      </div>

      {/* External Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className={styles.dropzoneOverlay}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" x2="12" y1="3" y2="15"/>
          </svg>
          <span>Drop photos here to import {activeFolderName ? `to [${activeFolderName}]` : ''}</span>
        </div>
      )}

      {/* Filmstrip Body */}
      {isOpen && (
        <div className={styles.body} onClick={clearSelection}>
          {sortedPhotos.length > 0 ? (
            <div className={styles.photoList}>
              {sortedPhotos.map((photo) => {
                const isSelected = selectedPhotoIds.includes(photo.id);

                return (
                  <div
                    key={photo.id}
                    className={`${styles.photoCard} ${isSelected ? styles.cardSelected : ''} ${photo.isMissing ? styles.cardMissing : ''}`}
                    onClick={(e) => handleCardClick(e, photo)}
                    draggable={true}
                    onDragStart={(e) => handleCardDragStart(e, photo)}
                    title={`${photo.fileName}\n${photo.width} × ${photo.height} px • ${formatFileSize(photo.fileSize)}\nPath: ${photo.filePath}`}
                  >
                    {/* Thumbnail Image */}
                    <div className={styles.thumbnailWrapper}>
                      {photo.thumbnailPath ? (
                        <img
                          src={convertFileSrc(photo.thumbnailPath)}
                          alt={photo.fileName}
                          className={styles.thumbnailImg}
                          loading="lazy"
                        />
                      ) : photo.thumbnailBase64 ? (
                        <img
                          src={photo.thumbnailBase64}
                          alt={photo.fileName}
                          className={styles.thumbnailImg}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.thumbnailPlaceholder}>
                          <span>{photo.format.toUpperCase()}</span>
                        </div>
                      )}

                      {/* Missing Banner */}
                      {photo.isMissing && (
                        <div className={styles.missingBadge} onClick={openRelink}>
                          ⚠️ Missing
                        </div>
                      )}

                      {/* Selection Checkbox Overlay */}
                      <button
                        type="button"
                        className={`${styles.selectCheckbox} ${isSelected ? styles.checkboxChecked : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectPhoto(photo.id, 'toggle', sortedPhotos);
                        }}
                        title={isSelected ? 'Deselect photo' : 'Select photo'}
                      >
                        {isSelected ? '✓' : ''}
                      </button>

                      {/* Top Right: Favorite Star */}
                      <button
                        type="button"
                        className={`${styles.favBtn} ${photo.isFavorite ? styles.favActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(photo.id);
                        }}
                        title={photo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        ★
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        className={styles.deletePhotoBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(photo.id);
                        }}
                        title="Remove photo from library"
                      >
                        ✕
                      </button>

                      {/* Bottom Status Overlay */}
                      <div className={styles.bottomOverlay}>
                        <span className={`${styles.usedTag} ${photo.usedCount > 0 ? styles.usedActive : ''}`}>
                          {photo.usedCount > 0 ? `Used ${photo.usedCount}×` : 'Unused'}
                        </span>
                        <span className={styles.dimTag}>
                          {photo.width > photo.height ? 'Landscape' : photo.width < photo.height ? 'Portrait' : 'Square'}
                        </span>
                      </div>
                    </div>

                    {/* Filename under thumbnail */}
                    <span className={styles.fileNameText}>{photo.fileName}</span>
                  </div>
                );
              })}
            </div>
          ) : !isImporting ? (
            <div className={styles.emptyState}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>
                {activeFolderName
                  ? `No photos in folder "${activeFolderName}". Drag & drop photos here or import above.`
                  : photos.length === 0
                  ? 'No photos in library. Drag & drop photos here or click Import above.'
                  : 'No photos match the current filter or search query.'}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Folder Create/Rename Modal Dialog */}
      <FolderDialog />
    </section>
  );
}
