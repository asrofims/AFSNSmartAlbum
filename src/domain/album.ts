import type { Project } from './project';
import type { Unit } from './units';
import { getCornerRadii, type PhotoFrameElement } from './editor';
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
  const marginEnabled = project.marginEnabled ?? true;
  const marginVal = marginEnabled ? (project.marginValue ?? 10) : 0;
  const safeAreaTop = marginEnabled ? (project.marginTop ?? marginVal) : 0;
  const safeAreaBottom = marginEnabled ? (project.marginBottom ?? marginVal) : 0;
  const safeAreaOutside = marginEnabled ? (project.marginOutside ?? marginVal) : 0;
  const safeAreaSpine = marginEnabled ? (project.marginSpine ?? marginVal) : 0;
  const defaultBleed = 0; // Default zero bleed cut
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
    safeAreaTop,
    safeAreaBottom,
    safeAreaOutside,
    safeAreaSpine,
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
    safeAreaTop,
    safeAreaBottom,
    safeAreaOutside,
    safeAreaSpine,
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
  const marginEnabled = project.marginEnabled ?? true;
  const marginVal = marginEnabled ? (project.marginValue ?? 10) : 0;
  const safeAreaTop = marginEnabled ? (project.marginTop ?? marginVal) : 0;
  const safeAreaBottom = marginEnabled ? (project.marginBottom ?? marginVal) : 0;
  const safeAreaOutside = marginEnabled ? (project.marginOutside ?? marginVal) : 0;
  const safeAreaSpine = marginEnabled ? (project.marginSpine ?? marginVal) : 0;

  // New spread creation baseline: strictly follows the master project creation settings
  const defaultBleed = 0;
  const bleedVal = project.bleed !== undefined ? project.bleed : defaultBleed;

  const spacingVal = project.spacingValue ?? 2;
  const spacingUnitVal = project.spacingUnit ?? unit;

  const defaultBgColor = project.backgroundColor || '#FFFFFF';

  const leftPageNum = (spreadNumber - 1) * 2 + 1;
  const rightPageNum = leftPageNum + 1;
  const spreadId = `${album.id}-spread-${Date.now()}-${spreadNumber}-${Math.random().toString(36).substring(2, 6)}`;

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

/**
 * Formats a clean human-readable page number label without narrative words.
 * Examples:
 * - Cover spread: "Cover"
 * - Facing pages interior spread: "1–2", "3–4", "5–6"
 * - Single page spread: "1", "2"
 */
export function getSpreadPageLabel(spread: Spread): string {
  if (spread.type === 'cover') return 'Cover';
  const left = spread.leftPage?.pageNumber;
  const right = spread.rightPage?.pageNumber;
  if (left !== undefined && right !== undefined) {
    return `${left}–${right}`;
  }
  if (left !== undefined) return `${left}`;
  if (right !== undefined) return `${right}`;
  const start = Math.max(1, (spread.spreadIndex - 1) * 2 + 1);
  return `${start}–${start + 1}`;
}

/**
 * Formats a clean spread label without page narrative.
 * Examples:
 * - Cover spread: "Cover"
 * - Interior spreads: "Spread 1", "Spread 2", "Spread 3"
 */
export function getSpreadLabel(spread: Spread): string {
  if (spread.type === 'cover') return 'Cover';
  return `Spread ${spread.spreadIndex}`;
}

/**
 * Formats a clean spread identifier with only the number (or 'Cover').
 * Examples:
 * - Cover spread: "Cover"
 * - Interior spreads: "1", "2", "3"
 */
export function getSpreadNumberLabel(spread: Spread): string {
  if (spread.type === 'cover') return 'Cover';
  return String(spread.spreadIndex);
}

/**
 * Checks whether two album elements have identical design and layout properties,
 * intentionally ignoring runtime cache paths (previewPath, thumbnailPath).
 */
export function isElementDesignEqual(a?: AlbumElement | null, b?: AlbumElement | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.id !== b.id || a.type !== b.type) return false;
  if (
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height ||
    (a.rotation || 0) !== (b.rotation || 0) ||
    a.zIndex !== b.zIndex ||
    Boolean(a.locked) !== Boolean(b.locked) ||
    (a.groupId || null) !== (b.groupId || null)
  ) {
    return false;
  }

  if (a.type === 'photo' && b.type === 'photo') {
    const pA = a as PhotoFrameElement;
    const pB = b as PhotoFrameElement;
    if (pA.photoId !== pB.photoId) return false;
    if (pA.filePath !== pB.filePath) return false;
    if (pA.fileName !== pB.fileName) return false;
    if (
      pA.cropX !== pB.cropX ||
      pA.cropY !== pB.cropY ||
      pA.cropScale !== pB.cropScale ||
      (pA.cropRotation || 0) !== (pB.cropRotation || 0)
    ) {
      return false;
    }
    if (
      Boolean(pA.borderEnabled) !== Boolean(pB.borderEnabled) ||
      (pA.borderWidth || 0) !== (pB.borderWidth || 0) ||
      (pA.borderColor || '') !== (pB.borderColor || '')
    ) {
      return false;
    }
    if ((pA.opacity ?? 1) !== (pB.opacity ?? 1)) return false;
    if ((pA.photoAspect || 0) !== (pB.photoAspect || 0)) return false;
    const [tlA, trA, brA, blA] = getCornerRadii(pA);
    const [tlB, trB, brB, blB] = getCornerRadii(pB);
    if (tlA !== tlB || trA !== trB || brA !== brB || blA !== blB) return false;
    return true;
  }

  if (a.type === 'text' && b.type === 'text') {
    const tA = a as TextNodeElement;
    const tB = b as TextNodeElement;
    if (tA.text !== tB.text) return false;
    if (JSON.stringify(tA.style || {}) !== JSON.stringify(tB.style || {})) return false;
    if (JSON.stringify(tA.textRuns || []) !== JSON.stringify(tB.textRuns || [])) return false;
    if (JSON.stringify(tA.styledRanges || []) !== JSON.stringify(tB.styledRanges || [])) return false;
    return true;
  }

  return false;
}

/**
 * Checks whether two spreads have identical design layout, structure, and elements.
 */
export function isSpreadDesignEqual(sA?: Spread | null, sB?: Spread | null): boolean {
  if (sA === sB) return true;
  if (!sA || !sB) return false;
  if (sA.id !== sB.id || sA.spreadIndex !== sB.spreadIndex) return false;
  if (sA.gutterWidth !== sB.gutterWidth || (sA.backgroundColor || '') !== (sB.backgroundColor || '')) return false;
  if (
    sA.photoInset !== sB.photoInset ||
    sA.spacingValue !== sB.spacingValue ||
    (sA.spacingUnit || 'mm') !== (sB.spacingUnit || 'mm')
  ) {
    return false;
  }
  const elsA = sA.elements || [];
  const elsB = sB.elements || [];
  if (elsA.length !== elsB.length) return false;
  for (let i = 0; i < elsA.length; i++) {
    if (!isElementDesignEqual(elsA[i], elsB[i])) return false;
  }
  return true;
}

/**
 * Compares two albums for design and layout equality.
 * Preserves true dirty/clean state by ignoring background thumbnail/preview cache path changes.
 */
export function isAlbumDesignEqual(a?: Album | null, b?: Album | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.id !== b.id ||
    a.projectId !== b.projectId ||
    a.totalPages !== b.totalPages ||
    a.totalSpreads !== b.totalSpreads
  ) {
    return false;
  }
  if (!isSpreadDesignEqual(a.coverSpread, b.coverSpread)) return false;
  const spreadsA = a.spreads || [];
  const spreadsB = b.spreads || [];
  if (spreadsA.length !== spreadsB.length) return false;
  for (let i = 0; i < spreadsA.length; i++) {
    if (!isSpreadDesignEqual(spreadsA[i], spreadsB[i])) return false;
  }
  return true;
}

