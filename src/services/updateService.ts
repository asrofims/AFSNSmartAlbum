/**
 * AFSNSmartAlbum — Update Service
 * Dual-flow update engine:
 * 1. Primary: Tauri v2 official signed updater (secure, in-app download and installation).
 * 2. Fallback: Direct GitHub Releases REST API check with manual .exe download link.
 */

import { isTauri } from '../utils/platform';
import { invoke } from '@tauri-apps/api/core';
import type { Update } from '@tauri-apps/plugin-updater';

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubReleaseAsset[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  releaseUrl: string;
  isAutoUpdateSupported?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

const GITHUB_REPO_OWNER = 'asrofims';
const GITHUB_REPO_NAME = 'AFSNSmartAlbum';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
const GITHUB_ALL_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;

/** Cached Tauri update instance for the active check session */
let cachedTauriUpdate: Update | null = null;

/**
 * Compare two semver strings (e.g. "v2.0.0" vs "v1.9.0")
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *   -1 if v1 < v2 (v2 is newer)
 *   0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = (v1.replace(/^v/i, '').split('-')[0] || '').trim();
  const clean2 = (v2.replace(/^v/i, '').split('-')[0] || '').trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * Check for application updates.
 * In a Tauri environment, first queries the official Tauri updater endpoint (`latest.json`).
 * If no endpoint is accessible or in browser preview, falls back to the GitHub REST API.
 */
export async function checkForAppUpdates(currentVersion: string): Promise<UpdateCheckResult> {
  const defaultResult: UpdateCheckResult = {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseName: '',
    releaseNotes: '',
    publishedAt: '',
    downloadUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
    releaseUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
    isAutoUpdateSupported: false,
  };

  // 1. Try official Tauri v2 Updater first (in desktop environment)
  if (isTauri()) {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        cachedTauriUpdate = update;
        return {
          hasUpdate: true,
          currentVersion,
          latestVersion: update.version.startsWith('v') ? update.version : `v${update.version}`,
          releaseName: `AFSNSmartAlbum v${update.version}`,
          releaseNotes: update.body || 'A new update of AFSNSmartAlbum is available.',
          publishedAt: update.date || '',
          downloadUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
          releaseUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
          isAutoUpdateSupported: true,
        };
      } else {
        cachedTauriUpdate = null;
        return {
          ...defaultResult,
          hasUpdate: false,
          latestVersion: currentVersion,
          isAutoUpdateSupported: true,
        };
      }
    } catch (tauriErr) {
      console.warn('[Updater] Tauri native updater check returned error, falling back to GitHub API:', tauriErr);
      cachedTauriUpdate = null;
    }
  }

  // 2. Fallback to GitHub REST API (if Tauri check failed or running in web preview)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let res = await fetch(GITHUB_LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    // If latest release is 404 (e.g. only pre-releases exist), query all releases
    if (!res.ok && (res.status === 404 || res.status === 403)) {
      res = await fetch(GITHUB_ALL_RELEASES_URL, {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (res.ok) {
        const allReleases: GitHubRelease[] = await res.json();
        if (Array.isArray(allReleases) && allReleases.length > 0 && allReleases[0]) {
          clearTimeout(timeoutId);
          return processRelease(allReleases[0], currentVersion);
        }
      }
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        return {
          ...defaultResult,
          releaseNotes: 'No public release found yet on GitHub repository.',
        };
      }
      throw new Error(`GitHub API returned status ${res.status}: ${res.statusText}`);
    }

    const release: GitHubRelease = await res.json();
    return processRelease(release, currentVersion);
  } catch (err: any) {
    console.error('[Updater] Failed to check for updates:', err);
    return {
      ...defaultResult,
      isError: true,
      errorMessage: err?.message || 'Unable to connect to update service. Please check your internet connection.',
    };
  }
}

function processRelease(release: GitHubRelease, currentVersion: string): UpdateCheckResult {
  const latestTag = release.tag_name || '';
  const isNewer = compareVersions(latestTag, currentVersion) > 0;

  // Find Windows installer (.exe) in release assets
  let downloadUrl = release.html_url;
  if (Array.isArray(release.assets) && release.assets.length > 0) {
    const exeAsset = release.assets.find(
      (a) => a.name.toLowerCase().endsWith('.exe') && !a.name.toLowerCase().includes('blockmap')
    );
    if (exeAsset) {
      downloadUrl = exeAsset.browser_download_url;
    }
  }

  return {
    hasUpdate: isNewer,
    currentVersion,
    latestVersion: latestTag.startsWith('v') ? latestTag : `v${latestTag}`,
    releaseName: release.name || latestTag,
    releaseNotes: release.body || 'No release notes provided for this version.',
    publishedAt: release.published_at
      ? new Date(release.published_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '',
    downloadUrl,
    releaseUrl: release.html_url,
    isAutoUpdateSupported: false,
  };
}

/**
 * Downloads and installs the pending auto-update with progress tracking.
 * Throws an error if no signed Tauri update is currently pending.
 */
export async function downloadAndInstallAutoUpdate(
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<void> {
  if (!cachedTauriUpdate) {
    throw new Error('No pending auto-update available. Please check for updates again.');
  }

  let downloaded = 0;
  let total = 0;

  await cachedTauriUpdate.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength || 0;
        onProgress?.(0, total);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress?.(downloaded, total);
        break;
      case 'Finished':
        onProgress?.(total || downloaded, total || downloaded);
        break;
    }
  });
}

/**
 * Gracefully restarts the application to finish applying the newly installed update.
 */
export async function restartApp(): Promise<void> {
  if (isTauri()) {
    try {
      await invoke('restart_app');
    } catch (err) {
      console.error('[Updater] Failed to trigger restart command:', err);
      window.location.reload();
    }
  } else {
    window.location.reload();
  }
}
