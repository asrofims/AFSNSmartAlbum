export function formatPlatform(platform: string): string {
  const map: Record<string, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    browser: 'Browser (Dev)',
  };
  return map[platform.toLowerCase()] ?? platform;
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'isTauri' in window ||
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window
  );
}
