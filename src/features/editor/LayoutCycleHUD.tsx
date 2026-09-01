import { useEffect, useMemo, useCallback } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import {
  generateAdaptiveLayoutVariations,
  AdaptivePhoto,
} from '../../domain/adaptiveLayout';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import styles from './LayoutCycleHUD.module.css';

export function LayoutCycleHUD() {
  const {
    currentAlbum,
    activeSpreadId,
    spreadLayoutIndices,
    cycleSpreadLayout,
    shuffleSpreadPhotos,
  } = useAlbumStore();

  const currentProject = useProjectStore((s) => s.currentProject);
  const editingCropFrameId = useEditorStore((s) => s.editingCropFrameId);

  const activeSpread = useMemo(() => {
    if (!currentAlbum || !activeSpreadId) return null;
    return currentAlbum.spreads.find((s) => s.id === activeSpreadId) || currentAlbum.spreads[0] || null;
  }, [currentAlbum, activeSpreadId]);

  const unlockedElements = useMemo(() => {
    if (!activeSpread) return [];
    return activeSpread.elements.filter((el) => !el.locked);
  }, [activeSpread]);

  const lockedElements = useMemo(() => {
    if (!activeSpread) return [];
    return activeSpread.elements.filter((el) => el.locked);
  }, [activeSpread]);

  const photos: AdaptivePhoto[] = useMemo(() => {
    return unlockedElements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
    }));
  }, [unlockedElements]);

  const variations = useMemo(() => {
    if (!currentProject || !activeSpread || photos.length === 0) return [];
    const dims = getProjectDimensionsInCanvasUnit(currentProject, activeSpread);
    const spreadWidth = dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    return generateAdaptiveLayoutVariations(
      {
        spreadWidth,
        spreadHeight,
        isSpread: true,
        safeMargin: dims.safeMargin,
        gutterWidth: dims.gutterWidth,
        spacing: dims.spacing,
        lockedElements,
      },
      photos
    );
  }, [currentProject, activeSpread, photos, lockedElements]);

  const currentIndex = (activeSpread && spreadLayoutIndices[activeSpread.id]) ?? 0;
  const safeIndex = variations.length > 0 ? currentIndex % variations.length : 0;
  const currentVariation = variations[safeIndex];

  const handleNext = useCallback(() => {
    if (!activeSpread || !currentProject) return;
    cycleSpreadLayout(activeSpread.id, 'next', currentProject);
  }, [activeSpread, currentProject, cycleSpreadLayout]);

  const handlePrev = useCallback(() => {
    if (!activeSpread || !currentProject) return;
    cycleSpreadLayout(activeSpread.id, 'prev', currentProject);
  }, [activeSpread, currentProject, cycleSpreadLayout]);

  const handleShuffle = useCallback(() => {
    if (!activeSpread) return;
    shuffleSpreadPhotos(activeSpread.id);
  }, [activeSpread, shuffleSpreadPhotos]);

  // Global Keyboard Navigation (Space for Next, Shift+Space for Prev, S for Shuffle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or dialog, or in crop mode
      if (editingCropFrameId) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleNext();
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleShuffle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleShuffle, editingCropFrameId]);

  if (!currentProject || !activeSpread || photos.length === 0 || variations.length === 0) {
    return null;
  }

  return (
    <div className={styles.hudContainer}>
      <div className={styles.cycleGroup}>
        <button
          type="button"
          className={styles.hudBtn}
          onClick={handlePrev}
          title="Previous Layout Variant (Shift + Space)"
        >
          ◀
        </button>

        <span className={styles.badge}>
          {safeIndex + 1} / {variations.length}
        </span>

        <button
          type="button"
          className={styles.hudBtn}
          onClick={handleNext}
          title="Next Layout Variant (Space)"
        >
          ▶
        </button>
      </div>

      <div className={styles.separator} />

      {currentVariation && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {currentVariation.score !== undefined && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: currentVariation.score >= 85 ? '#34d399' : currentVariation.score >= 70 ? '#fbbf24' : '#94a3b8',
                backgroundColor: 'rgba(255,255,255,0.08)',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
              title={`Layout Aspect-Ratio Match: ${currentVariation.score}%\nEstimated Crop Penalty: ${Math.round((currentVariation.cropPenalty || 0) * 100)}%\nFingerprint: ${currentVariation.fingerprint || 'Auto'}`}
            >
              ⭐ {currentVariation.score}%
            </span>
          )}
          <span className={styles.layoutName} title={currentVariation.description}>
            {currentVariation.name}
          </span>
        </div>
      )}

      <div className={styles.separator} />

      <button
        type="button"
        className={styles.hudBtn}
        onClick={handleShuffle}
        title="Shuffle Photo Placements (Press S)"
      >
        <span>🔀 Shuffle</span>
        <span className={styles.shortcutHint}>S</span>
      </button>

      <span className={styles.shortcutHint} title="Press Spacebar to cycle layouts">
        Space
      </span>
    </div>
  );
}
