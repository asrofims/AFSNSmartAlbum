import type { Project } from './project';
import type { Unit } from './units';
import type { PhotoFrameElement } from './editor';
import type { TextNodeElement } from './text';
import type { Photo } from './photo';

export type AlbumElement = PhotoFrameElement | TextNodeElement;

export type PageType = 'cover_front' | 'cover_back' | 'left' | 'right' | 'single';
export type SpreadType = 'cover' | 'interior';

export interface Page {
  id: string;
  pageNumber: number;
  type: PageType;
  width: number;
  height: number;
  unit: Unit;
  bleed: number;
  safeArea: number;
  safeAreaTop?: number;
  safeAreaBottom?: number;
  safeAreaOutside?: number;
  safeAreaSpine?: number;
  photoInset?: number;
  photoInsetTop?: number;
  photoInsetBottom?: number;
  photoInsetLeft?: number;
  photoInsetRight?: number;
  backgroundColor: string;
  backgroundType: 'solid' | 'gradient' | 'image';
  elements?: AlbumElement[];
}

export interface Spread {
  id: string;
  spreadIndex: number;
  type: SpreadType;
  name: string;
  leftPage: Page | null;
  rightPage: Page | null;
  gutterWidth: number;
  gutterUnit: Unit;
  bleed: number;
  safeArea: number;
  safeAreaTop?: number;
  safeAreaBottom?: number;
  safeAreaOutside?: number;
  safeAreaSpine?: number;
  photoInset?: number;
  photoInsetTop?: number;
  photoInsetBottom?: number;
  photoInsetLeft?: number;
  photoInsetRight?: number;
  spacingValue?: number;
  spacingUnit?: Unit;
  backgroundColor: string;
  elements: AlbumElement[];
}

export interface Album {
  id: string;
  projectId: string;
  coverSpread: Spread;
  spreads: Spread[]; // Interior spreads (index 0 = Spread 1: Pages 2-3, etc.)
  totalSpreads: number;
  totalPages: number;
}

export type PhotoAsset = Pick<Photo, 'id' | 'filePath' | 'fileName' | 'previewPath' | 'thumbnailPath' | 'width' | 'height' | 'isMissing'>;

function isDifferentFrameAsset(a: PhotoFrameElement, b: PhotoFrameElement): boolean {
  return (
    a.filePath !== b.filePath ||
    a.fileName !== b.fileName ||
    a.previewPath !== b.previewPath ||
    a.thumbnailPath !== b.thumbnailPath ||
    a.photoAspect !== b.photoAspect
  );
}

export function mergeFramePhotoAsset<T extends AlbumElement>(frame: T, photo?: PhotoAsset | null): T {
  if (frame.type !== 'photo') {
    return frame;
  }
  const photoFrame = frame as unknown as PhotoFrameElement;
  if (!photoFrame.photoId || !photo || photoFrame.photoId !== photo.id) {
    return frame;
  }

  const nextFilePath = photo.filePath || photoFrame.filePath || '';
  const nextPreviewPath = photo.previewPath || photo.thumbnailPath || '';
  const nextThumbnailPath = photo.thumbnailPath || '';
  const nextPhotoAspect = photo.width > 0 && photo.height > 0
    ? Math.round((photo.width / photo.height) * 1000) / 1000
    : photoFrame.photoAspect;

  const nextFrame: PhotoFrameElement = {
    ...photoFrame,
    filePath: nextFilePath,
    fileName: photo.fileName || photoFrame.fileName || '',
    previewPath: nextPreviewPath,
    thumbnailPath: nextThumbnailPath,
    photoAspect: nextPhotoAspect,
    isMissing: photo.isMissing,
  };

  return (isDifferentFrameAsset(photoFrame, nextFrame) ? nextFrame : frame) as T;
}

export function syncAlbumPhotoAssets(
  album: Album,
  photos: PhotoAsset[]
): { album: Album; changed: boolean } {
  if (photos.length === 0) {
    return { album, changed: false };
  }

  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  let changed = false;

  const syncElements = (elements: AlbumElement[]): AlbumElement[] =>
    elements.map((element) => {
      if (element.type !== 'photo') return element;
      const nextElement = mergeFramePhotoAsset(element, element.photoId ? photoById.get(element.photoId) : null);
      if (nextElement !== element) {
        changed = true;
      }
      return nextElement;
    });

  const coverSpread = {
    ...album.coverSpread,
    elements: syncElements(album.coverSpread.elements || []),
  };

  const spreads = album.spreads.map((spread) => ({
    ...spread,
    elements: syncElements(spread.elements || []),
  }));

  return changed
    ? { album: { ...album, coverSpread, spreads }, changed: true }
    : { album, changed: false };
}

/**
 * Creates the initial album structure for a given project.
 * Standard Album contains:
 * 1. Cover Spread (Back Cover + Spine/Gutter + Front Cover)
 * 2. Spread 1 (Interior Left Page 2 + Right Page 3)
 */
export function createInitialAlbum(project: Project): Album {
  const albumId = `album-${project.id}`;
  const unit = project.canvasUnit;
  const pageW = project.canvasWidth;
  const pageH = project.canvasHeight;
  const marginVal = project.marginValue || 10;
  const defaultBleed = project.canvasUnit === 'inch' ? 0.125 : project.canvasUnit === 'cm' ? 0.3 : 3.0; // Standard 3mm bleed
  const bleedVal = project.bleed !== undefined ? project.bleed : defaultBleed;

  // 1. Cover Spread (Back Cover on left, Front Cover on right)
  const coverBackPage: Page = {
    id: `${albumId}-page-cover-back`,
    pageNumber: 0,
    type: 'cover_back',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: project.backgroundColor || '#1e293b',
    backgroundType: (project.backgroundType as any) || 'solid',
  };

  const coverFrontPage: Page = {
    id: `${albumId}-page-cover-front`,
    pageNumber: 1,
    type: 'cover_front',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: project.backgroundColor || '#1e293b',
    backgroundType: (project.backgroundType as any) || 'solid',
  };

  const coverSpread: Spread = {
    id: `${albumId}-spread-cover`,
    spreadIndex: 0,
    type: 'cover',
    name: 'Cover Spread',
    leftPage: coverBackPage,
    rightPage: coverFrontPage,
    gutterWidth: 0,
    gutterUnit: unit,
    bleed: bleedVal,
    safeArea: marginVal,
    spacingValue: project.spacingValue,
    spacingUnit: project.spacingUnit,
    backgroundColor: project.backgroundColor || '#1e293b',
    elements: [],
  };

  const defaultBgColor = project.backgroundColor || '#FFFFFF';

  // 2. Initial Interior Spread (Spread 1: Page 1 & Page 2)
  const page1: Page = {
    id: `${albumId}-page-1`,
    pageNumber: 1,
    type: 'left',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: defaultBgColor,
    backgroundType: 'solid',
  };

  const page2: Page = {
    id: `${albumId}-page-2`,
    pageNumber: 2,
    type: 'right',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: defaultBgColor,
    backgroundType: 'solid',
  };

  const spread1: Spread = {
    id: `${albumId}-spread-1`,
    spreadIndex: 1,
    type: 'interior',
    name: 'Spread 1 (Pages 1-2)',
    leftPage: page1,
    rightPage: page2,
    gutterWidth: 0,
    gutterUnit: unit,
    bleed: bleedVal,
    safeArea: marginVal,
    spacingValue: project.spacingValue,
    spacingUnit: project.spacingUnit,
    backgroundColor: defaultBgColor,
    elements: [],
  };

  return {
    id: albumId,
    projectId: project.id,
    coverSpread,
    spreads: [spread1],
    totalSpreads: 1, // Spread 1
    totalPages: 2,   // 2 interior pages (Pages 1-2)
  };
}

/**
 * Creates a new interior spread with 2 facing pages.
 * Formula for Spread N:
 * Left Page = (N - 1) * 2 + 1
 * Right Page = (N - 1) * 2 + 2
 */
export function createInteriorSpread(
  album: Album,
  project: Project,
  spreadNumber: number
): Spread {
  const unit = project.canvasUnit;
  const pageW = project.canvasWidth;
  const pageH = project.canvasHeight;
  const marginVal = project.marginValue || 10;
  const safeAreaTop = project.marginTop ?? marginVal;
  const safeAreaBottom = project.marginBottom ?? marginVal;
  const safeAreaOutside = project.marginOutside ?? marginVal;
  const safeAreaSpine = project.marginSpine ?? marginVal;

  // New spread creation baseline: strictly follows the master project creation settings
  const defaultBleed = project.canvasUnit === 'inch' ? 0.125 : project.canvasUnit === 'cm' ? 0.3 : 3.0;
  const bleedVal = project.bleed !== undefined ? project.bleed : defaultBleed;

  const spacingVal = project.spacingValue ?? 2;
  const spacingUnitVal = project.spacingUnit ?? unit;

  const defaultBgColor = project.backgroundColor || '#FFFFFF';

  const leftPageNum = (spreadNumber - 1) * 2 + 1;
  const rightPageNum = leftPageNum + 1;
  const spreadId = `${album.id}-spread-${Date.now()}`;

  const leftPage: Page = {
    id: `${spreadId}-page-${leftPageNum}`,
    pageNumber: leftPageNum,
    type: 'left',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: defaultBgColor,
    backgroundType: 'solid',
  };

  const rightPage: Page = {
    id: `${spreadId}-page-${rightPageNum}`,
    pageNumber: rightPageNum,
    type: 'right',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: defaultBgColor,
    backgroundType: 'solid',
  };

  return {
    id: spreadId,
    spreadIndex: spreadNumber,
    type: 'interior',
    name: `Spread ${spreadNumber} (Pages ${leftPageNum}-${rightPageNum})`,
    leftPage,
    rightPage,
    gutterWidth: 0,
    gutterUnit: unit,
    bleed: bleedVal,
    safeArea: marginVal,
    safeAreaTop,
    safeAreaBottom,
    safeAreaOutside,
    safeAreaSpine,
    spacingValue: spacingVal,
    spacingUnit: spacingUnitVal,
    backgroundColor: defaultBgColor,
    elements: [],
  };
}

/**
 * Recalculates page numbers and names for all interior spreads in sequential order (1-2, 3-4, 5-6).
 */
export function recalculateAlbumPageNumbers(album: Album): Album {
  const updatedSpreads = album.spreads.map((spread, idx) => {
    const spreadNum = idx + 1;
    const leftNum = (spreadNum - 1) * 2 + 1;
    const rightNum = leftNum + 1;

    const leftPage: Page | null = spread.leftPage
      ? { ...spread.leftPage, pageNumber: leftNum, type: 'left' }
      : null;

    const rightPage: Page | null = spread.rightPage
      ? { ...spread.rightPage, pageNumber: rightNum, type: 'right' }
      : null;

    return {
      ...spread,
      spreadIndex: spreadNum,
      name: `Spread ${spreadNum} (Pages ${leftNum}-${rightNum})`,
      leftPage,
      rightPage,
    };
  });

  const totalPages = updatedSpreads.length * 2;
  const totalSpreads = updatedSpreads.length;

  return {
    ...album,
    spreads: updatedSpreads,
    totalSpreads,
    totalPages,
  };
}

/**
 * Duplicates a spread, creating fresh unique IDs for all elements while preserving
 * exact positions, dimensions, rotation, crops, borders, and spread styling.
 */
export function duplicateAlbumSpread(
  album: Album,
  project: Project,
  spreadId: string
): { updatedAlbum: Album; newSpreadId: string; newSpreadIndex: number } | null {
  const targetIdx = album.spreads.findIndex((s) => s.id === spreadId);
  if (targetIdx === -1) return null;

  const original = album.spreads[targetIdx];
  if (!original) return null;

  const newSpreadNumber = album.spreads.length + 1;
  const duplicated = createInteriorSpread(album, project, newSpreadNumber);

  duplicated.backgroundColor = original.backgroundColor;
  duplicated.gutterWidth = original.gutterWidth;
  duplicated.gutterUnit = original.gutterUnit;
  duplicated.bleed = original.bleed;
  duplicated.safeArea = original.safeArea;
  duplicated.safeAreaTop = original.safeAreaTop;
  duplicated.safeAreaBottom = original.safeAreaBottom;
  duplicated.safeAreaOutside = original.safeAreaOutside;
  duplicated.safeAreaSpine = original.safeAreaSpine;
  duplicated.spacingValue = original.spacingValue;
  duplicated.spacingUnit = original.spacingUnit;

  // Deep clone all layout elements with fresh unique IDs
  duplicated.elements = (original.elements || []).map((elem, idx) => ({
    ...elem,
    id: `${elem.type === 'text' ? 'text' : 'frame'}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
  }));

  if (original.leftPage && duplicated.leftPage) {
    duplicated.leftPage.backgroundColor = original.leftPage.backgroundColor;
    duplicated.leftPage.backgroundType = original.leftPage.backgroundType;
  }
  if (original.rightPage && duplicated.rightPage) {
    duplicated.rightPage.backgroundColor = original.rightPage.backgroundColor;
    duplicated.rightPage.backgroundType = original.rightPage.backgroundType;
  }

  const updatedSpreads = [
    ...album.spreads.slice(0, targetIdx + 1),
    duplicated,
    ...album.spreads.slice(targetIdx + 1),
  ];

  const updatedAlbum = recalculateAlbumPageNumbers({
    ...album,
    spreads: updatedSpreads,
  });

  return {
    updatedAlbum,
    newSpreadId: duplicated.id,
    newSpreadIndex: targetIdx + 1,
  };
}

/**
 * Reorders interior spreads by moving a spread from fromIndex to toIndex.
 * Automatically recalculates sequential spread numbers and left/right page numbers.
 */
export function reorderAlbumSpreads(
  album: Album,
  fromIndex: number,
  toIndex: number
): Album {
  if (
    fromIndex < 0 ||
    fromIndex >= album.spreads.length ||
    toIndex < 0 ||
    toIndex >= album.spreads.length ||
    fromIndex === toIndex
  ) {
    return album;
  }

  const updatedSpreads = [...album.spreads];
  const [movedSpread] = updatedSpreads.splice(fromIndex, 1);
  if (!movedSpread) return album;
  updatedSpreads.splice(toIndex, 0, movedSpread);

  return recalculateAlbumPageNumbers({
    ...album,
    spreads: updatedSpreads,
  });
}

/**
 * Moves a spread left (earlier) or right (later) by 1 position.
 */
export function moveAlbumSpread(
  album: Album,
  spreadId: string,
  direction: 'left' | 'right'
): { updatedAlbum: Album; newActiveIndex: number } | null {
  const currentIndex = album.spreads.findIndex((s) => s.id === spreadId);
  if (currentIndex === -1) return null;

  const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= album.spreads.length) return null;

  const updatedAlbum = reorderAlbumSpreads(album, currentIndex, targetIndex);
  return {
    updatedAlbum,
    newActiveIndex: targetIndex,
  };
}

/**
 * Returns all album spreads in sequential order.
 */
export function getAllAlbumSpreads(album: Album): Spread[] {
  return album.spreads;
}
