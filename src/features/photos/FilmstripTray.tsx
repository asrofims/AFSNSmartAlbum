import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { filterPhotos, sortPhotos, formatFileSize, PhotoSortBy } from '../../domain/photo';
import styles from './FilmstripTray.module.css';

interface FilmstripTrayProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function FilmstripTray({ isOpen, onToggle }: FilmstripTrayProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    photos,
    filter,
    sortBy,
    searchQuery,
    isImporting,
    importProgress,
    loadPhotos,
    importFiles,
    importFolder,
    importPaths,
    toggleFavorite,
    removePhoto,
    checkMissing,
    setupListeners,
    setFilter,
    setSortBy,
    setSearchQuery,
    openRelink,
  } = usePhotoStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

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

  // Load photos and check missing status when project changes
  useEffect(() => {
    if (currentProject) {
      loadPhotos(currentProject.id);
      checkMissing(currentProject.id);
    }
  }, [currentProject?.id, loadPhotos, checkMissing]);

  if (!currentProject) return null;

  const totalCount = photos.length;
  const unusedCount = photos.filter((p) => p.usedCount === 0).length;
  const usedCount = photos.filter((p) => p.usedCount > 0).length;
  const favCount = photos.filter((p) => p.isFavorite).length;
  const missingCount = photos.filter((p) => p.isMissing).length;

  const filtered = filterPhotos(photos, filter, searchQuery);
  const sortedPhotos = sortPhotos(filtered, sortBy);

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
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

  return (
    <section
      className={`${styles.filmstrip} ${!isOpen ? styles.collapsed : ''} ${isDragOver ? styles.dragOver : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="Photo Library Filmstrip"
    >
      {/* Real-time Import Progress Bar Banner */}
      {isImporting && (
        <div className={styles.progressBarContainer}>
          <div className={styles.progressTopRow}>
            <div className={styles.progressInfo}>
              <div className={styles.spinner} />
              <span className={styles.progressTitle}>
                {importProgress && importProgress.total > 0
                  ? `Importing ${importProgress.current} of ${importProgress.total} photos...`
                  : 'Preparing photo import...'}
              </span>
            </div>
            <span className={styles.progressPercent}>
              {importProgress ? `${importProgress.percent}%` : '0%'}
            </span>
          </div>

          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${importProgress ? Math.max(5, importProgress.percent) : 10}%` }}
            />
          </div>

          {importProgress?.currentFile && (
            <span className={styles.progressFileName}>
              {importProgress.currentFile}
            </span>
          )}
        </div>
      )}

      {/* Top Header Bar */}
      <div className={styles.header}>
        {/* Left: Title, Counts, Filters */}
        <div className={styles.leftHeader}>
          <span className={styles.title}>PHOTOS</span>
          <span className={styles.countBadge}>{totalCount}</span>

          {isOpen && (
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
                ★ Favorites ({favCount})
              </button>
            </div>
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
                  ⚠️ {missingCount} Missing Photo{missingCount > 1 ? 's' : ''} (Relink)
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
                title="Import individual image files (multi-select)"
              >
                {isImporting ? 'Importing...' : '+ Import Files'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => importFolder(currentProject.id)}
                disabled={isImporting}
                title="Import entire folder of photos"
              >
                {isImporting ? 'Importing...' : '+ Import Folder'}
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

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className={styles.dropzoneOverlay}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" x2="12" y1="3" y2="15"/>
          </svg>
          <span>Drop photos or folders here to import</span>
        </div>
      )}

      {/* Filmstrip Body */}
      {isOpen && (
        <div className={styles.body}>
          {sortedPhotos.length > 0 ? (
            <div className={styles.photoList}>
              {sortedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className={`${styles.photoCard} ${photo.isMissing ? styles.cardMissing : ''}`}
                  title={`${photo.fileName}\n${photo.width} × ${photo.height} px • ${formatFileSize(photo.fileSize)}\nPath: ${photo.filePath}`}
                >
                  {/* Thumbnail Image */}
                  <div className={styles.thumbnailWrapper}>
                    {photo.thumbnailBase64 ? (
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

                    {/* Top Left: Favorite Star */}
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

                    {/* Top Right: Delete Button */}
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
              ))}
            </div>
          ) : !isImporting ? (
            <div className={styles.emptyState}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>
                {photos.length === 0
                  ? 'No photos in library. Drag & drop photos here or click Import above.'
                  : 'No photos match the current filter or search query.'}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
