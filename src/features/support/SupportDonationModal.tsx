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
      title="Support Development"
      width={360}
      closeOnOverlayClick={true}
    >
      <div className={styles.container}>
        <div className={styles.title}>☕ Dukung Pengembangan</div>

        <div className={styles.description}>
          Pindai dengan aplikasi mobile banking atau e-wallet apa saja untuk kontribusi sukarela pengembangan AFSNSmartAlbum.
        </div>

        {/* Pure Clean QR Code — Tanpa Teks / Embel-embel */}
        <div className={styles.qrCard}>
          <QRCodeSVG
            value={QRIS_RAW_PAYLOAD}
            size={220}
            level="M"
            marginSize={0}
            fgColor="#000000"
            bgColor="#ffffff"
          />
        </div>

        <div className={styles.footer}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Jangan tampilkan lagi saat aplikasi dibuka</span>
          </label>

          <div className={styles.btnRow}>
            <Button variant="primary" onClick={handleClose} style={{ minWidth: '110px' }}>
              Tutup
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
