import { create } from 'zustand';

interface AppInfo {
  version: string;
  buildNumber: string;
  platform: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'uptodate'
  | 'error';

export interface UpdateProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

interface AppState {
  // App info
  appInfo: AppInfo;
  isAppInfoLoaded: boolean;
  
  // Dialog states
  isAboutOpen: boolean;
  isSettingsOpen: boolean;
  isSupportModalOpen: boolean;
  isUpdateModalOpen: boolean;
  updateAvailableVersion: string | null;
  settingsActiveTab: string;

  // Background update state
  updateStatus: UpdateStatus;
  updateProgress: UpdateProgress;
  updateCheckResult: any;
  updateError: string | null;
  isBackgroundNoticeDismissed: boolean;
  
  // Actions
  setAppInfo: (info: AppInfo) => void;
  openAbout: () => void;
  closeAbout: () => void;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  openSupportModal: () => void;
  closeSupportModal: () => void;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
  setUpdateAvailableVersion: (version: string | null) => void;
  setSettingsActiveTab: (tab: string) => void;
  isExitWarningOpen: boolean;
  openExitWarning: () => void;
  closeExitWarning: () => void;

  setUpdateStatus: (status: UpdateStatus) => void;
  setUpdateProgress: (downloadedBytes: number, totalBytes: number) => void;
  setUpdateCheckResult: (res: any) => void;
  setUpdateError: (err: string | null) => void;
  dismissBackgroundNotice: () => void;
  resetBackgroundNotice: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: {
    version: 'v1.0.68',
    buildNumber: '1',
    platform: 'unknown',
  },
  isAppInfoLoaded: false,
  isAboutOpen: false,
  isSettingsOpen: false,
  isSupportModalOpen: false,
  isUpdateModalOpen: false,
  updateAvailableVersion: null,
  settingsActiveTab: 'general',

  updateStatus: 'idle',
  updateProgress: {
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
  },
  updateCheckResult: null,
  updateError: null,
  isBackgroundNoticeDismissed: false,
  
  setAppInfo: (info) => set({ appInfo: info, isAppInfoLoaded: true }),
  openAbout: () => set({ isAboutOpen: true }),
  closeAbout: () => set({ isAboutOpen: false }),
  openSettings: (tab = 'general') => set({ isSettingsOpen: true, settingsActiveTab: tab }),
  closeSettings: () => set({ isSettingsOpen: false }),
  openSupportModal: () => set({ isSupportModalOpen: true }),
  closeSupportModal: () => set({ isSupportModalOpen: false }),
  openUpdateModal: () => set({ isUpdateModalOpen: true }),
  closeUpdateModal: () => set({ isUpdateModalOpen: false }),
  setUpdateAvailableVersion: (version) => set({ updateAvailableVersion: version }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
  isExitWarningOpen: false,
  openExitWarning: () => set({ isExitWarningOpen: true }),
  closeExitWarning: () => set({ isExitWarningOpen: false }),

  setUpdateStatus: (status) => set({ updateStatus: status }),
  setUpdateProgress: (downloadedBytes, totalBytes) => {
    const percent =
      totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
    set({
      updateProgress: { downloadedBytes, totalBytes, percent },
    });
  },
  setUpdateCheckResult: (res) => set({ updateCheckResult: res }),
  setUpdateError: (err) => set({ updateError: err }),
  dismissBackgroundNotice: () => set({ isBackgroundNoticeDismissed: true }),
  resetBackgroundNotice: () => set({ isBackgroundNoticeDismissed: false }),
}));
