import { useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { WorkspaceLayout } from './features/workspace/WorkspaceLayout';
import { AboutDialog } from './features/about/AboutDialog';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { NewProjectDialog } from './features/project/NewProjectDialog';
import { SupportDonationModal } from './features/support/SupportDonationModal';
import { UpdateModal } from './features/updates/UpdateModal';
import { BackgroundUpdateIndicator } from './features/updates/BackgroundUpdateIndicator';
import { ExitWarningModal } from './features/workspace/ExitWarningModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useProjectStore } from './stores/projectStore';
import { useAlbumStore } from './stores/albumStore';
import { usePhotoStore } from './stores/photoStore';
import { useAppStore } from './stores/appStore';
import { isTauri } from './utils/platform';
import { checkForAppUpdates } from './services/updateService';

export default function App() {
  const projectError = useProjectStore((s) => s.error);
  const isSaving = useProjectStore((s) => s.isSaving);
  const automaticUpdateChecks = useAppStore((s) => s.preferences.automaticUpdateChecks);
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
    if (!automaticUpdateChecks) return;
    const timer = setTimeout(async () => {
      try {
        const { appInfo, setUpdateAvailableVersion, setUpdateCheckResult, setUpdateStatus, setUpdateError } = useAppStore.getState();
        setUpdateStatus('checking');
        setUpdateError(null);
        const res = await checkForAppUpdates(appInfo.version);
        setUpdateCheckResult(res);
        if (res?.isError) {
          setUpdateStatus('error');
          setUpdateError(res.errorMessage || 'Unable to contact update server.');
        } else if (res && res.hasUpdate && res.latestVersion) {
          console.log('[Updater] Background check detected new version:', res.latestVersion);
          setUpdateAvailableVersion(res.latestVersion);
          setUpdateStatus('available');
        } else {
          setUpdateAvailableVersion(null);
          setUpdateStatus('uptodate');
        }
      } catch (err) {
        // Silently swallow errors during background check so offline/network issues never interrupt app
        console.warn('[Updater] Background check skipped gracefully:', err);
        useAppStore.getState().setUpdateStatus('error');
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [automaticUpdateChecks]);

  useEffect(() => {
    if (!isTauri()) return;

    // 1. A file association takes priority; otherwise honor the startup preference.
    let initialLaunchCancelled = false;
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<string | null>('get_initial_open_path')
        .then(async (initialPath) => {
          if (initialLaunchCancelled) return;
          if (initialPath) {
            console.log('[AFSN] Initial project path from CLI:', initialPath);
            requestOpenFile(initialPath);
            return;
          }

          if (useAppStore.getState().preferences.startupBehavior === 'reopen_last') {
            await useProjectStore.getState().loadRecentProjects();
            if (initialLaunchCancelled || useProjectStore.getState().currentProject) return;
            const recentProject = useProjectStore.getState().recentProjects[0];
            if (recentProject) await useProjectStore.getState().openProjectById(recentProject.id);
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
        const isUnsaved = Boolean(project && (saveStatus !== 'saved' || useProjectStore.getState().isSaving || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking));
        invoke('set_unsaved_status', { unsaved: isUnsaved }).catch(() => {});
      });
    };

    syncUnsavedStatus();
    const unsubAlbum = useAlbumStore.subscribe(syncUnsavedStatus);
    const unsubProject = useProjectStore.subscribe(syncUnsavedStatus);
    const unsubPhotos = usePhotoStore.subscribe((state, previous) => {
      if (state.isRemoving !== previous.isRemoving || state.isRelinking !== previous.isRelinking) syncUnsavedStatus();
    });

    return () => {
      initialLaunchCancelled = true;
      if (unlistenFn) unlistenFn();
      if (unlistenCloseWarning) unlistenCloseWarning();
      unsubAlbum();
      unsubProject();
      unsubPhotos();
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
      <BackgroundUpdateIndicator />
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
