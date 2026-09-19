import { useAppStore } from '../../stores/appStore';
import { formatBytes, restartApp } from '../../services/updateService';
import styles from './BackgroundUpdateIndicator.module.css';

export function BackgroundUpdateIndicator() {
  const updateStatus = useAppStore((s) => s.updateStatus);
  const updateProgress = useAppStore((s) => s.updateProgress);
  const isUpdateModalOpen = useAppStore((s) => s.isUpdateModalOpen);
  const isBackgroundNoticeDismissed = useAppStore((s) => s.isBackgroundNoticeDismissed);
  const updateAvailableVersion = useAppStore((s) => s.updateAvailableVersion);
  const updateError = useAppStore((s) => s.updateError);
  const openUpdateModal = useAppStore((s) => s.openUpdateModal);
  const dismissBackgroundNotice = useAppStore((s) => s.dismissBackgroundNotice);

  // If the full modal is currently open, don't show the background toast
  if (isUpdateModalOpen) return null;

  // If the user dismissed the floating notice, keep it hidden (still visible in header toolbar)
  if (isBackgroundNoticeDismissed) return null;

  // Only render when downloading, ready, or on error
  if (updateStatus !== 'downloading' && updateStatus !== 'ready' && updateStatus !== 'error') {
    return null;
  }

  const { percent, downloadedBytes, totalBytes } = updateProgress;

  const handleRestart = async () => {
    try {
      await restartApp();
    } catch (err) {
      console.error('[Updater] Failed to restart application:', err);
    }
  };

  return (
    <aside
      className={`${styles.card} ${
        updateStatus === 'ready'
          ? styles.cardSuccess
          : updateStatus === 'error'
          ? styles.cardError
          : ''
      }`}
      aria-label="Software Update Notification"
      role="status"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div
            className={`${styles.iconBadge} ${
              updateStatus === 'ready'
                ? styles.iconBadgeSuccess
                : updateStatus === 'error'
                ? styles.iconBadgeError
                : ''
            }`}
          >
            {updateStatus === 'downloading' && <span className={styles.pulseIcon}>⏳</span>}
            {updateStatus === 'ready' && <span>🎉</span>}
            {updateStatus === 'error' && <span>⚠️</span>}
          </div>
          <div className={styles.titleArea}>
            <div className={styles.title}>
              {updateStatus === 'downloading' && 'Downloading Update'}
              {updateStatus === 'ready' && 'Update Ready to Install'}
              {updateStatus === 'error' && 'Update Download Failed'}
            </div>
            <div className={styles.subtitle}>
              {updateStatus === 'downloading' &&
                (updateAvailableVersion
                  ? `AFSNSmartAlbum v${updateAvailableVersion}`
                  : 'Downloading package in background...')}
              {updateStatus === 'ready' &&
                (updateAvailableVersion
                  ? `v${updateAvailableVersion} verified and ready`
                  : 'Restart application to finish')}
              {updateStatus === 'error' &&
                (updateError || 'Could not complete auto-update')}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.closeBtn}
          onClick={dismissBackgroundNotice}
          title="Minimize notification (accessible in top toolbar)"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>

      {/* Progress Bar (Visible during downloading and ready states) */}
      {updateStatus === 'downloading' && (
        <>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressBar} ${
                totalBytes === 0 ? styles.progressIndeterminate : ''
              }`}
              style={{ width: totalBytes > 0 ? `${percent}%` : '100%' }}
            />
          </div>

          <div className={styles.metaRow}>
            <span className={styles.percentText}>
              {totalBytes > 0 ? `${percent}%` : 'Downloading...'}
            </span>
            <span>
              {totalBytes > 0
                ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
                : formatBytes(downloadedBytes)}
            </span>
          </div>
        </>
      )}

      {updateStatus === 'ready' && (
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressBar} ${styles.progressBarSuccess}`}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {updateStatus === 'downloading' && (
          <button
            type="button"
            className={styles.btnActionSecondary}
            onClick={openUpdateModal}
          >
            View Details
          </button>
        )}

        {updateStatus === 'ready' && (
          <>
            <button
              type="button"
              className={styles.btnActionSecondary}
              onClick={dismissBackgroundNotice}
            >
              Later
            </button>
            <button
              type="button"
              className={styles.btnActionSuccess}
              onClick={handleRestart}
            >
              Restart Now
            </button>
          </>
        )}

        {updateStatus === 'error' && (
          <>
            <button
              type="button"
              className={styles.btnActionSecondary}
              onClick={dismissBackgroundNotice}
            >
              Dismiss
            </button>
            <button
              type="button"
              className={styles.btnActionPrimary}
              onClick={openUpdateModal}
            >
              Details
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
