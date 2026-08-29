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
    setIsCancelling(true);
    try {
      await invoke('cancel_export');
    } catch (err) {
      console.error('Failed to request export cancellation:', err);
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
          <div className={styles.iconWrapper}>⚙️</div>
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
          <div className={styles.filesBox}>
            {progress.outputFiles.map((file, i) => (
              <div key={i} className={styles.fileItem} title={file}>
                📄 {file.split(/[\\/]/).pop()}
              </div>
            ))}
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
