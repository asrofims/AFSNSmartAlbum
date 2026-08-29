import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import styles from './RelinkDialog.module.css';

export function RelinkDialog() {
  const isRelinkOpen = usePhotoStore((s) => s.isRelinkOpen);
  const closeRelink = usePhotoStore((s) => s.closeRelink);
  const relinkFolder = usePhotoStore((s) => s.relinkFolder);
  const photos = usePhotoStore((s) => s.photos);
  const currentProject = useProjectStore((s) => s.currentProject);

  const missingPhotos = photos.filter((p) => p.isMissing);

  if (!isRelinkOpen || !currentProject) return null;

  return (
    <Dialog
      isOpen={isRelinkOpen}
      onClose={closeRelink}
      title="Relink Missing Photos"
      width={520}
      closeOnOverlayClick={false}
    >
      <div className={styles.container}>
        <div className={styles.description}>
          <p>
            The original files for <strong>{missingPhotos.length}</strong> photo(s) could not be found at their original locations.
          </p>
          <p className={styles.subtext}>
            Please select the folder where these photos are now located. AFSNSmartAlbum will automatically reconnect matching files by filename and rebuild their thumbnails.
          </p>
        </div>

        <div className={styles.missingList}>
          {missingPhotos.map((photo) => (
            <div key={photo.id} className={styles.missingItem}>
              <span className={styles.missingName}>⚠️ {photo.fileName}</span>
              <span className={styles.missingPath} title={photo.filePath}>
                {photo.filePath}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={closeRelink}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => relinkFolder(currentProject.id)}
          >
            Locate Folder & Relink
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
