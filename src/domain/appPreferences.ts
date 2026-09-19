export type StartupBehavior = 'welcome' | 'reopen_last';
export type AutoSaveIntervalSeconds = 10 | 30 | 60 | 300;

export interface AppPreferences {
  startupBehavior: StartupBehavior;
  autoSaveEnabled: boolean;
  autoSaveIntervalSeconds: AutoSaveIntervalSeconds;
  automaticUpdateChecks: boolean;
}

export const APP_PREFERENCES_STORAGE_KEY = 'afsn_app_preferences_v1';

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  startupBehavior: 'welcome',
  autoSaveEnabled: true,
  autoSaveIntervalSeconds: 10,
  automaticUpdateChecks: true,
};

const AUTO_SAVE_INTERVALS = new Set<number>([10, 30, 60, 300]);

export function normalizeAppPreferences(value: unknown): AppPreferences {
  if (!value || typeof value !== 'object') return { ...DEFAULT_APP_PREFERENCES };

  const candidate = value as Partial<AppPreferences>;
  return {
    startupBehavior: candidate.startupBehavior === 'reopen_last' ? 'reopen_last' : 'welcome',
    autoSaveEnabled:
      typeof candidate.autoSaveEnabled === 'boolean'
        ? candidate.autoSaveEnabled
        : DEFAULT_APP_PREFERENCES.autoSaveEnabled,
    autoSaveIntervalSeconds: AUTO_SAVE_INTERVALS.has(Number(candidate.autoSaveIntervalSeconds))
      ? Number(candidate.autoSaveIntervalSeconds) as AutoSaveIntervalSeconds
      : DEFAULT_APP_PREFERENCES.autoSaveIntervalSeconds,
    automaticUpdateChecks:
      typeof candidate.automaticUpdateChecks === 'boolean'
        ? candidate.automaticUpdateChecks
        : DEFAULT_APP_PREFERENCES.automaticUpdateChecks,
  };
}

export function loadAppPreferences(): AppPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_APP_PREFERENCES };
  try {
    const stored = window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
    return stored ? normalizeAppPreferences(JSON.parse(stored)) : { ...DEFAULT_APP_PREFERENCES };
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export function saveAppPreferences(preferences: AppPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      APP_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizeAppPreferences(preferences))
    );
  } catch {
    // Preferences remain active for the current session if local persistence is unavailable.
  }
}
