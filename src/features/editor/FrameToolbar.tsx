import { useEditorStore } from '../../stores/editorStore';
import { useAlbumStore } from '../../stores/albumStore';
import { getAllAlbumSpreads } from '../../domain/album';
import { zoomCropAtPoint, PhotoFrameElement } from '../../domain/editor';
import styles from './FrameToolbar.module.css';

export function FrameToolbar() {
  const { currentAlbum, activeSpreadId } = useAlbumStore();
  const {
    selectedFrameIds,
    editingCropFrameId,
    deleteSelectedFrames,
    rotateSelectedFrames,
    enterCropMode,
    exitCropMode,
    resetToOriginalRatio,
    resetSelectedRatio,
    resetCrop,
    swapFrames,
    groupSelectedFrames,
    ungroupSelectedFrames,
    updateFrameGeometry,
    updateCrop,
  } = useEditorStore();

  if (!currentAlbum || selectedFrameIds.length === 0) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  if (!activeSpread) return null;

  const primaryFrameId = selectedFrameIds[0];
  const foundFrame = (activeSpread.elements || []).find((f) => f.id === primaryFrameId);
  if (!foundFrame || foundFrame.type !== 'photo') return null;
  const frame = foundFrame as PhotoFrameElement;

  const selectedElements = (activeSpread.elements || []).filter((f) =>
    selectedFrameIds.includes(f.id)
  );
  const distinctGroupIds = new Set(selectedElements.map((f) => f.groupId).filter(Boolean));
  const hasUngrouped = selectedElements.some((f) => !f.groupId);
  const canGroup = selectedElements.length >= 2 && (distinctGroupIds.size > 1 || hasUngrouped);
  const canUngroup = distinctGroupIds.size > 0;

  const isCrop = editingCropFrameId === frame.id;
  const updateCropZoom = (delta: number) => {
    const nextCrop = zoomCropAtPoint(
      frame,
      { x: frame.width / 2, y: frame.height / 2 },
      (frame.cropScale || 1.0) + delta
    );
    updateCrop(activeSpread.id, frame.id, nextCrop);
  };

  return (
    <div className={styles.verticalDockContainer}>
      {/* When in Crop Mode: Clean Pure Icon Dock */}
      {isCrop ? (
        <>
          {/* 1. Finish Crop (Done Checkmark) */}
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnCropDone}`}
            onClick={exitCropMode}
            title="Finish Crop Mode (Enter / Esc)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>

          <div className={styles.divider} />

          {/* 2. Zoom In (+) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => updateCropZoom(0.01)}
            disabled={(frame.cropScale || 1.0) >= 3.5}
            title="Zoom In Inside Frame (+1%)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          {/* Zoom % Pill */}
          <div className={styles.zoomPercentPill} title="Current Zoom Scale">
            {Math.round((frame.cropScale || 1.0) * 100)}%
          </div>

          {/* 3. Zoom Out (-) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => updateCropZoom(-0.01)}
            disabled={(frame.cropScale || 1.0) <= 1.0}
            title="Zoom Out Inside Frame (−1%)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <div className={styles.divider} />

          {/* 4. Reset Crop */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => resetCrop(activeSpread.id, frame.id)}
            title="Reset Crop Position & Scale (Center Fit)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </>
      ) : (
        <>
          {/* 1. Crop Image (Double Click) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => enterCropMode(frame.id)}
            title="Crop Image (Double Click)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2v14a2 2 0 0 0 2 2h14" />
              <path d="M18 22V8a2 2 0 0 0-2-2H2" />
            </svg>
          </button>
          <div className={styles.divider} />

          {/* 2. Reset to Original Aspect Ratio (1-Click Restore) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() =>
              selectedFrameIds.length > 1
                ? resetSelectedRatio(activeSpread.id)
                : resetToOriginalRatio(activeSpread.id, frame.id)
            }
            title={selectedFrameIds.length > 1 ? `Reset ${selectedFrameIds.length} Frames to Original Aspect Ratio` : 'Reset to Original Aspect Ratio (3:2 / 4:3)'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" strokeDasharray="3 2" />
              <path d="M7 12h10" />
              <path d="M12 7v10" />
            </svg>
          </button>

          {/* 3. Rotate 90° */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => rotateSelectedFrames(activeSpread.id, 'cw')}
            title={selectedFrameIds.length > 1 ? `Rotate ${selectedFrameIds.length} Frames 90° (R)` : 'Rotate 90° (R)'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.57 2.6L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>

          {/* 4. Border Toggle */}
          <button
            type="button"
            className={`${styles.toolBtn} ${frame.borderEnabled ? styles.toolBtnActive : ''}`}
            onClick={() =>
              updateFrameGeometry(activeSpread.id, frame.id, {
                borderEnabled: !frame.borderEnabled,
              })
            }
            title={frame.borderEnabled ? 'Disable Frame Border' : 'Enable Frame Border'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
            </svg>
          </button>

          {/* Contextual: Swap 2 Photos Button (When 2 frames are selected) */}
          {selectedFrameIds.length === 2 && selectedFrameIds[0] && selectedFrameIds[1] && (
            <button
              type="button"
              className={`${styles.toolBtn} ${styles.toolBtnActive}`}
              onClick={() => swapFrames(activeSpread.id, selectedFrameIds[0]!, selectedFrameIds[1]!)}
              title="Swap 2 Photos (S)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 3 4 4-4 4" />
                <path d="M20 7H4" />
                <path d="m8 21-4-4 4-4" />
                <path d="M4 17h16" />
              </svg>
            </button>
          )}

          {/* Contextual: Group Frames Button */}
          {canGroup && (
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => groupSelectedFrames(activeSpread.id)}
              title={`Group ${selectedFrameIds.length} Frames (Ctrl+G)`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="9" height="9" x="2" y="2" rx="1.5" />
                <rect width="9" height="9" x="13" y="13" rx="1.5" />
              </svg>
            </button>
          )}

          {/* Contextual: Ungroup Frames Button */}
          {canUngroup && (
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => ungroupSelectedFrames(activeSpread.id)}
              title="Ungroup Frames (Ctrl+Shift+G)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="8" height="8" x="2" y="2" rx="1" strokeDasharray="2 2" />
                <rect width="8" height="8" x="14" y="14" rx="1" strokeDasharray="2 2" />
              </svg>
            </button>
          )}

          {/* Lock / Unlock Toggle Button */}
          <button
            type="button"
            className={`${styles.toolBtn} ${selectedElements.every((f) => f.locked) ? styles.toolBtnActive : ''}`}
            style={{
              color: selectedElements.every((f) => f.locked) ? '#f59e0b' : undefined,
              borderColor: selectedElements.every((f) => f.locked) ? '#f59e0b' : undefined,
            }}
            onClick={() => useEditorStore.getState().toggleLockSelectedFrames(activeSpread.id)}
            title={
              selectedElements.some((f) => !f.locked)
                ? selectedFrameIds.length > 1
                  ? `Lock ${selectedFrameIds.length} Frames (Ctrl+L)`
                  : 'Lock Photo Frame (Ctrl+L)'
                : selectedFrameIds.length > 1
                ? `Unlock ${selectedFrameIds.length} Frames (Alt+L)`
                : 'Unlock Photo Frame (Alt+L)'
            }
          >
            {selectedElements.every((f) => f.locked) ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
            )}
          </button>

          <div className={styles.divider} />

          {/* 5. Delete Frame */}
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
            onClick={() => deleteSelectedFrames(activeSpread.id)}
            title="Remove Photo Frame from Canvas (Delete)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
