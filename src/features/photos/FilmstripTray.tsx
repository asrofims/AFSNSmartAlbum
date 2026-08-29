import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { getAllAlbumSpreads } from '../../domain/album';
import { filterPhotos, sortPhotos, formatFileSize, PhotoSortBy, Photo } from '../../domain/photo';
import { FolderTabs } from './FolderTabs';
import { BatchActionBar } from './BatchActionBar';
import { FolderDialog } from './FolderDialog';
import { PhotoContextMenu } from './PhotoContextMenu';
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
    lastSelectedPhotoId,
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
    batchDeleteSelected,
    batchToggleFavoritesSelected,
    addPhotosToFolder,
    movePhotosToFolder,
    removePhotosFromFolder,
    setFilter,
    setSortBy,
    setSearchQuery,
    openRelink,
  } = usePhotoStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [importAnchor, setImportAnchor] = useState<{ top: number; right: number } | null>(null);
  const dragCounterRef = useRef(0);
  const filmstripRef = useRef<HTMLElement>(null);

  // Context Menu State
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    photo: Photo | null;
  }>({ isOpen: false, x: 0, y: 0, photo: null });

  // Single / Target Photo Deletion Confirm State
  const [photoToDelete, setPhotoToDelete] = useState<{ ids: string[]; name: string } | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

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

  const currentAlbum = useAlbumStore((s) => s.currentAlbum);

  // Real-time calculation of used photo IDs from all elements across all spreads in current album
  const usedPhotoIdSet = React.useMemo(() => {
    const set = new Set<string>();
    if (!currentAlbum) return set;

    (currentAlbum.spreads || []).forEach((spread) => {
      (spread.elements || []).forEach((el) => {
        if (el.photoId) set.add(el.photoId);
      });
    });

    return set;
  }, [currentAlbum]);

  // Determine current photo pool based on active folder
  const currentPhotoPool = React.useMemo(() => {
    if (!activeFolderId) return photos;
    const allowedIds = folderPhotoIds[activeFolderId] || [];
    return photos.filter((p) => allowedIds.includes(p.id));
  }, [photos, activeFolderId, folderPhotoIds]);

  const filtered = filterPhotos(currentPhotoPool, filter, searchQuery, usedPhotoIdSet);
  const sortedPhotos = sortPhotos(filtered, sortBy);

  const isHoveredRef = useRef(false);

  // Global Keyboard Shortcuts for Lightroom-style photo interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentProject) return;

      // Ignore if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const isTargetInside = filmstripRef.current && (
          filmstripRef.current.contains(e.target as Node) || isHoveredRef.current
        );
        if (isTargetInside) {
          e.preventDefault();
          selectAll(sortedPhotos);
          useEditorStore.getState().clearSelection();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        clearSelection();
      } else if (e.key === 'Escape') {
        clearSelection();
        setContextMenuState((s) => ({ ...s, isOpen: false }));
        setIsImportMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProject, clearSelection, selectAll, sortedPhotos]);

  if (!currentProject) return null;

  const totalCount = currentPhotoPool.length;
  const unusedCount = currentPhotoPool.filter((p) => !usedPhotoIdSet.has(p.id) && p.usedCount === 0).length;
  const usedCount = currentPhotoPool.filter((p) => usedPhotoIdSet.has(p.id) || p.usedCount > 0).length;
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

  const handleToggleImportMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isImportMenuOpen) {
      setIsImportMenuOpen(false);
      return;
    }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    setImportAnchor({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setIsImportMenuOpen(true);
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

  // Internal Card Click Handler (Lightroom Style)
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

  // Card Context Menu (Right Click)
  const handleCardContextMenu = (e: React.MouseEvent, photo: Photo) => {
    e.preventDefault();
    e.stopPropagation();

    // If right-clicked photo is not in current multi-selection, make it the single selection
    if (!selectedPhotoIds.includes(photo.id)) {
      selectPhoto(photo.id, 'single', sortedPhotos);
    }

    setContextMenuState({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      photo,
    });
  };

  // Card Drag Handler for Folder Organization & Canvas Placement
  const handleCardDragStart = (e: React.DragEvent, photo: Photo) => {
    if (!selectedPhotoIds.includes(photo.id)) {
      selectPhoto(photo.id, 'single', sortedPhotos);
    }
    e.dataTransfer.setData('application/json', JSON.stringify(photo));
    e.dataTransfer.setData('text/plain', photo.id);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Execute Photo Deletion after ConfirmDialog
  const handleConfirmPhotoDelete = async () => {
    if (!photoToDelete) return;
    setIsDeletingPhoto(true);
    try {
      if (photoToDelete.ids.length === 1 && photoToDelete.ids[0]) {
        await removePhoto(photoToDelete.ids[0]);
      } else {
        await batchDeleteSelected(currentProject.id);
      }
      setPhotoToDelete(null);
    } catch (err) {
      console.error('Delete photo error:', err);
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const showProgressBar = isImporting && importProgress && importProgress.total > 0;
  const activeFolderName = activeFolderId
    ? folders.find((f) => f.id === activeFolderId)?.name || 'Folder'
    : null;

  return (
    <section
      ref={filmstripRef}
      className={`${styles.filmstrip} ${!isOpen ? styles.collapsed : ''} ${isDragOver ? styles.dragOver : ''}`}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="Photo Library Filmstrip"
    >
      {/* Batch Action Bar (Appears when 2 or more photos are selected - Lightroom style) */}
      <BatchActionBar />

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
        {/* Left: Title, Counts, and Folder Collections */}
        <div className={styles.leftHeader}>
          <span className={styles.title}>PHOTOS</span>
          <span className={styles.countBadge}>{totalCount}</span>

          {isOpen && (
            <>
              {/* Folder Collections Tabs */}
              <div className={styles.divider} />
              <FolderTabs />
            </>
          )}
        </div>

        {/* Right: Status Filters Dropdown, Sort, Search, Missing Alert, Import Buttons, Toggle */}
        <div className={styles.rightHeader}>
          {isOpen && (
            <>
              {/* Status Filters Dropdown */}
              <select
                className={styles.filterSelect}
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                title="Filter photos by status"
              >
                <option value="all">Filter: All ({totalCount})</option>
                <option value="unused">Filter: Unused ({unusedCount})</option>
                <option value="used">Filter: Used ({usedCount})</option>
                <option value="favorites">Filter: Favorites ({favCount})</option>
              </select>

              {/* Sort Dropdown */}
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

              <input
                type="text"
                placeholder="Search photos..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

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

              {/* Unified Import Options Dropdown Button */}
              <button
                type="button"
                className={`${styles.importDropdownBtn} ${isImportMenuOpen ? styles.importDropdownBtnActive : ''}`}
                onClick={handleToggleImportMenu}
                disabled={isImporting}
                title={activeFolderName ? `Import photos into ${activeFolderName}` : 'Import photos into project library'}
                aria-label="Import options"
              >
                <span>+ Import</span>
                <span className={styles.dropdownArrow}>▾</span>
              </button>
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
                const isActive = lastSelectedPhotoId === photo.id;
                const isUsed = usedPhotoIdSet.has(photo.id) || photo.usedCount > 0;

                return (
                  <div
                    key={photo.id}
                    className={`${styles.photoCard} ${isSelected ? styles.cardSelected : ''} ${isActive ? styles.cardActive : ''} ${photo.isMissing ? styles.cardMissing : ''} ${isUsed ? styles.cardUsed : ''}`}
                    onClick={(e) => handleCardClick(e, photo)}
                    onDoubleClick={() => {
                      if (isUsed) return;
                      const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
                      if (currentAlbum) {
                        const allSpreads = getAllAlbumSpreads(currentAlbum);
                        const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
                        if (activeSpread) {
                          useEditorStore.getState().addPhotoToSpread(activeSpread.id, photo);
                        }
                      }
                    }}
                    onContextMenu={(e) => handleCardContextMenu(e, photo)}
                    draggable={true}
                    onDragStart={(e) => {
                      handleCardDragStart(e, photo);
                    }}
                    title={
                      isUsed
                        ? `${photo.fileName}\n(Placed in album spread — Drag onto a canvas frame to replace or swap)`
                        : `${photo.fileName}\n${photo.width} × ${photo.height} px • ${formatFileSize(photo.fileSize)}\nDouble-click to add or drag onto canvas to place/replace\nRight-click for options`
                    }
                  >
                    {/* Thumbnail Image */}
                    <div className={styles.thumbnailWrapper} draggable={false}>
                      {photo.thumbnailPath ? (
                        <img
                          src={convertFileSrc(photo.thumbnailPath)}
                          alt={photo.fileName}
                          className={styles.thumbnailImg}
                          loading="lazy"
                          draggable={false}
                        />
                      ) : photo.thumbnailBase64 ? (
                        <img
                          src={photo.thumbnailBase64}
                          alt={photo.fileName}
                          className={styles.thumbnailImg}
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className={styles.thumbnailPlaceholder} draggable={false}>
                          <span>{photo.format.toUpperCase()}</span>
                        </div>
                      )}

                      {/* Used Protective Lock Badge */}
                      {isUsed && (
                        <div className={styles.usedLockBadge}>
                          ✓ Used
                        </div>
                      )}

                      {/* Missing Banner */}
                      {photo.isMissing && (
                        <div className={styles.missingBadge} onClick={openRelink}>
                          ⚠️ Missing
                        </div>
                      )}

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

                      {/* Bottom Status Overlay */}
                      <div className={styles.bottomOverlay}>
                        <span className={`${styles.usedTag} ${isUsed ? styles.usedActive : ''}`}>
                          {isUsed ? 'Used' : 'Unused'}
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

      {/* Lightroom-style Right Click Context Menu */}
      {contextMenuState.isOpen && contextMenuState.photo && (
        <PhotoContextMenu
          isOpen={contextMenuState.isOpen}
          x={contextMenuState.x}
          y={contextMenuState.y}
          targetPhoto={contextMenuState.photo}
          selectedPhotos={photos.filter((p) => selectedPhotoIds.includes(p.id))}
          folders={folders}
          activeFolderId={activeFolderId}
          onClose={() => setContextMenuState((s) => ({ ...s, isOpen: false }))}
          onToggleFavorite={toggleFavorite}
          onBatchToggleFavorite={batchToggleFavoritesSelected}
          onAddToFolder={(fId, pIds) => addPhotosToFolder(currentProject.id, fId, pIds)}
          onMoveToFolder={(fromId, toId, pIds) => movePhotosToFolder(currentProject.id, fromId, toId, pIds)}
          onRemoveFromFolder={(fId, pIds) => removePhotosFromFolder(currentProject.id, fId, pIds)}
          onRequestDelete={(ids, name) => setPhotoToDelete({ ids, name })}
          onSelectAll={() => selectAll(sortedPhotos)}
        />
      )}

      {/* Modern Confirm Dialog for Photo Deletion */}
      <ConfirmDialog
        isOpen={photoToDelete !== null}
        title={photoToDelete && photoToDelete.ids.length > 1 ? `Delete ${photoToDelete.ids.length} Photos?` : 'Delete Photo from Library?'}
        message={
          photoToDelete && photoToDelete.ids.length > 1
            ? `Are you sure you want to delete ${photoToDelete.ids.length} selected photos from the project library?`
            : `Are you sure you want to delete "${photoToDelete?.name}" from the project library?`
        }
        detail="The photo will be removed from your album project. The original image file on your hard drive will remain completely safe."
        confirmText={photoToDelete && photoToDelete.ids.length > 1 ? `Delete ${photoToDelete.ids.length} Photos` : 'Delete Photo'}
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingPhoto}
        onConfirm={handleConfirmPhotoDelete}
        onCancel={() => setPhotoToDelete(null)}
      />

      {/* React Portal Import Options Dropdown Menu */}
      {isImportMenuOpen && importAnchor && createPortal(
        <>
          <div
            className={styles.backdrop}
            onClick={() => setIsImportMenuOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsImportMenuOpen(false);
            }}
          />
          <div
            className={styles.importDropdownMenu}
            style={{
              position: 'fixed',
              top: `${importAnchor.top}px`,
              right: `${importAnchor.right}px`,
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeFolderName && (
              <div className={styles.importTargetHeader}>
                <span>Target: <strong>{activeFolderName}</strong></span>
              </div>
            )}
            <button
              type="button"
              className={styles.importMenuItem}
              onClick={() => {
                setIsImportMenuOpen(false);
                importFiles(currentProject.id);
              }}
            >
              <span className={styles.importMenuIcon}>🖼️</span>
              <div className={styles.importTextCol}>
                <span className={styles.importMainTitle}>Import Photos / Files...</span>
                <span className={styles.importSubTitle}>Select individual or multiple photo files</span>
              </div>
            </button>

            <button
              type="button"
              className={styles.importMenuItem}
              onClick={() => {
                setIsImportMenuOpen(false);
                importFolder(currentProject.id);
              }}
            >
              <span className={styles.importMenuIcon}>📁</span>
              <div className={styles.importTextCol}>
                <span className={styles.importMainTitle}>Import Entire Folder...</span>
                <span className={styles.importSubTitle}>Import all photos in a directory</span>
              </div>
            </button>
          </div>
        </>,
        document.body
      )}
    </section>
  );
}
