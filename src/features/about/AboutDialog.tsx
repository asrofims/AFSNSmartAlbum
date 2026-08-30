import { useState, useEffect } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { APP_CONFIG } from '../../config/app';
import { useAppStore } from '../../stores/appStore';
import { formatPlatform, isTauri } from '../../utils/platform';
import { checkForAppUpdates, UpdateCheckResult } from '../../services/updateService';
import styles from './AboutDialog.module.css';

export function AboutDialog() {
  const isAboutOpen = useAppStore((s) => s.isAboutOpen);
  const isUpdateModalOpen = useAppStore((s) => s.isUpdateModalOpen);
  const closeAbout = useAppStore((s) => s.closeAbout);
  const closeUpdateModal = useAppStore((s) => s.closeUpdateModal);
  const appInfo = useAppStore((s) => s.appInfo);

  const [view, setView] = useState<'info' | 'updates'>('info');
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'uptodate' | 'error'>('checking');
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

  const isOpen = isAboutOpen || isUpdateModalOpen;

  const handleClose = () => {
    closeAbout();
    closeUpdateModal();
    setView('info');
  };

  const runUpdateCheck = async () => {
    setUpdateStatus('checking');
    setUpdateResult(null);
    const startTime = Date.now();
    try {
      const res = await checkForAppUpdates(appInfo.version);
      const elapsed = Date.now() - startTime;
      const minWait = 600;
      if (elapsed < minWait) {
        await new Promise((resolve) => setTimeout(resolve, minWait - elapsed));
      }
      setUpdateResult(res);
      if (res.isError) {
        setUpdateStatus('error');
      } else if (res.hasUpdate) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('uptodate');
      }
    } catch {
      setUpdateStatus('error');
    }
  };

  useEffect(() => {
    if (isUpdateModalOpen) {
      setView('updates');
      runUpdateCheck();
    } else if (isAboutOpen && view !== 'updates') {
      setView('info');
    }
  }, [isUpdateModalOpen, isAboutOpen]);

  const handleStartUpdateCheck = () => {
    setView('updates');
    runUpdateCheck();
  };

  const handleLinkClick = (url: string) => (e: React.MouseEvent) => {
    if (!url) return;
    if (isTauri()) {
      e.preventDefault();
      import('@tauri-apps/plugin-shell').then(({ open }) => open(url));
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenUrl = (url: string) => {
    if (!url) return;
    if (isTauri()) {
      import('@tauri-apps/plugin-shell').then(({ open }) => open(url));
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={view === 'updates' ? 'Software Update' : 'About AFSNSmartAlbum'}
      width={440}
    >
      {view === 'updates' ? (
        <div className={styles.updateViewContainer}>
          {/* Header Area */}
          <div className={styles.updateHeader}>
            <div
              className={`${styles.iconCircle} ${
                updateStatus === 'checking'
                  ? styles.iconChecking
                  : updateStatus === 'available'
                  ? styles.iconUpdate
                  : updateStatus === 'uptodate'
                  ? styles.iconUpToDate
                  : styles.iconError
              }`}
            >
              {updateStatus === 'checking' && '🔄'}
              {updateStatus === 'available' && '🚀'}
              {updateStatus === 'uptodate' && '✓'}
              {updateStatus === 'error' && '⚠️'}
            </div>
            <div>
              <h3 className={styles.updateTitleText}>
                {updateStatus === 'checking' && 'Checking for Updates'}
                {updateStatus === 'available' && 'Software Update Available'}
                {updateStatus === 'uptodate' && 'Your Software is Up to Date'}
                {updateStatus === 'error' && 'Could Not Check for Updates'}
              </h3>
              <p className={styles.updateSubtitleText}>
                {updateStatus === 'checking' && 'Looking for the latest software version...'}
                {updateStatus === 'available' && 'A new version of AFSNSmartAlbum is ready to download and install.'}
                {updateStatus === 'uptodate' && `AFSNSmartAlbum ${appInfo.version} is currently the newest version.`}
                {updateStatus === 'error' && 'The update service is temporarily unreachable.'}
              </p>
            </div>
          </div>

          {/* Body Section */}
          {updateStatus === 'checking' && (
            <div className={styles.statusCard}>
              <div className={styles.statusSpinner} />
              <div className={styles.statusTitle}>Checking for Updates...</div>
              <div className={styles.statusDesc}>Connecting to update service...</div>
            </div>
          )}

          {updateStatus === 'uptodate' && (
            <div className={styles.statusCard}>
              <div className={styles.statusTitle}>You're Up to Date</div>
              <div className={styles.statusDesc}>
                You have the latest version (<strong>{appInfo.version}</strong>) of AFSNSmartAlbum installed.
              </div>
            </div>
          )}

          {updateStatus === 'error' && (
            <div className={styles.statusCard}>
              <div className={styles.statusTitle} style={{ color: '#f87171' }}>
                Connection Error
              </div>
              <div className={styles.statusDesc}>
                {updateResult?.errorMessage ||
                  'Could not connect to update service. Please check your internet connection and try again.'}
              </div>
            </div>
          )}

          {updateStatus === 'available' && updateResult && (
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
                    {updateResult.latestVersion}
                  </span>
                </div>
                {updateResult.publishedAt && (
                  <span className={styles.releaseDateText}>{updateResult.publishedAt}</span>
                )}
              </div>

              {/* Release Notes */}
              <div className={styles.notesSection}>
                <span className={styles.notesHeader}>What's New in {updateResult.latestVersion}</span>
                <div className={styles.notesBox}>{updateResult.releaseNotes}</div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className={styles.updateFooter}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setView('info')}
            >
              ← Back to About
            </button>

            {updateStatus === 'checking' && (
              <button type="button" className={styles.btnSecondary} onClick={handleClose}>
                Cancel
              </button>
            )}

            {updateStatus === 'uptodate' && (
              <button type="button" className={styles.btnSecondary} onClick={handleClose}>
                Done
              </button>
            )}

            {updateStatus === 'error' && (
              <button type="button" className={styles.btnPrimary} onClick={runUpdateCheck}>
                🔄 Retry
              </button>
            )}

            {updateStatus === 'available' && updateResult && (
              <>
                {updateResult.releaseUrl && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => handleOpenUrl(updateResult.releaseUrl)}
                  >
                    🌐 What's New
                  </button>
                )}
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => handleOpenUrl(updateResult.downloadUrl)}
                >
                  📥 Install Update
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.topSection}>
            <div className={styles.appName}>AFSNSmartAlbum</div>
            <div className={styles.tagline}>Professional Photo Album Layout Software</div>
          </div>

          <div className={styles.infoGrid}>
            <span className={styles.infoLabel}>Version:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={styles.infoValue}>{appInfo.version}</span>
              <button
                type="button"
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#818cf8',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={handleStartUpdateCheck}
                title="Check for software updates"
              >
                🔄 Check Updates
              </button>
            </div>

            <span className={styles.infoLabel}>Build:</span>
            <span className={styles.infoValue}>{appInfo.buildNumber}</span>

            <span className={styles.infoLabel}>Platform:</span>
            <span className={styles.infoValue}>{formatPlatform(appInfo.platform)}</span>

            <span className={styles.infoLabel}>License:</span>
            <span className={styles.infoValue}>{APP_CONFIG.license}</span>
          </div>

          {/* Support & Contribution via QRIS */}
          <div className={styles.supportCard}>
            <div>
              <div className={styles.supportTitle}>Support Independent Development</div>
              <div className={styles.supportDesc}>Fund future features & updates via QRIS</div>
            </div>
            <button
              type="button"
              className={styles.ackLink}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--color-primary, #6366f1)',
                color: '#ffffff',
                borderRadius: 'var(--radius-sm, 4px)',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                closeAbout();
                useAppStore.getState().openSupportModal();
              }}
            >
              ☕ Donate (QRIS)
            </button>
          </div>

          <div className={styles.divider} />

          <div>
            <h4 className={styles.sectionTitle}>Credits</h4>
            <ul className={styles.creditsList}>
              {APP_CONFIG.credits.map((credit, i) => (
                <li key={i}>{credit}</li>
              ))}
            </ul>
          </div>

          <div className={styles.divider} />

          <div>
            <h4 className={styles.sectionTitle}>Open Source Acknowledgements</h4>
            <ul className={styles.ackList}>
              {APP_CONFIG.acknowledgements.map((ack, i) => (
                <li key={i}>
                  <a
                    href={ack.url}
                    className={styles.ackLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick(ack.url)}
                  >
                    {ack.name}
                  </a>{' '}
                  ({ack.license})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Dialog>
  );
}
