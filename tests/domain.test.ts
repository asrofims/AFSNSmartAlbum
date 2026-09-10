import assert from 'node:assert';
import {
  convertUnit,
  toPixels,
  fromPixels,
  calculateExportPixels,
  formatDimensions,
  getMaxGapForUnit,
} from '../src/domain/units';
import {
  ALBUM_PRESETS,
  getPresetById,
} from '../src/domain/presets';
import {
  validateProjectSettings,
  ProjectSettings,
} from '../src/domain/project';
import {
  Photo,
  filterPhotos,
  sortPhotos,
  getRangeSelection,
} from '../src/domain/photo';

// Test 1: Unit conversions
console.log('Testing Unit Conversions...');
assert.strictEqual(convertUnit(25.4, 'mm', 'inch'), 1.0);
assert.strictEqual(convertUnit(1, 'inch', 'mm'), 25.4);
assert.strictEqual(convertUnit(10, 'cm', 'mm'), 100);
assert.strictEqual(toPixels(1, 'inch', 300), 300);
assert.strictEqual(fromPixels(300, 'inch', 300), 1);
assert.strictEqual(formatDimensions(210, 297, 'mm'), '210 × 297 mm');

// Test calculateExportPixels: physical units vs pixel units with custom DPI
assert.strictEqual(calculateExportPixels(1, 'inch', 300, 300), 300);
assert.strictEqual(calculateExportPixels(1, 'inch', 600, 300), 600);
assert.strictEqual(calculateExportPixels(20, 'cm', 300, 300), 2362);
assert.strictEqual(calculateExportPixels(1920, 'px', 300, 300), 1920);
assert.strictEqual(calculateExportPixels(1920, 'px', 600, 300), 3840);
assert.strictEqual(calculateExportPixels(1000, 'px', 300, 72), 4167);

// Test getMaxGapForUnit: dynamic sensible maximum gap bounds per unit
assert.strictEqual(getMaxGapForUnit('px'), 2000);
assert.strictEqual(getMaxGapForUnit('mm'), 500);
assert.strictEqual(getMaxGapForUnit('cm'), 50);
assert.strictEqual(getMaxGapForUnit('inch'), 20);
assert.strictEqual(getMaxGapForUnit(undefined), 500);
console.log('✓ Unit conversions and dynamic gap limits passed.');

// Test 2: Presets & Custom Presets Lifecycle
console.log('Testing Presets...');
assert.ok(ALBUM_PRESETS.length > 0);
const standardPreset = getPresetById('square-8x8');
assert.ok(standardPreset !== undefined);
assert.strictEqual(standardPreset?.width, 8);
assert.strictEqual(standardPreset?.height, 8);

// Test Custom Preset lifecycle
const { saveCustomPreset, deleteCustomPreset, getAllPresets } = await import('../src/domain/presets');
const mockCustom = {
  id: 'test-custom-preset',
  name: 'Test 10x10 Custom',
  width: 10,
  height: 10,
  unit: 'inch' as const,
  dpi: 300,
  isCustom: true,
};
const allAfterSave = saveCustomPreset(mockCustom);
assert.ok(allAfterSave.some((p) => p.id === 'test-custom-preset'));
assert.ok(allAfterSave.some((p) => p.id === 'square-8x8'), 'Built-in presets must remain after saving custom preset');
assert.ok(allAfterSave.some((p) => p.id === 'a4-portrait'), 'All built-ins must be preserved');

const allAfterDelete = deleteCustomPreset('test-custom-preset');
assert.ok(!allAfterDelete.some((p) => p.id === 'test-custom-preset'));
assert.ok(allAfterDelete.some((p) => p.id === 'square-8x8'), 'Built-in presets must remain after deleting custom preset');

// Test 2b: formatPresetLabel and Cross-Unit findMatchingPreset
const { formatPresetLabel, findMatchingPreset } = await import('../src/domain/presets');
const p20cm = getPresetById('square-20x20-cm')!;
assert.ok(p20cm !== undefined);
assert.strictEqual(formatPresetLabel(p20cm, 'cm'), 'Square 20×20 cm', 'Native unit should display clean name without parentheses');
assert.strictEqual(formatPresetLabel(p20cm, 'inch', 300), 'Square 20×20 cm (7.87 × 7.87 in)', 'Converted inch unit should include equivalent dimension');
assert.strictEqual(formatPresetLabel(p20cm, 'px', 300), 'Square 20×20 cm (2362 × 2362 px)', 'Converted px unit should include equivalent dimension');
assert.strictEqual(formatPresetLabel(p20cm, 'mm', 300), 'Square 20×20 cm (200 × 200 mm)', 'Converted mm unit should include equivalent dimension');

const pA4 = getPresetById('a4-portrait')!;
assert.strictEqual(formatPresetLabel(pA4, 'inch', 300), 'A4 Portrait (8.27 × 11.69 in)', 'Clean title without redundant parenthesized dimensions');

// Test Cross-Unit findMatchingPreset
assert.strictEqual(findMatchingPreset(20, 20, 'cm')?.id, 'square-20x20-cm', 'Direct unit match');
assert.strictEqual(findMatchingPreset(200, 200, 'mm')?.id, 'square-20x20-cm', 'Cross-unit mm to cm match');
assert.strictEqual(findMatchingPreset(7.87, 7.87, 'inch')?.id, 'square-20x20-cm', 'Cross-unit inch to cm match');
assert.strictEqual(findMatchingPreset(2362, 2362, 'px', 300)?.id, 'square-20x20-cm', 'Cross-unit px to cm match at 300 DPI');
assert.strictEqual(findMatchingPreset(2400, 2400, 'px', 300)?.id, 'square-8x8', 'Cross-unit px to 8x8 inch match at 300 DPI');
assert.strictEqual(findMatchingPreset(25, 25, 'cm'), undefined, 'Non-standard custom dimensions return undefined');

console.log('✓ Presets and Custom Preset lifecycle passed.');

// Test 3: Validation
console.log('Testing Validation...');
const validSettings: ProjectSettings = {
  name: 'My Album',
  canvas: { width: 200, height: 200, unit: 'mm', dpi: 300 },
  spacing: { value: 2, unit: 'mm' },
  margin: { enabled: true, value: 10, unit: 'mm' },
  border: { enabled: false, width: 1, unit: 'mm', color: '#000000' },
  background: { type: 'solid', color: '#FFFFFF' },
};
assert.strictEqual(validateProjectSettings(validSettings).length, 0);

const invalidSettings: ProjectSettings = {
  name: '',
  canvas: { width: -5, height: 100, unit: 'mm', dpi: 300 },
  spacing: { value: 2, unit: 'mm' },
  margin: { enabled: true, value: 10, unit: 'mm' },
  border: { enabled: false, width: 1, unit: 'mm', color: '#000000' },
  background: { type: 'solid', color: '#FFFFFF' },
};
const errs = validateProjectSettings(invalidSettings);
assert.ok(errs.some((e) => e.field === 'name'));
assert.ok(errs.some((e) => e.field === 'canvas.width'));
console.log('✓ Validation passed.');

// Test 4: Photo Domain & Selection
console.log('Testing Photo Domain & Range Selection...');
const samplePhotos: Photo[] = [
  {
    id: '1',
    projectId: 'p1',
    filePath: 'C:/img1.jpg',
    fileName: 'img1.jpg',
    fileSize: 2000,
    width: 1000,
    height: 800,
    format: 'jpg',
    isFavorite: false,
    usedCount: 0,
    isMissing: false,
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  },
  {
    id: '2',
    projectId: 'p1',
    filePath: 'C:/img2.jpg',
    fileName: 'img2.jpg',
    fileSize: 4000,
    width: 2000,
    height: 1600,
    format: 'jpg',
    isFavorite: true,
    usedCount: 2,
    isMissing: false,
    createdAt: '2026-08-02',
    updatedAt: '2026-08-02',
  },
  {
    id: '3',
    projectId: 'p1',
    filePath: 'C:/img3.jpg',
    fileName: 'img3.jpg',
    fileSize: 3000,
    width: 1500,
    height: 1200,
    format: 'jpg',
    isFavorite: false,
    usedCount: 1,
    isMissing: false,
    createdAt: '2026-08-03',
    updatedAt: '2026-08-03',
  },
];

assert.strictEqual(filterPhotos(samplePhotos, 'unused').length, 1);
assert.strictEqual(filterPhotos(samplePhotos, 'used').length, 2);
assert.strictEqual(filterPhotos(samplePhotos, 'favorites').length, 1);
assert.strictEqual(sortPhotos(samplePhotos, 'size')[0].id, '2');

// Test with real-time usedPhotoIds set
const activeUsedSet = new Set(['1']);
assert.strictEqual(filterPhotos(samplePhotos, 'unused', undefined, activeUsedSet).length, 0);
assert.strictEqual(filterPhotos(samplePhotos, 'used', undefined, activeUsedSet).length, 3);

// Test Range Selection
const range = getRangeSelection(samplePhotos, '1', '3', ['1']);
assert.strictEqual(range.length, 3);
assert.ok(range.includes('1'));
assert.ok(range.includes('2'));
assert.ok(range.includes('3'));

console.log('✓ Photo Domain & Range Selection passed.');

// Test 5: Date Formatting Standard (PUEBI / Formal Standard)
console.log('Testing Date Formatting Standard...');
const { formatStandardDate } = await import('../src/services/updateService');
assert.strictEqual(formatStandardDate('2026-09-07T02:27:38Z'), '7 September 2026');
assert.strictEqual(formatStandardDate('2026-09-07 02:27:38 +00:00'), '7 September 2026');
assert.strictEqual(formatStandardDate('2026-01-15'), '15 Januari 2026');
assert.strictEqual(formatStandardDate('7 September 2026'), '7 September 2026');
assert.strictEqual(formatStandardDate(''), '');
assert.strictEqual(formatStandardDate(null), '');
console.log('✓ Date Formatting Standard passed.');

console.log('ALL TESTS PASSED!');
