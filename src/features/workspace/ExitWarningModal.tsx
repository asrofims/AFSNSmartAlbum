import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../stores/appStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { isTauri } from '../../utils/platform';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { usePhotoStore } from '../../stores/photoStore';

export function ExitWarningModal() {
  const { isExitWarningOpen, closeExitWarning } = useAppStore();
  const [isClosing, setIsClosing] = useState(false);
  const isSaving = useProjectStore((s) => s.isSaving);
  const isPhotoBusy = usePhotoStore((s) => s.isRemoving || s.isRelinking);

  const handleForceExit = async () => {
    if (isClosing || useProjectStore.getState().isSaving || isPhotoBusy) return;
    setIsClosing(true);
    closeExitWarning();

    if (isTauri()) {
      try {
        await invoke('exit_app');
      } catch (err) {
        console.error('Failed to exit via invoke exit_app:', err);
        // Fallback to window destroy if command fails
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().destroy();
        } catch {
          window.close();
        }
      }
    } else {
      window.close();
    }
  };

  if (!isExitWarningOpen) return null;

  return (
    <ConfirmDialog
      isOpen={isExitWarningOpen}
      title="Unsaved Changes"
      message="Save your changes before exiting?"
      onConfirm={async () => {
        const result = await useProjectStore.getState().saveProject();
        if (result.success && useAlbumStore.getState().saveStatus === 'saved') await handleForceExit();
      }}
      onSecondary={handleForceExit}
      secondaryText="Exit Without Saving"
      isLoading={isSaving || isClosing || isPhotoBusy}
      loadingText={isPhotoBusy ? 'Finishing photo operation...' : 'Processing...'}
      onCancel={() => {
        setIsClosing(false);
        closeExitWarning();
      }}
      confirmText="Save & Exit"
      cancelText="Cancel"
    />
  );
}
