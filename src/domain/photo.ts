export interface Photo {
  id: string;
  projectId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  format: string;
  thumbnailPath?: string | null;
  thumbnailBase64?: string | null;
  previewPath?: string | null;
  isFavorite: boolean;
  usedCount: number;
  isMissing: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoFolder {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportProgress {
  projectId?: string;
  current: number;
  total: number;
  currentFile: string;
  percent: number;
}

export interface ImportNotice {
  projectId?: string;
  total: number;
  imported: number;
  existing: number;
  relinked: number;
  cancelled?: boolean;
  purged?: number;
}

export type PhotoFilter = 'all' | 'unused' | 'used' | 'favorites';
export type PhotoSortBy = 'name' | 'date' | 'size';

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

export function filterPhotos(
  photos: Photo[],
  filter: PhotoFilter,
  query?: string,
  usedPhotoIds?: Set<string>
): Photo[] {
  let result = photos;

  if (filter === 'unused') {
    if (usedPhotoIds) {
      result = result.filter((p) => !usedPhotoIds.has(p.id) && p.usedCount === 0);
    } else {
      result = result.filter((p) => p.usedCount === 0);
    }
  } else if (filter === 'used') {
    if (usedPhotoIds) {
      result = result.filter((p) => usedPhotoIds.has(p.id) || p.usedCount > 0);
    } else {
      result = result.filter((p) => p.usedCount > 0);
    }
  } else if (filter === 'favorites') {
    result = result.filter((p) => p.isFavorite);
  }

  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    result = result.filter((p) => p.fileName.toLowerCase().includes(q));
  }

  return result;
}

export function sortPhotos(photos: Photo[], sortBy: PhotoSortBy): Photo[] {
  return [...photos].sort((a, b) => {
    if (sortBy === 'name') {
      return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (sortBy === 'date') {
      return a.createdAt.localeCompare(b.createdAt);
    }
    if (sortBy === 'size') {
      return b.fileSize - a.fileSize;
    }
    return 0;
  });
}

/**
 * Calculates a range selection from lastSelectedId to targetId in the given photo list.
 */
export function getRangeSelection(
  photos: Photo[],
  lastSelectedId: string | null,
  targetId: string,
  currentSelectedIds: string[]
): string[] {
  if (!lastSelectedId || lastSelectedId === targetId) {
    return Array.from(new Set([...currentSelectedIds, targetId]));
  }

  const fromIndex = photos.findIndex((p) => p.id === lastSelectedId);
  const toIndex = photos.findIndex((p) => p.id === targetId);

  if (fromIndex === -1 || toIndex === -1) {
    return Array.from(new Set([...currentSelectedIds, targetId]));
  }

  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  const rangeIds = photos.slice(start, end + 1).map((p) => p.id);

  return Array.from(new Set([...currentSelectedIds, ...rangeIds]));
}

/**
 * Formats an ImportNotice into a concise, professional desktop toast notification message.
 */
export function formatImportNoticeToast(notice: ImportNotice): string {
  if (notice.cancelled) {
    if (notice.imported > 0) {
      const keptPlural = notice.imported === 1 ? 'photo' : 'photos';
      const purgedCount = notice.purged || 0;
      const purgedPlural = purgedCount === 1 ? 'photo' : 'photos';
      return `⊘ Import Cancelled: Kept ${notice.imported} completed ${keptPlural}. Removed ${purgedCount} cancelled ${purgedPlural} from library.`;
    }
    const purgedCount = notice.purged || notice.total || 0;
    const purgedPlural = purgedCount === 1 ? 'photo' : 'photos';
    return `⊘ Import Cancelled: Removed ${purgedCount} ${purgedPlural} from library.`;
  }

  if (notice.existing > 0 && notice.imported === 0 && notice.relinked === 0) {
    const photoPlural = notice.existing === 1 ? 'photo already exists' : 'photos already exist';
    return `ℹ️ Already in Library: All ${notice.existing} selected ${photoPlural} in your project library.`;
  }

  const parts: string[] = [];

  if (notice.imported > 0) {
    const photoPlural = notice.imported === 1 ? 'photo' : 'photos';
    if (notice.existing > 0) {
      const dupPlural = notice.existing === 1 ? 'duplicate file was' : 'duplicate files were';
      parts.push(`✓ Imported ${notice.imported} ${photoPlural} (${notice.existing} ${dupPlural} already in library).`);
    } else {
      parts.push(`✓ Successfully imported ${notice.imported} ${photoPlural}.`);
    }
  }

  if (notice.relinked > 0) {
    const relinkPlural = notice.relinked === 1 ? 'photo' : 'photos';
    if (parts.length === 0) {
      const dupNote = notice.existing > 0
        ? ` (${notice.existing} ${notice.existing === 1 ? 'duplicate file was' : 'duplicate files were'} already in library)`
        : '';
      parts.push(`✓ Relinked ${notice.relinked} existing ${relinkPlural}${dupNote}.`);
    } else {
      parts.push(`Relinked ${notice.relinked} missing ${relinkPlural}.`);
    }
  }

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return '✓ Photo import complete.';
}
