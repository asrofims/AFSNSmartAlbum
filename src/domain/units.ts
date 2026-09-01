export type Unit = 'mm' | 'cm' | 'inch' | 'px';

export interface Dimensions {
  width: number;
  height: number;
  unit: Unit;
}

export const UNIT_LABELS: Record<Unit, string> = {
  mm: 'mm',
  cm: 'cm',
  inch: 'in',
  px: 'px',
};

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'inch', label: 'inch' },
  { value: 'px', label: 'px' },
];

const MM_PER_INCH = 25.4;

/**
 * Convert any unit to millimeters.
 */
function toMillimeters(value: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'inch':
      return value * MM_PER_INCH;
    case 'px':
      return (value / dpi) * MM_PER_INCH;
  }
}

/**
 * Convert millimeters to any unit.
 */
function fromMillimeters(mm: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case 'mm':
      return mm;
    case 'cm':
      return mm / 10;
    case 'inch':
      return mm / MM_PER_INCH;
    case 'px':
      return (mm / MM_PER_INCH) * dpi;
  }
}

/**
 * Convert value between any physical or pixel unit using given DPI.
 */
export function convertUnit(
  value: number,
  from: Unit,
  to: Unit,
  dpi: number = 300,
  decimals: number = 2
): number {
  if (from === to) return value;
  const mm = toMillimeters(value, from, dpi);
  const result = fromMillimeters(mm, to, dpi);
  const factor = Math.pow(10, decimals);
  return Math.round(result * factor) / factor;
}

/**
 * Convert a value from its unit to pixels at given DPI.
 */
export function toPixels(value: number, unit: Unit, dpi: number = 300): number {
  return convertUnit(value, unit, 'px', dpi, 2);
}

/**
 * Convert pixel value to a target physical unit at given DPI.
 */
export function fromPixels(px: number, unit: Unit, dpi: number = 300, decimals: number = 2): number {
  return convertUnit(px, 'px', unit, dpi, decimals);
}

/**
 * Calculate target export pixel dimension from a dimension value, project unit, target export DPI,
 * and base project DPI.
 * If unit is 'px', scales by (exportDpi / baseDpi).
 * If unit is physical ('mm', 'cm', 'inch'), converts physical unit to pixels at exportDpi.
 */
export function calculateExportPixels(
  value: number,
  unit: Unit,
  exportDpi: number,
  projectBaseDpi: number = 300
): number {
  if (unit === 'px') {
    const base = projectBaseDpi > 0 ? projectBaseDpi : 300;
    return Math.round(value * (exportDpi / base));
  }
  return Math.round(toPixels(value, unit, exportDpi));
}

/**
 * Format dimensions as a clean display string (e.g., "210 × 297 mm" or "8 × 8 in").
 */
export function formatDimensions(width: number, height: number, unit: Unit): string {
  const label = UNIT_LABELS[unit] ?? unit;
  return `${width} × ${height} ${label}`;
}

