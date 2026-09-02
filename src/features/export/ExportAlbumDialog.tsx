import { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { usePhotoStore } from '../../stores/photoStore';
import { getAllAlbumSpreads, Spread } from '../../domain/album';
import { calculateExportPixels } from '../../domain/units';
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
  const [includeBleed, setIncludeBleed] = useState<boolean>(true);
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

  // Calculate live output dimensions
  const singlePageW = currentProject.canvasWidth;
  const singlePageH = currentProject.canvasHeight;
  const gutterW = activeSpread?.gutterWidth || 0;
  const bleed = activeSpread?.bleed || 0;

  const totalSpreadW = singlePageW * 2 + gutterW;
  const totalSpreadH = singlePageH;

  const spreadWWithBleed = includeBleed ? totalSpreadW + bleed * 2 : totalSpreadW;
  const spreadHWithBleed = includeBleed ? totalSpreadH + bleed * 2 : totalSpreadH;

  const pixelW = calculateExportPixels(spreadWWithBleed, currentProject.canvasUnit, dpi, currentProject.canvasDpi);
  const pixelH = calculateExportPixels(spreadHWithBleed, currentProject.canvasUnit, dpi, currentProject.canvasDpi);

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
        width={560}
        closeOnOverlayClick={false}
      >
        <div className={styles.container}>
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
            <label className={styles.label}>Bleed Allowance</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="bleedOption"
                  checked={includeBleed}
                  onChange={() => setIncludeBleed(true)}
                />
                Include Bleed ({activeSpread?.bleed || 0} {currentProject.canvasUnit})
              </label>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="bleedOption"
                  checked={!includeBleed}
                  onChange={() => setIncludeBleed(false)}
                />
                Trim to Page Boundary
              </label>
            </div>
          </div>
        </div>

        {/* 3. Resolution & Quality */}
        <div className={styles.optionsGrid}>
          <div className={styles.optionField}>
            <label className={styles.label}>Print Resolution</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className={styles.select}
                value={isCustomDpi ? 'custom' : dpi}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsCustomDpi(true);
                    setCustomDpiText(String(dpi));
                  } else {
                    setIsCustomDpi(false);
                    setDpi(Number(val));
                  }
                }}
                style={{ flex: isCustomDpi ? '0 0 140px' : '1' }}
              >
                <option value={300}>300 DPI (Production Print)</option>
                <option value={240}>240 DPI (Standard Print)</option>
                <option value={600}>600 DPI (Ultra Fine Print)</option>
                {currentProject.canvasDpi !== 300 && currentProject.canvasDpi !== 240 && currentProject.canvasDpi !== 600 && (
                  <option value={currentProject.canvasDpi}>Project DPI ({currentProject.canvasDpi} DPI)</option>
                )}
                <option value="custom">Custom DPI...</option>
              </select>
              {isCustomDpi && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <input
                    type="number"
                    className={styles.select}
                    style={{ flex: 1, padding: '0 8px' }}
                    min={72}
                    max={1200}
                    step={1}
                    value={customDpiText}
                    onChange={(e) => {
                      setCustomDpiText(e.target.value);
                      const num = Number(e.target.value);
                      if (num >= 72 && num <= 1200) {
                        setDpi(num);
                      }
                    }}
                    onBlur={() => {
                      const num = Number(customDpiText);
                      const clamped = Math.max(72, Math.min(1200, Math.round(num) || 300));
                      setDpi(clamped);
                      setCustomDpiText(String(clamped));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    autoFocus
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>DPI</span>
                </div>
              )}
            </div>
          </div>

          {format !== 'png' ? (
            <div className={styles.optionField}>
              <label className={styles.label}>JPEG Quality ({jpegQuality}%)</label>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  className={styles.slider}
                  min={80}
                  max={100}
                  step={1}
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(Number(e.target.value))}
                />
                <span className={styles.sliderVal}>{jpegQuality}%</span>
              </div>
            </div>
          ) : (
            <div className={styles.optionField}>
              <label className={styles.label}>Compression</label>
              <div className={styles.sliderRow}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Lossless 24-bit RGBA
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Print Output Sharpening */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>Print Output Sharpening</label>
          <div className={styles.sharpenBox}>
            <label className={styles.sharpenToggle}>
              <input
                type="checkbox"
                checked={sharpenEnabled}
                onChange={(e) => setSharpenEnabled(e.target.checked)}
              />
              <span>Enhance Micro-Detail for Print (Unsharp Masking)</span>
            </label>
            <div className={styles.sharpenHelp}>
              Compensates for downscale pixel softening and printer dot gain, giving extra crispness to hair, eyes, jewelry, and textures.
            </div>

            {sharpenEnabled && (
              <div className={styles.sharpenSubGroup}>
                <label className={styles.radioItem} style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="sharpenAmount"
                    value="standard"
                    checked={sharpenAmount === 'standard'}
                    onChange={() => setSharpenAmount('standard')}
                  />
                  <span>Standard (Glossy / Luster Photo Lab)</span>
                </label>
                <label className={styles.radioItem} style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="sharpenAmount"
                    value="high"
                    checked={sharpenAmount === 'high'}
                    onChange={() => setSharpenAmount('high')}
                  />
                  <span>High (Matte / Velvet / Canvas)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* 5. Scope (All / Current / Custom Range) */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>Export Scope</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioItem}>
              <input
                type="radio"
                name="exportScope"
                checked={scope === 'all'}
                onChange={() => {
                  setScope('all');
                  setPreflightReport(null);
                }}
              />
              All Spreads ({allSpreads.length} Spreads / {allSpreads.length * 2} Pages)
            </label>
            <label className={styles.radioItem}>
              <input
                type="radio"
                name="exportScope"
                checked={scope === 'current'}
                onChange={() => {
                  setScope('current');
                  setPreflightReport(null);
                }}
              />
              Current Spread ({activeSpread?.name || 'Spread 1'})
            </label>
            <label className={styles.radioItem}>
              <input
                type="radio"
                name="exportScope"
                checked={scope === 'custom'}
                onChange={() => {
                  setScope('custom');
                  setPreflightReport(null);
                }}
              />
              Custom Range...
            </label>

            {scope === 'custom' && (
              <div className={styles.rangeBox}>
                <div className={styles.rangeRow}>
                  <span className={styles.rangeHint}>Specify by:</span>
                  <select
                    className={styles.select}
                    style={{ height: '28px', fontSize: '11px', padding: '0 4px' }}
                    value={rangeMode}
                    onChange={(e) => {
                      setRangeMode(e.target.value as any);
                      setPreflightReport(null);
                    }}
                  >
                    <option value="spreads">Spread Numbers (1-{allSpreads.length})</option>
                    <option value="pages">Page Numbers (1-{allSpreads.length * 2})</option>
                  </select>
                  <input
                    type="text"
                    className={styles.rangeInput}
                    placeholder={rangeMode === 'spreads' ? 'e.g. 3-6 or 1,3,5' : 'e.g. 3-8 or 1,4'}
                    value={customRange}
                    onChange={(e) => {
                      setCustomRange(e.target.value);
                      setPreflightReport(null);
                    }}
                  />
                </div>
                <div className={styles.rangeBadge}>
                  ✓ Selected {targetSpreads.length} Spread(s): {targetSpreads.map((s) => `Spread ${s.spreadIndex}`).join(', ') || 'None'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. File Naming & Custom Prefix */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>File Naming & Custom Prefix</label>
          <div className={styles.namingRow}>
            <input
              type="text"
              className={styles.pathInput}
              placeholder="e.g. Wedding_Budi_Ani (Optional prefix)"
              value={filePrefix}
              onChange={(e) => {
                setFilePrefix(e.target.value);
                setPreflightReport(null);
              }}
            />
            {currentProject?.name && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilePrefix(currentProject.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
                  setPreflightReport(null);
                }}
                title="Use current project name as prefix"
              >
                Use Project Name
              </Button>
            )}
            {filePrefix && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilePrefix('');
                  setPreflightReport(null);
                }}
                title="Reset to default naming"
              >
                Clear
              </Button>
            )}
          </div>
          <div className={styles.namingPreview}>
            <span className={styles.previewLabel}>Example Output:</span>
            <span className={styles.previewFilename}>
              {(() => {
                const ext = format === 'png' ? 'png' : format === 'pdf' ? 'pdf' : 'jpg';
                const clean = filePrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                if (format === 'pdf') {
                  return clean ? (clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`) : `${currentProject?.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Album'}_Print_Ready.pdf`;
                }
                if (splitPages) {
                  return clean ? `${clean}_Page_001.${ext}, ${clean}_Page_002.${ext}` : `Page_001.${ext}, Page_002.${ext}`;
                }
                return clean ? `${clean}_Spread_01.${ext}` : `Spread_01.${ext}`;
              })()}
            </span>
          </div>
        </div>

        {/* 6. Destination Folder */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>Destination Folder</label>
          <div className={styles.pathRow}>
            <input
              type="text"
              className={styles.pathInput}
              placeholder="Click Browse to select export folder..."
              value={outputDir}
              onChange={(e) => {
                setOutputDir(e.target.value);
                setErrorMsg(null);
                setPreflightReport(null);
              }}
            />
            <Button variant="secondary" onClick={handleSelectFolder}>
              Browse...
            </Button>
          </div>
          {errorMsg && (
            <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '11px' }}>
              ⚠️ {errorMsg}
            </span>
          )}
        </div>

        {/* 6. Live Summary Box */}
        <div className={styles.summaryBox}>
          <div className={styles.summaryRow}>
            <span>Spread Dimensions:</span>
            <span className={styles.summaryVal}>
              {pixelW} × {pixelH} px ({spreadWWithBleed} × {spreadHWithBleed} {currentProject.canvasUnit} @ {dpi} DPI)
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span>Total Outputs:</span>
            <span className={styles.summaryVal}>
              {format === 'pdf'
                ? `1 Multi-Page PDF (${targetSpreadCount} Spreads)`
                : `${targetPageCount} ${format.toUpperCase()} Image File(s)`}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleInitiateExport}
            disabled={isVerifyingPreflight}
          >
            {isVerifyingPreflight ? 'Verifying Files...' : 'Export Album 📤'}
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
