import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import styles from './RelinkDialog.module.css';

export function RelinkDialog() {
  const isRelinkOpen = usePhotoStore((s) => s.isRelinkOpen);
  const closeRelink = usePhotoStore((s) => s.closeRelink);
  const openRelink = usePhotoStore((s) => s.openRelink);
  const relinkFolder = usePhotoStore((s) => s.relinkFolder);
  const relinkPhoto = usePhotoStore((s) => s.relinkPhoto);
  const photos = usePhotoStore((s) => s.photos);
  const targetPhotoId = usePhotoStore((s) => s.relinkTargetPhotoId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const isRelinking = usePhotoStore((s) => s.isRelinking);
  const progress = usePhotoStore((s) => s.relinkProgress);
  const summary = usePhotoStore((s) => s.relinkSummary);
  const error = usePhotoStore((s) => s.error);

  const missingPhotos = photos.filter((p) => p.isMissing);
  const isSinglePhoto = targetPhotoId !== null;
  const targetPhoto = isSinglePhoto ? photos.find((p) => p.id === targetPhotoId) : null;
  const listedPhotos = isSinglePhoto ? (targetPhoto ? [targetPhoto] : []) : missingPhotos;

  if (!isRelinkOpen || !currentProject) return null;

  return (
    <Dialog
      isOpen={isRelinkOpen}
      onClose={closeRelink}
      title={isSinglePhoto ? 'Relink Photo' : 'Relink Missing Photos'}
      width={580}
      closeOnOverlayClick={false}
    >
      <div className={styles.container}>
        <div className={styles.description}>
          <p>
            {isSinglePhoto
              ? targetPhoto ? <>Choose the source file for <strong>{targetPhoto.fileName}</strong>.</> : 'The selected photo is no longer in the library.'
              : <><strong>{missingPhotos.length}</strong> {missingPhotos.length === 1 ? 'photo is' : 'photos are'} missing from the original location.</>}
          </p>
          <p className={styles.subtext}>
            {isSinglePhoto
              ? 'Select one image file. The photo preview and any placed frames will update after relinking.'
              : 'Locate an individual file, or search a folder and its subfolders. Folder relink matches the original name, file size, and dimensions. Ambiguous matches remain unlinked.'}
          </p>
        </div>

        {listedPhotos.length > 0 && <div className={styles.missingList}>
          {listedPhotos.map((photo) => (
            <div key={photo.id} className={styles.missingItem}>
              <div className={styles.itemDetails}>
                <span className={`${styles.missingName} ${!photo.isMissing ? styles.linkedName : ''}`}>
                  {photo.isMissing ? '⚠' : '✓'} {photo.fileName}
                </span>
                <span className={styles.missingPath} title={photo.filePath}>{photo.filePath}</span>
              </div>
              <Button variant="secondary" disabled={isRelinking} onClick={() => {
                if (!isSinglePhoto) openRelink(photo.id);
                void relinkPhoto(currentProject.id, photo.id);
              }}>
                Locate File...
              </Button>
            </div>
          ))}
        </div>}

        {summary && <p className={styles.summary} role="status">{summary} {isSinglePhoto
          ? targetPhoto?.isMissing ? 'Photo is still missing.' : 'Source linked.'
          : missingPhotos.length > 0 ? `${missingPhotos.length} still missing.` : 'All photos are linked.'}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {isRelinking && (
          <div className={styles.progress} role="status" aria-live="polite">
            <div className={styles.progressLabel}>
              <span>{!progress ? 'Choose a file or folder in the system dialog...' : progress.phase === 'scanning' ? 'Scanning folder and subfolders...' : `Relinking ${progress.currentFile || 'photos'} and rebuilding previews...`}</span>
              {progress?.total ? <span>{progress.current} / {progress.total}</span> : null}
            </div>
            <div className={styles.progressTrack}>
              <div className={progress?.total ? styles.progressFill : styles.progressIndeterminate}
                style={progress?.total ? { width: `${Math.round(progress.current / progress.total * 100)}%` } : undefined} />
            </div>
          </div>
        )}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={closeRelink} disabled={isRelinking}>
            {summary ? 'Close' : 'Cancel'}
          </Button>
          {!isSinglePhoto && <Button
            variant="primary"
            disabled={isRelinking || missingPhotos.length === 0}
            onClick={() => relinkFolder(currentProject.id)}
          >
            Locate Folder...
          </Button>}
        </div>
      </div>
    </Dialog>
  );
}
