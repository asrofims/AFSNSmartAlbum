import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../stores/appStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { isTauri } from '../../utils/platform';

export function ExitWarningModal() {
  const { isExitWarningOpen, closeExitWarning } = useAppStore();
  const [isClosing, setIsClosing] = useState(false);

  const handleForceExit = async () => {
    if (isClosing) return;
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
      message="You have unsaved changes in your current project. Are you sure you want to exit without saving? All unsaved work will be lost."
      onConfirm={handleForceExit}
      onCancel={() => {
        setIsClosing(false);
        closeExitWarning();
      }}
      confirmText="Exit Without Saving"
      cancelText="Cancel"
    />
  );
}
