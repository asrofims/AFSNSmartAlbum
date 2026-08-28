import { useEditorStore } from '../../stores/editorStore';
import { useAlbumStore } from '../../stores/albumStore';
import { getAllAlbumSpreads } from '../../domain/album';
import styles from './FrameToolbar.module.css';

export function FrameToolbar() {
  const { currentAlbum, activeSpreadId } = useAlbumStore();
  const {
    selectedFrameIds,
    editingCropFrameId,
    snapEnabled,
    toggleSnap,
    deleteSelectedFrames,
    rotateFrame90,
    bringToFront,
    sendToBack,
    enterCropMode,
    exitCropMode,
    resetToOriginalRatio,
    resetCrop,
    updateFrameGeometry,
  } = useEditorStore();

  if (!currentAlbum || selectedFrameIds.length === 0) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  if (!activeSpread) return null;

  const primaryFrameId = selectedFrameIds[0];
  const frame = (activeSpread.elements || []).find((f) => f.id === primaryFrameId);
  if (!frame) return null;

  const isCrop = editingCropFrameId === frame.id;

  return (
    <div className={styles.verticalDockContainer}>
      {/* Crop / Done (Icon only) */}
      <button
        type="button"
        className={`${styles.toolBtn} ${isCrop ? styles.toolBtnActive : ''}`}
        onClick={() => (isCrop ? exitCropMode() : enterCropMode(frame.id))}
        title={isCrop ? 'Finish Crop Mode (Esc)' : 'Crop Image (Double Click)'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      </button>

      {/* When in Crop Mode: Zoom in, Zoom out, Reset */}
      {isCrop && (
        <>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() =>
              updateFrameGeometry(activeSpread.id, frame.id, {
                cropScale: Math.min(3.5, (frame.cropScale || 1.0) + 0.15),
              })
            }
            title="Zoom In Inside Frame"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.toolBtn}
            onClick={() =>
              updateFrameGeometry(activeSpread.id, frame.id, {
                cropScale: Math.max(1.0, (frame.cropScale || 1.0) - 0.15),
              })
            }
            title="Zoom Out Inside Frame"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

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
      )}

      {!isCrop && (
        <>
          <div className={styles.divider} />

          {/* Reset to Original Aspect Ratio (1-Click Restore) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => resetToOriginalRatio(activeSpread.id, frame.id)}
            title="Reset to Original Aspect Ratio (3:2 / 4:3)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" strokeDasharray="3 2" />
              <path d="M7 12h10" />
              <path d="M12 7v10" />
            </svg>
          </button>

          <div className={styles.divider} />

          {/* Rotate CCW (Icon only) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => rotateFrame90(activeSpread.id, frame.id, 'ccw')}
            title="Rotate Left 90°"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          {/* Rotate CW (Icon only) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => rotateFrame90(activeSpread.id, frame.id, 'cw')}
            title="Rotate Right 90°"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.57 2.6L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>

          <div className={styles.divider} />

          {/* Border Toggle (Icon only, no text, no dot) */}
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

          <div className={styles.divider} />

          {/* Magnet Snapping Toggle (Icon only) */}
          <button
            type="button"
            className={`${styles.toolBtn} ${snapEnabled ? styles.toolBtnActive : ''}`}
            onClick={toggleSnap}
            title={snapEnabled ? 'Magnet Snapping: ON (Hold Alt to bypass)' : 'Magnet Snapping: OFF'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3v6a6 6 0 0 0 12 0V3" />
              <line x1="6" y1="3" x2="6" y2="7" />
              <line x1="18" y1="3" x2="18" y2="7" />
              <line x1="4" y1="7" x2="8" y2="7" />
              <line x1="16" y1="7" x2="20" y2="7" />
            </svg>
          </button>

          <div className={styles.divider} />

          {/* Layer Ordering: Bring to Front */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => bringToFront(activeSpread.id, frame.id)}
            title="Bring to Front"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </button>

          {/* Layer Ordering: Send to Back */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => sendToBack(activeSpread.id, frame.id)}
            title="Send to Back"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 12 17 2 12" />
              <polyline points="22 7 12 12 2 7" />
            </svg>
          </button>

          <div className={styles.divider} />

          {/* Delete Frame from Canvas */}
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
