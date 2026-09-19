import { TextPreviewCanvas } from '../editor/TextPreviewCanvas';
import React, { useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Spread, mergeFramePhotoAsset } from '../../domain/album';
import { Project } from '../../domain/project';
import { PhotoFrameElement, calculateImageOffset, getCornerRadii, getPhotoAspect } from '../../domain/editor';
import { TextNodeElement } from '../../domain/text';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import { calculatePreviewProjection, projectPreviewRect } from '../../domain/previewGeometry';
import { calculateExportPixels } from '../../domain/units';
import { usePhotoStore } from '../../stores/photoStore';
import styles from './ExportSpreadPreview.module.css';

function safeConvertFileSrc(filePath: string, version = ''): string {
  try {
    return `${convertFileSrc(filePath)}?v=${encodeURIComponent(version)}`;
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
  showSafeAreaGuide?: boolean;
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
  showSafeAreaGuide = false,
  splitPages,
  dpi,
  format,
}) => {
  const photos = usePhotoStore((s) => s.photos);
  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const dims = useMemo(() => getProjectDimensionsInCanvasUnit(project, spread), [project, spread]);

  const singlePageW = dims.pageWidth;
  const singlePageH = dims.pageHeight;
  const gutterW = dims.gutterWidth;
  const bleed = includeBleed ? (spread.bleed ?? dims.bleed ?? 0) : 0;

  // Base physical spread geometry (without bleed)
  const baseSpreadW = singlePageW * 2 + gutterW;
  const baseSpreadH = singlePageH;

  const targetW = viewMode === 'spread' ? baseSpreadW : singlePageW;
  const targetH = baseSpreadH;

  // With bleed geometry
  const finalExportW = targetW + bleed * (viewMode === 'spread' ? 2 : 1);
  const finalExportH = targetH + bleed * 2;

  // Compute live pixel output dimensions for specs badge
  const spreadPixelW = calculateExportPixels(baseSpreadW + bleed * 2, dims.unit, dpi, dims.dpi);
  const leftCutPixelX = calculateExportPixels(bleed, dims.unit, dpi, dims.dpi)
    + calculateExportPixels(singlePageW, dims.unit, dpi, dims.dpi);
  const pixelW = viewMode === 'spread' ? spreadPixelW
    : viewMode === 'left-page' ? leftCutPixelX : spreadPixelW - leftCutPixelX;
  const pixelH = calculateExportPixels(finalExportH, dims.unit, dpi, dims.dpi);

  // Scale canvas to fill the preview container while strictly preserving aspect ratio
  const boxW = 550;
  const boxH = 330;
  const projection = calculatePreviewProjection(singlePageW, singlePageH, gutterW,
    boxW, boxH, viewMode, bleed);
  const { scale, width: containerW, height: containerH, bleedPx, bleedLeftPx, bleedRightPx,
    spineX: spinePx, viewOffsetX } = projection;
  const safeAreaWidth = Math.max(0, singlePageW - dims.safeMarginOutside - dims.safeMarginSpine);
  const safeAreaHeight = Math.max(0, singlePageH - dims.safeMarginTop - dims.safeMarginBottom);
  const leftSafeArea = projectPreviewRect({
    x: dims.safeMarginOutside, y: dims.safeMarginTop,
    width: safeAreaWidth, height: safeAreaHeight,
  }, projection);
  const rightSafeArea = projectPreviewRect({
    x: singlePageW + gutterW + dims.safeMarginSpine, y: dims.safeMarginTop,
    width: safeAreaWidth, height: safeAreaHeight,
  }, projection);

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
            backgroundColor: 'transparent',
            overflow: 'hidden',
          }}
        >
          {/* Base Spread Background Fill */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${containerW}px`,
              height: `${containerH}px`,
              backgroundColor: spreadBgColor,
            }}
          />

          {/* Bleed Cut Margin Trim Guides */}
          {includeBleed && showBleedGuide && (
            <div
              className={styles.trimLineBox}
              style={{
                left: `${bleedLeftPx}px`,
                top: `${bleedPx}px`,
                right: `${bleedRightPx}px`,
                bottom: `${bleedPx}px`,
              }}
              title="Dashed red line indicates the final trim cut line after printing"
            />
          )}

          {/* Page Background Fill */}
          {viewMode === 'spread' && (
            gutterW === 0 && leftPageBg === rightPageBg ? (
              <div
                style={{
                  position: 'absolute',
                  left: `${bleedLeftPx}px`,
                  top: `${bleedPx}px`,
                  width: `${(singlePageW * 2) * scale}px`,
                  height: `${singlePageH * scale}px`,
                  backgroundColor: leftPageBg,
                }}
              />
            ) : (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: `${bleedLeftPx}px`,
                    top: `${bleedPx}px`,
                    width: `${singlePageW * scale + (gutterW === 0 ? 0.5 : 0)}px`,
                    height: `${singlePageH * scale}px`,
                    backgroundColor: leftPageBg,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${projection.rightPageX}px`,
                    top: `${bleedPx}px`,
                    width: `${singlePageW * scale}px`,
                    height: `${singlePageH * scale}px`,
                    backgroundColor: rightPageBg,
                  }}
                />
              </>
            )
          )}

          {viewMode === 'left-page' && (
            <div
              style={{
                position: 'absolute',
                left: `${bleedLeftPx}px`,
                top: `${bleedPx}px`,
                width: `${singlePageW * scale}px`,
                height: `${singlePageH * scale}px`,
                backgroundColor: leftPageBg,
              }}
            />
          )}

          {viewMode === 'right-page' && (
            <div
              style={{
                position: 'absolute',
                left: `${bleedLeftPx}px`,
                top: `${bleedPx}px`,
                width: `${singlePageW * scale}px`,
                height: `${singlePageH * scale}px`,
                backgroundColor: rightPageBg,
              }}
            />
          )}

          {/* Center Split Slicing Cut Line (for Full Spread when splitPages is active) */}
          {viewMode === 'spread' && splitPages && (
            <div
              className={styles.splitCutLine}
              style={{
                left: `${spinePx}px`,
                top: 0,
                bottom: 0,
              }}
              title="✂ Slicing cut line (pages will be exported as separate files)"
            >
              <span className={styles.splitScissors}>✂</span>
            </div>
          )}

          {/* Safe Area Margins Guide (matching real canvas blue dashed guide) */}
          {showSafeAreaGuide && (
            <>
              {/* Left Page Safe Area */}
              {viewMode !== 'right-page' && <div
                style={{
                  position: 'absolute',
                  left: `${leftSafeArea.x}px`,
                  top: `${leftSafeArea.y}px`,
                  width: `${leftSafeArea.width}px`,
                  height: `${leftSafeArea.height}px`,
                  border: '1px dashed rgba(59, 130, 246, 0.75)',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                  zIndex: 20,
                }}
                title={`Safe Area Margin (Left Page): ${dims.safeMarginOutside} ${dims.unit}`}
              />}
              {/* Right Page Safe Area */}
              {viewMode !== 'left-page' && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${rightSafeArea.x}px`,
                    top: `${rightSafeArea.y}px`,
                    width: `${rightSafeArea.width}px`,
                    height: `${rightSafeArea.height}px`,
                    border: '1px dashed rgba(59, 130, 246, 0.75)',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                    zIndex: 20,
                  }}
                  title={`Safe Area Margin (Right Page): ${dims.safeMarginSpine} ${dims.unit}`}
                />
              )}
            </>
          )}

          {/* Scaled Rendered Elements */}
          <div className={styles.artworkLayer}>
            {visibleElements.map((el, idx) => {
              // Coordinate transformation relative to view container
              const { x: renderX, y: renderY, width: renderW, height: renderH } =
                projectPreviewRect(el, projection);
              const rot = el.rotation || 0;

              // Strict 1:1 physical positioning matching real canvas
              let finalRenderX = renderX;
              let finalRenderY = renderY;
              let finalRenderW = renderW;
              let finalRenderH = renderH;

              if (!rot) {
                // Viewport boundaries in canvas physical coordinates
                const viewLeft = viewOffsetX;
                const viewContentWidth = viewMode === 'spread' ? baseSpreadW : singlePageW;

                // Thresholds: snap if frame physically touches or is within 0.15 canvas units or 1.5 screen px
                const tol = 0.15;
                const touchesLeft = (el.x - viewLeft) <= tol || finalRenderX <= 1.5;
                const touchesTop = el.y <= tol || finalRenderY <= 1.5;
                const touchesRight = (el.x + el.width - viewOffsetX) >= (viewContentWidth - tol)
                  || (finalRenderX + finalRenderW >= containerW - 1.5);
                const touchesBottom = (el.y + el.height) >= (baseSpreadH - tol)
                  || (finalRenderY + finalRenderH >= containerH - 1.5);

                if (touchesLeft) {
                  finalRenderX = 0;
                  if (includeBleed && bleedLeftPx > 0 && viewMode !== 'right-page' && el.x <= tol) {
                    finalRenderW += bleedLeftPx;
                  }
                }

                if (touchesTop) {
                  finalRenderY = 0;
                  if (includeBleed && bleedPx > 0 && el.y <= tol) {
                    finalRenderH += bleedPx;
                  }
                }

                if (touchesRight) {
                  // Ensure frame extends to the right boundary with +1px overlap for overflow:hidden clipping
                  finalRenderW = Math.max(finalRenderW, containerW - finalRenderX + 1);
                }

                if (touchesBottom) {
                  // Ensure frame extends to the bottom boundary with +1px overlap for overflow:hidden clipping
                  finalRenderH = Math.max(finalRenderH, containerH - finalRenderY + 1);
                }

                // In full spread view, seamlessly join photo frames meeting at the center spine fold
                if (viewMode === 'spread') {
                  const rightPageStartX = singlePageW + gutterW;
                  const rightPageStartPx = projection.rightPageX;
                  const isPhotoBorder = el.type === 'photo' && Boolean((el as PhotoFrameElement).borderEnabled && ((el as PhotoFrameElement).borderWidth || 0) > 0);

                  // 1. Frame on Left Page touching the center spine fold
                  const touchesSpineFromLeft = Math.abs(el.x + el.width - singlePageW) <= tol
                    || Math.abs(finalRenderX + finalRenderW - spinePx) <= 1.5;

                  if (touchesSpineFromLeft) {
                    // Snap right edge flush to spine, with 1px overlap across zero-gutter fold if no border
                    const overlap = (gutterW === 0 && !isPhotoBorder) ? 1 : 0;
                    finalRenderW = Math.max(finalRenderW, spinePx - finalRenderX + overlap);
                  }

                  // 2. Frame on Right Page touching the center spine fold
                  const touchesSpineFromRight = Math.abs(el.x - rightPageStartX) <= tol
                    || Math.abs(finalRenderX - rightPageStartPx) <= 1.5;

                  if (touchesSpineFromRight) {
                    const shift = finalRenderX - rightPageStartPx;
                    finalRenderX = rightPageStartPx;
                    finalRenderW += shift;
                  }
                }
              }

              if (el.type === 'text') {
                const textEl = el as TextNodeElement;
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
                      pointerEvents: 'none',
                      userSelect: 'none',
                      zIndex: textEl.zIndex ?? (idx + 1),
                    }}
                  >
                    <TextPreviewCanvas element={textEl} unit={dims.unit} dpi={dims.dpi} width={renderW} height={renderH} />
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
              ? (safePreview || safeThumb || null)
              : null;

            const photoAspect = getPhotoAspect(hydrated);

            // In-place calculate crop and zoom offsets using actual photo aspect ratio
            const { offsetX, offsetY, width: imgPhysicalW, height: imgPhysicalH } = calculateImageOffset(
              photoEl.width,
              photoEl.height,
              photoAspect,
              Math.max(1.0, photoEl.cropScale || 1.0),
              photoEl.cropX || 0,
              photoEl.cropY || 0
            );

            // Normalized percentage positioning inside frame container
            const imgLeftPct = (offsetX / photoEl.width) * 100;
            const imgTopPct = (offsetY / photoEl.height) * 100;
            const imgWidthPct = (imgPhysicalW / photoEl.width) * 100;
            const imgHeightPct = (imgPhysicalH / photoEl.height) * 100;
            // Overscan the cropped image inside its clipped frame so subpixel image
            // rasterization cannot expose the white loading background at a cut edge.
            const imageEdgeOverscan = 1;
            const cropRot = photoEl.cropRotation || 0;

            const [crTl, crTr, crBr, crBl] = getCornerRadii(photoEl);
            const maxRPx = Math.min(finalRenderW, finalRenderH) / 2;
            const rTlPx = Math.min(crTl * scale, maxRPx);
            const rTrPx = Math.min(crTr * scale, maxRPx);
            const rBrPx = Math.min(crBr * scale, maxRPx);
            const rBlPx = Math.min(crBl * scale, maxRPx);
            const hasR = rTlPx > 0.5 || rTrPx > 0.5 || rBrPx > 0.5 || rBlPx > 0.5;

            return (
              <div
                key={photoEl.id}
                style={{
                  position: 'absolute',
                  left: `${finalRenderX}px`,
                  top: `${finalRenderY}px`,
                  width: `${finalRenderW}px`,
                  height: `${finalRenderH}px`,
                  transform: rot ? `rotate(${rot}deg)` : undefined,
                  transformOrigin: '0 0',
                  overflow: 'hidden',
                  background: imgSrc ? 'transparent' : '#1e293b',
                  opacity: photoEl.opacity ?? 1,
                  boxSizing: 'border-box',
                  borderRadius: hasR ? `${rTlPx}px ${rTrPx}px ${rBrPx}px ${rBlPx}px` : undefined,
                  zIndex: photoEl.zIndex ?? (idx + 1),
                }}
              >
                {imgSrc ? (
                  <img
                    src={safeConvertFileSrc(imgSrc, photoEl.photoId ? photoById.get(photoEl.photoId)?.updatedAt : '')}
                    alt=""
                    style={{
                      position: 'absolute',
                      left: `calc(${imgLeftPct}% - ${imageEdgeOverscan}px)`,
                      top: `calc(${imgTopPct}% - ${imageEdgeOverscan}px)`,
                      width: `calc(${imgWidthPct}% + ${imageEdgeOverscan * 2}px)`,
                      height: `calc(${imgHeightPct}% + ${imageEdgeOverscan * 2}px)`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                      transform: cropRot ? `rotate(${cropRot}deg)` : undefined,
                      transformOrigin: 'center center',
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
                {photoEl.borderEnabled && photoEl.borderWidth > 0 && (
                  <div style={{
                    position: 'absolute', inset: 0, boxSizing: 'border-box', pointerEvents: 'none',
                    border: `${photoEl.borderWidth * scale}px solid ${photoEl.borderColor || '#ffffff'}`,
                    borderRadius: 'inherit',
                  }} />
                )}
              </div>
            );
          })}
          </div>
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
