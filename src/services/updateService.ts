/**
 * AFSNSmartAlbum — GitHub REST API Update Service
 * Checks for latest releases from https://github.com/asrofims/AFSNSmartAlbum/releases
 */

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
  isError?: boolean;
  errorMessage?: string;
}

const GITHUB_REPO_OWNER = 'asrofims';
const GITHUB_REPO_NAME = 'AFSNSmartAlbum';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
const GITHUB_ALL_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;

/**
 * Compare two semver strings (e.g. "v1.0.2-beta" vs "v1.0.1-beta")
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
 * Check GitHub repository for the latest release
 */
export async function checkForAppUpdates(currentVersion: string): Promise<UpdateCheckResult> {
  const defaultResult: UpdateCheckResult = {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseName: '',
    releaseNotes: '',
    publishedAt: '',
    downloadUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`,
    releaseUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`,
  };

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
    console.error('Failed to check for updates:', err);
    return {
      ...defaultResult,
      isError: true,
      errorMessage: err?.message || 'Unable to connect to GitHub. Please check your internet connection.',
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
  };
}
