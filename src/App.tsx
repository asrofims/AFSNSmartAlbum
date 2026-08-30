import { useEffect } from 'react';
import { WorkspaceLayout } from './features/workspace/WorkspaceLayout';
import { AboutDialog } from './features/about/AboutDialog';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { NewProjectDialog } from './features/project/NewProjectDialog';
import { SupportDonationModal } from './features/support/SupportDonationModal';
import { useProjectStore } from './stores/projectStore';
import { useAppStore } from './stores/appStore';
import { isTauri } from './utils/platform';

export default function App() {
  // Disable default browser context menu globally for a native desktop application experience,
  // allowing only standard editable input/textarea fields or custom app context menus.
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (!isInput) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Trigger QRIS support popup on initial app launch session (non-intrusive)
  useEffect(() => {
    try {
      const isSuppressed = localStorage.getItem('afsn_suppress_support_popup') === 'true';
      const isShownSession = sessionStorage.getItem('afsn_shown_support_session') === 'true';
      if (!isSuppressed && !isShownSession) {
        sessionStorage.setItem('afsn_shown_support_session', 'true');
        const timer = setTimeout(() => {
          useAppStore.getState().openSupportModal();
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

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
      <SupportDonationModal />
    </>
  );
}
