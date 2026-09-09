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
  const isRelinking = usePhotoStore((s) => s.isRelinking);
  const error = usePhotoStore((s) => s.error);

  const missingPhotos = photos.filter((p) => p.isMissing);

  if (!isRelinkOpen || !currentProject) return null;

  return (
    <Dialog
      isOpen={isRelinkOpen}
      onClose={() => { if (!isRelinking) closeRelink(); }}
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
            Select the folder containing the original photos. Files are matched by name, file size, and dimensions. Ambiguous matches are left unchanged.
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

        {error && <p role="alert" style={{ whiteSpace: 'pre-wrap' }}>{error}</p>}
        {isRelinking && <p role="status">Relinking photos and rebuilding previews...</p>}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={closeRelink} disabled={isRelinking}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={isRelinking}
            onClick={() => relinkFolder(currentProject.id)}
          >
            Locate Folder & Relink
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
