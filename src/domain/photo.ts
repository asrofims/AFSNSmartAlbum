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

export interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
  percent: number;
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

export function filterPhotos(photos: Photo[], filter: PhotoFilter, query?: string): Photo[] {
  let result = photos;

  if (filter === 'unused') {
    result = result.filter((p) => p.usedCount === 0);
  } else if (filter === 'used') {
    result = result.filter((p) => p.usedCount > 0);
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
