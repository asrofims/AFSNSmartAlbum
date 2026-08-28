import assert from 'node:assert';
import {
  convertUnit,
  toPixels,
  fromPixels,
  formatDimensions,
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
console.log('✓ Unit conversions passed.');

// Test 2: Presets
console.log('Testing Presets...');
assert.ok(ALBUM_PRESETS.length > 0);
const standardPreset = getPresetById('square-8x8');
assert.ok(standardPreset !== undefined);
assert.strictEqual(standardPreset?.width, 8);
assert.strictEqual(standardPreset?.height, 8);
console.log('✓ Presets passed.');

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

// Test Range Selection
const range = getRangeSelection(samplePhotos, '1', '3', ['1']);
assert.strictEqual(range.length, 3);
assert.ok(range.includes('1'));
assert.ok(range.includes('2'));
assert.ok(range.includes('3'));

console.log('✓ Photo Domain & Range Selection passed.');

console.log('ALL TESTS PASSED!');
