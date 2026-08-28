import { useRef } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { convertUnit, formatDimensions } from '../../domain/units';
import { getAllAlbumSpreads } from '../../domain/album';
import styles from './SpreadCanvas.module.css';

interface SpreadCanvasProps {
  zoomLevel: number;
  activeTool: 'select' | 'pan';
}

export function SpreadCanvas({ zoomLevel, activeTool }: SpreadCanvasProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    currentAlbum,
    activeSpreadId,
    selectedPageId,
    showGutterGuide,
    showBleedGuide,
    showSafeAreaGuide,
    selectPage,
  } = useAlbumStore();

  const containerRef = useRef<HTMLDivElement>(null);

  if (!currentProject || !currentAlbum) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  if (!activeSpread) return null;

  const isCover = activeSpread.type === 'cover';
  const unit = currentProject.canvasUnit;

  // Single page physical dimensions
  const singlePageW = currentProject.canvasWidth;
  const singlePageH = currentProject.canvasHeight;

  // Gutter physical width (Spine width on cover, or 0 on interior flush spreads)
  const gutterPhysicalW = activeSpread.gutterWidth || 0;

  // Total spread physical width = leftPage + gutter + rightPage
  const totalSpreadPhysicalW = singlePageW * 2 + gutterPhysicalW;
  const totalSpreadPhysicalH = singlePageH;

  // Physical bleed and safe area in mm
  const bleedInMm = convertUnit(activeSpread.bleed, unit, 'mm');
  const safeAreaInMm = convertUnit(activeSpread.safeArea, unit, 'mm');
  const pageWInMm = convertUnit(singlePageW, unit, 'mm');

  // Screen view calculation
  const baseViewportW = 780;
  const aspect = totalSpreadPhysicalW / totalSpreadPhysicalH;
  const baseViewportH = Math.round(baseViewportW / aspect);

  // Zoom scale factor
  const scale = (zoomLevel / 100);
  const screenSpreadW = Math.round(baseViewportW * scale);
  const screenSpreadH = Math.round(baseViewportH * scale);

  // Calculate pixel proportions
  const leftPagePixelW = Math.round((singlePageW / totalSpreadPhysicalW) * screenSpreadW);
  const rightPagePixelW = leftPagePixelW;
  const gutterPixelW = screenSpreadW - leftPagePixelW - rightPagePixelW;

  // Calculate bleed & safe area in pixels relative to page size
  const bleedPixel = Math.max(2, Math.round((bleedInMm / pageWInMm) * leftPagePixelW));
  const safeAreaPixel = Math.max(6, Math.round((safeAreaInMm / pageWInMm) * leftPagePixelW));

  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ${activeTool === 'pan' ? styles.panningMode : ''}`}
      onClick={() => selectPage(null)}
    >
      {/* Visual Canvas Wrapper with Drop Shadow */}
      <div
        className={styles.spreadWrapper}
        style={{
          width: `${screenSpreadW}px`,
          height: `${screenSpreadH}px`,
        }}
      >
        {/* Outer Bleed Cut Box Guide */}
        {showBleedGuide && (
          <div
            className={styles.bleedGuideBox}
            style={{
              inset: `-${bleedPixel}px`,
            }}
            title={`Bleed Cut Line: ${activeSpread.bleed} ${unit}`}
          />
        )}

        {/* Facing Pages Canvas Area */}
        <div
          className={`${styles.spreadBoard} ${isCover ? styles.coverBoard : ''}`}
          style={{
            backgroundColor: activeSpread.backgroundColor || '#FFFFFF',
          }}
        >
          {/* Left Page (Back Cover if isCover, else Left Facing Page) */}
          <div
            className={`${styles.page} ${styles.leftPage} ${selectedPageId === activeSpread.leftPage?.id ? styles.pageSelected : ''}`}
            style={{ width: `${leftPagePixelW}px` }}
            onClick={(e) => {
              e.stopPropagation();
              selectPage(activeSpread.leftPage?.id || null);
            }}
          >
            {/* Safe Area Margins Guide on Left Page */}
            {showSafeAreaGuide && (
              <div
                className={styles.safeAreaGuide}
                style={{
                  top: `${safeAreaPixel}px`,
                  bottom: `${safeAreaPixel}px`,
                  left: `${safeAreaPixel}px`,
                  right: `${Math.max(safeAreaPixel, gutterPixelW / 2 + 4)}px`,
                }}
                title={`Safe Area Margin: ${activeSpread.safeArea} ${unit}`}
              />
            )}

            {/* Page Number Badge */}
            <div className={`${styles.pageBadge} ${styles.leftBadge}`}>
              {isCover ? 'Back Cover' : `Page ${activeSpread.leftPage?.pageNumber || 2}`}
            </div>
          </div>

          {/* Center Gutter / Spine Fold */}
          <div
            className={`${styles.gutterSpine} ${showGutterGuide ? styles.gutterVisible : ''}`}
            style={{ width: `${Math.max(2, gutterPixelW)}px` }}
            title={isCover ? `Spine / Gutter: ${gutterPhysicalW} ${unit}` : 'Center Fold / Gutter Crease'}
          >
            {isCover && gutterPixelW > 8 && (
              <span className={styles.spineLabel}>Spine</span>
            )}
          </div>

          {/* Right Page (Front Cover if isCover, else Right Facing Page) */}
          <div
            className={`${styles.page} ${styles.rightPage} ${selectedPageId === activeSpread.rightPage?.id ? styles.pageSelected : ''}`}
            style={{ width: `${rightPagePixelW}px` }}
            onClick={(e) => {
              e.stopPropagation();
              selectPage(activeSpread.rightPage?.id || null);
            }}
          >
            {/* Safe Area Margins Guide on Right Page */}
            {showSafeAreaGuide && (
              <div
                className={styles.safeAreaGuide}
                style={{
                  top: `${safeAreaPixel}px`,
                  bottom: `${safeAreaPixel}px`,
                  right: `${safeAreaPixel}px`,
                  left: `${Math.max(safeAreaPixel, gutterPixelW / 2 + 4)}px`,
                }}
                title={`Safe Area Margin: ${activeSpread.safeArea} ${unit}`}
              />
            )}

            {/* Page Number Badge */}
            <div className={`${styles.pageBadge} ${styles.rightBadge}`}>
              {isCover ? 'Front Cover' : `Page ${activeSpread.rightPage?.pageNumber || 3}`}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Canvas Footer Info Badge */}
      <div className={styles.spreadInfoBadge}>
        <span className={styles.spreadNameText}>{activeSpread.name}</span>
        <span className={styles.spreadDimText}>
          {formatDimensions(singlePageW, singlePageH, unit)} per page (Spread: {formatDimensions(totalSpreadPhysicalW, totalSpreadPhysicalH, unit)})
        </span>
      </div>
    </div>
  );
}
