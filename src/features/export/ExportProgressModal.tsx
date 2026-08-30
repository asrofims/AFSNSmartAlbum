import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import styles from './ExportProgressModal.module.css';

export interface ExportProgressPayload {
  current: number;
  total: number;
  currentPhotos?: number;
  totalPhotos?: number;
  percent?: number;
  spreadName: string;
  status: string;
  isFinished: boolean;
  outputFiles: string[];
}

interface ExportProgressModalProps {
  isOpen: boolean;
  outputDir: string;
  onClose: () => void;
}

function AnimatedExportPhotoIcon() {
  return (
    <div className={styles.photoAnimationContainer}>
      <svg width="68" height="68" viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.photoSvg}>
        <defs>
          <linearGradient id="expPhotoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="expPhotoGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="expSunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Outer Aura Glow */}
        <circle cx="34" cy="34" r="28" fill="url(#expPhotoGrad2)" opacity="0.18" className={styles.auraPulse} />

        {/* Back Photo Card (Tilted left) */}
        <g className={styles.backCard}>
          <rect x="10" y="16" width="38" height="30" rx="4" fill="#1e293b" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <rect x="13" y="19" width="32" height="24" rx="2" fill="url(#expPhotoGrad1)" opacity="0.85" />
        </g>

        {/* Front Photo Card (Tilted right, vibrant scenery) */}
        <g className={styles.frontCard}>
          <rect x="18" y="22" width="40" height="32" rx="5" fill="#ffffff" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
          {/* Photo Inner Screen */}
          <rect x="21" y="25" width="34" height="26" rx="3" fill="url(#expPhotoGrad2)" />
          {/* Sun */}
          <circle cx="28" cy="31" r="3.5" fill="url(#expSunGrad)" />
          {/* Landscape Mountains */}
          <path d="M21 47 L30 38 L36 43 L45 33 L55 47 Z" fill="#0f172a" opacity="0.65" />
          <path d="M28 47 L36 40 L43 45 L50 37 L55 44 L55 47 Z" fill="#1e1b4b" opacity="0.85" />
        </g>

        {/* Sparkles / Magic Stars */}
        <g className={styles.sparkleGroup}>
          <path d="M52 14 L53.5 18 L57.5 19.5 L53.5 21 L52 25 L50.5 21 L46.5 19.5 L50.5 18 Z" fill="#fbbf24" className={styles.sparkle1} />
          <path d="M14 12 L15 15 L18 16 L15 17 L14 20 L13 17 L10 16 L13 15 Z" fill="#38bdf8" className={styles.sparkle2} />
        </g>
      </svg>
    </div>
  );
}

export function ExportProgressModal({ isOpen, outputDir, onClose }: ExportProgressModalProps) {
  const [progress, setProgress] = useState<ExportProgressPayload>({
    current: 0,
    total: 1,
    currentPhotos: 0,
    totalPhotos: 0,
    percent: 0,
    spreadName: '',
    status: 'Preparing high-resolution rendering...',
    isFinished: false,
    outputFiles: [],
  });

  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setProgress({
        current: 0,
        total: 1,
        currentPhotos: 0,
        totalPhotos: 0,
        percent: 0,
        spreadName: '',
        status: 'Preparing high-resolution rendering...',
        isFinished: false,
        outputFiles: [],
      });
      setIsCancelling(false);
      return;
    }

    const unlisten = listen<ExportProgressPayload>('export-progress', (event) => {
      setProgress(event.payload);
      if (event.payload.isFinished) {
        setIsCancelling(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isOpen]);

  const rawPercent = progress.isFinished
    ? (progress.status.includes('cancelled') ? 0 : 100)
    : progress.percent !== undefined
    ? progress.percent
    : (progress.current / Math.max(1, progress.total)) * 100;
  const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));

  const handleOpenFolder = async () => {
    if (!outputDir) return;
    try {
      await invoke('open_export_directory', { dirPath: outputDir });
    } catch (err) {
      console.error('Failed to open export directory:', err);
    }
  };

  const handleCancelExport = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await invoke('cancel_export');
    } catch (err) {
      console.error('Failed to request export cancellation:', err);
      setIsCancelling(false);
    }
  };

  const isCancelled = progress.status.toLowerCase().includes('cancelled');

  return (
    <Dialog
      isOpen={isOpen}
      onClose={progress.isFinished ? onClose : handleCancelExport}
      title={
        progress.isFinished
          ? isCancelled
            ? 'Export Cancelled'
            : 'Export Complete'
          : 'Exporting Album'
      }
      width={460}
      closeOnOverlayClick={progress.isFinished}
    >
      <div className={styles.container}>
        {progress.isFinished ? (
          isCancelled ? (
            <div className={styles.iconWrapper} style={{ fontSize: '28px' }}>⏹️</div>
          ) : (
            <div className={styles.successIcon}>🎉</div>
          )
        ) : (
          <AnimatedExportPhotoIcon />
        )}

        <div className={styles.title}>
          {progress.isFinished
            ? isCancelled
              ? 'Export Was Cancelled'
              : 'Album Export Complete!'
            : 'Rendering High-Resolution Layout'}
        </div>

        <div className={styles.statusText} title={progress.status}>
          {isCancelling ? 'Cancelling export safely...' : progress.status}
        </div>

        <div className={styles.progressTrack}>
          <div
            className={styles.progressBar}
            style={{
              width: `${percent}%`,
              backgroundColor: isCancelled ? 'var(--color-danger, #ef4444)' : undefined,
            }}
          />
        </div>

        <div className={styles.percentLabel}>
          {isCancelled
            ? 'Cancelled'
            : progress.totalPhotos && progress.totalPhotos > 0
            ? `${progress.currentPhotos || 0} of ${progress.totalPhotos} Photos (${percent}%)`
            : `${progress.current} of ${progress.total} Spreads (${percent}%)`}
        </div>

        {progress.isFinished && !isCancelled && progress.outputFiles.length > 0 && (
          <div className={styles.filesSection}>
            <div className={styles.filesHeader}>
              <span>Exported Files ({progress.outputFiles.length})</span>
              <span className={styles.filesLocationHint}>Saved to export directory</span>
            </div>
            <div className={styles.filesBox}>
              {progress.outputFiles.map((file, i) => {
                const filename = file.split(/[\\/]/).pop() || file;
                const isPdf = filename.toLowerCase().endsWith('.pdf');
                const isPng = filename.toLowerCase().endsWith('.png');
                return (
                  <div key={i} className={styles.fileItem} title={file}>
                    <div className={styles.fileItemLeft}>
                      <span className={styles.fileIcon}>
                        {isPdf ? '📕' : isPng ? '🖼️' : '📸'}
                      </span>
                      <span className={styles.fileName}>{filename}</span>
                    </div>
                    <span className={styles.fileBadge}>
                      {isPdf ? 'PDF Document' : isPng ? 'PNG' : 'JPEG'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          {progress.isFinished ? (
            <>
              {!isCancelled && (
                <Button variant="secondary" onClick={handleOpenFolder}>
                  📂 Open Export Folder
                </Button>
              )}
              <Button variant="primary" onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {isCancelling ? 'Stopping background workers...' : 'Rendering at full print DPI...'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelExport}
                disabled={isCancelling}
                style={{ color: 'var(--color-danger, #ef4444)' }}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Export'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
