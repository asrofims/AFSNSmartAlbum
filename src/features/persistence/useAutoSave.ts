import { useEffect, useRef } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';

const SNAPSHOT_STORAGE_KEY_PREFIX = 'afsn_snapshot_';

export function useAutoSave() {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const saveStatus = useAlbumStore((s) => s.saveStatus);
  const saveAlbumToDb = useAlbumStore((s) => s.saveAlbumToDb);
  const currentProject = useProjectStore((s) => s.currentProject);

  const debounceTimerRef = useRef<number | null>(null);

  // 1. Local Storage Crash Snapshot Recovery Protection
  useEffect(() => {
    if (!currentAlbum || !currentProject) return;

    try {
      const snapshotKey = `${SNAPSHOT_STORAGE_KEY_PREFIX}${currentProject.id}`;
      localStorage.setItem(
        snapshotKey,
        JSON.stringify({
          projectId: currentProject.id,
          savedAt: new Date().toISOString(),
          album: currentAlbum,
        })
      );
    } catch {
      // Ignore localStorage errors (e.g. quota limit)
    }
  }, [currentAlbum, currentProject]);

  // 2. Debounced Auto-Save to SQLite Database (8s delay after user stops editing)
  useEffect(() => {
    if (saveStatus !== 'unsaved' || !currentAlbum) return;

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      await saveAlbumToDb();
      if (currentProject?.filePath) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('export_afsn_package', {
            projectId: currentProject.id,
            targetPath: currentProject.filePath,
          });
        } catch {}
      }
    }, 8000);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentAlbum, saveStatus, saveAlbumToDb, currentProject]);

  // 3. Periodic Background Timer (60 seconds interval fallback)
  useEffect(() => {
    const interval = window.setInterval(async () => {
      const { saveStatus: currentStatus, currentAlbum: album } = useAlbumStore.getState();
      const project = useProjectStore.getState().currentProject;
      if (currentStatus === 'unsaved' && album && project) {
        await useAlbumStore.getState().saveAlbumToDb();
        if (project.filePath) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('export_afsn_package', {
              projectId: project.id,
              targetPath: project.filePath,
            });
          } catch {}
        }
      }
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);
}

/**
 * Checks if a crash snapshot exists for the given project ID.
 */
export function getCrashSnapshot(projectId: string) {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_STORAGE_KEY_PREFIX}${projectId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Clears crash snapshot upon clean project exit.
 */
export function clearCrashSnapshot(projectId: string) {
  try {
    localStorage.removeItem(`${SNAPSHOT_STORAGE_KEY_PREFIX}${projectId}`);
  } catch {
    // ignore
  }
}
