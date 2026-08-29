import { useEffect } from 'react';
import { WorkspaceLayout } from './features/workspace/WorkspaceLayout';
import { AboutDialog } from './features/about/AboutDialog';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { NewProjectDialog } from './features/project/NewProjectDialog';
import { useProjectStore } from './stores/projectStore';
import { isTauri } from './utils/platform';

export default function App() {
  useEffect(() => {
    if (!isTauri()) return;

    // 1. Check if app was started with a project file path (.afsn, .afsnz, .zip)
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<string | null>('get_initial_open_path')
        .then((initialPath) => {
          if (initialPath) {
            console.log('[AFSN] Initial project path from CLI:', initialPath);
            useProjectStore.getState().openProjectFromFile(initialPath);
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
          useProjectStore.getState().openProjectFromFile(event.payload);
        }
      }).then((unlisten) => {
        unlistenFn = unlisten;
      });
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  return (
    <>
      <WorkspaceLayout />
      <AboutDialog />
      <SettingsDialog />
      <NewProjectDialog />
    </>
  );
}
