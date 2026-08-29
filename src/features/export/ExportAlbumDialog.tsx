import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { getAllAlbumSpreads } from '../../domain/album';
import { toPixels } from '../../domain/units';
import styles from './ExportAlbumDialog.module.css';

export interface ExportOptions {
  format: 'jpeg' | 'png' | 'pdf';
  dpi: number;
  jpegQuality: number;
  includeBleed: boolean;
  splitPages: boolean;
  outputDir: string;
  selectedSpreadIds?: string[];
}

interface ExportAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: (options: ExportOptions) => void;
}

export function ExportAlbumDialog({ isOpen, onClose, onStartExport }: ExportAlbumDialogProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);

  const [format, setFormat] = useState<'jpeg' | 'png' | 'pdf'>('jpeg');
  const [dpi, setDpi] = useState<number>(currentProject?.canvasDpi || 300);
  const [jpegQuality, setJpegQuality] = useState<number>(95);
  const [includeBleed, setIncludeBleed] = useState<boolean>(true);
  const [splitPages, setSplitPages] = useState<boolean>(false);
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [outputDir, setOutputDir] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !currentProject) return null;

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  // Calculate live output dimensions
  const singlePageW = currentProject.canvasWidth;
  const singlePageH = currentProject.canvasHeight;
  const gutterW = activeSpread?.gutterWidth || 0;
  const bleed = activeSpread?.bleed || 0;

  const totalSpreadW = singlePageW * 2 + gutterW;
  const totalSpreadH = singlePageH;

  const spreadWWithBleed = includeBleed ? totalSpreadW + bleed * 2 : totalSpreadW;
  const spreadHWithBleed = includeBleed ? totalSpreadH + bleed * 2 : totalSpreadH;

  const pixelW = Math.round(toPixels(spreadWWithBleed, currentProject.canvasUnit, dpi));
  const pixelH = Math.round(toPixels(spreadHWithBleed, currentProject.canvasUnit, dpi));

  const targetSpreadCount = scope === 'all' ? allSpreads.length : 1;
  const targetPageCount = splitPages ? targetSpreadCount * 2 : targetSpreadCount;

  const handleSelectFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_export_directory');
      if (selected) {
        setOutputDir(selected);
        setErrorMsg(null);
      }
    } catch (err) {
      console.error('Failed to pick directory:', err);
    }
  };

  const handleExport = () => {
    if (!outputDir.trim()) {
      setErrorMsg('Please select a destination folder.');
      return;
    }

    const selectedSpreadIds = scope === 'current' && activeSpread
      ? [activeSpread.id]
      : undefined;

    onStartExport({
      format,
      dpi,
      jpegQuality,
      includeBleed,
      splitPages,
      outputDir: outputDir.trim(),
      selectedSpreadIds,
    });
    onClose();
  };

  return (
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
              onClick={() => setFormat('jpeg')}
            >
              <span className={styles.formatIcon}>🖼️</span>
              <span className={styles.formatName}>High-Res JPEG</span>
              <span className={styles.formatDesc}>Standard Print Lab</span>
            </div>
            <div
              className={`${styles.formatCard} ${format === 'png' ? styles.formatCardActive : ''}`}
              onClick={() => setFormat('png')}
            >
              <span className={styles.formatIcon}>🎨</span>
              <span className={styles.formatName}>Lossless PNG</span>
              <span className={styles.formatDesc}>Highest Precision</span>
            </div>
            <div
              className={`${styles.formatCard} ${format === 'pdf' ? styles.formatCardActive : ''}`}
              onClick={() => setFormat('pdf')}
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
                  onChange={() => setSplitPages(false)}
                />
                Full Spreads (Facing)
              </label>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="pageLayout"
                  checked={splitPages}
                  onChange={() => setSplitPages(true)}
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
            <select
              className={styles.select}
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
            >
              <option value={300}>300 DPI (Production Print)</option>
              <option value={240}>240 DPI (Standard Print)</option>
              <option value={600}>600 DPI (Ultra Fine Print)</option>
              {currentProject.canvasDpi !== 300 && currentProject.canvasDpi !== 240 && currentProject.canvasDpi !== 600 && (
                <option value={currentProject.canvasDpi}>Project DPI ({currentProject.canvasDpi} DPI)</option>
              )}
            </select>
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

        {/* 4. Scope & Destination */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>Export Scope</label>
          <div className={styles.radioGroup} style={{ flexDirection: 'row', gap: '16px' }}>
            <label className={styles.radioItem}>
              <input
                type="radio"
                name="exportScope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              All Spreads ({allSpreads.length} spreads)
            </label>
            <label className={styles.radioItem}>
              <input
                type="radio"
                name="exportScope"
                checked={scope === 'current'}
                onChange={() => setScope('current')}
              />
              Current Spread ({activeSpread?.name || 'Active'})
            </label>
          </div>
        </div>

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

        {/* 5. Live Summary Box */}
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
          <Button variant="primary" onClick={handleExport}>
            Export Album 📤
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
