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
  isSupportModalOpen: boolean;
  settingsActiveTab: string;
  
  // Actions
  setAppInfo: (info: AppInfo) => void;
  openAbout: () => void;
  closeAbout: () => void;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  openSupportModal: () => void;
  closeSupportModal: () => void;
  setSettingsActiveTab: (tab: string) => void;
}

const shouldOpenSupportOnLaunch = (): boolean => {
  try {
    if (localStorage.getItem('afsn_suppress_support_popup') === 'true') {
      return false;
    }
    if (sessionStorage.getItem('afsn_shown_support_session') === 'true') {
      return false;
    }
    sessionStorage.setItem('afsn_shown_support_session', 'true');
    return true;
  } catch {
    return true;
  }
};

export const useAppStore = create<AppState>((set) => ({
  appInfo: {
    version: 'v1.0.1-beta',
    buildNumber: '1',
    platform: 'unknown',
  },
  isAppInfoLoaded: false,
  isAboutOpen: false,
  isSettingsOpen: false,
  isSupportModalOpen: shouldOpenSupportOnLaunch(),
  settingsActiveTab: 'snapping',
  
  setAppInfo: (info) => set({ appInfo: info, isAppInfoLoaded: true }),
  openAbout: () => set({ isAboutOpen: true }),
  closeAbout: () => set({ isAboutOpen: false }),
  openSettings: (tab = 'snapping') => set({ isSettingsOpen: true, settingsActiveTab: tab }),
  closeSettings: () => set({ isSettingsOpen: false }),
  openSupportModal: () => set({ isSupportModalOpen: true }),
  closeSupportModal: () => set({ isSupportModalOpen: false }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
}));
