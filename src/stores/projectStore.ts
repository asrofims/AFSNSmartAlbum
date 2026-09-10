import { create } from 'zustand';
import { Project, ProjectSettings } from '../domain/project';
import { Unit } from '../domain/units';
import { isAlbumDesignEqual } from '../domain/album';
import { usePhotoStore } from './photoStore';

const persistProjectMargins = async (project: Project): Promise<void> => {
  const fallback = Number(project.marginValue ?? 0);
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('update_project_margins', {
    id: project.id,
    marginValue: fallback,
    marginUnit: project.marginUnit || 'mm',
    marginTop: Number(project.marginTop ?? fallback),
    marginBottom: Number(project.marginBottom ?? fallback),
    marginOutside: Number(project.marginOutside ?? fallback),
    marginSpine: Number(project.marginSpine ?? fallback),
  });
};

const persistProjectSpacing = async (project: Project): Promise<void> => {
  const fallback = Number(project.spacingValue ?? 2);
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('update_project_spacing', {
    id: project.id,
    spacingValue: fallback,
    spacingUnit: project.spacingUnit || 'mm',
  });
};

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  isNewProjectOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  openNewProject: () => void;
  closeNewProject: () => void;
  setCurrentProject: (project: Project | null) => void;
  updateProjectName: (name: string) => Promise<void>;
  updateProjectSpacing: (spacingValue: number, spacingUnit?: Unit) => Promise<void>;
  updateProjectMargin: (marginValue: number, marginUnit?: Unit, side?: 'all' | 'top' | 'bottom' | 'outside' | 'spine') => Promise<void>;
  updateProjectBleed: (bleed: number) => Promise<void>;
  updateProjectBackgroundColor: (backgroundColor: string) => Promise<void>;
  closeProject: () => void;
  loadRecentProjects: () => Promise<void>;
  createNewProject: (settings: ProjectSettings) => Promise<Project>;
  openProjectById: (id: string) => Promise<void>;
  saveProject: (options?: { automatic?: boolean }) => Promise<{ success: boolean; filePath: string | null; isSaveAs: boolean }>;
  exportProjectAsAfsn: () => Promise<string | null>;
  exportCompleteProjectPackageWithPhotos: () => Promise<string | null>;
  importProjectFromAfsn: () => Promise<boolean>;
  openProjectFromFile: (filePath: string) => Promise<boolean>;
  removeRecentProject: (id: string) => Promise<void>;
  clearAllRecentProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isNewProjectOpen: false,
  isLoading: false,
  isSaving: false,
  error: null,

  openNewProject: () => set({ isNewProjectOpen: true, error: null }),
  closeNewProject: () => set({ isNewProjectOpen: false, error: null }),

  setCurrentProject: (project) => set({ currentProject: project }),

  updateProjectName: async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const current = get().currentProject;
    if (!current || get().isSaving || get().isLoading) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updatedRow = await invoke<Project>('update_project_name', {
        id: current.id,
        name: clean,
      });

      if (updatedRow) {
        const updatedProject: Project = {
          ...current,
          name: updatedRow.name,
          filePath: updatedRow.filePath ?? null,
          updatedAt: updatedRow.updatedAt || new Date().toISOString(),
        };

        set((state) => ({
          currentProject: updatedProject,
          recentProjects: state.recentProjects.map((p) => (p.id === current.id ? updatedProject : p)),
        }));
        if (current.filePath && !updatedProject.filePath) {
          const { useAlbumStore } = await import('./albumStore');
          useAlbumStore.getState().setSaveStatus('unsaved');
        }

        try {
          const existing = JSON.parse(localStorage.getItem('afsn_recent_projects') || '[]');
          const updatedRecents = existing.map((p: Project) => (p.id === current.id ? updatedProject : p));
          localStorage.setItem('afsn_recent_projects', JSON.stringify(updatedRecents));
        } catch {}
        await get().loadRecentProjects();
        return;
      }
    } catch (err: any) {
      console.warn('[AFSN] update_project_name via Tauri error:', err);
      throw err;
    }

    // Local fallback
    const fallbackProject: Project = {
      ...current,
      name: clean,
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      currentProject: fallbackProject,
      recentProjects: state.recentProjects.map((p) => (p.id === current.id ? fallbackProject : p)),
    }));
  },

  updateProjectSpacing: async (spacingValue: number, spacingUnit?: Unit) => {
    const current = get().currentProject;
    if (!current) return;
    const unit = spacingUnit || current.spacingUnit;
    const updatedProject: Project = {
      ...current,
      spacingValue: Number(spacingValue),
      spacingUnit: unit,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentProject: updatedProject,
      recentProjects: state.recentProjects.map((p) => (p.id === current.id ? updatedProject : p)),
    }));

    // Update in Tauri DB
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_project_spacing', {
        id: current.id,
        spacingValue: Number(spacingValue),
        spacingUnit: unit,
      });
    } catch (err) {
      console.warn('[AFSN] update_project_spacing via Tauri failed, fallback:', err);
    }

    // Update in localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('afsn_recent_projects') || '[]');
      const updatedRecents = existing.map((p: Project) => (p.id === current.id ? updatedProject : p));
      localStorage.setItem('afsn_recent_projects', JSON.stringify(updatedRecents));
    } catch (e) {
      console.warn('[AFSN] localStorage write error:', e);
    }

    try {
      const { useAlbumStore } = await import('./albumStore');
      useAlbumStore.getState().setSaveStatus('unsaved');
    } catch {}
  },

  updateProjectMargin: async (marginValue: number, marginUnit?: Unit, side: 'all' | 'top' | 'bottom' | 'outside' | 'spine' = 'all') => {
    const current = get().currentProject;
    if (!current) return;
    const unit = marginUnit || current.marginUnit || 'mm';
    const num = Number(marginValue);
    if (!Number.isFinite(num) || num < 0) return;
    const updatedProject: Project = {
      ...current,
      marginUnit: unit,
      updatedAt: new Date().toISOString(),
    };

    if (side === 'all') {
      updatedProject.marginValue = num;
      updatedProject.marginTop = num;
      updatedProject.marginBottom = num;
      updatedProject.marginOutside = num;
      updatedProject.marginSpine = num;
    } else if (side === 'top') {
      updatedProject.marginTop = num;
    } else if (side === 'bottom') {
      updatedProject.marginBottom = num;
    } else if (side === 'outside') {
      updatedProject.marginOutside = num;
    } else if (side === 'spine') {
      updatedProject.marginSpine = num;
    }

    set((state) => ({
      currentProject: updatedProject,
      recentProjects: state.recentProjects.map((p) => (p.id === current.id ? updatedProject : p)),
    }));

    try {
      await persistProjectMargins(updatedProject);
    } catch (err) {
      console.warn('[AFSN] update_project_margins via Tauri failed, fallback:', err);
    }

    try {
      const existing = JSON.parse(localStorage.getItem('afsn_recent_projects') || '[]');
      const updatedRecents = existing.map((p: Project) => (p.id === current.id ? updatedProject : p));
      localStorage.setItem('afsn_recent_projects', JSON.stringify(updatedRecents));
    } catch (err) {
      console.warn('[AFSN] localStorage write error:', err);
    }
  },

  updateProjectBleed: async (bleed: number) => {
    const current = get().currentProject;
    if (!current) return;
    const num = Number(bleed);
    if (isNaN(num)) return;
    const updatedProject: Project = {
      ...current,
      bleed: num,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentProject: updatedProject,
      recentProjects: state.recentProjects.map((p) => (p.id === current.id ? updatedProject : p)),
    }));

    // Update in localStorage recents
    try {
      const existing = JSON.parse(localStorage.getItem('afsn_recent_projects') || '[]');
      const updatedRecents = existing.map((p: Project) => (p.id === current.id ? updatedProject : p));
      localStorage.setItem('afsn_recent_projects', JSON.stringify(updatedRecents));
    } catch (e) {
      console.warn('[AFSN] localStorage write error:', e);
    }
  },

  updateProjectBackgroundColor: async (backgroundColor: string) => {
    const current = get().currentProject;
    if (!current) return;
    const cleanColor = backgroundColor.trim();
    if (!cleanColor) return;
    const updatedProject: Project = {
      ...current,
      backgroundColor: cleanColor,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentProject: updatedProject,
      recentProjects: state.recentProjects.map((p) => (p.id === current.id ? updatedProject : p)),
    }));

    // Update in localStorage recents
    try {
      const existing = JSON.parse(localStorage.getItem('afsn_recent_projects') || '[]');
      const updatedRecents = existing.map((p: Project) => (p.id === current.id ? updatedProject : p));
      localStorage.setItem('afsn_recent_projects', JSON.stringify(updatedRecents));
    } catch (e) {
      console.warn('[AFSN] localStorage write error:', e);
    }
  },

  closeProject: async () => {
    if (get().isSaving || get().isLoading || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return;
    // 1. Terminate any active or queued photo imports immediately
    try {
      const { usePhotoStore } = await import('./photoStore');
      await usePhotoStore.getState().cancelAllImports();
    } catch (err) {
      console.warn('[AFSN] Error cancelling imports on closeProject:', err);
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_photo_import');
    } catch {}

    set({ currentProject: null });
    try {
      const { useAlbumStore } = await import('./albumStore');
      const { usePhotoStore } = await import('./photoStore');
      const { useEditorStore } = await import('./editorStore');
      useAlbumStore.setState({ currentAlbum: null, activeSpreadId: null, activeSpreadIndex: 0, saveStatus: 'saved' });
      usePhotoStore.setState({
        photos: [],
        folders: [],
        selectedPhotoIds: [],
        importQueue: [],
        currentImportTask: null,
        isImporting: false,
        isCancelling: false,
        importProgress: null,
        importNotice: null,
      });
      useEditorStore.setState({ selectedFrameIds: [], editingCropFrameId: null });
    } catch {}
  },

  loadRecentProjects: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const projects = await invoke<Project[]>('list_recent_projects', { limit: 10 });
      if (Array.isArray(projects)) {
        set({ recentProjects: projects });
        try { localStorage.setItem('afsn_recent_projects', JSON.stringify(projects)); } catch {}
        const current = get().currentProject;
        if (current) {
          const latest = projects.find((p) => p.id === current.id)
            ?? await invoke<Project | null>('get_project', { id: current.id });
          if (latest && get().currentProject?.id === current.id) {
            set((state) => ({ currentProject: { ...state.currentProject!, filePath: latest.filePath ?? null } }));
            if (current.filePath && !latest.filePath) {
              const { useAlbumStore } = await import('./albumStore');
              useAlbumStore.getState().setSaveStatus('unsaved');
            }
          }
        }
        return;
      }
    } catch (err) {
      console.warn('[AFSN] Could not load recent projects from Tauri, checking localStorage:', err);
      if ('__TAURI_INTERNALS__' in window) return;
    }

    try {
      const stored = localStorage.getItem('afsn_recent_projects');
      if (stored) {
        set({ recentProjects: JSON.parse(stored) });
      }
    } catch (e) {
      console.warn('[AFSN] localStorage read error:', e);
    }
  },

  createNewProject: async (settings: ProjectSettings): Promise<Project> => {
    if (usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) {
      throw new Error('Wait for the current photo operation to finish before creating a project.');
    }
    // Terminate any existing import tasks before creating a new project
    try {
      const { usePhotoStore } = await import('./photoStore');
      await usePhotoStore.getState().cancelAllImports();
    } catch {}

    set({ isLoading: true, error: null });

    const payload = {
      name: settings.name.trim() || 'Untitled Album',
      canvasWidth: Number(settings.canvas.width),
      canvasHeight: Number(settings.canvas.height),
      canvasUnit: settings.canvas.unit,
      canvasDpi: Number(settings.canvas.dpi),
      spacingValue: Number(settings.spacing.value),
      spacingUnit: settings.spacing.unit,
      marginEnabled: Boolean(settings.margin.enabled),
      marginValue: Number(settings.margin.value),
      marginUnit: settings.margin.unit,
      marginTop: settings.margin.top !== undefined ? Number(settings.margin.top) : Number(settings.margin.value),
      marginBottom: settings.margin.bottom !== undefined ? Number(settings.margin.bottom) : Number(settings.margin.value),
      marginOutside: settings.margin.outside !== undefined ? Number(settings.margin.outside) : Number(settings.margin.value),
      marginSpine: settings.margin.spine !== undefined ? Number(settings.margin.spine) : Number(settings.margin.value),
      borderEnabled: Boolean(settings.border.enabled),
      borderWidth: Number(settings.border.width),
      borderUnit: settings.border.unit,
      borderColor: String(settings.border.color),
      backgroundType: String(settings.background.type),
      backgroundColor: String(settings.background.color),
    };

    console.log('[AFSN] Creating project with payload:', payload);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('[AFSN] Invoking Tauri create_project...');
      const created = await invoke<Project>('create_project', { request: payload });
      console.log('[AFSN] Project successfully created via Tauri:', created);

      set((state) => ({
        currentProject: created,
        recentProjects: [created, ...state.recentProjects.filter((p) => p.id !== created.id)].slice(0, 10),
        isNewProjectOpen: false,
        isLoading: false,
        error: null,
      }));

      // Initialize album for this new project
      const { useAlbumStore } = await import('./albumStore');
      useAlbumStore.getState().initializeAlbum(created);
      await useAlbumStore.getState().saveAlbumToDb();
      useAlbumStore.getState().setSaveStatus('unsaved');

      return created;
    } catch (tauriErr) {
      console.warn('[AFSN] Tauri create_project invoke failed, falling back to local storage:', tauriErr);

      // Local fallback
      const mockProject: Project = {
        id: 'proj-' + Date.now(),
        ...payload,
        filePath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const existing = JSON.parse(localStorage.getItem('afsn_recent_projects') || '[]');
        const updated = [mockProject, ...existing.filter((p: Project) => p.id !== mockProject.id)].slice(0, 10);
        localStorage.setItem('afsn_recent_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('[AFSN] localStorage write error:', e);
      }

      set((state) => ({
        currentProject: mockProject,
        recentProjects: [mockProject, ...state.recentProjects.filter((p) => p.id !== mockProject.id)].slice(0, 10),
        isNewProjectOpen: false,
        isLoading: false,
        error: null,
      }));

      const { useAlbumStore } = await import('./albumStore');
      useAlbumStore.getState().initializeAlbum(mockProject);
      await useAlbumStore.getState().saveAlbumToDb();
      useAlbumStore.getState().setSaveStatus('unsaved');

      return mockProject;
    }
  },

  openProjectById: async (id: string) => {
    if (get().isSaving || get().isLoading || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return;
    let hasUnsavedRecovery = false;
    try { hasUnsavedRecovery = localStorage.getItem(`afsn_dirty_${id}`) === '1'; } catch {}
    // Terminate any existing import tasks before switching projects
    try {
      const { usePhotoStore } = await import('./photoStore');
      await usePhotoStore.getState().cancelAllImports();
    } catch {}

    set({ isLoading: true, error: null });

    let project: Project | null = null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      project = await invoke<Project | null>('get_project', { id });
    } catch (err) {
      console.warn('[AFSN] get_project via Tauri failed, checking state/localStorage:', err);
      if ('__TAURI_INTERNALS__' in window) {
        set({ isLoading: false, error: `Open failed: ${String(err)}` });
        return;
      }
    }

    if (!project && !('__TAURI_INTERNALS__' in window)) {
      project = get().recentProjects.find((p) => p.id === id) || null;
    }

    if (project) {
      set((state) => ({
        currentProject: project,
        recentProjects: [project!, ...state.recentProjects.filter((p) => p.id !== project!.id)].slice(0, 10),
        isLoading: false,
      }));

      // Load Photos, Folders, and Album Structure for this Project
      try {
        const { usePhotoStore } = await import('./photoStore');
        const { useAlbumStore } = await import('./albumStore');
        await usePhotoStore.getState().loadPhotos(project.id);
        await usePhotoStore.getState().loadFolders(project.id);
        const loaded = await useAlbumStore.getState().loadAlbumFromDb(project.id);
        if (!loaded) {
          useAlbumStore.getState().initializeAlbum(project);
        }
        let hasProjectFile = false;
        if (project.filePath && /\.afsn$/i.test(project.filePath)) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            hasProjectFile = await invoke<boolean>('check_path_exists', { path: project.filePath });
          } catch { /* Keep recovery data unsaved if the file cannot be verified. */ }
        }
        if (hasUnsavedRecovery || !hasProjectFile) useAlbumStore.getState().setSaveStatus('unsaved');
        if (!project.filePath) {
          set({ error: 'This project is available as recovery data. Use Save As to save it to a project file.' });
        }
        await get().loadRecentProjects();
      } catch (e) {
        console.error('[AFSN] Failed to load album/photos on openProjectById:', e);
      }
    } else {
      set({ error: 'Project not found', isLoading: false });
    }
  },

  saveProject: async (options = {}) => {
    const current = get().currentProject;
    const failed = { success: false, filePath: null, isSaveAs: false };
    if (usePhotoStore.getState().isImporting || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return failed;
    if (!current || get().isSaving || get().isLoading || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return failed;
    // Old database entries may still point at a ZIP opened by a previous release.
    const workingPath = current.filePath && /\.afsn$/i.test(current.filePath) ? current.filePath : null;
    if (!workingPath && !options.automatic) {
      const path = await get().exportProjectAsAfsn();
      return { success: Boolean(path), filePath: path, isSaveAs: true };
    }
    set({ isSaving: true, error: null });
    const { useAlbumStore } = await import('./albumStore');
    const album = useAlbumStore.getState().currentAlbum;
    try {
      if (!album || album.projectId !== current.id) throw new Error('The active project is not ready to save.');
      await persistProjectMargins(current);
      await persistProjectSpacing(current);
      if (!await useAlbumStore.getState().saveAlbumToDb()) throw new Error('The recovery database could not be saved. Your project file was not changed.');
      if (get().currentProject?.id !== current.id) return failed;
      // Unsaved projects receive database recovery checkpoints without opening a dialog.
      if (!workingPath) return failed;
      const { invoke } = await import('@tauri-apps/api/core');
      const exists = await invoke<boolean>('check_path_exists', { path: workingPath });
      let savedPath = workingPath;
      if (!exists) {
        useAlbumStore.getState().setSaveStatus('unsaved');
        // Recovery checkpoints must never recreate a deleted document silently.
        if (options.automatic) return failed;
        const path = await invoke<string | null>('export_afsn_with_dialog', { projectId: current.id, suggestedName: current.name });
        if (!path) return failed;
        savedPath = path;
        if (get().currentProject?.id === current.id) {
          // Relocate the recovered project without creating a duplicate recent entry.
          const saved = { ...get().currentProject!, filePath: path, name: path.replace(/^.*[\\/]/, '').replace(/\.afsn$/i, '') };
          set((state) => ({ currentProject: saved,
            recentProjects: [saved, ...state.recentProjects.filter((p) => p.id !== saved.id)].slice(0, 10) }));
          try { localStorage.setItem('afsn_recent_projects', JSON.stringify(get().recentProjects)); } catch {}
        }
      } else {
        await invoke('export_afsn_package', { projectId: current.id, targetPath: workingPath });
      }
      if (get().currentProject?.id === current.id && isAlbumDesignEqual(useAlbumStore.getState().currentAlbum, album)) {
        useAlbumStore.setState({ saveStatus: 'saved', lastSavedAt: new Date().toLocaleTimeString() });
      }
      return { success: true, filePath: savedPath, isSaveAs: !exists };
    } catch (error) {
      if (get().currentProject?.id === current.id) {
        useAlbumStore.getState().setSaveStatus('unsaved');
        set({ error: `Save failed: ${String(error)}` });
      }
      return failed;
    } finally {
      // Successful autosave need not scan every recent document on each checkpoint.
      if (!options.automatic || get().error) await get().loadRecentProjects();
      set({ isSaving: false });
    }
  },

  exportProjectAsAfsn: async () => {
    const current = get().currentProject;
    if (!current || get().isSaving || get().isLoading || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return null;
    set({ isSaving: true, error: null });
    const { useAlbumStore } = await import('./albumStore');
    const album = useAlbumStore.getState().currentAlbum;
    try {
      if (!album || album.projectId !== current.id) throw new Error('The active project is not ready to save.');
      const { usePhotoStore } = await import('./photoStore');
      if (usePhotoStore.getState().isImporting) throw new Error('Wait for photo import to finish before using Save As.');
      await persistProjectMargins(current);
      await persistProjectSpacing(current);
      if (!await useAlbumStore.getState().saveAlbumToDb()) throw new Error('The recovery database could not be saved. Your project file was not changed.');
      const { invoke } = await import('@tauri-apps/api/core');
      let saved: Project | null;
      if (current.filePath && /\.afsn$/i.test(current.filePath)) {
        saved = await invoke<Project | null>('save_project_as_with_dialog', { projectId: current.id, suggestedName: current.name });
      } else {
        const path = await invoke<string | null>('export_afsn_with_dialog', { projectId: current.id, suggestedName: current.name });
        saved = path ? { ...current, filePath: path, name: path.replace(/^.*[\\/]/, '').replace(/\.afsn$/i, '') } : null;
      }
      if (!saved) return null; // Cancel preserves the current identity and dirty state.
      if (get().currentProject?.id !== current.id) return saved.filePath || null;
      // Do not discard edits made while the native Save As dialog was open.
      if (useAlbumStore.getState().currentAlbum !== album && saved.id !== current.id) {
        set((state) => ({ recentProjects: [saved!, ...state.recentProjects.filter((p) => p.id !== saved!.id)].slice(0, 10),
          error: 'A copy was saved. Newer edits remain in the current project; save again before switching to the copy.' }));
        return saved.filePath || null;
      }
      set((state) => ({
        currentProject: saved,
        recentProjects: [saved!, ...state.recentProjects.filter((p) => p.id !== saved!.id)].slice(0, 10),
      }));
      try { localStorage.setItem('afsn_recent_projects', JSON.stringify(get().recentProjects)); } catch {}
      if (saved.id !== current.id) {
        await usePhotoStore.getState().loadPhotos(saved.id);
        await usePhotoStore.getState().loadFolders(saved.id);
        if (!await useAlbumStore.getState().loadAlbumFromDb(saved.id)) throw new Error('The saved copy could not be loaded.');
      }
      if (saved.id !== current.id || isAlbumDesignEqual(useAlbumStore.getState().currentAlbum, album)) {
        useAlbumStore.setState({ saveStatus: 'saved', lastSavedAt: new Date().toLocaleTimeString() });
      }
      return saved.filePath || null;
    } catch (error) {
      useAlbumStore.getState().setSaveStatus('unsaved');
      set({ error: `Save As failed: ${String(error)}` });
      return null;
    } finally {
      await get().loadRecentProjects();
      set({ isSaving: false });
    }
  },

  exportCompleteProjectPackageWithPhotos: async () => {
    const current = get().currentProject;
    if (!current || get().isSaving || get().isLoading || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return null;
    set({ isSaving: true, error: null });
    try {
      const { useAlbumStore } = await import('./albumStore');
      const { usePhotoStore } = await import('./photoStore');
      if (usePhotoStore.getState().isImporting) throw new Error('Wait for photo import to finish before exporting a package.');
      await persistProjectMargins(current);
      await persistProjectSpacing(current);
      if (useAlbumStore.getState().currentAlbum?.projectId !== current.id || !await useAlbumStore.getState().saveAlbumToDb()) {
        throw new Error('The current project could not be saved to the recovery database.');
      }
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('export_bundled_package_with_dialog', { projectId: current.id, suggestedName: current.name });
    } catch (error) {
      set({ error: `Package export failed: ${String(error)}` });
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  importProjectFromAfsn: async (): Promise<boolean> => {
    if (get().isSaving || get().isLoading || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return false;
    set({ isLoading: true, error: null });
    try {
      const { usePhotoStore } = await import('./photoStore');
      await usePhotoStore.getState().cancelAllImports();
      const { invoke } = await import('@tauri-apps/api/core');
      const packageData = await invoke<any>('import_afsn_with_dialog');
      if (packageData && packageData.project) {
        const project = packageData.project as Project;
        set((state) => ({
          currentProject: project,
          recentProjects: [project, ...state.recentProjects.filter((p) => p.id !== project.id)].slice(0, 10),
          error: null,
        }));

        try {
          localStorage.setItem('afsn_recent_projects', JSON.stringify(get().recentProjects));
        } catch {}

        // Load imported photos, folders, and album structure
        const { usePhotoStore } = await import('./photoStore');
        const { useAlbumStore } = await import('./albumStore');
        await usePhotoStore.getState().loadPhotos(project.id);
        await usePhotoStore.getState().loadFolders(project.id);
        await useAlbumStore.getState().loadAlbumFromDb(project.id);
        return true;
      }
    } catch (err) {
      console.error('[AFSN] import_afsn_with_dialog failed:', err);
      set({ error: `Open failed: ${String(err)}` });
    } finally {
      await get().loadRecentProjects();
      set({ isLoading: false });
    }
    return false;
  },

  openProjectFromFile: async (filePath: string): Promise<boolean> => {
    if (get().isSaving || get().isLoading || usePhotoStore.getState().isRemoving || usePhotoStore.getState().isRelinking) return false;
    if (!/\.afsn$/i.test(filePath)) {
      set({ error: 'Open .afsn project files only. Extract ZIP packages first, then open project.afsn inside the extracted folder.' });
      return false;
    }
    set({ isLoading: true, error: null });
    try {
      const { usePhotoStore } = await import('./photoStore');
      await usePhotoStore.getState().cancelAllImports();
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('[AFSN] Opening project from file:', filePath);
      const packageData = await invoke<any>('import_afsn_package', { sourcePath: filePath });
      if (packageData && packageData.project) {
        const project = packageData.project as Project;
        set((state) => ({
          currentProject: project,
          recentProjects: [project, ...state.recentProjects.filter((p) => p.id !== project.id)].slice(0, 10),
          error: null,
        }));

        try {
          localStorage.setItem('afsn_recent_projects', JSON.stringify(get().recentProjects));
        } catch {}

        // Load imported photos, folders, and album structure
        const { usePhotoStore } = await import('./photoStore');
        const { useAlbumStore } = await import('./albumStore');
        await usePhotoStore.getState().loadPhotos(project.id);
        await usePhotoStore.getState().loadFolders(project.id);
        await useAlbumStore.getState().loadAlbumFromDb(project.id);
        return true;
      }
    } catch (err) {
      console.error('[AFSN] openProjectFromFile failed:', err);
      set({ error: `Open failed: ${String(err)}` });
    } finally {
      await get().loadRecentProjects();
      set({ isLoading: false });
    }
    return false;
  },

  removeRecentProject: async (id: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_project', { id });
    } catch (err) {
      console.warn('[AFSN] delete_project via Tauri failed, fallback:', err);
    }

    const updated = get().recentProjects.filter((p) => p.id !== id);
    set({ recentProjects: updated });
    try {
      localStorage.setItem('afsn_recent_projects', JSON.stringify(updated));
    } catch (e) {
      console.warn('[AFSN] localStorage write error:', e);
    }
  },

  clearAllRecentProjects: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('clear_recent_projects');
    } catch (err) {
      console.warn('[AFSN] clear_recent_projects via Tauri failed, fallback:', err);
    }

    set({ recentProjects: [] });
    try {
      localStorage.removeItem('afsn_recent_projects');
    } catch (e) {
      console.warn('[AFSN] localStorage write error:', e);
    }
  },
}));
