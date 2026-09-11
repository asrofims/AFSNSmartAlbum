import React, { useMemo, useRef } from 'react';
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
    selectFrames,
    clearSelection,
    toggleLockSingleFrame,
    toggleLockSelectedFrames,
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

  // Display order in the panel (locked items first, then unlocked items)
  const displayList = useMemo(() => {
    return [...lockedElements, ...unlockedElements];
  }, [lockedElements, unlockedElements]);

  const lastClickedIdRef = useRef<string | null>(null);

  const dims = useMemo(() => {
    if (!currentProject) return null;
    return getProjectDimensionsInCanvasUnit(currentProject, activeSpread);
  }, [currentProject, activeSpread]);

  const unit = dims?.unit || 'mm';

  const getPhotoPreviewSrc = (photoId?: string | null, fallbackThumbnail?: string | null) => {
    if (photoId) {
      const p = photos.find((item) => item.id === photoId);
      if (p?.thumbnailPath) return `${convertFileSrc(p.thumbnailPath)}?v=${encodeURIComponent(p.updatedAt || '')}`;
      if (p?.previewPath) return `${convertFileSrc(p.previewPath)}?v=${encodeURIComponent(p.updatedAt || '')}`;
    }
    if (fallbackThumbnail) return convertFileSrc(fallbackThumbnail);
    return '';
  };

  // Helper to expand grouped frames so selections maintain group integrity
  const expandGroups = (ids: string[], elements: AlbumElement[]) => {
    const result = new Set<string>();
    for (const id of ids) {
      const el = elements.find((e) => e.id === id);
      if (el?.groupId) {
        elements.filter((e) => e.groupId === el.groupId).forEach((e) => result.add(e.id));
      } else {
        result.add(id);
      }
    }
    return Array.from(result);
  };

  // Handle Card Click: Single select, Ctrl/Cmd multi-toggle, Shift range selection
  const handleCardClick = (e: React.MouseEvent, frameId: string) => {
    const isMulti = Boolean(e.ctrlKey || e.metaKey);
    const isRange = Boolean(e.shiftKey);

    if (isRange) {
      const anchorId =
        lastClickedIdRef.current ||
        (selectedFrameIds.length > 0 ? selectedFrameIds[selectedFrameIds.length - 1] : frameId);
      const anchorIdx = displayList.findIndex((el) => el.id === anchorId);
      const targetIdx = displayList.findIndex((el) => el.id === frameId);

      if (anchorIdx !== -1 && targetIdx !== -1) {
        const minIdx = Math.min(anchorIdx, targetIdx);
        const maxIdx = Math.max(anchorIdx, targetIdx);
        const rangeSlice = displayList.slice(minIdx, maxIdx + 1).map((el) => el.id);

        if (isMulti) {
          // Ctrl + Shift: Add range to existing selection
          const expanded = expandGroups([...selectedFrameIds, ...rangeSlice], allElements);
          selectFrames(expanded);
        } else {
          // Shift alone: Set selection to range
          const expanded = expandGroups(rangeSlice, allElements);
          selectFrames(expanded);
        }
        return;
      }
    }

    const targetEl = allElements.find((el) => el.id === frameId);
    const targetGroupId = targetEl?.groupId;
    const targetIds = targetGroupId
      ? allElements.filter((el) => el.groupId === targetGroupId).map((el) => el.id)
      : [frameId];

    const isSelected = targetIds.some((id) => selectedFrameIds.includes(id));

    if (isSelected) {
      // Unselect clicked card (and its group members) from the selection
      const remaining = selectedFrameIds.filter((id) => !targetIds.includes(id));
      selectFrames(remaining);
      lastClickedIdRef.current = remaining.length > 0 ? (remaining[remaining.length - 1] ?? null) : null;
      return;
    }

    if (isMulti) {
      selectFrame(frameId, true);
      lastClickedIdRef.current = frameId;
    } else {
      selectFrame(frameId, false);
      lastClickedIdRef.current = frameId;
    }
  };

  // Selection statistics on active spread
  const selectedOnSpread = useMemo(() => {
    return allElements.filter((el) => selectedFrameIds.includes(el.id));
  }, [allElements, selectedFrameIds]);

  const selectedLockedCount = useMemo(() => {
    return selectedOnSpread.filter((el) => el.locked).length;
  }, [selectedOnSpread]);

  const selectedUnlockedCount = useMemo(() => {
    return selectedOnSpread.filter((el) => !el.locked).length;
  }, [selectedOnSpread]);

  const handleSelectAll = () => {
    const allIds = allElements.map((el) => el.id);
    selectFrames(allIds);
    if (onToast) onToast(`Selected all ${allIds.length} items on spread`);
  };

  const handleClearSelection = () => {
    clearSelection();
  };

  const handleSelectAllLocked = () => {
    const ids = lockedElements.map((el) => el.id);
    selectFrames(expandGroups(ids, allElements));
    if (onToast) onToast(`Selected ${ids.length} locked item${ids.length > 1 ? 's' : ''}`);
  };

  const handleSelectAllUnlocked = () => {
    const ids = unlockedElements.map((el) => el.id);
    selectFrames(expandGroups(ids, allElements));
    if (onToast) onToast(`Selected ${ids.length} unlocked item${ids.length > 1 ? 's' : ''}`);
  };

  const handleLockSelected = () => {
    if (!activeSpread || selectedUnlockedCount === 0) return;
    toggleLockSelectedFrames(activeSpread.id, true);
    if (onToast) onToast(`🔒 Locked ${selectedUnlockedCount} selected item${selectedUnlockedCount > 1 ? 's' : ''}`);
  };

  const handleUnlockSelected = () => {
    if (!activeSpread || selectedLockedCount === 0) return;
    toggleLockSelectedFrames(activeSpread.id, false);
    if (onToast) onToast(`🔓 Unlocked ${selectedLockedCount} selected item${selectedLockedCount > 1 ? 's' : ''}`);
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
        onClick={(e) => handleCardClick(e, frame.id)}
        title="Click to select • Click selected to unselect • Ctrl+Click to toggle • Shift+Click for range"
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
            Active: <strong>{activeSpread.name || 'Spread'}</strong> ({allElements.length})
          </span>
          <div className={styles.headerQuickLinks}>
            {selectedOnSpread.length > 0 ? (
              <button
                type="button"
                className={styles.headerTextBtn}
                onClick={handleClearSelection}
                title="Deselect all (Esc)"
              >
                Clear Selection
              </button>
            ) : (
              <button
                type="button"
                className={styles.headerTextBtn}
                onClick={handleSelectAll}
                title="Select all items on active spread (Ctrl+A)"
              >
                Select All
              </button>
            )}
          </div>
        </div>

        {/* Contextual Action Row: Batch Lock / Unlock for Selection, or Spread-Wide */}
        {selectedOnSpread.length > 0 ? (
          <div className={styles.selectionBar}>
            <div className={styles.selectionCountPill}>
              <span>{selectedOnSpread.length} Selected</span>
              <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 500 }}>
                {selectedLockedCount > 0 && selectedUnlockedCount > 0
                  ? `${selectedLockedCount} locked, ${selectedUnlockedCount} unlocked`
                  : selectedLockedCount > 0
                  ? 'All locked'
                  : 'All unlocked'}
              </span>
            </div>
            <div className={styles.selectionActionRow}>
              {selectedUnlockedCount > 0 && (
                <button
                  type="button"
                  className={`${styles.headerActionBtn} ${styles.lockSelectedBtn}`}
                  onClick={handleLockSelected}
                  title={`Lock ${selectedUnlockedCount} selected item(s) (Ctrl+L)`}
                >
                  <span>🔒</span>
                  <span>Lock ({selectedUnlockedCount})</span>
                </button>
              )}
              {selectedLockedCount > 0 && (
                <button
                  type="button"
                  className={`${styles.headerActionBtn} ${styles.unlockSelectedBtn}`}
                  onClick={handleUnlockSelected}
                  title={`Unlock ${selectedLockedCount} selected item(s) (Alt+L)`}
                >
                  <span>🔓</span>
                  <span>Unlock ({selectedLockedCount})</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.actionRow}>
            {lockedElements.length > 0 && (
              <button
                type="button"
                className={`${styles.headerActionBtn} ${styles.unlockAllBtn}`}
                onClick={handleUnlockAll}
                title="Unlock all items on this spread (Ctrl+Alt+L)"
              >
                <span>🔓</span>
                <span>Unlock All ({lockedElements.length})</span>
              </button>
            )}
            {unlockedElements.length > 0 && (
              <button
                type="button"
                className={`${styles.headerActionBtn} ${styles.lockAllBtn}`}
                onClick={handleLockAll}
                title="Lock all items on this spread (Ctrl+L)"
              >
                <span>🔒</span>
                <span>Lock All ({unlockedElements.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.scrollContent}>
        {/* Section 1: Locked Items */}
        {lockedElements.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              <span>🔒 Locked Items ({lockedElements.length})</span>
              <button
                type="button"
                className={styles.sectionSelectBtn}
                onClick={handleSelectAllLocked}
                title="Select all locked items on spread"
              >
                Select All
              </button>
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
              <button
                type="button"
                className={styles.sectionSelectBtn}
                onClick={handleSelectAllUnlocked}
                title="Select all unlocked items on spread"
              >
                Select All
              </button>
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
