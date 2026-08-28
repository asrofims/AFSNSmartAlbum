import { useEditorStore } from '../../stores/editorStore';
import { useAlbumStore } from '../../stores/albumStore';
import { getAllAlbumSpreads } from '../../domain/album';
import styles from './FrameToolbar.module.css';

export function FrameToolbar() {
  const { currentAlbum, activeSpreadId } = useAlbumStore();
  const {
    selectedFrameIds,
    editingCropFrameId,
    deleteSelectedFrames,
    rotateFrame90,
    bringToFront,
    sendToBack,
    enterCropMode,
    exitCropMode,
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
    <div className={styles.toolbarContainer}>
      {/* Crop / Finish Crop Mode Toggle */}
      <button
        type="button"
        className={`${styles.toolBtn} ${isCrop ? styles.toolBtnActive : ''}`}
        onClick={() => (isCrop ? exitCropMode() : enterCropMode(frame.id))}
        title={isCrop ? 'Finish Crop Mode (Esc)' : 'Crop Image inside Frame (Double Click)'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
        <span>{isCrop ? 'Done' : 'Crop'}</span>
      </button>

      <div className={styles.divider} />

      {/* Rotate CCW */}
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => rotateFrame90(activeSpread.id, frame.id, 'ccw')}
        title="Rotate Left 90°"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>

      {/* Rotate CW */}
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => rotateFrame90(activeSpread.id, frame.id, 'cw')}
        title="Rotate Right 90°"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.57 2.6L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>

      <div className={styles.divider} />

      {/* Border Toggle */}
      <button
        type="button"
        className={`${styles.toolBtn} ${frame.borderEnabled ? styles.toolBtnActive : ''}`}
        onClick={() =>
          updateFrameGeometry(activeSpread.id, frame.id, {
            borderEnabled: !frame.borderEnabled,
          })
        }
        title="Toggle Photo Border"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="18" height="18" x="3" y="3" rx="2" />
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 12 17 2 12" />
          <polyline points="22 7 12 12 2 7" />
        </svg>
      </button>

      <div className={styles.divider} />

      {/* Delete Frame */}
      <button
        type="button"
        className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
        onClick={() => deleteSelectedFrames(activeSpread.id)}
        title="Delete Photo Frame (Delete / Backspace)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
