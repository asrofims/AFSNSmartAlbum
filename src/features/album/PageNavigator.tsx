import React, { useState, useEffect } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { getAllAlbumSpreads, Spread } from '../../domain/album';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import styles from './PageNavigator.module.css';

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
    setSpreadDrawerOpen,
    toggleSpreadDrawer,
  } = useAlbumStore();

  const [spreadToDelete, setSpreadToDelete] = useState<Spread | null>(null);

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
    setSpreadToDelete(spread);
  };

  const handleConfirmDelete = () => {
    if (spreadToDelete) {
      deleteSpread(spreadToDelete.id);
      setSpreadToDelete(null);
    }
  };

  return (
    <div className={styles.navigatorContainer}>
      {/* Spread Thumbnail Drawer (Collapsible) */}
      {isSpreadDrawerOpen && (
        <div className={styles.drawer}>
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
            {allSpreads.map((spread) => {
              const isActive = activeSpreadId === spread.id;
              const isCover = spread.type === 'cover';

              return (
                <div
                  key={spread.id}
                  className={`${styles.thumbnailCard} ${isActive ? styles.cardActive : ''}`}
                  onClick={() => {
                    setActiveSpread(spread.id);
                  }}
                  title={spread.name}
                >
                  {/* Miniature Spread Preview */}
                  <div className={`${styles.miniSpread} ${isCover ? styles.miniCover : ''}`}>
                    <div className={styles.miniLeftPage} />
                    <div className={styles.miniGutter} />
                    <div className={styles.miniRightPage} />
                  </div>

                  {/* Card Label & Actions */}
                  <div className={styles.cardInfoRow}>
                    <span className={styles.cardIndexText}>{isCover ? 'Cover' : `${spread.spreadIndex}`}</span>
                    <span className={styles.cardNameText}>{spread.name}</span>

                    {/* Quick Actions (Duplicate / Delete for interior spreads) */}
                    {!isCover && (
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.cardActionBtn}
                          onClick={(e) => handleDuplicateSpread(e, spread)}
                          title="Duplicate this spread"
                        >
                          📋
                        </button>
                        {allSpreads.length > 2 && (
                          <button
                            type="button"
                            className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
                            onClick={(e) => handleDeleteRequest(e, spread)}
                            title="Delete this spread"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    )}
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
      )}

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
                {s.type === 'cover' ? '📕 Cover Spread' : `📖 ${s.name}`}
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

      {/* Confirm Delete Spread Dialog */}
      <ConfirmDialog
        isOpen={spreadToDelete !== null}
        title="Delete Album Spread?"
        message={`Are you sure you want to delete "${spreadToDelete?.name}"?`}
        detail="The two facing pages and any layout elements on this spread will be removed from your album."
        confirmText="Delete Spread"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setSpreadToDelete(null)}
      />
    </div>
  );
}
