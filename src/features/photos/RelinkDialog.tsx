import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import styles from './RelinkDialog.module.css';

export function RelinkDialog() {
  const isRelinkOpen = usePhotoStore((s) => s.isRelinkOpen);
  const closeRelink = usePhotoStore((s) => s.closeRelink);
  const relinkFolder = usePhotoStore((s) => s.relinkFolder);
  const photos = usePhotoStore((s) => s.photos);
  const currentProject = useProjectStore((s) => s.currentProject);
  const isRelinking = usePhotoStore((s) => s.isRelinking);
  const isCancellingRelink = usePhotoStore((s) => s.isCancellingRelink);
  const cancelRelink = usePhotoStore((s) => s.cancelRelink);
  const relinkProgress = usePhotoStore((s) => s.relinkProgress);
  const relinkSummary = usePhotoStore((s) => s.relinkSummary);
  const error = usePhotoStore((s) => s.error);

  const missingPhotos = photos.filter((p) => p.isMissing);

  if (!isRelinkOpen || !currentProject) return null;

  const dialogTitle = isCancellingRelink
    ? 'Cancelling Relink...'
    : isRelinking
    ? 'Relinking Missing Photos...'
    : relinkSummary
    ? 'Relink Results'
    : 'Relink Missing Photos';

  const getPhaseLabel = (phase?: string) => {
    if (isCancellingRelink) return 'Stopping relink gracefully...';
    switch (phase) {
      case 'scanning':
        return 'Scanning directory for matching files...';
      case 'matching':
        return 'Matching filenames and EXIF metadata...';
      case 'rebuilding':
        return 'Rebuilding high-resolution previews and thumbnails...';
      case 'completed':
        return 'Finalizing photo assets...';
      case 'cancelled':
        return 'Relink cancelled by user.';
      default:
        return 'Searching and restoring missing photos...';
    }
  };

  return (
    <Dialog
      isOpen={isRelinkOpen}
      onClose={() => {
        if (!isRelinking && !isCancellingRelink) closeRelink();
      }}
      title={dialogTitle}
      width={560}
      closeOnOverlayClick={!isRelinking && !isCancellingRelink}
    >
      <div className={styles.container}>
        {/* VIEW 1: LIVE PROGRESS */}
        {isRelinking && (
          <div className={styles.progressContainer} role="status" aria-live="polite">
            <div className={styles.progressHeader}>
              <div className={styles.phaseIndicator}>
                <span className={styles.pulseDot} />
                <span className={styles.phaseText}>
                  {getPhaseLabel(relinkProgress?.phase)}
                </span>
              </div>
              <span className={styles.percentText}>
                {relinkProgress?.percent ?? 0}%
              </span>
            </div>

            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{ width: `${Math.min(100, Math.max(0, relinkProgress?.percent ?? 0))}%` }}
              />
            </div>

            <div className={styles.progressDetails}>
              <div className={styles.fileInfo}>
                {relinkProgress?.currentFile ? (
                  <>
                    <span className={styles.fileLabel}>Processing:</span>
                    <span className={styles.fileName} title={relinkProgress.currentFile}>
                      {relinkProgress.currentFile}
                    </span>
                  </>
                ) : (
                  <span className={styles.fileLabel}>Preparing candidate files...</span>
                )}
              </div>
              <div className={styles.metrics}>
                {relinkProgress && relinkProgress.total > 0 && (
                  <span className={styles.countText}>
                    {relinkProgress.current} / {relinkProgress.total}
                  </span>
                )}
                {relinkProgress && relinkProgress.relinkedCount > 0 && (
                  <span className={styles.relinkedBadge}>
                    ✓ {relinkProgress.relinkedCount} reconnected
                  </span>
                )}
              </div>
            </div>

            <div className={styles.progressFooter}>
              <Button
                variant="secondary"
                onClick={cancelRelink}
                disabled={isCancellingRelink}
              >
                {isCancellingRelink ? 'Cancelling...' : 'Cancel Relink'}
              </Button>
            </div>
          </div>
        )}

        {/* VIEW 2: RESULTS SUMMARY */}
        {!isRelinking && relinkSummary && (
          <div className={styles.summaryContainer}>
            {relinkSummary.cancelled && (
              <div className={styles.cancelledCard}>
                <span className={styles.cancelledIcon}>⏹</span>
                <div className={styles.cancelledText}>
                  <strong>Relink operation was cancelled.</strong>
                  <p className={styles.summarySubtext}>
                    The operation was safely stopped. Photos reconnected before cancellation remain saved and updated.
                  </p>
                </div>
              </div>
            )}

            {relinkSummary.relinkedCount > 0 && (
              <div className={styles.successCard}>
                <span className={styles.successIcon}>✓</span>
                <div className={styles.successText}>
                  <strong>
                    {relinkSummary.relinkedCount} photo{relinkSummary.relinkedCount === 1 ? '' : 's'} successfully reconnected.
                  </strong>
                  <p className={styles.summarySubtext}>
                    Database records and frame dimensions have been updated and previews refreshed.
                  </p>
                </div>
              </div>
            )}

            {relinkSummary.unresolvedCount > 0 ? (
              <div className={styles.unresolvedSection}>
                <div className={styles.warningCard}>
                  <span className={styles.warningIcon}>⚠️</span>
                  <div className={styles.warningText}>
                    <strong>
                      {relinkSummary.unresolvedCount} photo{relinkSummary.unresolvedCount === 1 ? '' : 's'} could not be found.
                    </strong>
                    <p className={styles.summarySubtext}>
                      {relinkSummary.relinkedCount === 0
                        ? 'No matching files were found in the selected folder. Verify that the correct directory was chosen.'
                        : 'Some photos were not present in the selected folder. You can select another folder to relink the rest.'}
                    </p>
                  </div>
                </div>

                {relinkSummary.failures.length > 0 && (
                  <div className={styles.failureList}>
                    {relinkSummary.failures.map((fail, idx) => (
                      <div key={idx} className={styles.failureItem}>
                        <span className={styles.failureBullet}>•</span>
                        <span className={styles.failureText}>{fail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : relinkSummary.relinkedCount === 0 && !relinkSummary.cancelled ? (
              <div className={styles.warningCard}>
                <span className={styles.warningIcon}>ℹ️</span>
                <div className={styles.warningText}>
                  <strong>No photos were relinked.</strong>
                  <p className={styles.summarySubtext}>
                    The selected folder did not contain matching files for any missing photos.
                  </p>
                </div>
              </div>
            ) : null}

            <div className={styles.footer}>
              {missingPhotos.length > 0 ? (
                <>
                  <Button variant="secondary" onClick={closeRelink}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => relinkFolder(currentProject.id)}
                  >
                    Locate Another Folder
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={closeRelink}>
                  Done
                </Button>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: INITIAL INSPECTION */}
        {!isRelinking && !relinkSummary && (
          <>
            <div className={styles.description}>
              <p>
                The original files for <strong>{missingPhotos.length}</strong> photo(s) could not be found at their original locations.
              </p>
              <p className={styles.subtext}>
                Select the folder containing the original photos. Files are matched by name, file size, and dimensions. Ambiguous matches are left unchanged.
              </p>
            </div>

            <div className={styles.missingList}>
              {missingPhotos.map((photo) => (
                <div key={photo.id} className={styles.missingItem}>
                  <span className={styles.missingName}>⚠️ {photo.fileName}</span>
                  <span className={styles.missingPath} title={photo.filePath}>
                    {photo.filePath}
                  </span>
                </div>
              ))}
            </div>

            {error && <p className={styles.errorMessage} role="alert">{error}</p>}

            <div className={styles.footer}>
              <Button variant="secondary" onClick={closeRelink}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => relinkFolder(currentProject.id)}
              >
                Locate Folder & Relink
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
