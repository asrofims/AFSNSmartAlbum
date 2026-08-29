import { useState, useMemo } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import {
  BUILTIN_LAYOUT_TEMPLATES,
  LayoutTemplate,
  generateTemplateSvgPreview,
  TemplateCategory,
} from '../../domain/templates';
import styles from './TemplatesPanel.module.css';

interface TemplatesPanelProps {
  onApplyToast?: (msg: string) => void;
}

export function TemplatesPanel({ onApplyToast }: TemplatesPanelProps) {
  const [selectedFilter, setSelectedFilter] = useState<TemplateCategory>('all');
  const { currentAlbum, activeSpreadId, applyLayoutTemplate } = useAlbumStore();
  const { currentProject } = useProjectStore();

  const activeSpread = useMemo(() => {
    if (!currentAlbum || !activeSpreadId) return null;
    if (currentAlbum.coverSpread.id === activeSpreadId) {
      return currentAlbum.coverSpread;
    }
    return currentAlbum.spreads.find((s) => s.id === activeSpreadId) || null;
  }, [currentAlbum, activeSpreadId]);

  const currentPhotoCount = activeSpread ? activeSpread.elements.length : 0;

  const filteredTemplates = useMemo(() => {
    return BUILTIN_LAYOUT_TEMPLATES.filter((template) => {
      // If single page cover, only show single_page or both
      if (activeSpread && currentAlbum && currentAlbum.coverSpread.id === activeSpread.id) {
        if (template.category === 'spread') return false;
      }

      if (selectedFilter === 'all') return true;
      if (selectedFilter === '1_photo') return template.photoCount === 1;
      if (selectedFilter === '2_photos') return template.photoCount === 2;
      if (selectedFilter === '3_photos') return template.photoCount === 3;
      if (selectedFilter === '4_photos') return template.photoCount === 4;
      if (selectedFilter === '5+_photos') return template.photoCount >= 5;
      return true;
    });
  }, [selectedFilter, activeSpread, currentAlbum]);

  const handleApply = (template: LayoutTemplate) => {
    if (!activeSpread || !currentProject) return;
    applyLayoutTemplate(activeSpread.id, template, currentProject);
    if (onApplyToast) {
      onApplyToast(`Applied layout: ${template.name}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Filter & Context Header */}
      <div className={styles.filterHeader}>
        {activeSpread && (
          <div className={styles.spreadContextBadge}>
            <span>
              Active Spread: <strong>{activeSpread.name || 'Spread'}</strong>
            </span>
            <span className={styles.badgeCount}>
              {currentPhotoCount} {currentPhotoCount === 1 ? 'Photo' : 'Photos'}
            </span>
          </div>
        )}

        <div className={styles.filterRow}>
          <button
            type="button"
            className={`${styles.filterBtn} ${selectedFilter === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setSelectedFilter('all')}
          >
            All ({BUILTIN_LAYOUT_TEMPLATES.length})
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

      {/* Grid of Templates */}
      <div className={styles.gridList}>
        {filteredTemplates.map((template) => {
          const svgPreview = generateTemplateSvgPreview(template, 140, 70);
          const isCurrentCountMatch = template.photoCount === currentPhotoCount;

          return (
            <div
              key={template.id}
              className={styles.templateCard}
              onClick={() => handleApply(template)}
              title={`${template.name}\n${template.description}\nClick to apply to active spread`}
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

      {filteredTemplates.length === 0 && (
        <div className={styles.emptyState}>
          No layout templates match the selected filter.
        </div>
      )}
    </div>
  );
}
