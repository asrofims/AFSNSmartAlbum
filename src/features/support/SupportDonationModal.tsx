import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useAppStore } from '../../stores/appStore';
import styles from './SupportDonationModal.module.css';

const QRIS_RAW_PAYLOAD =
  '00020101021126580013ID.CO.BRI.WWW01189360000200702075320208702075320303UMI51440014ID.CO.QRIS.WWW0215ID10265453997620303UMI5204722153033605802ID5910AFSUNMEDIA6011TULUNGAGUNG61056628162070703A016304BB0D';

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
          AFSNSmartAlbum is 100% offline, privacy-first software built for photographers. Your voluntary contribution helps keep updates, performance features, and new album templates coming! 💖
        </div>

        {/* Reconstructed Clean Vector QRIS Card */}
        <div className={styles.qrisCard}>
          <div className={styles.qrisTopBar}>
            <div>
              <div className={styles.qrisLogoText}>QRIS</div>
              <div className={styles.qrisSubLogo}>QR Code Standar Pembayaran Nasional</div>
            </div>
            <div className={styles.gpnLogoBadge}>
              <span>🇲🇨 GPN</span>
            </div>
          </div>

          <div className={styles.merchantInfo}>
            <div className={styles.merchantName}>AFSUNMEDIA</div>
            <div className={styles.nmidText}>NMID : ID1026545399762</div>
            <div className={styles.tagA01}>A01</div>
          </div>

          <div className={styles.qrVectorWrapper}>
            <QRCodeSVG
              value={QRIS_RAW_PAYLOAD}
              size={210}
              level="M"
              marginSize={1}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>

          <div className={styles.qrisBottomTag}>SATU QRIS UNTUK SEMUA</div>
          <div className={styles.paymentList}>
            BCA • Mandiri • BRI • BNI • GoPay • OVO • DANA • ShopeePay
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
