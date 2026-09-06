import { useEffect, useState } from 'react';
import {
  checkForAppUpdates,
  downloadAndInstallAutoUpdate,
  restartApp,
  UpdateCheckResult,
} from '../../services/updateService';
import { useAppStore } from '../../stores/appStore';
import { isTauri } from '../../utils/platform';
import styles from './UpdateModal.module.css';

type UpdateStatus = 'checking' | 'available' | 'downloading' | 'ready' | 'uptodate' | 'error';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function UpdateModal() {
  const { isUpdateModalOpen: isOpen, closeUpdateModal, appInfo, setUpdateAvailableVersion } = useAppStore();
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const runCheck = async () => {
    setStatus('checking');
    setErrorDetails(null);
    try {
      const res = await checkForAppUpdates(appInfo.version);
      setResult(res);
      if (res.isError) {
        setStatus('error');
        setErrorDetails(res.errorMessage || 'Unable to contact update server.');
      } else if (res.hasUpdate) {
        setStatus('available');
        setUpdateAvailableVersion(res.latestVersion);
      } else {
        setStatus('uptodate');
        setUpdateAvailableVersion(null);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorDetails(err?.message || 'Unexpected error while checking for updates.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      runCheck();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenUrl = (url: string) => {
    if (!url) return;
    if (isTauri()) {
      import('@tauri-apps/plugin-shell').then(({ open }) => open(url));
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleStartAutoUpdate = async () => {
    setStatus('downloading');
    setDownloadedBytes(0);
    setTotalBytes(0);
    setErrorDetails(null);

    try {
      await downloadAndInstallAutoUpdate((downloaded, total) => {
        setDownloadedBytes(downloaded);
        if (total > 0) {
          setTotalBytes(total);
        }
      });
      setStatus('ready');
    } catch (err: any) {
      console.error('[Updater] Download & install failed:', err);
      setStatus('error');
      setErrorDetails(
        err?.message ||
          'Failed to download or verify the update signature. You can download the installer manually.'
      );
    }
  };

  const handleRestart = async () => {
    try {
      await restartApp();
    } catch (err: any) {
      console.error('[Updater] Failed to restart application:', err);
    }
  };

  const percent =
    totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;

  return (
    <div className={styles.overlay} onClick={status === 'downloading' ? undefined : closeUpdateModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div
              className={`${styles.iconCircle} ${
                status === 'checking'
                  ? styles.iconChecking
                  : status === 'available' || status === 'downloading'
                  ? styles.iconUpdate
                  : status === 'uptodate' || status === 'ready'
                  ? styles.iconUpToDate
                  : styles.iconError
              }`}
            >
              {status === 'checking' && '🔄'}
              {status === 'available' && '🚀'}
              {status === 'downloading' && '⏳'}
              {status === 'ready' && '🎉'}
              {status === 'uptodate' && '✓'}
              {status === 'error' && '⚠️'}
            </div>
            <div>
              <h3 className={styles.titleText}>
                {status === 'checking' && 'Checking for Updates'}
                {status === 'available' && 'Software Update Available'}
                {status === 'downloading' && 'Downloading Update'}
                {status === 'ready' && 'Update Ready to Install'}
                {status === 'uptodate' && 'Your Software is Up to Date'}
                {status === 'error' && 'Update Failed or Unavailable'}
              </h3>
              <p className={styles.subtitleText}>
                {status === 'checking' && 'Looking for the latest software version...'}
                {status === 'available' &&
                  `A new version of AFSNSmartAlbum is ready to install.`}
                {status === 'downloading' &&
                  'Downloading and verifying signed update package...'}
                {status === 'ready' &&
                  'The update is installed. Restart AFSNSmartAlbum to apply changes.'}
                {status === 'uptodate' &&
                  `AFSNSmartAlbum ${appInfo.version} is currently the newest version.`}
                {status === 'error' && 'Unable to complete the update automatically.'}
              </p>
            </div>
          </div>
          {status !== 'downloading' && (
            <button
              type="button"
              className={styles.closeBtn}
              onClick={closeUpdateModal}
              title="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {status === 'checking' && (
            <div className={styles.statusCard}>
              <div className={styles.statusSpinner} />
              <div className={styles.statusTitle}>Checking for Updates...</div>
              <div className={styles.statusDesc}>
                Connecting to update service...
              </div>
            </div>
          )}

          {status === 'uptodate' && (
            <div className={styles.statusCard}>
              <div className={styles.statusTitle}>You're Up to Date</div>
              <div className={styles.statusDesc}>
                You have the latest version (<strong>{appInfo.version}</strong>) of AFSNSmartAlbum installed.
              </div>
            </div>
          )}

          {status === 'downloading' && (
            <div className={styles.statusCard}>
              <div className={styles.statusTitle}>
                {totalBytes > 0 ? `Downloading... ${percent}%` : 'Downloading update...'}
              </div>
              <div className={styles.statusDesc}>
                Please keep AFSNSmartAlbum open while the update downloads.
              </div>

              <div className={styles.progressContainer}>
                <div className={styles.progressInfoRow}>
                  <span>Progress</span>
                  <span>
                    {totalBytes > 0
                      ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} (${percent}%)`
                      : formatBytes(downloadedBytes)}
                  </span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressBar} ${
                      totalBytes === 0 ? styles.progressIndeterminate : ''
                    }`}
                    style={{ width: totalBytes > 0 ? `${percent}%` : '100%' }}
                  />
                </div>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <div className={styles.statusCard}>
              <div className={styles.statusTitle} style={{ color: '#34d399' }}>
                ✓ Update Installed Successfully
              </div>
              <div className={styles.statusDesc}>
                AFSNSmartAlbum has downloaded and verified the update. Click <strong>Restart Now</strong> to launch the new version.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.statusCard}>
              <div className={styles.statusTitle} style={{ color: '#f87171' }}>
                Update Error
              </div>
              <div className={styles.statusDesc}>
                {errorDetails ||
                  result?.errorMessage ||
                  'Could not complete the auto-update. You can download the latest installer manually.'}
              </div>
            </div>
          )}

          {status === 'available' && result && (
            <>
              {/* Version Comparison */}
              <div className={styles.versionPillRow}>
                <div className={styles.versionTag}>
                  <span className={styles.versionLabel}>Installed</span>
                  <span className={styles.versionValue}>{appInfo.version}</span>
                </div>
                <div className={styles.versionArrow}>➔</div>
                <div className={styles.versionTag}>
                  <span className={styles.versionLabel}>Latest</span>
                  <span className={`${styles.versionValue} ${styles.newVersionBadge}`}>
                    {result.latestVersion}
                  </span>
                </div>
                {result.publishedAt && (
                  <span className={styles.releaseDateText}>{result.publishedAt}</span>
                )}
              </div>

              {/* Release Notes */}
              <div className={styles.notesSection}>
                <span className={styles.notesHeader}>What's New in {result.latestVersion}</span>
                <div className={styles.notesBox}>{result.releaseNotes}</div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          {status === 'checking' && (
            <button type="button" className={styles.btnSecondary} onClick={closeUpdateModal}>
              Cancel
            </button>
          )}

          {status === 'uptodate' && (
            <button type="button" className={styles.btnSecondary} onClick={closeUpdateModal}>
              Done
            </button>
          )}

          {status === 'downloading' && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={closeUpdateModal}
              title="Continue download in background"
            >
              Background
            </button>
          )}

          {status === 'ready' && (
            <>
              <button type="button" className={styles.btnSecondary} onClick={closeUpdateModal}>
                Later
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleRestart}
              >
                🔄 Restart Now
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <button type="button" className={styles.btnSecondary} onClick={closeUpdateModal}>
                Close
              </button>
              <button type="button" className={styles.btnSecondary} onClick={runCheck}>
                🔄 Retry
              </button>
              {result?.downloadUrl && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => handleOpenUrl(result.downloadUrl)}
                  title="Download the .exe installer manually from GitHub"
                >
                  📥 Manual Download
                </button>
              )}
            </>
          )}

          {status === 'available' && result && (
            <>
              <button type="button" className={styles.btnSecondary} onClick={closeUpdateModal}>
                Later
              </button>
              {result.releaseUrl && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => handleOpenUrl(result.releaseUrl)}
                >
                  🌐 Release Notes
                </button>
              )}
              {/* Permanent Fallback: Manual Download Button */}
              {result.downloadUrl && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => handleOpenUrl(result.downloadUrl)}
                  title="Download installer directly in browser"
                >
                  📥 Manual Download
                </button>
              )}
              {/* Primary: Auto-Update Button */}
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={
                  result.isAutoUpdateSupported
                    ? handleStartAutoUpdate
                    : () => handleOpenUrl(result.downloadUrl)
                }
              >
                {result.isAutoUpdateSupported ? '⚡ Update Now' : '📥 Install Update'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
