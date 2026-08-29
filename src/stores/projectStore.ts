import { create } from 'zustand';
import { Project, ProjectSettings } from '../domain/project';
import { Unit } from '../domain/units';

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  isNewProjectOpen: boolean;
  isLoading: boolean;
  error: string | null;

  openNewProject: () => void;
  closeNewProject: () => void;
  setCurrentProject: (project: Project | null) => void;
  updateProjectSpacing: (spacingValue: number, spacingUnit?: Unit) => Promise<void>;
  updateProjectMargin: (marginValue: number, marginUnit?: Unit) => Promise<void>;
  updateProjectPhotoInset: (photoInset: number, photoInsetUnit?: Unit) => Promise<void>;
  closeProject: () => void;
  loadRecentProjects: () => Promise<void>;
  createNewProject: (settings: ProjectSettings) => Promise<Project>;
  openProjectById: (id: string) => Promise<void>;
  saveProject: () => Promise<{ success: boolean; filePath: string | null; isSaveAs: boolean }>;
  exportProjectAsAfsn: () => Promise<string | null>;
  exportCompleteProjectPackageWithPhotos: () => Promise<string | null>;
  importProjectFromAfsn: () => Promise<boolean>;
  removeRecentProject: (id: string) => Promise<void>;
  clearAllRecentProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isNewProjectOpen: false,
  isLoading: false,
  error: null,

  openNewProject: () => set({ isNewProjectOpen: true, error: null }),
  closeNewProject: () => set({ isNewProjectOpen: false, error: null }),

  setCurrentProject: (project) => set({ currentProject: project }),

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
  },

  updateProjectMargin: async (marginValue: number, marginUnit?: Unit) => {
    const current = get().currentProject;
    if (!current) return;
    const unit = marginUnit || current.marginUnit || 'mm';
    const updatedProject: Project = {
      ...current,
      marginValue: Number(marginValue),
      marginUnit: unit,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentProject: updatedProject,
      recentProjects: state.recentProjects.map((p) => (p.id === current.id ? updatedProject : p)),
    }));
  },

  updateProjectPhotoInset: async (photoInset: number, photoInsetUnit?: Unit) => {
    const current = get().currentProject;
    if (!current) return;
    const unit = photoInsetUnit || current.photoInsetUnit || 'mm';
    const updatedProject: Project = {
      ...current,
      photoInset: Number(photoInset),
      photoInsetUnit: unit,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentProject: updatedProject,
      recentProjects: state.recentProjects.map((p) => (p.id === current.id ? updatedProject : p)),
    }));
  },

  closeProject: async () => {
    set({ currentProject: null });
    try {
      const { useAlbumStore } = await import('./albumStore');
      const { usePhotoStore } = await import('./photoStore');
      const { useEditorStore } = await import('./editorStore');
      useAlbumStore.setState({ currentAlbum: null, activeSpreadId: null, activeSpreadIndex: 0, saveStatus: 'saved' });
      usePhotoStore.setState({ photos: [], folders: [], selectedPhotoIds: [] });
      useEditorStore.setState({ selectedFrameIds: [], editingCropFrameId: null });
    } catch {}
  },

  loadRecentProjects: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const projects = await invoke<Project[]>('list_recent_projects', { limit: 10 });
      if (Array.isArray(projects)) {
        set({ recentProjects: projects, error: null });
        return;
      }
    } catch (err) {
      console.warn('[AFSN] Could not load recent projects from Tauri, checking localStorage:', err);
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
      photoInset: settings.photoInset ? Number(settings.photoInset.value) : 2,
      photoInsetTop: settings.photoInset?.top !== undefined ? Number(settings.photoInset.top) : (settings.photoInset ? Number(settings.photoInset.value) : 2),
      photoInsetBottom: settings.photoInset?.bottom !== undefined ? Number(settings.photoInset.bottom) : (settings.photoInset ? Number(settings.photoInset.value) : 2),
      photoInsetLeft: settings.photoInset?.left !== undefined ? Number(settings.photoInset.left) : (settings.photoInset ? Number(settings.photoInset.value) : 2),
      photoInsetRight: settings.photoInset?.right !== undefined ? Number(settings.photoInset.right) : (settings.photoInset ? Number(settings.photoInset.value) : 2),
      photoInsetUnit: settings.photoInset?.unit || settings.canvas.unit,
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

      return mockProject;
    }
  },

  openProjectById: async (id: string) => {
    set({ isLoading: true, error: null });

    let project: Project | null = null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      project = await invoke<Project | null>('get_project', { id });
    } catch (err) {
      console.warn('[AFSN] get_project via Tauri failed, checking state/localStorage:', err);
    }

    if (!project) {
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
      } catch (e) {
        console.error('[AFSN] Failed to load album/photos on openProjectById:', e);
      }
    } else {
      set({ error: 'Project not found', isLoading: false });
    }
  },

  saveProject: async (): Promise<{ success: boolean; filePath: string | null; isSaveAs: boolean }> => {
    const current = get().currentProject;
    if (!current) return { success: false, filePath: null, isSaveAs: false };

    // 1. Flush latest album state to SQLite and crash snapshot
    const { useAlbumStore } = await import('./albumStore');
    await useAlbumStore.getState().saveAlbumToDb();

    // 2. If project already has an assigned .afsn file on disk, overwrite directly!
    if (current.filePath) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('export_afsn_package', {
          projectId: current.id,
          targetPath: current.filePath,
        });

        const updatedProject: Project = {
          ...current,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          currentProject: updatedProject,
          recentProjects: [
            updatedProject,
            ...state.recentProjects.filter((p) => p.id !== current.id),
          ].slice(0, 10),
        }));

        try {
          localStorage.setItem('afsn_recent_projects', JSON.stringify(get().recentProjects));
        } catch {}

        return { success: true, filePath: current.filePath, isSaveAs: false };
      } catch (err) {
        console.warn('[AFSN] Direct save to filePath failed, fallback to dialog:', err);
      }
    }

    // 3. If no filePath exists yet (first save), prompt Save As (.afsn) dialog
    const savedPath = await get().exportProjectAsAfsn();
    return { success: Boolean(savedPath), filePath: savedPath, isSaveAs: true };
  },

  exportProjectAsAfsn: async (): Promise<string | null> => {
    const current = get().currentProject;
    if (!current) return null;

    try {
      // 1. Ensure latest album state in memory is flushed to SQLite
      const { useAlbumStore } = await import('./albumStore');
      await useAlbumStore.getState().saveAlbumToDb();

      // 2. Open native Save File Dialog and write .afsn
      const { invoke } = await import('@tauri-apps/api/core');
      const savedPath = await invoke<string | null>('export_afsn_with_dialog', {
        projectId: current.id,
        suggestedName: current.name,
      });

      if (savedPath) {
        const updatedProject: Project = {
          ...current,
          filePath: savedPath,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          currentProject: updatedProject,
          recentProjects: [
            updatedProject,
            ...state.recentProjects.filter((p) => p.id !== current.id),
          ].slice(0, 10),
        }));

        try {
          localStorage.setItem('afsn_recent_projects', JSON.stringify(get().recentProjects));
        } catch {}

        return savedPath;
      }
      return null;
    } catch (err) {
      console.error('[AFSN] export_afsn_with_dialog failed:', err);
      return null;
    }
  },

  exportCompleteProjectPackageWithPhotos: async (): Promise<string | null> => {
    const current = get().currentProject;
    if (!current) return null;

    try {
      // 1. Ensure latest album state in memory is flushed to SQLite
      const { useAlbumStore } = await import('./albumStore');
      await useAlbumStore.getState().saveAlbumToDb();

      // 2. Open native Save File Dialog and write complete .zip package
      const { invoke } = await import('@tauri-apps/api/core');
      const savedPath = await invoke<string | null>('export_bundled_package_with_dialog', {
        projectId: current.id,
        suggestedName: current.name,
      });
      return savedPath;
    } catch (err) {
      console.error('[AFSN] export_bundled_package_with_dialog failed:', err);
      return null;
    }
  },

  importProjectFromAfsn: async (): Promise<boolean> => {
    try {
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
