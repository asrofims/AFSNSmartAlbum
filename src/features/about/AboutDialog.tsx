import React from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { APP_CONFIG } from '../../config/app';
import { useAppStore } from '../../stores/appStore';
import { formatPlatform, isTauri } from '../../utils/platform';
import appLogo from '../../assets/app-logo.png';
import styles from './AboutDialog.module.css';

export function AboutDialog() {
  const isAboutOpen = useAppStore((s) => s.isAboutOpen);
  const closeAbout = useAppStore((s) => s.closeAbout);
  const openUpdateModal = useAppStore((s) => s.openUpdateModal);
  const openSupportModal = useAppStore((s) => s.openSupportModal);
  const appInfo = useAppStore((s) => s.appInfo);

  const handleStartUpdateCheck = () => {
    openUpdateModal();
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

  return (
    <Dialog
      isOpen={isAboutOpen}
      onClose={closeAbout}
      title="About AFSNSmartAlbum"
      width={480}
      noPadding
    >
      <div className={styles.container}>
        {/* 1. Hero Section with App Logo */}
        <div className={styles.heroSection}>
          <div className={styles.logoWrapper}>
            <img src={appLogo} alt="AFSNSmartAlbum Logo" className={styles.logoImg} />
          </div>

          <div className={styles.brandText}>
            <h2 className={styles.appName}>AFSNSmartAlbum</h2>
            <p className={styles.tagline}>
              Professional Offline Desktop Photo Album Layout Application
            </p>
          </div>

          <div className={styles.versionRow}>
            <span className={styles.versionBadge}>{appInfo.version}</span>
            <button
              type="button"
              className={styles.updateBtn}
              onClick={handleStartUpdateCheck}
              title="Check for software updates"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Check Updates</span>
            </button>
          </div>
        </div>

        {/* 2. Technical Specs & Environment Card */}
        <div className={styles.specCard}>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Developer</span>
            <span className={styles.specValue}>Asrofims · Afsunmedia</span>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Platform</span>
            <span className={styles.specValue}>{formatPlatform(appInfo.platform)}</span>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Core Engine</span>
            <span className={styles.specValue}>Tauri 2 · Rust · SQLite WAL · libvips</span>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>License</span>
            <span className={styles.specValue}>{APP_CONFIG.license}</span>
          </div>
        </div>

        {/* 3. Support Independent Development (QRIS) */}
        <div className={styles.supportCard}>
          <div className={styles.supportInfo}>
            <div className={styles.supportTitle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              <span>Support Development</span>
            </div>
            <div className={styles.supportDesc}>
              Fund future layout templates, algorithms & updates via QRIS
            </div>
          </div>
          <button
            type="button"
            className={styles.donateBtn}
            onClick={() => {
              closeAbout();
              openSupportModal();
            }}
          >
            <span>☕ Donate (QRIS)</span>
          </button>
        </div>

        {/* 4. Open Source Foundations */}
        <div className={styles.ackSection}>
          <div className={styles.ackHeader}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Open Source Technologies</span>
          </div>
          <div className={styles.ackChips}>
            {APP_CONFIG.acknowledgements.map((ack, i) => (
              <a
                key={i}
                href={ack.url}
                className={styles.ackChip}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick(ack.url)}
                title={`Open ${ack.name} website (${ack.license})`}
              >
                <span>{ack.name}</span>
                <span className={styles.ackLicense}>{ack.license}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
