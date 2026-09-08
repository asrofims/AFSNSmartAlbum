import { useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { WorkspaceLayout } from './features/workspace/WorkspaceLayout';
import { AboutDialog } from './features/about/AboutDialog';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { NewProjectDialog } from './features/project/NewProjectDialog';
import { SupportDonationModal } from './features/support/SupportDonationModal';
import { UpdateModal } from './features/updates/UpdateModal';
import { ExitWarningModal } from './features/workspace/ExitWarningModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useProjectStore } from './stores/projectStore';
import { useAlbumStore } from './stores/albumStore';
import { useAppStore } from './stores/appStore';
import { isTauri } from './utils/platform';
import { checkForAppUpdates } from './services/updateService';

export default function App() {
  const projectError = useProjectStore((s) => s.error);
  const isSaving = useProjectStore((s) => s.isSaving);
  const [pendingOpenPath, setPendingOpenPath] = useState<string | null>(null);
  const requestOpenFile = (path: string) => {
    if (useProjectStore.getState().isSaving) {
      useProjectStore.setState({ error: 'Wait for the current save to finish before opening another project.' });
    } else if (useProjectStore.getState().currentProject && useAlbumStore.getState().saveStatus !== 'saved') {
      setPendingOpenPath(path);
    } else {
      void useProjectStore.getState().openProjectFromFile(path);
    }
  };
  // Catch any unhandled window errors and store them for diagnostics
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('[AFSN Window Error]', event.error || event.message);
      try {
        localStorage.setItem(
          'afsn_last_window_error',
          JSON.stringify({
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            time: new Date().toISOString(),
          })
        );
      } catch {}
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[AFSN Unhandled Rejection]', event.reason);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Disable default browser context menu globally for a native desktop application experience.
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Trigger QRIS support popup on initial app launch session
  useEffect(() => {
    try {
      localStorage.removeItem('afsn_suppress_support_popup');
    } catch {}
    const timer = setTimeout(() => {
      useAppStore.getState().openSupportModal();
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  // Silent non-blocking background update check (after 4s startup delay)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const { appInfo, setUpdateAvailableVersion } = useAppStore.getState();
        const res = await checkForAppUpdates(appInfo.version);
        if (res && res.hasUpdate && res.latestVersion) {
          console.log('[Updater] Background check detected new version:', res.latestVersion);
          setUpdateAvailableVersion(res.latestVersion);
        }
      } catch (err) {
        // Silently swallow errors during background check so offline/network issues never interrupt app
        console.warn('[Updater] Background check skipped gracefully:', err);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    // 1. Check if app was started with a project file path (.afsn).
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<string | null>('get_initial_open_path')
        .then((initialPath) => {
          if (initialPath) {
            console.log('[AFSN] Initial project path from CLI:', initialPath);
            requestOpenFile(initialPath);
          }
        })
        .catch((err) => {
          console.warn('[AFSN] get_initial_open_path error:', err);
        });
    });

    // 2. Listen for single-instance triggers when files are opened while app is running
    let unlistenFn: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string>('open-project-file', (event) => {
        if (event.payload) {
          console.log('[AFSN] Received open-project-file event:', event.payload);
          requestOpenFile(event.payload);
        }
      }).then((unlisten) => {
        unlistenFn = unlisten;
      });
    });

    // 3. Listen for window close warning requests emitted by Rust when project is unsaved
    let unlistenCloseWarning: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('request-close-warning', () => {
        useAppStore.getState().openExitWarning();
      }).then((unlisten) => {
        unlistenCloseWarning = unlisten;
      });
    });

    // 4. Continuously synchronize unsaved status with native Rust backend
    const syncUnsavedStatus = () => {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        const project = useProjectStore.getState().currentProject;
        const saveStatus = useAlbumStore.getState().saveStatus;
        const isUnsaved = Boolean(project && (saveStatus !== 'saved' || useProjectStore.getState().isSaving));
        invoke('set_unsaved_status', { unsaved: isUnsaved }).catch(() => {});
      });
    };

    syncUnsavedStatus();
    const unsubAlbum = useAlbumStore.subscribe(syncUnsavedStatus);
    const unsubProject = useProjectStore.subscribe(syncUnsavedStatus);

    return () => {
      if (unlistenFn) unlistenFn();
      if (unlistenCloseWarning) unlistenCloseWarning();
      unsubAlbum();
      unsubProject();
    };
  }, []);

  return (
    <ErrorBoundary>
      <WorkspaceLayout />
      <AboutDialog />
      <SettingsDialog />
      <NewProjectDialog />
      <SupportDonationModal />
      <UpdateModal />
      <ExitWarningModal />
      <ConfirmDialog isOpen={pendingOpenPath !== null} title="Unsaved Changes"
        message="Save your changes before opening another project?" variant="warning"
        confirmText="Save & Open" secondaryText="Don't Save" cancelText="Cancel" isLoading={isSaving}
        onConfirm={async () => {
          const result = await useProjectStore.getState().saveProject();
          if (result.success && useAlbumStore.getState().saveStatus === 'saved' && pendingOpenPath) {
            const path = pendingOpenPath;
            setPendingOpenPath(null);
            await useProjectStore.getState().openProjectFromFile(path);
          }
        }}
        onSecondary={async () => {
          if (pendingOpenPath && !isSaving) {
            const path = pendingOpenPath;
            setPendingOpenPath(null);
            await useProjectStore.getState().openProjectFromFile(path);
          }
        }} onCancel={() => { if (!isSaving) setPendingOpenPath(null); }} />
      <ConfirmDialog isOpen={Boolean(projectError)} title="Project Operation" message={projectError || ''}
        variant="warning" confirmText="OK" onConfirm={() => useProjectStore.setState({ error: null })}
        onCancel={() => useProjectStore.setState({ error: null })} />
    </ErrorBoundary>
  );
}
