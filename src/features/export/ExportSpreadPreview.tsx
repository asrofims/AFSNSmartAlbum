import React, { useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Spread, mergeFramePhotoAsset } from '../../domain/album';
import { Project } from '../../domain/project';
import { PhotoFrameElement, calculateImageOffset } from '../../domain/editor';
import { TextNodeElement } from '../../domain/text';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import { calculateExportPixels } from '../../domain/units';
import { usePhotoStore } from '../../stores/photoStore';
import styles from './ExportSpreadPreview.module.css';

function safeConvertFileSrc(filePath: string): string {
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}

export type ExportPreviewViewMode = 'spread' | 'left-page' | 'right-page';

interface ExportSpreadPreviewProps {
  spread: Spread;
  project: Project;
  viewMode: ExportPreviewViewMode;
  includeBleed: boolean;
  showBleedGuide: boolean;
  splitPages: boolean;
  dpi: number;
  format: 'jpeg' | 'png' | 'pdf';
}

export const ExportSpreadPreview: React.FC<ExportSpreadPreviewProps> = ({
  spread,
  project,
  viewMode,
  includeBleed,
  showBleedGuide,
  splitPages,
  dpi,
  format,
}) => {
  const photos = usePhotoStore((s) => s.photos);
  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const dims = useMemo(() => getProjectDimensionsInCanvasUnit(project, spread), [project, spread]);

  const singlePageW = spread.leftPage?.width || dims.pageWidth;
  const singlePageH = spread.leftPage?.height || dims.pageHeight;
  const gutterW = spread.gutterWidth ?? dims.gutterWidth ?? 0;
  const bleed = includeBleed ? (spread.bleed ?? dims.bleed ?? 0) : 0;

  // Base physical spread geometry (without bleed)
  const baseSpreadW = singlePageW * 2 + gutterW;
  const baseSpreadH = singlePageH;

  // Target view geometry
  let targetW = baseSpreadW;
  let targetH = baseSpreadH;
  let viewOffsetX = 0; // horizontal offset in spread coordinate space

  if (viewMode === 'left-page') {
    targetW = singlePageW;
    viewOffsetX = 0;
  } else if (viewMode === 'right-page') {
    targetW = singlePageW;
    viewOffsetX = singlePageW + gutterW;
  }

  // With bleed geometry
  const finalExportW = targetW + bleed * 2;
  const finalExportH = targetH + bleed * 2;

  // Compute live pixel output dimensions for specs badge
  const pixelW = calculateExportPixels(finalExportW, dims.unit, dpi, dims.dpi);
  const pixelH = calculateExportPixels(finalExportH, dims.unit, dpi, dims.dpi);

  // Scale canvas to fill the preview container while strictly preserving aspect ratio
  const boxW = 550;
  const boxH = 330;
  const scale = Math.min(boxW / finalExportW, boxH / finalExportH);

  const containerW = Math.round(finalExportW * scale);
  const containerH = Math.round(finalExportH * scale);

  const bleedPx = Math.round(bleed * scale);
  const spinePx = Math.round((singlePageW + (bleed > 0 ? bleed : 0)) * scale);

  // Background colors
  const spreadBgColor = spread.backgroundColor || project.backgroundColor || '#FFFFFF';
  const leftPageBg = spread.leftPage?.backgroundColor || spreadBgColor;
  const rightPageBg = spread.rightPage?.backgroundColor || spreadBgColor;

  // Filter and project elements visible in current viewMode
  const visibleElements = useMemo(() => {
    return (spread.elements || []).filter((el) => {
      if (viewMode === 'spread') return true;
      if (viewMode === 'left-page') {
        // Must overlap left page: x < singlePageW
        return el.x < singlePageW;
      }
      if (viewMode === 'right-page') {
        // Must overlap right page: x + width > singlePageW + gutterW
        return el.x + el.width > singlePageW + gutterW;
      }
      return true;
    });
  }, [spread.elements, viewMode, singlePageW, gutterW]);

  const photoCount = visibleElements.filter((e) => e.type === 'photo').length;
  const textCount = visibleElements.filter((e) => e.type === 'text').length;

  return (
    <div className={styles.previewContainer}>
      {/* Top HUD Badge: View Mode */}
      <div className={styles.topHud}>
        <span className={styles.viewModeBadge}>
          {viewMode === 'spread' && (
            <>
              <span className={styles.hudIcon}>◫</span>
              <span>Full Spread {spread.name ? `(${spread.name})` : ''}</span>
            </>
          )}
          {viewMode === 'left-page' && (
            <>
              <span className={styles.hudIcon}>◧</span>
              <span>Left Page {spread.leftPage ? `(Page ${spread.leftPage.pageNumber})` : `(Page ${(spread.spreadIndex - 1) * 2 + 1})`}</span>
            </>
          )}
          {viewMode === 'right-page' && (
            <>
              <span className={styles.hudIcon}>◨</span>
              <span>Right Page {spread.rightPage ? `(Page ${spread.rightPage.pageNumber})` : `(Page ${(spread.spreadIndex - 1) * 2 + 2})`}</span>
            </>
          )}
        </span>

        {splitPages && viewMode === 'spread' && (
          <span className={styles.splitNoticeBadge}>
            ✂ Split Slicing Active
          </span>
        )}

        {includeBleed && (
          <span className={styles.bleedBadge}>
            +{bleed} {dims.unit} Bleed
          </span>
        )}
      </div>

      {/* Main Scaled Canvas Stage Card */}
      <div className={styles.canvasCard}>
        <div
          className={styles.canvasStage}
          style={{
            width: `${containerW}px`,
            height: `${containerH}px`,
            position: 'relative',
            backgroundColor: spreadBgColor,
            overflow: 'hidden',
          }}
        >
          {/* Bleed Cut Margin Trim Guides */}
          {includeBleed && showBleedGuide && (
            <div
              className={styles.trimLineBox}
              style={{
                left: `${bleedPx}px`,
                top: `${bleedPx}px`,
                right: `${bleedPx}px`,
                bottom: `${bleedPx}px`,
              }}
              title="Dashed red line indicates the final trim cut line after printing"
            />
          )}

          {/* Page Background Fill */}
          {viewMode === 'spread' && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: `${bleedPx}px`,
                  top: `${bleedPx}px`,
                  width: `${Math.round(singlePageW * scale)}px`,
                  height: `${Math.round(singlePageH * scale)}px`,
                  backgroundColor: leftPageBg,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: `${bleedPx + Math.round((singlePageW + gutterW) * scale)}px`,
                  top: `${bleedPx}px`,
                  width: `${Math.round(singlePageW * scale)}px`,
                  height: `${Math.round(singlePageH * scale)}px`,
                  backgroundColor: rightPageBg,
                }}
              />
            </>
          )}

          {viewMode === 'left-page' && (
            <div
              style={{
                position: 'absolute',
                left: `${bleedPx}px`,
                top: `${bleedPx}px`,
                width: `${Math.round(singlePageW * scale)}px`,
                height: `${Math.round(singlePageH * scale)}px`,
                backgroundColor: leftPageBg,
              }}
            />
          )}

          {viewMode === 'right-page' && (
            <div
              style={{
                position: 'absolute',
                left: `${bleedPx}px`,
                top: `${bleedPx}px`,
                width: `${Math.round(singlePageW * scale)}px`,
                height: `${Math.round(singlePageH * scale)}px`,
                backgroundColor: rightPageBg,
              }}
            />
          )}

          {/* Center Spine Fold Guide / Split Slicing Cut Line (for Full Spread) */}
          {viewMode === 'spread' && (
            <div
              className={splitPages ? styles.splitCutLine : styles.spineLine}
              style={{
                left: `${spinePx}px`,
                top: 0,
                bottom: 0,
              }}
              title={splitPages ? '✂ Slicing cut line (pages will be exported as separate files)' : 'Spine center fold line'}
            >
              {splitPages && <span className={styles.splitScissors}>✂</span>}
            </div>
          )}

          {/* Scaled Rendered Elements */}
          {visibleElements.map((el) => {
            // Coordinate transformation relative to view container
            const localX = el.x - viewOffsetX + bleed;
            const localY = el.y + bleed;

            const renderX = Math.round(localX * scale);
            const renderY = Math.round(localY * scale);
            const renderW = Math.max(1, Math.round(el.width * scale));
            const renderH = Math.max(1, Math.round(el.height * scale));
            const rot = el.rotation || 0;

            if (el.type === 'text') {
              const textEl = el as TextNodeElement;
              const fontPt = Number.isFinite(textEl.style?.fontSize) ? textEl.style.fontSize : 24;
              // Screen size scaling (72 pt = 25.4 mm)
              const fontSizePx = Math.max(6, Math.round(((fontPt * 25.4) / 72) * scale));
              const isBold = textEl.style?.fontWeight === 'bold' || Number(textEl.style?.fontWeight) >= 600;
              const isItalic = textEl.style?.fontStyle === 'italic';

              return (
                <div
                  key={textEl.id}
                  style={{
                    position: 'absolute',
                    left: `${renderX}px`,
                    top: `${renderY}px`,
                    width: `${renderW}px`,
                    height: `${renderH}px`,
                    transform: rot ? `rotate(${rot}deg)` : undefined,
                    transformOrigin: '0 0',
                    overflow: 'hidden',
                    fontSize: `${fontSizePx}px`,
                    color: textEl.style?.fill || '#000000',
                    fontFamily: textEl.style?.fontFamily || 'Inter, sans-serif',
                    fontWeight: isBold ? 700 : 400,
                    fontStyle: isItalic ? 'italic' : 'normal',
                    textAlign: (textEl.style?.align as any) || 'left',
                    lineHeight: 1.2,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    whiteSpace: 'pre-wrap',
                    zIndex: textEl.zIndex || 2,
                    padding: '2px',
                  }}
                >
                  {textEl.text || ''}
                </div>
              );
            }

            const photoEl = el as PhotoFrameElement;
            const hydrated = mergeFramePhotoAsset(photoEl, photoEl.photoId ? photoById.get(photoEl.photoId) : null);
            const isCachePath = (p?: string | null) => {
              if (!p) return false;
              const norm = p.replace(/\\/g, '/').toLowerCase();
              return norm.includes('/thumbnails/') || norm.includes('/previews/');
            };
            const safeThumb = isCachePath(hydrated.thumbnailPath) ? hydrated.thumbnailPath : null;
            const safePreview = isCachePath(hydrated.previewPath) ? hydrated.previewPath : null;
            const imgSrc = (hydrated.photoId && !hydrated.isMissing)
              ? (safePreview || safeThumb || hydrated.filePath || null)
              : null;

            // In-place calculate crop and zoom offsets
            const { offsetX, offsetY, width: imgPhysicalW, height: imgPhysicalH } = calculateImageOffset(
              photoEl.width,
              photoEl.height,
              photoEl.photoAspect || 1.5,
              Math.max(1.0, photoEl.cropScale || 1.0),
              photoEl.cropX || 0,
              photoEl.cropY || 0
            );

            // Normalized percentage positioning inside frame container
            const imgLeftPct = (offsetX / photoEl.width) * 100;
            const imgTopPct = (offsetY / photoEl.height) * 100;
            const imgWidthPct = (imgPhysicalW / photoEl.width) * 100;
            const imgHeightPct = (imgPhysicalH / photoEl.height) * 100;

            return (
              <div
                key={photoEl.id}
                style={{
                  position: 'absolute',
                  left: `${renderX}px`,
                  top: `${renderY}px`,
                  width: `${renderW}px`,
                  height: `${renderH}px`,
                  transform: rot ? `rotate(${rot}deg)` : undefined,
                  transformOrigin: '0 0',
                  overflow: 'hidden',
                  background: imgSrc ? 'transparent' : '#1e293b',
                  opacity: photoEl.opacity ?? 1,
                  boxSizing: 'border-box',
                  border: photoEl.borderEnabled && photoEl.borderWidth
                    ? `${Math.max(1, Math.round(photoEl.borderWidth * scale))}px solid ${photoEl.borderColor || '#ffffff'}`
                    : 'none',
                  zIndex: photoEl.zIndex || 2,
                }}
              >
                {imgSrc ? (
                  <img
                    src={safeConvertFileSrc(imgSrc)}
                    alt=""
                    style={{
                      position: 'absolute',
                      left: `${imgLeftPct}%`,
                      top: `${imgTopPct}%`,
                      width: `${imgWidthPct}%`,
                      height: `${imgHeightPct}%`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      objectFit: 'fill',
                    }}
                  />
                ) : (
                  <div className={styles.emptySlot}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Live Specs Overlay HUD */}
      <div className={styles.bottomHud}>
        <div className={styles.specsBadge}>
          <span className={styles.specsDim}>
            {finalExportW.toFixed(1)} × {finalExportH.toFixed(1)} {dims.unit}
          </span>
          <span className={styles.specsDivider}>•</span>
          <span className={styles.specsPixels}>
            {pixelW} × {pixelH} px ({dpi} DPI)
          </span>
          <span className={styles.specsDivider}>•</span>
          <span className={styles.specsFormat}>
            {format.toUpperCase()}
          </span>
        </div>

        <div className={styles.elementSummaryBadge}>
          <span>{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</span>
          {textCount > 0 && <span>, {textCount} text</span>}
        </div>
      </div>
    </div>
  );
};
