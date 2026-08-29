import { create } from 'zustand';

interface AppInfo {
  version: string;
  buildNumber: string;
  platform: string;
}

interface AppState {
  // App info
  appInfo: AppInfo;
  isAppInfoLoaded: boolean;
  
  // Dialog states
  isAboutOpen: boolean;
  isSettingsOpen: boolean;
  settingsActiveTab: string;
  
  // Actions
  setAppInfo: (info: AppInfo) => void;
  openAbout: () => void;
  closeAbout: () => void;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  setSettingsActiveTab: (tab: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: {
    version: 'v1.0.1-beta',
    buildNumber: '1',
    platform: 'unknown',
  },
  isAppInfoLoaded: false,
  isAboutOpen: false,
  isSettingsOpen: false,
  settingsActiveTab: 'snapping',
  
  setAppInfo: (info) => set({ appInfo: info, isAppInfoLoaded: true }),
  openAbout: () => set({ isAboutOpen: true }),
  closeAbout: () => set({ isAboutOpen: false }),
  openSettings: (tab = 'snapping') => set({ isSettingsOpen: true, settingsActiveTab: tab }),
  closeSettings: () => set({ isSettingsOpen: false }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
}));
