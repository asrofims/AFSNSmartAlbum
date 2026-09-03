import { useState, useMemo, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { usePhotoStore } from '../../stores/photoStore';
import { getAllAlbumSpreads, Spread } from '../../domain/album';
import { ExportSpreadPreview, ExportPreviewViewMode } from './ExportSpreadPreview';
import styles from './ExportAlbumDialog.module.css';

export interface ExportOptions {
  format: 'jpeg' | 'png' | 'pdf';
  dpi: number;
  jpegQuality: number;
  includeBleed: boolean;
  splitPages: boolean;
  sharpenEnabled?: boolean;
  sharpenAmount?: 'standard' | 'high';
  outputDir: string;
  selectedSpreadIds?: string[];
  filePrefix?: string;
}

export interface MissingPhotoInfo {
  elementId: string;
  spreadName: string;
  filePath: string;
  fileName: string;
  hasPreview: boolean;
}

export interface PreflightReport {
  totalPhotos: number;
  missingPhotos: MissingPhotoInfo[];
  existingFiles: string[];
  destinationWritable: boolean;
  destinationError: string | null;
}

interface ExportAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: (options: ExportOptions) => void;
}

/**
 * Parses range strings like "3-6", "1, 3, 5-8" into sorted unique integers.
 */
function parseRange(input: string, maxVal: number): number[] {
  const result = new Set<number>();
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const splitArr = part.split('-');
      const startNum = parseInt(splitArr[0]?.trim() || '', 10);
      const endNum = parseInt(splitArr[1]?.trim() || '', 10);
      if (!isNaN(startNum) && !isNaN(endNum)) {
        const start = Math.max(1, Math.min(startNum, endNum));
        const end = Math.min(maxVal, Math.max(startNum, endNum));
        for (let i = start; i <= end; i++) {
          result.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxVal) {
        result.add(num);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

const LAST_EXPORT_DIR_KEY = 'afsn_last_export_dir';

export function ExportAlbumDialog({ isOpen, onClose, onStartExport }: ExportAlbumDialogProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const openRelink = usePhotoStore((s) => s.openRelink);

  const [format, setFormat] = useState<'jpeg' | 'png' | 'pdf'>('jpeg');
  const [dpi, setDpi] = useState<number>(currentProject?.canvasDpi || 300);
  const [isCustomDpi, setIsCustomDpi] = useState<boolean>(false);
  const [customDpiText, setCustomDpiText] = useState<string>(String(currentProject?.canvasDpi || 300));
  const [jpegQuality, setJpegQuality] = useState<number>(95);
  const [includeBleed, setIncludeBleed] = useState<boolean>(false);
  const [splitPages, setSplitPages] = useState<boolean>(false);
  const [sharpenEnabled, setSharpenEnabled] = useState<boolean>(true);
  const [sharpenAmount, setSharpenAmount] = useState<'standard' | 'high'>('standard');

  const [scope, setScope] = useState<'all' | 'current' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('1-2');
  const [rangeMode, setRangeMode] = useState<'spreads' | 'pages'>('spreads');
  const [filePrefix, setFilePrefix] = useState<string>('');

  const [outputDir, setOutputDir] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_EXPORT_DIR_KEY) || '';
    } catch {
      return '';
    }
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-Flight Validation State (missing photos & existing destination file collisions)
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [isVerifyingPreflight, setIsVerifyingPreflight] = useState(false);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);
  const [isMissingModalOpen, setIsMissingModalOpen] = useState(false);

  const allSpreads: Spread[] = useMemo(() => {
    return currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  }, [currentAlbum]);

  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  // Live Preview Navigation & Inspection State
  const [activePreviewSpreadId, setActivePreviewSpreadId] = useState<string>('');
  const [previewViewMode, setPreviewViewMode] = useState<ExportPreviewViewMode>('spread');
  const [showBleedGuide, setShowBleedGuide] = useState<boolean>(true);

  // Sync initial preview spread
  useEffect(() => {
    if (!activePreviewSpreadId && allSpreads.length > 0) {
      setActivePreviewSpreadId(activeSpread?.id || allSpreads[0]?.id || '');
    }
  }, [allSpreads, activeSpread, activePreviewSpreadId]);

  const previewSpread = useMemo(() => {
    return allSpreads.find((s) => s.id === activePreviewSpreadId) || activeSpread || allSpreads[0];
  }, [allSpreads, activePreviewSpreadId, activeSpread]);

  const currentSpreadIdx = useMemo(() => {
    return allSpreads.findIndex((s) => s.id === previewSpread?.id);
  }, [allSpreads, previewSpread]);

  const hasPrev = currentSpreadIdx > 0;
  const hasNext = currentSpreadIdx >= 0 && currentSpreadIdx < allSpreads.length - 1;

  const goToPrev = () => {
    if (hasPrev && allSpreads[currentSpreadIdx - 1]) {
      setActivePreviewSpreadId(allSpreads[currentSpreadIdx - 1]!.id);
    }
  };

  const goToNext = () => {
    if (hasNext && allSpreads[currentSpreadIdx + 1]) {
      setActivePreviewSpreadId(allSpreads[currentSpreadIdx + 1]!.id);
    }
  };

  // Resolve target spreads to export based on scope
  const targetSpreads = useMemo(() => {
    if (scope === 'all') {
      return allSpreads;
    }
    if (scope === 'current') {
      return activeSpread ? [activeSpread] : [];
    }
    if (scope === 'custom') {
      if (rangeMode === 'spreads') {
        const spreadNums = parseRange(customRange, allSpreads.length);
        return allSpreads.filter((s) => spreadNums.includes(s.spreadIndex));
      } else {
        // Range by Page Number (e.g. pages 3-6)
        const maxPages = allSpreads.length * 2;
        const pageNums = parseRange(customRange, maxPages);
        return allSpreads.filter((s) => {
          const leftNum = (s.spreadIndex - 1) * 2 + 1;
          const rightNum = leftNum + 1;
          return pageNums.includes(leftNum) || pageNums.includes(rightNum);
        });
      }
    }
    return allSpreads;
  }, [scope, customRange, rangeMode, allSpreads, activeSpread]);

  if (!isOpen || !currentProject) return null;

  const targetSpreadCount = targetSpreads.length;
  const targetPageCount = splitPages ? targetSpreadCount * 2 : targetSpreadCount;

  const handleSelectFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_export_directory');
      if (selected) {
        setOutputDir(selected);
        try {
          localStorage.setItem(LAST_EXPORT_DIR_KEY, selected);
        } catch {}
        setErrorMsg(null);
        setPreflightReport(null);
      }
    } catch (err) {
      console.error('Failed to pick directory:', err);
    }
  };

  const handleInitiateExport = async () => {
    const trimmedDir = outputDir.trim();
    if (!trimmedDir) {
      setErrorMsg('Please select a destination folder.');
      return;
    }
    if (targetSpreads.length === 0) {
      setErrorMsg('No spreads match the selected range. Please check your range settings.');
      return;
    }

    try {
      localStorage.setItem(LAST_EXPORT_DIR_KEY, trimmedDir);
    } catch {}

    const selectedSpreadIds = targetSpreads.map((s) => s.id);
    const exportOpts: ExportOptions = {
      format,
      dpi,
      jpegQuality,
      includeBleed,
      splitPages,
      sharpenEnabled,
      sharpenAmount,
      outputDir: trimmedDir,
      selectedSpreadIds,
      filePrefix: filePrefix.trim() || undefined,
    };

    setIsVerifyingPreflight(true);
    setErrorMsg(null);

    try {
      // 🔍 Upfront Pre-Flight Check before rendering
      const report = await invoke<PreflightReport>('preflight_check_export', {
        projectId: currentProject.id,
        options: exportOpts,
      });

      setIsVerifyingPreflight(false);

      if (!report.destinationWritable) {
        setErrorMsg(report.destinationError || 'Destination folder is not accessible or writable.');
        return;
      }

      if (report.missingPhotos && report.missingPhotos.length > 0) {
        // Pre-Flight found missing photos -> open dedicated Missing Photos modal popup!
        setPreflightReport(report);
        setIsMissingModalOpen(true);
        return;
      }

      if (report.existingFiles && report.existingFiles.length > 0) {
        // Pre-Flight found conflicting output files in destination folder -> open dedicated Overwrite modal popup!
        setPreflightReport(report);
        setIsOverwriteModalOpen(true);
        return;
      }

      // Pre-Flight 100% clean -> proceed to export!
      onStartExport(exportOpts);
      onClose();
    } catch (err: any) {
      setIsVerifyingPreflight(false);
      console.error('Pre-flight check error:', err);
      // Fallback: proceed directly if preflight check call fails
      onStartExport(exportOpts);
      onClose();
    }
  };

  const handleProceedConfirmed = () => {
    const trimmedDir = outputDir.trim();
    const selectedSpreadIds = targetSpreads.map((s) => s.id);
    onStartExport({
      format,
      dpi,
      jpegQuality,
      includeBleed,
      splitPages,
      sharpenEnabled,
      sharpenAmount,
      outputDir: trimmedDir,
      selectedSpreadIds,
      filePrefix: filePrefix.trim() || undefined,
    });
    setPreflightReport(null);
    setIsOverwriteModalOpen(false);
    setIsMissingModalOpen(false);
    onClose();
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Export Album for Print"
        width={1040}
        closeOnOverlayClick={false}
        bodyClassName={styles.dialogBodyCustom}
      >
        <div className={styles.scrollableContent}>
          <div className={styles.studioLayout}>
          {/* Left Column: Interactive Live Preview & Navigation */}
          <div className={styles.previewSection}>
            {/* Preview Toolbar */}
            <div className={styles.previewToolbar}>
              <div className={styles.viewModePills}>
                <button
                  type="button"
                  className={`${styles.viewPill} ${previewViewMode === 'spread' ? styles.viewPillActive : ''}`}
                  onClick={() => setPreviewViewMode('spread')}
                  title="View full facing spread"
                >
                  <span>◫</span>
                  <span>Full Spread</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewPill} ${previewViewMode === 'left-page' ? styles.viewPillActive : ''}`}
                  onClick={() => setPreviewViewMode('left-page')}
                  title="Inspect left page only"
                >
                  <span>◧</span>
                  <span>Left Page</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewPill} ${previewViewMode === 'right-page' ? styles.viewPillActive : ''}`}
                  onClick={() => setPreviewViewMode('right-page')}
                  title="Inspect right page only"
                >
                  <span>◨</span>
                  <span>Right Page</span>
                </button>
              </div>

              {includeBleed && (
                <button
                  type="button"
                  className={`${styles.guideToggleBtn} ${showBleedGuide ? styles.guideToggleBtnActive : ''}`}
                  onClick={() => setShowBleedGuide(!showBleedGuide)}
                  title="Toggle dashed red line showing print lab trim cut line"
                >
                  <span>✂</span>
                  <span>Trim Guide</span>
                </button>
              )}
            </div>

            {/* Interactive Live Scaled Preview */}
            {previewSpread && (
              <ExportSpreadPreview
                spread={previewSpread}
                project={currentProject}
                viewMode={previewViewMode}
                includeBleed={includeBleed}
                showBleedGuide={showBleedGuide}
                splitPages={splitPages}
                dpi={dpi}
                format={format}
              />
            )}

            {/* Spread Navigation Bar (Arrow buttons only) */}
            <div className={styles.spreadNavigator}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={goToPrev}
                disabled={!hasPrev}
                title="Previous spread"
              >
                ◀ Prev Spread
              </button>
              <div className={styles.spreadNavInfo}>
                <span className={styles.spreadNavIndex}>
                  Spread {currentSpreadIdx + 1} of {allSpreads.length}
                </span>
                {previewSpread && (
                  <span className={styles.spreadNavName}>
                    {previewSpread.name || (previewSpread.type === 'cover' ? 'Cover Spread' : `Pages ${(previewSpread.spreadIndex - 1) * 2 + 1}–${(previewSpread.spreadIndex - 1) * 2 + 2}`)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.navBtn}
                onClick={goToNext}
                disabled={!hasNext}
                title="Next spread"
              >
                Next Spread ▶
              </button>
            </div>
          </div>

          {/* Right Column: Configuration & Options */}
          <div className={styles.configSection}>
            {/* 1. Format Selection */}
            <div className={styles.section}>
              <label className={styles.sectionTitle}>Export Format</label>
              <div className={styles.formatGrid}>
                <div
                  className={`${styles.formatCard} ${format === 'jpeg' ? styles.formatCardActive : ''}`}
                  onClick={() => {
                    setFormat('jpeg');
                    setPreflightReport(null);
                  }}
                >
                  <span className={styles.formatIcon}>🖼️</span>
                  <span className={styles.formatName}>High-Res JPEG</span>
                  <span className={styles.formatDesc}>Standard Print Lab</span>
                </div>
                <div
                  className={`${styles.formatCard} ${format === 'png' ? styles.formatCardActive : ''}`}
                  onClick={() => {
                    setFormat('png');
                    setPreflightReport(null);
                  }}
                >
                  <span className={styles.formatIcon}>🎨</span>
                  <span className={styles.formatName}>Lossless PNG</span>
                  <span className={styles.formatDesc}>Highest Precision</span>
                </div>
                <div
                  className={`${styles.formatCard} ${format === 'pdf' ? styles.formatCardActive : ''}`}
                  onClick={() => {
                    setFormat('pdf');
                    setPreflightReport(null);
                  }}
                >
                  <span className={styles.formatIcon}>📑</span>
                  <span className={styles.formatName}>Print PDF</span>
                  <span className={styles.formatDesc}>Multi-Page Book</span>
                </div>
              </div>
            </div>

            {/* 2. Page Layout & Bleed Trimming */}
            <div className={styles.optionsGrid}>
              <div className={styles.optionField}>
                <label className={styles.label}>Page Layout</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioItem}>
                    <input
                      type="radio"
                      name="pageLayout"
                      checked={!splitPages}
                      onChange={() => {
                        setSplitPages(false);
                        setPreflightReport(null);
                      }}
                    />
                    Full Spreads (Facing)
                  </label>
                  <label className={styles.radioItem}>
                    <input
                      type="radio"
                      name="pageLayout"
                      checked={splitPages}
                      onChange={() => {
                        setSplitPages(true);
                        setPreflightReport(null);
                      }}
                    />
                    Single Pages (Split L/R)
                  </label>
                </div>
              </div>

              <div className={styles.optionField}>
                <label className={styles.label}>Bleed Cut Margins</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioItem} title="Export image matching the exact canvas size without outer cut margins">
                    <input
                      type="radio"
                      name="bleedOption"
                      checked={!includeBleed}
                      onChange={() => setIncludeBleed(false)}
                    />
                    Trim to Page Boundary
                  </label>
                  <label className={styles.radioItem} title="Includes extra cut margin for print lab trimming; edge-aligned photos will auto-extend into bleed">
                    <input
                      type="radio"
                      name="bleedOption"
                      checked={includeBleed}
                      onChange={() => setIncludeBleed(true)}
                    />
                    Include Bleed (+{activeSpread?.bleed || 0} {currentProject.canvasUnit})
                  </label>
                </div>
              </div>
            </div>

            {/* 3. Print Resolution & Sharpening */}
            {/* 3. Print Resolution & Quality */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Print Resolution</label>
                <span className={styles.dpiBadge}>{dpi} DPI</span>
              </div>
              <div className={styles.dpiSegmentGroup}>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${!isCustomDpi && dpi === 240 ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(false);
                    setDpi(240);
                    setPreflightReport(null);
                  }}
                  title="240 DPI - Fast draft printing"
                >
                  240
                </button>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${!isCustomDpi && dpi === 300 ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(false);
                    setDpi(300);
                    setPreflightReport(null);
                  }}
                  title="300 DPI - Standard print lab production"
                >
                  300
                </button>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${!isCustomDpi && dpi === 600 ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(false);
                    setDpi(600);
                    setPreflightReport(null);
                  }}
                  title="600 DPI - Ultra fine art & gallery print"
                >
                  600
                </button>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${isCustomDpi ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(true);
                    setPreflightReport(null);
                  }}
                  title="Custom DPI value"
                >
                  Custom
                </button>
              </div>

              {isCustomDpi && (
                <div className={styles.customDpiRow}>
                  <div className={styles.customDpiInputWrap}>
                    <input
                      type="number"
                      className={styles.customDpiInput}
                      min={72}
                      max={1200}
                      value={customDpiText}
                      onChange={(e) => {
                        setCustomDpiText(e.target.value);
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n) && n >= 72 && n <= 1200) {
                          setDpi(n);
                          setPreflightReport(null);
                        }
                      }}
                      placeholder="300"
                      autoFocus
                    />
                    <span className={styles.customDpiSuffix}>DPI</span>
                  </div>
                  <span className={styles.customDpiHint}>(72–1200)</span>
                </div>
              )}

              {/* Image Quality Slider - Located directly beneath DPI controls */}
              {format === 'jpeg' && (
                <div className={styles.qualityRow}>
                  <div className={styles.labelRow}>
                    <label className={styles.label}>JPEG Image Quality</label>
                    <span className={styles.qualityValBadge}>
                      {jpegQuality}% • {jpegQuality >= 95 ? 'Maximum' : jpegQuality >= 85 ? 'High' : 'Standard'}
                    </span>
                  </div>
                  <div className={styles.sliderRow}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={70}
                      max={100}
                      value={jpegQuality}
                      onChange={(e) => setJpegQuality(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modern Output Sharpening Card */}
            <div className={`${styles.modernSharpenCard} ${sharpenEnabled ? styles.modernSharpenCardActive : ''}`}>
              <div className={styles.sharpenCardHeader}>
                <div className={styles.sharpenHeaderInfo}>
                  <div className={styles.sharpenTitleRow}>
                    <span className={styles.sharpenIcon}>✨</span>
                    <span className={styles.sharpenTitle}>Output Print Sharpening</span>
                  </div>
                  <span className={styles.sharpenSubtitle}>
                    Unsharp masking tailored for photo paper (libvips)
                  </span>
                </div>

                <label className={styles.switchLabel} title="Toggle output print sharpening">
                  <input
                    type="checkbox"
                    className={styles.switchInput}
                    checked={sharpenEnabled}
                    onChange={(e) => setSharpenEnabled(e.target.checked)}
                  />
                  <span className={styles.switchTrack}>
                    <span className={styles.switchThumb} />
                  </span>
                </label>
              </div>

              {sharpenEnabled && (
                <div className={styles.sharpenIntensityGroup}>
                  <button
                    type="button"
                    className={`${styles.sharpenIntensityBtn} ${sharpenAmount === 'standard' ? styles.sharpenIntensityBtnActive : ''}`}
                    onClick={() => setSharpenAmount('standard')}
                  >
                    <span className={styles.intensityLevel}>Standard</span>
                    <span className={styles.intensityDesc}>Lustre / Matte Paper</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.sharpenIntensityBtn} ${sharpenAmount === 'high' ? styles.sharpenIntensityBtnActive : ''}`}
                    onClick={() => setSharpenAmount('high')}
                  >
                    <span className={styles.intensityLevel}>High</span>
                    <span className={styles.intensityDesc}>Glossy / Fine Art</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. Export Scope (Modern Horizontal Button Model) */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Export Scope</label>
                <span className={styles.scopeCountBadge}>
                  {targetSpreadCount} {targetSpreadCount === 1 ? 'Spread' : 'Spreads'} ({targetPageCount} {targetPageCount === 1 ? 'Page' : 'Pages'})
                </span>
              </div>

              <div className={styles.horizontalScopeBar}>
                <button
                  type="button"
                  className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeBtnActive : ''}`}
                  onClick={() => {
                    setScope('all');
                    setPreflightReport(null);
                  }}
                  title="Export all spreads in this album"
                >
                  <span className={styles.scopeBtnTitle}>All Spreads</span>
                  <span className={styles.scopeBtnSub}>{allSpreads.length} Spreads</span>
                </button>

                <button
                  type="button"
                  className={`${styles.scopeBtn} ${scope === 'current' ? styles.scopeBtnActive : ''}`}
                  onClick={() => {
                    setScope('current');
                    setPreflightReport(null);
                  }}
                  title="Export currently active spread"
                >
                  <span className={styles.scopeBtnTitle}>Current Spread</span>
                  <span className={styles.scopeBtnSub}>
                    {activeSpread ? (activeSpread.type === 'cover' ? 'Cover' : `Spread ${activeSpread.spreadIndex}`) : 'Spread 1'}
                  </span>
                </button>

                <button
                  type="button"
                  className={`${styles.scopeBtn} ${scope === 'custom' ? styles.scopeBtnActive : ''}`}
                  onClick={() => {
                    setScope('custom');
                    setPreflightReport(null);
                  }}
                  title="Export custom selection of spreads or pages"
                >
                  <span className={styles.scopeBtnTitle}>Custom Range</span>
                  <span className={styles.scopeBtnSub}>
                    {scope === 'custom' && customRange.trim() ? `${targetSpreadCount} Spreads` : 'Pick Spreads / Pages'}
                  </span>
                </button>
              </div>

              {scope === 'custom' && (
                <div className={styles.customScopeCard}>
                  <div className={styles.customScopeHeader}>
                    <span className={styles.customScopeHint}>
                      Enter {rangeMode === 'spreads' ? 'spread numbers' : 'page numbers'} to export:
                    </span>
                    <div className={styles.rangeModeToggle}>
                      <button
                        type="button"
                        className={`${styles.rangeModeBtn} ${rangeMode === 'spreads' ? styles.rangeModeBtnActive : ''}`}
                        onClick={() => {
                          setRangeMode('spreads');
                          setPreflightReport(null);
                        }}
                        title="Specify range by Spread numbers"
                      >
                        By Spreads (1–{allSpreads.length})
                      </button>
                      <button
                        type="button"
                        className={`${styles.rangeModeBtn} ${rangeMode === 'pages' ? styles.rangeModeBtnActive : ''}`}
                        onClick={() => {
                          setRangeMode('pages');
                          setPreflightReport(null);
                        }}
                        title="Specify range by individual Page numbers"
                      >
                        By Pages (1–{allSpreads.length * 2})
                      </button>
                    </div>
                  </div>

                  <div className={styles.customRangeInputRow}>
                    <input
                      type="text"
                      className={styles.customRangeInput}
                      placeholder={rangeMode === 'spreads' ? "e.g. 1-3, 5, 8" : "e.g. 1-6, 9-10"}
                      value={customRange}
                      onChange={(e) => {
                        setCustomRange(e.target.value);
                        setPreflightReport(null);
                      }}
                      autoFocus
                    />
                  </div>

                  <div className={styles.customScopeResult}>
                    {targetSpreads.length > 0 ? (
                      <span className={styles.customScopeSuccess}>
                        ✓ Will export {targetSpreads.length} {targetSpreads.length === 1 ? 'Spread' : 'Spreads'}:{' '}
                        {targetSpreads.map((s) => s.type === 'cover' ? 'Cover' : `Spread ${s.spreadIndex}`).join(', ')}
                      </span>
                    ) : (
                      <span className={styles.customScopeWarning}>
                        ⚠️ No spreads selected. Enter comma-separated numbers or ranges (e.g. 1-3, 5).
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Filename Pattern & Prefix */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Filename Prefix</label>
                {currentProject?.name && (
                  <button
                    type="button"
                    className={styles.useProjectNameBtn}
                    onClick={() => {
                      setFilePrefix(currentProject.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
                      setPreflightReport(null);
                    }}
                    title="Apply current project name as prefix"
                  >
                    <span>↺</span>
                    <span>Use Project Name</span>
                  </button>
                )}
              </div>

              <div className={styles.modernInputWrapper}>
                <span className={styles.inputPrefixIcon}>🏷️</span>
                <input
                  type="text"
                  className={styles.modernInput}
                  placeholder="Prefix (e.g. Wedding_Album, leave blank for default)"
                  value={filePrefix}
                  onChange={(e) => {
                    setFilePrefix(e.target.value);
                    setPreflightReport(null);
                  }}
                />
                {filePrefix && (
                  <button
                    type="button"
                    className={styles.inputClearBtn}
                    onClick={() => {
                      setFilePrefix('');
                      setPreflightReport(null);
                    }}
                    title="Clear prefix"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className={styles.namingOutputTag}>
                <span className={styles.outputTagIcon}>📄</span>
                <span className={styles.outputTagLabel}>Example Output:</span>
                {(() => {
                  const ext = format === 'png' ? 'png' : format === 'pdf' ? 'pdf' : 'jpg';
                  const clean = filePrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                  let filename = `Spread_01.${ext}`;
                  if (format === 'pdf') {
                    filename = clean ? (clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`) : `${currentProject?.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Album'}_Print_Ready.pdf`;
                  } else if (splitPages) {
                    filename = clean ? `${clean}_Page_001.${ext}` : `Page_001.${ext}`;
                  } else {
                    filename = clean ? `${clean}_Spread_01.${ext}` : `Spread_01.${ext}`;
                  }
                  return (
                    <span className={styles.outputTagValue} title={filename}>
                      {filename}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* 6. Destination Folder */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Destination Folder</label>
                {outputDir && (
                  <span className={styles.folderStatusBadge}>✓ Selected</span>
                )}
              </div>

              <div
                className={`${styles.modernFolderCard} ${!outputDir ? styles.modernFolderCardEmpty : ''}`}
                onClick={handleSelectFolder}
                title={outputDir ? `Target: ${outputDir}` : 'Click to choose destination folder'}
              >
                <div className={styles.folderCardIconWrap}>
                  <span className={styles.folderCardIcon}>{outputDir ? '📂' : '📁'}</span>
                </div>

                <div className={styles.folderCardContent}>
                  {outputDir ? (
                    <>
                      <span className={styles.folderPrimaryName}>
                        {outputDir.split(/[\\/]/).filter(Boolean).pop() || outputDir}
                      </span>
                      <span className={styles.folderFullPath} title={outputDir}>
                        {outputDir}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={styles.folderEmptyTitle}>Choose Export Destination</span>
                      <span className={styles.folderEmptyHint}>Click to select folder where print files will be saved</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className={styles.browseActionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFolder();
                  }}
                >
                  Browse...
                </button>
              </div>

              {errorMsg && (
                <div className={styles.errorBanner}>
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <div className={styles.footerSummary}>
            <span className={styles.readyBadge}>✓ Ready</span>
            <span className={styles.summaryDot}>•</span>
            <span>
              {targetSpreadCount} {targetSpreadCount === 1 ? 'Spread' : 'Spreads'} ({targetPageCount} {targetPageCount === 1 ? 'Page' : 'Pages'})
            </span>
            <span className={styles.summaryDot}>•</span>
            <span>{format.toUpperCase()} @ {dpi} DPI</span>
            {includeBleed && <span> (+Bleed)</span>}
          </div>
          <div className={styles.footerActions}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleInitiateExport}
              disabled={isVerifyingPreflight}
            >
              {isVerifyingPreflight ? 'Verifying Files...' : `Export Album (${targetSpreadCount}) 📤`}
            </Button>
          </div>
        </div>
      </Dialog>

    {/* Dedicated Overwrite Confirmation Modal Popup */}
    {isOverwriteModalOpen && preflightReport && preflightReport.existingFiles && preflightReport.existingFiles.length > 0 && (
      <Dialog
        isOpen={isOverwriteModalOpen}
        onClose={() => setIsOverwriteModalOpen(false)}
        title="⚠️ Overwrite Warning"
        width={500}
        closeOnOverlayClick={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            The destination folder already contains <strong>{preflightReport.existingFiles.length} file(s)</strong> with matching export names. Proceeding will overwrite and replace them:
          </div>

          <div className={styles.missingList} style={{ maxHeight: '180px', backgroundColor: 'rgba(0,0,0,0.35)' }}>
            {preflightReport.existingFiles.map((filename, i) => (
              <div key={i} className={styles.missingItem}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>📄 {filename}</span>
                <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 600 }}>Will be overwritten</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
            <Button
              variant="secondary"
              onClick={() => setIsOverwriteModalOpen(false)}
            >
              Cancel / Change Folder
            </Button>
            <Button
              variant="primary"
              onClick={handleProceedConfirmed}
              style={{ backgroundColor: '#ef4444', borderColor: '#dc2626', color: '#ffffff' }}
            >
              Overwrite Existing Files
            </Button>
          </div>
        </div>
      </Dialog>
    )}

    {/* Dedicated Missing Photos Warning Modal Popup */}
    {isMissingModalOpen && preflightReport && preflightReport.missingPhotos && preflightReport.missingPhotos.length > 0 && (
      <Dialog
        isOpen={isMissingModalOpen}
        onClose={() => setIsMissingModalOpen(false)}
        title="⚠️ Missing Photos Detected"
        width={520}
        closeOnOverlayClick={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            The original high-resolution master files for <strong>{preflightReport.missingPhotos.length} photo(s)</strong> could not be found at their disk paths.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '-8px' }}>
            If you proceed with export, these frames will be rendered using low-resolution thumbnail previews.
          </div>

          <div className={styles.missingList} style={{ maxHeight: '180px', backgroundColor: 'rgba(0,0,0,0.35)' }}>
            {preflightReport.missingPhotos.map((item) => (
              <div key={item.elementId} className={styles.missingItem}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.spreadName}: {item.fileName}</span>
                <span className={styles.missingPath} title={item.filePath}>{item.filePath}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsMissingModalOpen(false);
                onClose();
                openRelink();
              }}
            >
              Locate & Relink Photos...
            </Button>
            <Button
              variant="primary"
              onClick={handleProceedConfirmed}
              style={{ backgroundColor: '#f59e0b', borderColor: '#d97706', color: '#000000' }}
            >
              Export Using Previews
            </Button>
          </div>
        </div>
      </Dialog>
    )}
  </>
  );
}
