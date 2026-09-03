import React, { useMemo } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { usePhotoStore } from '../../stores/photoStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import { AlbumElement } from '../../domain/album';
import { TextNodeElement } from '../../domain/text';
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

  const allElements = useMemo(
    () => (activeSpread?.elements || []),
    [activeSpread]
  );

  const lockedElements = useMemo(() => allElements.filter((f) => f.locked), [allElements]);
  const unlockedElements = useMemo(() => allElements.filter((f) => !f.locked), [allElements]);

  const dims = useMemo(() => {
    if (!currentProject) return null;
    return getProjectDimensionsInCanvasUnit(currentProject, activeSpread);
  }, [currentProject, activeSpread]);

  const unit = dims?.unit || 'mm';

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
    if (onToast) onToast(`🔓 Unlocked all ${lockedElements.length} items on spread`);
  };

  const handleLockAll = () => {
    if (!activeSpread) return;
    lockAllFramesOnSpread(activeSpread.id);
    if (onToast) onToast(`🔒 Locked all ${allElements.length} items on spread`);
  };

  const handleToggleLock = (e: React.MouseEvent, frameId: string, isCurrentlyLocked: boolean, isText: boolean = false) => {
    e.stopPropagation();
    if (!activeSpread) return;
    toggleLockSingleFrame(activeSpread.id, frameId, !isCurrentlyLocked);
    if (onToast) {
      if (isCurrentlyLocked) {
        onToast(isText ? '🔓 Text unlocked' : '🔓 Photo unlocked');
      } else {
        onToast(isText ? '🔒 Text locked (fixed position)' : '🔒 Photo locked (fixed position & crop)');
      }
    }
  };

  if (!activeSpread || allElements.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔒</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
            No elements on active spread
          </p>
          <p>Add photos or text to the spread canvas to view and manage locks.</p>
        </div>
      </div>
    );
  }

  const renderElementCard = (frame: AlbumElement, isLocked: boolean) => {
    const isText = frame.type === 'text';
    const textEl = isText ? (frame as TextNodeElement) : null;
    const isSelected = selectedFrameIds.includes(frame.id);
    const thumbSrc = !isText ? getPhotoPreviewSrc(frame.photoId, frame.thumbnailPath || frame.previewPath) : '';
    const dimText = `${Math.round(frame.width)} × ${Math.round(frame.height)} ${unit}`;

    return (
      <div
        key={frame.id}
        className={`${styles.photoCard} ${isLocked ? styles.photoCardLocked : ''} ${isSelected ? styles.photoCardActive : ''}`}
        onClick={() => handleSelect(frame.id)}
        title={`Click to select ${isText ? 'text box' : 'photo frame'} on canvas`}
      >
        <div className={styles.thumbWrapper}>
          {isText ? (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(59, 130, 246, 0.12)',
              borderRadius: '4px',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: '#60a5fa',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1 }}>T</span>
              <span style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.85, marginTop: '2px' }}>TEXT</span>
            </div>
          ) : thumbSrc ? (
            <img src={thumbSrc} alt="" className={styles.thumbImg} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '10px' }}>
              🖼
            </div>
          )}
        </div>

        <div className={styles.photoMeta}>
          <div className={styles.photoName} title={isText ? (textEl?.text || 'Text Box') : (frame.fileName || 'Photo Frame')}>
            {isText
              ? (textEl?.text ? `"${textEl.text.slice(0, 28)}${textEl.text.length > 28 ? '...' : ''}"` : 'Text Box')
              : (frame.fileName || 'Photo Frame')}
          </div>
          <div className={styles.tagDimensions}>{dimText}</div>
        </div>

        <button
          type="button"
          className={`${styles.toggleLockBtn} ${isLocked ? styles.toggleLockBtnActive : ''}`}
          onClick={(e) => handleToggleLock(e, frame.id, isLocked, isText)}
          title={isLocked ? `Unlock this ${isText ? 'text box' : 'photo frame'}` : `Lock this ${isText ? 'text box' : 'photo frame'}`}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
      </div>
    );
  };

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
            title="Unlock all items on this spread (Ctrl+Alt+L)"
          >
            <span>🔓</span>
            <span>Unlock All</span>
          </button>
          <button
            type="button"
            className={`${styles.headerActionBtn} ${styles.lockAllBtn}`}
            onClick={handleLockAll}
            disabled={unlockedElements.length === 0}
            title="Lock all items on this spread (Ctrl+L)"
          >
            <span>🔒</span>
            <span>Lock All</span>
          </button>
        </div>
      </div>

      <div className={styles.scrollContent}>
        {/* Section 1: Locked Items */}
        {lockedElements.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              <span>🔒 Locked Items ({lockedElements.length})</span>
            </div>

            <div className={styles.cardList}>
              {lockedElements.map((frame) => renderElementCard(frame, true))}
            </div>
          </>
        )}

        {/* Section 2: Unlocked Items */}
        {unlockedElements.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              <span>🔓 Unlocked Items ({unlockedElements.length})</span>
            </div>

            <div className={styles.cardList}>
              {unlockedElements.map((frame) => renderElementCard(frame, false))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
