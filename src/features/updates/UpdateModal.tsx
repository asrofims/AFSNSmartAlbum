import { useEffect, useState } from 'react';
import { checkForAppUpdates, UpdateCheckResult } from '../../services/updateService';
import { useAppStore } from '../../stores/appStore';
import { isTauri } from '../../utils/platform';
import styles from './UpdateModal.module.css';

export function UpdateModal() {
  const { isUpdateModalOpen: isOpen, closeUpdateModal, appInfo } = useAppStore();
  const [status, setStatus] = useState<'checking' | 'available' | 'uptodate' | 'error'>('checking');
  const [result, setResult] = useState<UpdateCheckResult | null>(null);

  const runCheck = async () => {
    setStatus('checking');
    try {
      const res = await checkForAppUpdates(appInfo.version);
      setResult(res);
      if (res.isError) {
        setStatus('error');
      } else if (res.hasUpdate) {
        setStatus('available');
      } else {
        setStatus('uptodate');
      }
    } catch {
      setStatus('error');
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

  return (
    <div className={styles.overlay} onClick={closeUpdateModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div
              className={`${styles.iconCircle} ${
                status === 'checking'
                  ? styles.iconChecking
                  : status === 'available'
                  ? styles.iconUpdate
                  : status === 'uptodate'
                  ? styles.iconUpToDate
                  : styles.iconError
              }`}
            >
              {status === 'checking' && '🔄'}
              {status === 'available' && '🚀'}
              {status === 'uptodate' && '✓'}
              {status === 'error' && '⚠️'}
            </div>
            <div>
              <h3 className={styles.titleText}>
                {status === 'checking' && 'Checking for Updates'}
                {status === 'available' && 'Software Update Available'}
                {status === 'uptodate' && 'Your Software is Up to Date'}
                {status === 'error' && 'Could Not Check for Updates'}
              </h3>
              <p className={styles.subtitleText}>
                {status === 'checking' && 'Looking for the latest software version...'}
                {status === 'available' && `A new version of AFSNSmartAlbum is ready to download and install.`}
                {status === 'uptodate' && `AFSNSmartAlbum ${appInfo.version} is currently the newest version.`}
                {status === 'error' && 'The update service is temporarily unreachable.'}
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={closeUpdateModal} title="Close">
            ✕
          </button>
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

          {status === 'error' && (
            <div className={styles.statusCard}>
              <div className={styles.statusTitle} style={{ color: '#f87171' }}>
                Connection Error
              </div>
              <div className={styles.statusDesc}>
                {result?.errorMessage ||
                  'Could not connect to update service. Please check your internet connection and try again.'}
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

          {status === 'error' && (
            <>
              <button type="button" className={styles.btnSecondary} onClick={closeUpdateModal}>
                Close
              </button>
              <button type="button" className={styles.btnPrimary} onClick={runCheck}>
                🔄 Retry
              </button>
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
                  🌐 What's New
                </button>
              )}
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => handleOpenUrl(result.downloadUrl)}
              >
                📥 Install Update
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
