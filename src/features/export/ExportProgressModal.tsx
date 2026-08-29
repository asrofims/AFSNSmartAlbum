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
      return;
    }

    const unlisten = listen<ExportProgressPayload>('export-progress', (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isOpen]);

  const rawPercent = progress.isFinished
    ? 100
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

  return (
    <Dialog
      isOpen={isOpen}
      onClose={progress.isFinished ? onClose : () => {}}
      title={progress.isFinished ? 'Export Complete' : 'Exporting Album'}
      width={460}
      closeOnOverlayClick={progress.isFinished}
    >
      <div className={styles.container}>
        {progress.isFinished ? (
          <div className={styles.successIcon}>🎉</div>
        ) : (
          <div className={styles.iconWrapper}>⚙️</div>
        )}

        <div className={styles.title}>
          {progress.isFinished ? 'Album Export Complete!' : 'Rendering High-Resolution Layout'}
        </div>

        <div className={styles.statusText} title={progress.status}>
          {progress.status}
        </div>

        <div className={styles.progressTrack}>
          <div className={styles.progressBar} style={{ width: `${percent}%` }} />
        </div>

        <div className={styles.percentLabel}>
          {progress.totalPhotos && progress.totalPhotos > 0
            ? `${progress.currentPhotos || 0} of ${progress.totalPhotos} Photos (${percent}%)`
            : `${progress.current} of ${progress.total} Spreads (${percent}%)`}
        </div>

        {progress.isFinished && progress.outputFiles.length > 0 && (
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
              <Button variant="secondary" onClick={handleOpenFolder}>
                📂 Open Export Folder
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Please wait while photos are composited at full print DPI...
            </span>
          )}
        </div>
      </div>
    </Dialog>
  );
}
