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
  
  // Actions
  setAppInfo: (info: AppInfo) => void;
  openAbout: () => void;
  closeAbout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: {
    version: '0.1.0',
    buildNumber: '1',
    platform: 'unknown',
  },
  isAppInfoLoaded: false,
  isAboutOpen: false,
  
  setAppInfo: (info) => set({ appInfo: info, isAppInfoLoaded: true }),
  openAbout: () => set({ isAboutOpen: true }),
  closeAbout: () => set({ isAboutOpen: false }),
}));
