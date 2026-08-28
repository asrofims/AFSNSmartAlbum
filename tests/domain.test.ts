import assert from 'node:assert';
import { convertUnit, toPixels, fromPixels, formatDimensions } from '../src/domain/units';
import { ALBUM_PRESETS, findMatchingPreset } from '../src/domain/presets';
import { validateProjectSettings, DEFAULT_PROJECT_SETTINGS } from '../src/domain/project';

console.log('Testing Unit Conversions...');

// mm to cm
assert.strictEqual(convertUnit(10, 'mm', 'cm'), 1);
assert.strictEqual(convertUnit(210, 'mm', 'cm'), 21);

// inch to mm
assert.strictEqual(convertUnit(1, 'inch', 'mm'), 25.4);
assert.strictEqual(convertUnit(8, 'inch', 'mm'), 203.2);

// cm to inch
assert.strictEqual(convertUnit(2.54, 'cm', 'inch'), 1);

// Pixels at 300 DPI
assert.strictEqual(toPixels(1, 'inch', 300), 300);
assert.strictEqual(fromPixels(300, 'inch', 300), 1);

// Format dimensions
assert.strictEqual(formatDimensions(8, 8, 'inch'), '8 × 8 in');
assert.strictEqual(formatDimensions(210, 297, 'mm'), '210 × 297 mm');

console.log('✓ Unit conversions passed.');

console.log('Testing Presets...');
assert.strictEqual(ALBUM_PRESETS.length, 7);
const square = findMatchingPreset(8, 8, 'inch');
assert.ok(square);
assert.strictEqual(square.id, 'square-8x8');

console.log('✓ Presets passed.');

console.log('Testing Validation...');
const valid = validateProjectSettings(DEFAULT_PROJECT_SETTINGS);
assert.strictEqual(valid.length, 0);

const invalid = validateProjectSettings({
  ...DEFAULT_PROJECT_SETTINGS,
  name: '',
  canvas: { ...DEFAULT_PROJECT_SETTINGS.canvas, width: -1 },
});
assert.strictEqual(invalid.length, 2);
console.log('✓ Validation passed.');

console.log('Testing Photo Domain...');
import { formatFileSize, filterPhotos, sortPhotos, Photo } from '../src/domain/photo';

assert.strictEqual(formatFileSize(1024), '1.0 KB');
assert.strictEqual(formatFileSize(1048576 * 5.5), '5.5 MB');

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
];

assert.strictEqual(filterPhotos(samplePhotos, 'unused').length, 1);
assert.strictEqual(filterPhotos(samplePhotos, 'used').length, 1);
assert.strictEqual(filterPhotos(samplePhotos, 'favorites').length, 1);
assert.strictEqual(sortPhotos(samplePhotos, 'size')[0].id, '2');
console.log('✓ Photo Domain passed.');

console.log('ALL TESTS PASSED!');
