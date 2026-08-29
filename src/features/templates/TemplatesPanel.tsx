import { useState, useMemo } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import {
  BUILTIN_LAYOUT_TEMPLATES,
  LayoutTemplate,
  generateTemplateSvgPreview,
  getProjectDimensionsInCanvasUnit,
  TemplateCategory,
} from '../../domain/templates';
import {
  generateAdaptiveLayoutVariations,
  AdaptivePhoto,
} from '../../domain/adaptiveLayout';
import styles from './TemplatesPanel.module.css';

interface TemplatesPanelProps {
  onApplyToast?: (msg: string) => void;
}

export function TemplatesPanel({ onApplyToast }: TemplatesPanelProps) {
  const [activeViewMode, setActiveViewMode] = useState<'adaptive' | 'presets'>('adaptive');
  const [selectedFilter, setSelectedFilter] = useState<TemplateCategory>('all');

  const {
    currentAlbum,
    activeSpreadId,
    spreadLayoutIndices,
    applyLayoutTemplate,
    applyAdaptiveLayoutByIndex,
    cycleSpreadLayout,
    shuffleSpreadPhotos,
  } = useAlbumStore();

  const { currentProject } = useProjectStore();

  const activeSpread = useMemo(() => {
    if (!currentAlbum || !activeSpreadId) return null;
    if (currentAlbum.coverSpread.id === activeSpreadId) {
      return currentAlbum.coverSpread;
    }
    return currentAlbum.spreads.find((s) => s.id === activeSpreadId) || null;
  }, [currentAlbum, activeSpreadId]);

  const photos: AdaptivePhoto[] = useMemo(() => {
    if (!activeSpread) return [];
    return activeSpread.elements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
    }));
  }, [activeSpread]);

  const currentPhotoCount = photos.length;
  const isCover = activeSpread ? currentAlbum?.coverSpread.id === activeSpread.id : false;

  // Dynamic Adaptive Variations calculated specifically for the current spread's photos
  const adaptiveVariations = useMemo(() => {
    if (!currentProject || !activeSpread || photos.length === 0) return [];
    const isSpread = !isCover;
    const dims = getProjectDimensionsInCanvasUnit(currentProject, activeSpread);
    const spreadWidth = isCover
      ? (activeSpread.leftPage ? activeSpread.leftPage.width : dims.pageWidth) +
        (activeSpread.rightPage ? activeSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    return generateAdaptiveLayoutVariations(
      {
        spreadWidth,
        spreadHeight,
        isSpread,
        safeMargin: dims.safeMargin,
        gutterWidth: dims.gutterWidth,
        spacing: dims.spacing,
      },
      photos
    );
  }, [currentProject, activeSpread, photos, isCover]);

  const currentActiveIndex =
    activeSpread && spreadLayoutIndices[activeSpread.id] !== undefined
      ? spreadLayoutIndices[activeSpread.id]
      : 0;

  const filteredPresets = useMemo(() => {
    return BUILTIN_LAYOUT_TEMPLATES.filter((template) => {
      if (isCover && template.category === 'spread') return false;
      if (selectedFilter === 'all') return true;
      if (selectedFilter === '1_photo') return template.photoCount === 1;
      if (selectedFilter === '2_photos') return template.photoCount === 2;
      if (selectedFilter === '3_photos') return template.photoCount === 3;
      if (selectedFilter === '4_photos') return template.photoCount === 4;
      if (selectedFilter === '5+_photos') return template.photoCount >= 5;
      return true;
    });
  }, [selectedFilter, isCover]);

  const handleApplyPreset = (template: LayoutTemplate) => {
    if (!activeSpread || !currentProject) return;
    applyLayoutTemplate(activeSpread.id, template, currentProject);
    if (onApplyToast) {
      onApplyToast(`Applied preset: ${template.name}`);
    }
  };

  const handleApplyAdaptive = (index: number, name: string) => {
    if (!activeSpread || !currentProject) return;
    applyAdaptiveLayoutByIndex(activeSpread.id, index, currentProject);
    if (onApplyToast) {
      onApplyToast(`Switched to layout: ${name}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* View Mode Toggle: Adaptive vs All Presets */}
      <div className={styles.modeToggleRow}>
        <button
          type="button"
          className={`${styles.modeBtn} ${activeViewMode === 'adaptive' ? styles.modeBtnActive : ''}`}
          onClick={() => setActiveViewMode('adaptive')}
        >
          <span>🧠 Adaptive (${adaptiveVariations.length})</span>
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${activeViewMode === 'presets' ? styles.modeBtnActive : ''}`}
          onClick={() => setActiveViewMode('presets')}
        >
          <span>📚 All Presets</span>
        </button>
      </div>

      {activeViewMode === 'adaptive' ? (
        <div>
          {/* Adaptive Section Header */}
          <div className={styles.filterHeader}>
            <div className={styles.spreadContextBadge}>
              <span>
                Active Spread: <strong>{activeSpread?.name || 'Spread'}</strong>
              </span>
              <span className={styles.badgeCount}>
                {currentPhotoCount} {currentPhotoCount === 1 ? 'Photo' : 'Photos'}
              </span>
            </div>

            {currentPhotoCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => activeSpread && currentProject && cycleSpreadLayout(activeSpread.id, 'prev', currentProject)}
                    title="Previous Layout (Shift + Space)"
                  >
                    ◀ Prev
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => activeSpread && currentProject && cycleSpreadLayout(activeSpread.id, 'next', currentProject)}
                    title="Next Layout (Space)"
                  >
                    Next ▶
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => activeSpread && shuffleSpreadPhotos(activeSpread.id)}
                  title="Shuffle Photos (S)"
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
              const totalW = isCover
                ? (dims?.pageWidth || 200)
                : (dims ? dims.pageWidth * 2 + dims.gutterWidth : 400);
              const totalH = dims?.pageHeight || 200;

              const scaleX = 140 / totalW;
              const scaleY = 70 / totalH;

              const svgRects = variation.rects
                .map(
                  (r) =>
                    `<rect x="${(r.x * scaleX).toFixed(1)}" y="${(r.y * scaleY).toFixed(1)}" width="${(r.width * scaleX).toFixed(1)}" height="${(r.height * scaleY).toFixed(1)}" rx="2" fill="${isCurrent ? 'rgba(59,130,246,0.4)' : 'var(--color-surface, #27272a)'}" stroke="${isCurrent ? 'var(--color-accent, #3b82f6)' : 'var(--color-border, #3f3f46)'}" stroke-width="${isCurrent ? '1.5' : '1'}"/>`
                )
                .join('');

              const spine = !isCover
                ? `<line x1="${((dims ? (dims.pageWidth + dims.gutterWidth / 2) * scaleX : 70)).toFixed(1)}" y1="4" x2="${((dims ? (dims.pageWidth + dims.gutterWidth / 2) * scaleX : 70)).toFixed(1)}" y2="66" stroke="rgba(255,255,255,0.18)" stroke-dasharray="2 2" stroke-width="1"/>`
                : '';

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
              Drag photos onto the spread or add photos to generate adaptive layout variations.
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Preset Catalog Section */}
          <div className={styles.filterHeader}>
            <div className={styles.filterRow}>
              <button
                type="button"
                className={`${styles.filterBtn} ${selectedFilter === 'all' ? styles.filterBtnActive : ''}`}
                onClick={() => setSelectedFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${selectedFilter === '1_photo' ? styles.filterBtnActive : ''}`}
                onClick={() => setSelectedFilter('1_photo')}
              >
                1 Photo
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${selectedFilter === '2_photos' ? styles.filterBtnActive : ''}`}
                onClick={() => setSelectedFilter('2_photos')}
              >
                2 Photos
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${selectedFilter === '3_photos' ? styles.filterBtnActive : ''}`}
                onClick={() => setSelectedFilter('3_photos')}
              >
                3 Photos
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${selectedFilter === '4_photos' ? styles.filterBtnActive : ''}`}
                onClick={() => setSelectedFilter('4_photos')}
              >
                4 Photos
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${selectedFilter === '5+_photos' ? styles.filterBtnActive : ''}`}
                onClick={() => setSelectedFilter('5+_photos')}
              >
                5+ Photos
              </button>
            </div>
          </div>

          <div className={styles.gridList}>
            {filteredPresets.map((template) => {
              const svgPreview = generateTemplateSvgPreview(template, 140, 70);
              const isCurrentCountMatch = template.photoCount === currentPhotoCount;

              return (
                <div
                  key={template.id}
                  className={styles.templateCard}
                  onClick={() => handleApplyPreset(template)}
                >
                  <div
                    className={styles.svgWrapper}
                    dangerouslySetInnerHTML={{ __html: svgPreview }}
                  />
                  <div className={styles.cardMeta}>
                    <span className={styles.templateTitle}>{template.name}</span>
                    <span className={styles.templateDesc}>{template.description}</span>
                    <div className={styles.tagRow}>
                      <span className={styles.tagPill}>{template.photoCount}P</span>
                      {isCurrentCountMatch && (
                        <span
                          className={styles.tagPill}
                          style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}
                        >
                          Exact Fit
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
