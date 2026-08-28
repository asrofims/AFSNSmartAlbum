import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

export function useTauriInfo(): void {
  const setAppInfo = useAppStore((s) => s.setAppInfo);
  const isLoaded = useAppStore((s) => s.isAppInfoLoaded);

  useEffect(() => {
    if (isLoaded) return;

    async function loadInfo() {
      try {
        // Dynamic import to handle non-Tauri environments (e.g., browser dev)
        const { getVersion } = await import('@tauri-apps/api/app');
        const { platform } = await import('@tauri-apps/plugin-os');
        
        const version = await getVersion();
        const platformName = platform();
        
        setAppInfo({
          version,
          buildNumber: '1',
          platform: platformName,
        });
      } catch {
        // Fallback for browser development
        setAppInfo({
          version: '0.1.0-dev',
          buildNumber: 'dev',
          platform: 'browser',
        });
      }
    }

    loadInfo();
  }, [isLoaded, setAppInfo]);
}
