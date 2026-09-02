import React, { useMemo } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { usePhotoStore } from '../../stores/photoStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import styles from './LockedPhotosPanel.module.css';

interface LockedPhotosPanelProps {
  onToast?: (msg: string) => void;
}

export function LockedPhotosPanel({ onToast }: LockedPhotosPanelProps) {
  const { currentAlbum, activeSpreadId } = useAlbumStore();
  const {
    selectedFrameIds,
    selectFrame,
    toggleLockSingleFrame,
    lockAllFramesOnSpread,
    unlockAllFramesOnSpread,
  } = useEditorStore();
  const { currentProject } = useProjectStore();
  const { photos } = usePhotoStore();

  const activeSpread = useMemo(() => {
    if (!currentAlbum || !activeSpreadId) return null;
    return currentAlbum.spreads.find((s) => s.id === activeSpreadId) || currentAlbum.spreads[0] || null;
  }, [currentAlbum, activeSpreadId]);

  const elements = useMemo(() => activeSpread?.elements || [], [activeSpread]);

  const lockedElements = useMemo(() => elements.filter((f) => f.locked), [elements]);
  const unlockedElements = useMemo(() => elements.filter((f) => !f.locked), [elements]);

  const dims = useMemo(() => {
    if (!currentProject) return null;
    return getProjectDimensionsInCanvasUnit(currentProject, activeSpread);
  }, [currentProject, activeSpread]);

  const singlePageW = dims?.pageWidth || 200;
  const unit = dims?.unit || 'mm';

  const getElementPageLocation = (x: number) => {
    return x < singlePageW ? 'Left Page' : 'Right Page';
  };

  const getElementOrientation = (w: number, h: number) => {
    const ratio = w / Math.max(0.001, h);
    if (ratio >= 1.15) return 'Landscape';
    if (ratio <= 0.87) return 'Portrait';
    return 'Square';
  };

  const getPhotoPreviewSrc = (photoId?: string | null, fallbackThumbnail?: string | null) => {
    if (photoId) {
      const p = photos.find((item) => item.id === photoId);
      if (p?.thumbnailPath) return convertFileSrc(p.thumbnailPath);
      if (p?.previewPath) return convertFileSrc(p.previewPath);
      if (p?.filePath) return convertFileSrc(p.filePath);
    }
    if (fallbackThumbnail) return convertFileSrc(fallbackThumbnail);
    return '';
  };

  const handleSelect = (frameId: string) => {
    selectFrame(frameId);
  };

  const handleUnlockAll = () => {
    if (!activeSpread) return;
    unlockAllFramesOnSpread(activeSpread.id);
    if (onToast) onToast(`🔓 Unlocked all ${lockedElements.length} photos on spread`);
  };

  const handleLockAll = () => {
    if (!activeSpread) return;
    lockAllFramesOnSpread(activeSpread.id);
    if (onToast) onToast(`🔒 Locked all ${elements.length} photos on spread`);
  };

  const handleToggleLock = (e: React.MouseEvent, frameId: string, isCurrentlyLocked: boolean) => {
    e.stopPropagation();
    if (!activeSpread) return;
    toggleLockSingleFrame(activeSpread.id, frameId, !isCurrentlyLocked);
    if (onToast) {
      onToast(isCurrentlyLocked ? '🔓 Photo unlocked' : '🔒 Photo locked (fixed position & crop)');
    }
  };

  if (!activeSpread || elements.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔒</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
            No photos on active spread
          </p>
          <p>Drag photos from the tray onto the spread canvas to start designing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header & Quick Batch Actions */}
      <div className={styles.header}>
        <div className={styles.spreadContextBadge}>
          <span>
            Active: <strong>{activeSpread.name || 'Spread'}</strong>
          </span>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={`${styles.headerActionBtn} ${styles.unlockAllBtn}`}
            onClick={handleUnlockAll}
            disabled={lockedElements.length === 0}
            title="Unlock all photos on this spread (Ctrl+Shift+L)"
          >
            <span>🔓</span>
            <span>Unlock All</span>
          </button>
          <button
            type="button"
            className={`${styles.headerActionBtn} ${styles.lockAllBtn}`}
            onClick={handleLockAll}
            disabled={unlockedElements.length === 0}
            title="Lock all photos on this spread (Ctrl+L)"
          >
            <span>🔒</span>
            <span>Lock All</span>
          </button>
        </div>
      </div>

      <div className={styles.scrollContent}>
        {/* Section 1: Locked Photos */}
        {lockedElements.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              <span>🔒 Locked Photos ({lockedElements.length})</span>
            </div>

            <div className={styles.cardList}>
              {lockedElements.map((frame) => {
                const isSelected = selectedFrameIds.includes(frame.id);
                const thumbSrc = getPhotoPreviewSrc(frame.photoId, frame.thumbnailPath || frame.previewPath);
                const pageLoc = getElementPageLocation(frame.x);
                const orientation = getElementOrientation(frame.width, frame.height);
                const dimText = `${Math.round(frame.width)} × ${Math.round(frame.height)} ${unit}`;

                return (
                  <div
                    key={frame.id}
                    className={`${styles.photoCard} ${styles.photoCardLocked} ${isSelected ? styles.photoCardActive : ''}`}
                    onClick={() => handleSelect(frame.id)}
                    title="Click to select frame on canvas"
                  >
                    <div className={styles.thumbWrapper}>
                      {thumbSrc ? (
                        <img src={thumbSrc} alt="" className={styles.thumbImg} loading="lazy" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '10px' }}>
                          🖼
                        </div>
                      )}
                    </div>

                    <div className={styles.photoMeta}>
                      <div className={styles.photoName}>{frame.fileName || 'Photo Frame'}</div>
                      <div className={styles.tagRow}>
                        <span className={`${styles.tagPill} ${styles.tagPage}`}>{pageLoc}</span>
                        <span className={styles.tagPill}>{orientation}</span>
                        <span className={styles.tagDimensions}>{dimText}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`${styles.toggleLockBtn} ${styles.toggleLockBtnActive}`}
                      onClick={(e) => handleToggleLock(e, frame.id, true)}
                      title="Unlock this photo frame"
                    >
                      🔒
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Section 2: Unlocked Photos */}
        {unlockedElements.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              <span>🔓 Unlocked Photos ({unlockedElements.length})</span>
            </div>

            <div className={styles.cardList}>
              {unlockedElements.map((frame) => {
                const isSelected = selectedFrameIds.includes(frame.id);
                const thumbSrc = getPhotoPreviewSrc(frame.photoId, frame.thumbnailPath || frame.previewPath);
                const pageLoc = getElementPageLocation(frame.x);
                const orientation = getElementOrientation(frame.width, frame.height);
                const dimText = `${Math.round(frame.width)} × ${Math.round(frame.height)} ${unit}`;

                return (
                  <div
                    key={frame.id}
                    className={`${styles.photoCard} ${isSelected ? styles.photoCardActive : ''}`}
                    onClick={() => handleSelect(frame.id)}
                    title="Click to select frame on canvas"
                  >
                    <div className={styles.thumbWrapper}>
                      {thumbSrc ? (
                        <img src={thumbSrc} alt="" className={styles.thumbImg} loading="lazy" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '10px' }}>
                          🖼
                        </div>
                      )}
                    </div>

                    <div className={styles.photoMeta}>
                      <div className={styles.photoName}>{frame.fileName || 'Photo Frame'}</div>
                      <div className={styles.tagRow}>
                        <span className={`${styles.tagPill} ${styles.tagPage}`}>{pageLoc}</span>
                        <span className={styles.tagPill}>{orientation}</span>
                        <span className={styles.tagDimensions}>{dimText}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.toggleLockBtn}
                      onClick={(e) => handleToggleLock(e, frame.id, false)}
                      title="Lock this photo frame (Keep position & crop fixed during smart layouts)"
                    >
                      🔓
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
