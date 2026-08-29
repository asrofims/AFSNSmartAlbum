import { Unit } from './units';

export interface AlbumPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: Unit;
  dpi: number;
  isCustom?: boolean;
  spacingValue?: number;
  spacingUnit?: Unit;
  marginEnabled?: boolean;
  marginValue?: number;
  marginUnit?: Unit;
  borderEnabled?: boolean;
  borderWidth?: number;
  borderUnit?: Unit;
  borderColor?: string;
  backgroundColor?: string;
}

export const BUILTIN_ALBUM_PRESETS: AlbumPreset[] = [
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

export const ALBUM_PRESETS: AlbumPreset[] = BUILTIN_ALBUM_PRESETS;

export const CUSTOM_PRESET_ID = 'custom';

const CUSTOM_PRESETS_STORAGE_KEY = 'afsn_custom_album_presets';

export function loadCustomPresets(): AlbumPreset[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[AFSN] Failed to load custom presets:', err);
    return [];
  }
}

export function saveCustomPreset(preset: AlbumPreset): AlbumPreset[] {
  try {
    const current = loadCustomPresets();
    const filtered = current.filter((p) => p.id !== preset.id);
    const updated = [preset, ...filtered];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch (err) {
    console.warn('[AFSN] Failed to save custom preset:', err);
    return loadCustomPresets();
  }
}

export function deleteCustomPreset(id: string): AlbumPreset[] {
  try {
    const current = loadCustomPresets();
    const updated = current.filter((p) => p.id !== id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch (err) {
    console.warn('[AFSN] Failed to delete custom preset:', err);
    return loadCustomPresets();
  }
}

export function getAllPresets(): AlbumPreset[] {
  return [...loadCustomPresets(), ...BUILTIN_ALBUM_PRESETS];
}

export function getPresetById(id: string): AlbumPreset | undefined {
  return getAllPresets().find((p) => p.id === id);
}

export function findMatchingPreset(width: number, height: number, unit: Unit): AlbumPreset | undefined {
  return getAllPresets().find((p) => p.width === width && p.height === height && p.unit === unit);
}
