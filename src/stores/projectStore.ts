import { create } from 'zustand';
import { Project, ProjectSettings } from '../domain/project';

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  isNewProjectOpen: boolean;
  isLoading: boolean;
  error: string | null;

  openNewProject: () => void;
  closeNewProject: () => void;
  setCurrentProject: (project: Project | null) => void;
  closeProject: () => void;
  loadRecentProjects: () => Promise<void>;
  createNewProject: (settings: ProjectSettings) => Promise<Project>;
  openProjectById: (id: string) => Promise<void>;
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

  closeProject: () => set({ currentProject: null }),

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

      return mockProject;
    }
  },

  openProjectById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const project = await invoke<Project | null>('get_project', { id });
      if (project) {
        set((state) => ({
          currentProject: project,
          recentProjects: [project, ...state.recentProjects.filter((p) => p.id !== project.id)].slice(0, 10),
          isLoading: false,
        }));
        return;
      }
    } catch (err) {
      console.warn('[AFSN] get_project via Tauri failed, checking state/localStorage:', err);
    }

    const found = get().recentProjects.find((p) => p.id === id);
    if (found) {
      set({ currentProject: found, isLoading: false });
    } else {
      set({ error: 'Project not found', isLoading: false });
    }
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
