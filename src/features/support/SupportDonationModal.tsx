import { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useAppStore } from '../../stores/appStore';
import qrisImg from '../../assets/qris-donation.jpg';
import styles from './SupportDonationModal.module.css';

export function SupportDonationModal() {
  const isOpen = useAppStore((s) => s.isSupportModalOpen);
  const closeSupportModal = useAppStore((s) => s.closeSupportModal);

  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('afsn_suppress_support_popup', 'true');
      } catch {}
    }
    closeSupportModal();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Support AFSNSmartAlbum Development"
      width={460}
      closeOnOverlayClick={true}
    >
      <div className={styles.container}>
        <div className={styles.headerIcon}>☕</div>

        <div className={styles.title}>Support Independent Development</div>

        <div className={styles.description}>
          AFSNSmartAlbum is 100% offline, privacy-first software built for photographers and studios. If this tool speeds up your workflow, consider supporting ongoing development with a voluntary contribution via QRIS! 💖
        </div>

        {/* Replicated Modern QRIS Card */}
        <div className={styles.qrisCard}>
          <div className={styles.merchantName}>AFSUNMEDIA</div>
          <div className={styles.nmidText}>NMID : ID1026545399762 • A01</div>

          <div className={styles.qrImageWrapper}>
            <img
              src={qrisImg}
              alt="QRIS AFSUNMEDIA"
              className={styles.qrImage}
            />
          </div>

          <div className={styles.paymentBadges}>
            <span>QRIS • GPN</span>
          </div>
          <div className={styles.supportedText}>
            BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay
          </div>
        </div>

        <div className={styles.footer}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don't show this popup on application startup again</span>
          </label>

          <div className={styles.btnRow}>
            <Button variant="primary" onClick={handleClose} style={{ minWidth: '120px' }}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
