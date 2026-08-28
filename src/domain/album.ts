import { Project } from './project';
import { Unit } from './units';

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
  backgroundColor: string;
  backgroundType: 'solid' | 'gradient' | 'image';
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
  backgroundColor: string;
}

export interface Album {
  id: string;
  projectId: string;
  coverSpread: Spread;
  spreads: Spread[]; // Interior spreads (index 0 = Spread 1: Pages 2-3, etc.)
  totalSpreads: number;
  totalPages: number;
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
  const bleedVal = project.canvasUnit === 'inch' ? 0.125 : project.canvasUnit === 'cm' ? 0.3 : 3.0; // Standard 3mm bleed

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
    gutterWidth: project.canvasUnit === 'inch' ? 0.25 : project.canvasUnit === 'cm' ? 0.6 : 6.0, // Spine width
    gutterUnit: unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: project.backgroundColor || '#1e293b',
  };

  // 2. Initial Interior Spread (Spread 1: Page 2 & Page 3)
  const page2: Page = {
    id: `${albumId}-page-2`,
    pageNumber: 2,
    type: 'left',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: '#FFFFFF',
    backgroundType: 'solid',
  };

  const page3: Page = {
    id: `${albumId}-page-3`,
    pageNumber: 3,
    type: 'right',
    width: pageW,
    height: pageH,
    unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: '#FFFFFF',
    backgroundType: 'solid',
  };

  const spread1: Spread = {
    id: `${albumId}-spread-1`,
    spreadIndex: 1,
    type: 'interior',
    name: 'Spread 1 (Pages 2-3)',
    leftPage: page2,
    rightPage: page3,
    gutterWidth: 0,
    gutterUnit: unit,
    bleed: bleedVal,
    safeArea: marginVal,
    backgroundColor: '#FFFFFF',
  };

  return {
    id: albumId,
    projectId: project.id,
    coverSpread,
    spreads: [spread1],
    totalSpreads: 2, // Cover + Spread 1
    totalPages: 4,   // Back Cover, Front Cover, Page 2, Page 3
  };
}

/**
 * Creates a new interior spread with 2 facing pages.
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
  const bleedVal = project.canvasUnit === 'inch' ? 0.125 : project.canvasUnit === 'cm' ? 0.3 : 3.0;

  const leftPageNum = spreadNumber * 2;
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
  };
}

/**
 * Recalculates page numbers and names for all interior spreads in sequential order.
 */
export function recalculateAlbumPageNumbers(album: Album): Album {
  const updatedSpreads = album.spreads.map((spread, idx) => {
    const spreadNum = idx + 1;
    const leftNum = spreadNum * 2;
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

  const totalPages = 2 + updatedSpreads.length * 2;
  const totalSpreads = 1 + updatedSpreads.length;

  return {
    ...album,
    spreads: updatedSpreads,
    totalSpreads,
    totalPages,
  };
}

/**
 * Returns all spreads in sequential display order (Cover Spread first, followed by interior spreads).
 */
export function getAllAlbumSpreads(album: Album): Spread[] {
  return [album.coverSpread, ...album.spreads];
}
