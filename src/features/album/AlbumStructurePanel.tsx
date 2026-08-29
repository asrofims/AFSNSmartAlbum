import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { getAllAlbumSpreads } from '../../domain/album';
import { formatDimensions } from '../../domain/units';
import { NumberInput } from '../../components/ui/NumberInput';
import { Switch } from '../../components/ui/Switch';
import styles from './AlbumStructurePanel.module.css';

export function AlbumStructurePanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    currentAlbum,
    activeSpreadId,
    showGutterGuide,
    showBleedGuide,
    showSafeAreaGuide,
    toggleGuide,
    updateGutterWidth,
    updateBleed,
    updateSafeArea,
  } = useAlbumStore();

  if (!currentProject || !currentAlbum) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  if (!activeSpread) return null;

  const unit = currentProject.canvasUnit;

  return (
    <div className={styles.container}>
      {/* Album Summary Card */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Album Structure</span>
          <span className={styles.badge}>{currentAlbum.totalSpreads} Spreads</span>
        </div>

        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Spreads</span>
            <span className={styles.statVal}>{currentAlbum.totalSpreads}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Pages</span>
            <span className={styles.statVal}>{currentAlbum.totalPages}</span>
          </div>
        </div>
      </div>

      {/* Active Spread Info */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Active Spread</span>
          <span className={styles.typeBadge}>Sheet</span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Name:</span>
          <span className={styles.infoValue}>{activeSpread.name}</span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Page Size:</span>
          <span className={styles.infoValue}>
            {formatDimensions(currentProject.canvasWidth, currentProject.canvasHeight, unit)}
          </span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>DPI:</span>
          <span className={styles.infoValue}>{currentProject.canvasDpi} DPI</span>
        </div>
      </div>

      {/* Visual Guides Toggles */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Visual Guides</span>
        </div>

        <div className={styles.guideToggles}>
          {/* Gutter Guide */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleText}>Center Gutter Crease</span>
            <Switch
              checked={showGutterGuide}
              onChange={() => toggleGuide('gutter')}
              size="sm"
            />
          </div>

          {/* Bleed Guide */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleText}>Bleed Cut Boundary (Red)</span>
            <Switch
              checked={showBleedGuide}
              onChange={() => toggleGuide('bleed')}
              size="sm"
            />
          </div>

          {/* Safe Area Guide */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleText}>Safe Area Margin (Blue)</span>
            <Switch
              checked={showSafeAreaGuide}
              onChange={() => toggleGuide('safeArea')}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Physical Guide Adjustments */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Dimensions & Margins</span>
        </div>

        <div className={styles.inputGroup}>
          {/* Gutter Width */}
          <div className={styles.inputRow}>
            <span className={styles.inputLabel}>Gutter Crease</span>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={activeSpread.gutterWidth}
                onChange={updateGutterWidth}
                min={0}
                max={50}
                step={unit === 'inch' ? 0.05 : 1}
                precision={unit === 'inch' || unit === 'cm' ? 2 : 1}
              />
              <span className={styles.unitText}>{unit}</span>
            </div>
          </div>

          {/* Bleed Margin */}
          <div className={styles.inputRow}>
            <span className={styles.inputLabel}>Bleed Cut Margin</span>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={activeSpread.bleed}
                onChange={updateBleed}
                min={0}
                max={20}
                step={unit === 'inch' ? 0.025 : 0.5}
                precision={unit === 'inch' || unit === 'cm' ? 2 : 1}
              />
              <span className={styles.unitText}>{unit}</span>
            </div>
          </div>

          {/* Safe Area Margin */}
          <div className={styles.inputRow}>
            <span className={styles.inputLabel}>Safe Area Inset</span>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={activeSpread.safeArea}
                onChange={updateSafeArea}
                min={1}
                max={50}
                step={unit === 'inch' ? 0.05 : 1}
                precision={unit === 'inch' || unit === 'cm' ? 2 : 1}
              />
              <span className={styles.unitText}>{unit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
