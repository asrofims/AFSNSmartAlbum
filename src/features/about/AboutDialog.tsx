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

        {/* 2. Specs & Official Website Card */}
        <div className={styles.specCard}>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Developer</span>
            <span className={styles.specValue}>Asrofims · Afsunmedia</span>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Website</span>
            <a
              href={APP_CONFIG.website || 'https://app.afsun.my.id'}
              className={styles.linkValue}
              onClick={handleLinkClick(APP_CONFIG.website || 'https://app.afsun.my.id')}
              target="_blank"
              rel="noopener noreferrer"
              title="Visit official website (app.afsun.my.id)"
            >
              <span>app.afsun.my.id</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Platform</span>
            <span className={styles.specValue}>{formatPlatform(appInfo.platform)}</span>
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

        {/* 4. Footer */}
        <div className={styles.footer}>
          <span>Copyright © 2026 Afsunmedia. All rights reserved.</span>
        </div>
      </div>
    </Dialog>
  );
}
