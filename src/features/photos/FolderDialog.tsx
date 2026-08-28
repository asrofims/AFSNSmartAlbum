import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import styles from './FolderDialog.module.css';

export function FolderDialog() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    isFolderDialogOpen,
    folderDialogMode,
    folderDialogTarget,
    createFolder,
    renameFolder,
    closeFolderDialog,
  } = usePhotoStore();

  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isFolderDialogOpen) {
      if (folderDialogMode === 'rename' && folderDialogTarget) {
        setFolderName(folderDialogTarget.name);
      } else {
        setFolderName('');
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isFolderDialogOpen, folderDialogMode, folderDialogTarget]);

  if (!isFolderDialogOpen || !currentProject) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = folderName.trim();
    if (!trimmed) {
      setError('Folder name cannot be empty');
      return;
    }

    setIsSubmitting(true);
    try {
      if (folderDialogMode === 'create') {
        await createFolder(currentProject.id, trimmed);
      } else if (folderDialogMode === 'rename' && folderDialogTarget) {
        await renameFolder(currentProject.id, folderDialogTarget.id, trimmed);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = folderDialogMode === 'create' ? 'Create New Folder / Collection' : 'Rename Folder';

  return (
    <Dialog
      isOpen={isFolderDialogOpen}
      onClose={closeFolderDialog}
      title={title}
      width={420}
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          Folder Name
          <input
            type="text"
            className={styles.input}
            placeholder="e.g. Akad Nikah, Resepsi, Prewedding, Family"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            autoFocus
          />
        </label>
        {error && <span className={styles.errorText}>{error}</span>}

        <div className={styles.footerBtns}>
          <Button type="button" variant="ghost" onClick={closeFolderDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !folderName.trim()}>
            {isSubmitting
              ? 'Saving...'
              : folderDialogMode === 'create'
              ? 'Create Folder'
              : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
