import { Unit } from './units';

export interface AlbumPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: Unit;
  dpi: number;
}

export const ALBUM_PRESETS: AlbumPreset[] = [
  {
    id: 'square-8x8',
    name: 'Square 8×8 in',
    width: 8,
    height: 8,
    unit: 'inch',
    dpi: 300,
  },
  {
    id: 'landscape-10x8',
    name: 'Landscape 10×8 in',
    width: 10,
    height: 8,
    unit: 'inch',
    dpi: 300,
  },
  {
    id: 'portrait-8x10',
    name: 'Portrait 8×10 in',
    width: 8,
    height: 10,
    unit: 'inch',
    dpi: 300,
  },
  {
    id: 'wide-12x8',
    name: 'Wide 12×8 in',
    width: 12,
    height: 8,
    unit: 'inch',
    dpi: 300,
  },
  {
    id: 'square-12x12',
    name: 'Large Square 12×12 in',
    width: 12,
    height: 12,
    unit: 'inch',
    dpi: 300,
  },
  {
    id: 'a4-portrait',
    name: 'A4 Portrait (210 × 297 mm)',
    width: 210,
    height: 297,
    unit: 'mm',
    dpi: 300,
  },
  {
    id: 'a4-landscape',
    name: 'A4 Landscape (297 × 210 mm)',
    width: 297,
    height: 210,
    unit: 'mm',
    dpi: 300,
  },
];

export const CUSTOM_PRESET_ID = 'custom';

export function getPresetById(id: string): AlbumPreset | undefined {
  return ALBUM_PRESETS.find((p) => p.id === id);
}

export function findMatchingPreset(width: number, height: number, unit: Unit): AlbumPreset | undefined {
  return ALBUM_PRESETS.find((p) => p.width === width && p.height === height && p.unit === unit);
}
