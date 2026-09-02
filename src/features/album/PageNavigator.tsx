import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAlbumStore } from '../../stores/albumStore';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { getAllAlbumSpreads, mergeFramePhotoAsset, Spread } from '../../domain/album';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import { Project } from '../../domain/project';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import styles from './PageNavigator.module.css';

function safeConvertFileSrc(filePath: string): string {
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}

interface MiniSpreadPreviewProps {
  spread: Spread;
  project: Project;
}

function MiniSpreadPreview({ spread, project }: MiniSpreadPreviewProps) {
  const photos = usePhotoStore((s) => s.photos);
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  const dims = getProjectDimensionsInCanvasUnit(project);
  const totalPhysicalW = (spread.leftPage?.width || dims.pageWidth) + (spread.rightPage?.width || dims.pageWidth) + (spread.gutterWidth ?? dims.gutterWidth ?? 0);
  const totalPhysicalH = spread.leftPage?.height || dims.pageHeight || 200;

  // Mini thumbnail box dimensions
  const previewBoxW = 124;
  const previewBoxH = 56;
  const scale = Math.min(previewBoxW / (totalPhysicalW || 400), previewBoxH / (totalPhysicalH || 200));

  const actualSpreadW = Math.round(totalPhysicalW * scale);
  const actualSpreadH = Math.round(totalPhysicalH * scale);
  const spineX = (spread.leftPage ? spread.leftPage.width : totalPhysicalW / 2) * scale;
  const bgStyle = project.backgroundType === 'color' ? project.backgroundColor || '#ffffff' : '#ffffff';

  return (
    <div
      className={styles.miniSpread}
      style={{
        position: 'relative',
        width: `${actualSpreadW}px`,
        height: `${actualSpreadH}px`,
        backgroundColor: bgStyle,
        overflow: 'hidden',
      }}
    >
      {/* Spine / Gutter Line */}
      <div
        style={{
          position: 'absolute',
          left: `${spineX}px`,
          top: 0,
          bottom: 0,
          width: '1px',
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
          zIndex: 1,
        }}
      />

      {/* Real-time Rendered Photo Elements */}
      {(spread.elements || []).map((el) => {
        const hydratedElement = mergeFramePhotoAsset(el, el.photoId ? photoById.get(el.photoId) : null);
        const x = el.x * scale;
        const y = el.y * scale;
        const w = el.width * scale;
        const h = el.height * scale;
        const rot = el.rotation || 0;
        const isCachePath = (p?: string | null) => {
          if (!p) return false;
          const norm = p.replace(/\\/g, '/').toLowerCase();
          return norm.includes('/thumbnails/') || norm.includes('/previews/');
        };
        const safeThumb = isCachePath(hydratedElement.thumbnailPath) ? hydratedElement.thumbnailPath : null;
        const safePreview = isCachePath(hydratedElement.previewPath) ? hydratedElement.previewPath : null;
        const imgSrc = (hydratedElement.photoId && !hydratedElement.isMissing)
          ? (safeThumb || safePreview || null)
          : null;

        const photoMeta = el.photoId ? photoById.get(el.photoId) : null;

        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              transform: rot ? `rotate(${rot}deg)` : undefined,
              transformOrigin: '0 0',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #334155, #1e293b)',
              opacity: el.opacity ?? 1,
              border: el.borderEnabled && el.borderWidth ? `1px solid ${el.borderColor || '#ffffff'}` : '1px solid rgba(0,0,0,0.15)',
              borderRadius: '1px',
              zIndex: 2,
            }}
          >
            {imgSrc && (
              <img
                key={`${el.id}_${imgSrc}_${photoMeta?.updatedAt || ''}`}
                src={safeConvertFileSrc(imgSrc)}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  pointerEvents: 'none',
                }}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (el.photoId) {
                    void usePhotoStore.getState().healThumbnail(el.photoId);
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PageNavigator() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    currentAlbum,
    activeSpreadId,
    activeSpreadIndex,
    isSpreadDrawerOpen,
    setActiveSpread,
    nextSpread,
    prevSpread,
    addSpread,
    deleteSpread,
    duplicateSpread,
    moveSpread,
    reorderSpread,
    setSpreadDrawerOpen,
    toggleSpreadDrawer,
  } = useAlbumStore();

  const [spreadToDelete, setSpreadToDelete] = useState<Spread | null>(null);
  const [draggedSpreadIndex, setDraggedSpreadIndex] = useState<number | null>(null);
  const [dragOverSpreadIndex, setDragOverSpreadIndex] = useState<number | null>(null);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        nextSpread();
      } else if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        prevSpread();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSpread, prevSpread]);

  if (!currentProject || !currentAlbum) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const hasPrev = activeSpreadIndex > 0;
  const hasNext = activeSpreadIndex < allSpreads.length - 1;

  const handleAddSpread = () => {
    addSpread(currentProject);
  };

  const handleDuplicateSpread = (e: React.MouseEvent, spread: Spread) => {
    e.stopPropagation();
    duplicateSpread(spread.id, currentProject);
  };

  const handleDeleteRequest = (e: React.MouseEvent, spread: Spread) => {
    e.stopPropagation();
    const photoCount = (spread.elements || []).filter((el) => Boolean(el.photoId || el.filePath)).length;

    if (photoCount === 0) {
      // Empty spread without photos -> delete immediately without confirmation modal
      deleteSpread(spread.id);
    } else {
      // Spread has placed photos -> prompt confirmation dialog to protect user content
      setSpreadToDelete(spread);
    }
  };

  const handleConfirmDelete = () => {
    if (spreadToDelete) {
      deleteSpread(spreadToDelete.id);
      setSpreadToDelete(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSpreadIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSpreadIndex !== index) {
      setDragOverSpreadIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverSpreadIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = sourceIndexStr ? parseInt(sourceIndexStr, 10) : draggedSpreadIndex;
    setDraggedSpreadIndex(null);
    setDragOverSpreadIndex(null);

    if (sourceIndex !== null && !isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      reorderSpread(sourceIndex, targetIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedSpreadIndex(null);
    setDragOverSpreadIndex(null);
  };

  return (
    <div className={styles.navigatorContainer}>
      {/* Spread Thumbnail Drawer (Collapsible with Hardware-Accelerated Smooth Slide) */}
      <div className={`${styles.drawerWrapper} ${!isSpreadDrawerOpen ? styles.drawerWrapperCollapsed : ''}`}>
        <div className={styles.drawerInner}>
          <div className={styles.drawerHeader}>
            <span className={styles.drawerTitle}>Album Spreads ({allSpreads.length})</span>
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={() => setSpreadDrawerOpen(false)}
              title="Close Spread Drawer"
            >
              ✕
            </button>
          </div>

          <div className={styles.drawerList}>
            {allSpreads.map((spread, index) => {
              const isActive = activeSpreadId === spread.id;
              const isDragging = draggedSpreadIndex === index;
              const isDragOver = dragOverSpreadIndex === index;
              const isFirst = index === 0;
              const isLast = index === allSpreads.length - 1;

              let dragOverClass = '';
              if (isDragOver && draggedSpreadIndex !== null && draggedSpreadIndex !== index) {
                dragOverClass = (draggedSpreadIndex < index ? styles.dragOverRight : styles.dragOverLeft) || '';
              }

              return (
                <div
                  key={spread.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`${styles.thumbnailCard} ${isActive ? styles.cardActive : ''} ${isDragging ? styles.draggingCard : ''} ${dragOverClass}`}
                  onClick={() => {
                    setActiveSpread(spread.id);
                  }}
                  title={`${spread.name} (Drag or use ◀ ▶ to reorder)`}
                >
                  {/* Real-time Miniature Spread Preview */}
                  <MiniSpreadPreview spread={spread} project={currentProject} />

                  {/* Card Label & Actions */}
                  <div className={styles.cardInfoRow}>
                    <span className={styles.cardIndexText}>{spread.spreadIndex}</span>
                    <span className={styles.cardNameText}>{spread.name}</span>

                    {/* Quick Actions (Reorder ◀ ▶ / Duplicate / Delete) */}
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.reorderBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSpread(spread.id, 'left');
                        }}
                        disabled={isFirst}
                        title={isFirst ? undefined : 'Move spread left (earlier)'}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={styles.reorderBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSpread(spread.id, 'right');
                        }}
                        disabled={isLast}
                        title={isLast ? undefined : 'Move spread right (later)'}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${styles.cardActionBtn} ${styles.cardActionBtnDuplicate}`}
                        onClick={(e) => handleDuplicateSpread(e, spread)}
                        title="Duplicate this spread"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      {allSpreads.length > 1 && (
                        <button
                          type="button"
                          className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
                          onClick={(e) => handleDeleteRequest(e, spread)}
                          title="Delete this spread"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Spread Button inside Drawer */}
            <button
              type="button"
              className={styles.drawerAddBtn}
              onClick={handleAddSpread}
              title="Add a new spread to album"
            >
              <span className={styles.drawerAddIcon}>+</span>
              <span>New Spread</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Main Navigation Bar */}
      <div className={styles.navigationBar}>
        {/* Left: Thumbnail Drawer Toggle */}
        <button
          type="button"
          className={`${styles.navBtn} ${isSpreadDrawerOpen ? styles.navBtnActive : ''}`}
          onClick={toggleSpreadDrawer}
          title={isSpreadDrawerOpen ? 'Hide Spread Thumbnails' : 'Show All Spread Thumbnails'}
        >
          <span className={styles.drawerIcon}>⊞</span>
          <span>Spreads ({allSpreads.length})</span>
        </button>

        <div className={styles.divider} />

        {/* Center: Previous Button, Dropdown Selector, Next Button */}
        <div className={styles.centerControls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={prevSpread}
            disabled={!hasPrev}
            title="Previous Spread (PageUp or Alt+Left)"
          >
            ◀ Prev
          </button>

          {/* Spread Dropdown Selector */}
          <select
            className={styles.spreadSelect}
            value={activeSpreadId || ''}
            onChange={(e) => setActiveSpread(e.target.value)}
            title="Jump to Spread"
          >
            {allSpreads.map((s) => (
              <option key={s.id} value={s.id}>
                {`📖 ${s.name}`}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.navBtn}
            onClick={nextSpread}
            disabled={!hasNext}
            title="Next Spread (PageDown or Alt+Right)"
          >
            Next ▶
          </button>
        </div>

        <div className={styles.divider} />

        {/* Right: Quick + Add Spread */}
        <button
          type="button"
          className={`${styles.navBtn} ${styles.addSpreadBtn}`}
          onClick={handleAddSpread}
          title="Add a new spread with 2 facing pages"
        >
          <span>+ Add Spread</span>
        </button>
      </div>

      {/* Confirm Delete Spread Dialog (only shown when spread has photos) */}
      <ConfirmDialog
        isOpen={spreadToDelete !== null}
        title="Delete Album Spread?"
        message={`Are you sure you want to delete "${spreadToDelete?.name}"?`}
        detail={
          spreadToDelete
            ? `This spread contains ${(spreadToDelete.elements || []).filter((el) => Boolean(el.photoId || el.filePath)).length} photo(s). Deleting it will remove this spread from your album.`
            : 'The two facing pages and any layout elements on this spread will be removed from your album.'
        }
        confirmText="Delete Spread"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setSpreadToDelete(null)}
      />
    </div>
  );
}
