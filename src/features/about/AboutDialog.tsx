import { Dialog } from '../../components/ui/Dialog';
import { APP_CONFIG } from '../../config/app';
import { useAppStore } from '../../stores/appStore';
import { formatPlatform, isTauri } from '../../utils/platform';
import styles from './AboutDialog.module.css';

export function AboutDialog() {
  const isOpen = useAppStore((s) => s.isAboutOpen);
  const closeAbout = useAppStore((s) => s.closeAbout);
  const appInfo = useAppStore((s) => s.appInfo);

  const handleLinkClick = (url: string) => (e: React.MouseEvent) => {
    if (isTauri()) {
      e.preventDefault();
      import('@tauri-apps/plugin-shell').then(({ open }) => open(url));
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={closeAbout} title="About AFSNSmartAlbum" width={420}>
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
              onClick={() => {
                closeAbout();
                useAppStore.getState().openUpdateModal();
              }}
              title="Check for software updates on GitHub"
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
    </Dialog>
  );
}
