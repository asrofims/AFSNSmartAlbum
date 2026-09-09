import type { Album, AlbumElement } from './album';

/** Keep frame geometry while permanently detaching a removed library asset. */
export function detachRemovedPhotos(elements: AlbumElement[], ids: ReadonlySet<string>): AlbumElement[] {
  return elements.map((element) => element.type === 'photo' && element.photoId && ids.has(element.photoId)
    ? { ...element, photoId: null, filePath: '', fileName: '', thumbnailPath: '', previewPath: '',
      cropX: 0, cropY: 0, cropScale: 1, cropRotation: 0, photoAspect: undefined,
      originalWidth: undefined, originalHeight: undefined, imageWidth: undefined, imageHeight: undefined,
      isMissing: false }
    : element);
}

export function detachRemovedAlbumPhotos(album: Album, ids: ReadonlySet<string>): Album {
  return { ...album,
    coverSpread: { ...album.coverSpread, elements: detachRemovedPhotos(album.coverSpread.elements, ids) },
    spreads: album.spreads.map((spread) => ({ ...spread, elements: detachRemovedPhotos(spread.elements, ids) })),
  };
}
