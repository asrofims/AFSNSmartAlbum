import assert from 'node:assert';
import {
  rangesToTextRuns,
  applyStyleToRange,
  removeStyleRange,
  shiftRangesOnTextEdit,
  StyledRange,
} from '../src/domain/styledRanges';
import {
  createTextNode,
  serializeTextPayload,
  deserializeTextPayload,
  DEFAULT_TEXT_STYLE,
  TextNodeElement,
} from '../src/domain/text';

console.log('Testing Option 2: Clean Plain-Text + Range Selection Model...');

// 1. Text without ranges produces single run
const singleRun = rangesToTextRuns('Puput & Asrofi', undefined, DEFAULT_TEXT_STYLE);
assert.strictEqual(singleRun.length, 1);
assert.strictEqual(singleRun[0].text, 'Puput & Asrofi');
assert.strictEqual(singleRun[0].fontWeight, DEFAULT_TEXT_STYLE.fontWeight);
console.log('✓ Plain text without ranges produces single run.');

// 2. Formatting a word by range (0..5 => "Puput")
const ranges: StyledRange[] = [
  {
    id: 'r1',
    start: 0,
    end: 5,
    fontWeight: 'bold',
    fill: '#f59e0b',
  },
];

const runsWithRange = rangesToTextRuns('Puput & Asrofi', ranges, DEFAULT_TEXT_STYLE);
assert.strictEqual(runsWithRange.length, 2);
assert.strictEqual(runsWithRange[0].text, 'Puput');
assert.strictEqual(runsWithRange[0].fontWeight, 'bold');
assert.strictEqual(runsWithRange[0].fill, '#f59e0b');
assert.strictEqual(runsWithRange[1].text, ' & Asrofi');
assert.strictEqual(runsWithRange[1].fontWeight, DEFAULT_TEXT_STYLE.fontWeight);
console.log('✓ Range slicing for single word verified.');

// 3. Formatting multiple separate words
const multiRanges: StyledRange[] = [
  { id: 'r1', start: 0, end: 5, fontWeight: 'bold', fill: '#f59e0b' },
  { id: 'r2', start: 8, end: 14, fontWeight: 'bold', fill: '#3b82f6', highlight: '#fef08a' },
];

const multiRuns = rangesToTextRuns('Puput & Asrofi', multiRanges, DEFAULT_TEXT_STYLE);
assert.strictEqual(multiRuns.length, 3);
assert.strictEqual(multiRuns[0].text, 'Puput');
assert.strictEqual(multiRuns[0].fill, '#f59e0b');
assert.strictEqual(multiRuns[1].text, ' & ');
assert.strictEqual(multiRuns[1].fill, DEFAULT_TEXT_STYLE.fill);
assert.strictEqual(multiRuns[2].text, 'Asrofi');
assert.strictEqual(multiRuns[2].fill, '#3b82f6');
assert.strictEqual(multiRuns[2].highlight, '#fef08a');
console.log('✓ Multi-word independent range styling verified.');

// 4. Applying range updates (add new, toggle off)
const initial: StyledRange[] = [];
const applied = applyStyleToRange(initial, 6, 13, { fontWeight: 'bold' });
assert.strictEqual(applied.length, 1);
assert.strictEqual(applied[0].start, 6);
assert.strictEqual(applied[0].end, 13);
assert.strictEqual(applied[0].fontWeight, 'bold');

// Toggle off (exact same attributes on same range)
const toggledOff = applyStyleToRange(applied, 6, 13, { fontWeight: 'bold' });
assert.strictEqual(toggledOff.length, 0);
console.log('✓ Range application and toggle-off verified.');

// 5. Remove style range by id
const withTwo = [
  { id: 'r1', start: 0, end: 5, fontWeight: 'bold' as const },
  { id: 'r2', start: 8, end: 14, fontStyle: 'italic' as const },
];
const removed = removeStyleRange(withTwo, 'r1');
assert.strictEqual(removed.length, 1);
assert.strictEqual(removed[0].id, 'r2');
console.log('✓ Range deletion by id verified.');

// 6. Shifting ranges when user types or edits clean plain text
// "Puput & Asrofi" -> Insert "Dear " at index 0 (delta +5)
const shifted = shiftRangesOnTextEdit(withTwo, 0, 0, 5);
assert.strictEqual(shifted[0].start, 5);
assert.strictEqual(shifted[0].end, 10);
assert.strictEqual(shifted[1].start, 13);
assert.strictEqual(shifted[1].end, 19);
console.log('✓ Shifting range coordinates on text edit verified.');

// 7. Serialization and Deserialization with SQLite
const node: TextNodeElement = createTextNode({
  text: 'Puput & Asrofi',
});
node.styledRanges = multiRanges;

const payload = serializeTextPayload(node);
assert.ok(payload.includes('styledRanges'));
assert.ok(payload.includes('#f59e0b'));

const restored = deserializeTextPayload(payload);
assert.strictEqual(restored.text, 'Puput & Asrofi');
assert.strictEqual(restored.styledRanges?.length, 2);
assert.strictEqual(restored.styledRanges?.[0].fill, '#f59e0b');
assert.strictEqual(restored.styledRanges?.[1].highlight, '#fef08a');
console.log('✓ Full persistence serialization & restoration verified.');

console.log('ALL STYLED RANGES TESTS PASSED SUCCESSFULLY! 🎉');
