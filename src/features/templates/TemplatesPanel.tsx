import { useMemo } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import {
  generateAdaptiveLayoutVariations,
  AdaptivePhoto,
} from '../../domain/adaptiveLayout';
import { PhotoFrameElement } from '../../domain/editor';
import styles from './TemplatesPanel.module.css';

interface TemplatesPanelProps {
  onApplyToast?: (msg: string) => void;
}

export function TemplatesPanel({ onApplyToast }: TemplatesPanelProps) {
  const {
    currentAlbum,
    activeSpreadId,
    spreadLayoutIndices,
    applyAdaptiveLayoutByIndex,
    cycleSpreadLayout,
    shuffleSpreadPhotos,
  } = useAlbumStore();

  const { currentProject } = useProjectStore();

  const activeSpread = useMemo(() => {
    if (!currentAlbum || !activeSpreadId) return null;
    return currentAlbum.spreads.find((s) => s.id === activeSpreadId) || currentAlbum.spreads[0] || null;
  }, [currentAlbum, activeSpreadId]);

  const unlockedElements = useMemo(() => {
    if (!activeSpread) return [];
    return activeSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && !el.locked);
  }, [activeSpread]);

  const lockedElements = useMemo(() => {
    if (!activeSpread) return [];
    return activeSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && Boolean(el.locked));
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

  const currentPhotoCount = photos.length;

  // Dynamic Adaptive Variations calculated specifically for the current spread's photos
  const adaptiveVariations = useMemo(() => {
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

  const currentActiveIndex =
    activeSpread && spreadLayoutIndices[activeSpread.id] !== undefined
      ? spreadLayoutIndices[activeSpread.id]
      : 0;

  const handleApplyAdaptive = (index: number, name: string) => {
    if (!activeSpread || !currentProject) return;
    applyAdaptiveLayoutByIndex(activeSpread.id, index, currentProject);
    if (onApplyToast) {
      onApplyToast(`Switched to layout: ${name}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header with Active Spread & Photos Count */}
      <div className={styles.filterHeader}>
        <div className={styles.spreadContextBadge}>
          <span>
            Active: <strong>{activeSpread?.name || 'Spread'}</strong>
          </span>
          <span className={styles.badgeCount}>
            {currentPhotoCount} {currentPhotoCount === 1 ? 'Photo' : 'Photos'}
          </span>
        </div>

        {currentPhotoCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => activeSpread && currentProject && cycleSpreadLayout(activeSpread.id, 'prev', currentProject)}
                title="Previous Layout (Shift + Space)"
              >
                ◀ Prev Layout
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => activeSpread && currentProject && cycleSpreadLayout(activeSpread.id, 'next', currentProject)}
                title="Next Layout (Space)"
              >
                Next Layout ▶
              </button>
            </div>

            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => activeSpread && shuffleSpreadPhotos(activeSpread.id)}
              title="Shuffle Photos (S)"
              style={{ background: 'var(--color-accent)', color: '#ffffff', borderColor: 'var(--color-accent)' }}
            >
              🔀 Shuffle
            </button>
          </div>
        )}
      </div>

      {/* Adaptive Variations Grid */}
      <div className={styles.gridList}>
        {adaptiveVariations.map((variation, index) => {
          const isCurrent = index === ((currentActiveIndex ?? 0) % (adaptiveVariations.length || 1));

          // Render mini SVG from variation rects
          const dims = currentProject ? getProjectDimensionsInCanvasUnit(currentProject, activeSpread) : null;
          const totalW = dims ? dims.pageWidth * 2 + dims.gutterWidth : 400;
          const totalH = dims?.pageHeight || 200;

          const scaleX = 140 / totalW;
          const scaleY = 70 / totalH;

          const svgRects = variation.rects
            .map(
              (r) =>
                `<rect x="${(r.x * scaleX).toFixed(1)}" y="${(r.y * scaleY).toFixed(1)}" width="${(r.width * scaleX).toFixed(1)}" height="${(r.height * scaleY).toFixed(1)}" rx="2" fill="${isCurrent ? 'rgba(59,130,246,0.4)' : 'var(--color-surface, #27272a)'}" stroke="${isCurrent ? 'var(--color-accent, #3b82f6)' : 'var(--color-border, #3f3f46)'}" stroke-width="${isCurrent ? '1.5' : '1'}"/>`
            )
            .join('');

          const spine = `<line x1="${((dims ? (dims.pageWidth + dims.gutterWidth / 2) * scaleX : 70)).toFixed(1)}" y1="4" x2="${((dims ? (dims.pageWidth + dims.gutterWidth / 2) * scaleX : 70)).toFixed(1)}" y2="66" stroke="rgba(255,255,255,0.18)" stroke-dasharray="2 2" stroke-width="1"/>`;

          const svg = `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg"><rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>${spine}${svgRects}</svg>`;

          return (
            <div
              key={variation.id}
              className={`${styles.templateCard} ${isCurrent ? styles.activeCard : ''}`}
              onClick={() => handleApplyAdaptive(index, variation.name)}
            >
              <div
                className={styles.svgWrapper}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div className={styles.cardMeta}>
                <span className={styles.templateTitle}>{variation.name}</span>
                <span className={styles.templateDesc}>{variation.description}</span>
                <div className={styles.tagRow}>
                  <span className={styles.tagPill}>{index + 1} of {adaptiveVariations.length}</span>
                  {variation.score !== undefined && (
                    <span
                      className={styles.tagPill}
                      style={{
                        background: variation.score >= 85 ? 'rgba(52,211,153,0.2)' : variation.score >= 70 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)',
                        color: variation.score >= 85 ? '#34d399' : variation.score >= 70 ? '#fbbf24' : '#94a3b8',
                        fontWeight: 600,
                      }}
                    >
                      ⭐ {variation.score}%
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      className={styles.tagPill}
                      style={{ background: 'rgba(59,130,246,0.3)', color: '#93c5fd', fontWeight: 600 }}
                    >
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {adaptiveVariations.length === 0 && (
        <div className={styles.emptyState}>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
            {currentPhotoCount > 0 ? 'No Layout Variations for Available Space' : 'No Photos on Active Spread'}
          </p>
          <p>
            {currentPhotoCount > 0
              ? 'The remaining free space around locked frames is too constrained to fit all unlocked photos. Try unlocking a frame or resizing locked frames.'
              : 'Drag photos from the tray onto the canvas to generate Smart Layout variations automatically.'}
          </p>
        </div>
      )}
    </div>
  );
}
