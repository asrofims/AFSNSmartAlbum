import { useEffect, useRef } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';

const SNAPSHOT_STORAGE_KEY_PREFIX = 'afsn_snapshot_';

export function useAutoSave() {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const saveStatus = useAlbumStore((s) => s.saveStatus);
  const currentProject = useProjectStore((s) => s.currentProject);
  const autoSaveEnabled = useAppStore((s) => s.preferences.autoSaveEnabled);
  const autoSaveIntervalSeconds = useAppStore((s) => s.preferences.autoSaveIntervalSeconds);

  const debounceTimerRef = useRef<number | null>(null);

  // 1. Local Storage Crash Snapshot Recovery Protection
  useEffect(() => {
    if (!currentAlbum || !currentProject || currentAlbum.projectId !== currentProject.id) return;

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

  useEffect(() => {
    if (!currentProject || currentAlbum?.projectId !== currentProject.id) return;
    try {
      const key = `afsn_dirty_${currentProject.id}`;
      if (saveStatus === 'saved') localStorage.removeItem(key);
      else localStorage.setItem(key, '1');
    } catch {}
  }, [currentProject, currentAlbum, saveStatus]);

  // Both timers use the same guarded save pipeline as Ctrl+S.
  // Keep unsaved projects dirty after a database-only recovery checkpoint.
  const lastCheckpoint = useRef<typeof currentAlbum>(null);
  const checkpoint = async () => {
    const state = useProjectStore.getState();
    if (state.isSaving || state.isLoading) return;
    const project = state.currentProject;
    const album = useAlbumStore.getState().currentAlbum;
    if (!project || !album || album.projectId !== project.id) return;
    // A failed automatic save is shown once per revision. Retry with Save or a
    // subsequent edit instead of reopening the error dialog every eight seconds.
    if (lastCheckpoint.current === album) return;
    lastCheckpoint.current = album;
    await state.saveProject({ automatic: true });
  };

  useEffect(() => {
    if (!autoSaveEnabled || saveStatus !== 'unsaved' || !currentAlbum) return;
    debounceTimerRef.current = window.setTimeout(
      () => { void checkpoint(); },
      autoSaveIntervalSeconds * 1000
    );
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [autoSaveEnabled, autoSaveIntervalSeconds, currentAlbum, saveStatus, currentProject]);

  useEffect(() => {
    if (!autoSaveEnabled) return;
    const interval = window.setInterval(() => {
      if (useAlbumStore.getState().saveStatus === 'unsaved') void checkpoint();
    }, Math.max(60000, autoSaveIntervalSeconds * 1000));
    return () => window.clearInterval(interval);
  }, [autoSaveEnabled, autoSaveIntervalSeconds]);

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
