import assert from 'node:assert';
import {
  hasRichTextMarkup,
  parseRichTextRuns,
  stripRichTextMarkup,
  wrapSelectionWithMarkup,
  layoutRichText,
  calculateTextFitHeight,
  DEFAULT_TEXT_STYLE,
  TextStyle,
} from '../src/domain/text';

console.log('Testing Phase 5: Rich Text Domain & Layout Engine...');

// 1. Detection of Rich Text Markup
assert.strictEqual(hasRichTextMarkup('Plain simple text'), false);
assert.strictEqual(hasRichTextMarkup('Our **Wedding** Day'), true);
assert.strictEqual(hasRichTextMarkup('Chapter One: *The Beginning*'), true);
assert.strictEqual(hasRichTextMarkup('Please __sign here__'), true);
assert.strictEqual(hasRichTextMarkup('Price: ~~100~~ 50'), true);
assert.strictEqual(hasRichTextMarkup('Hello {color:#3b82f6}Blue{/color} World'), true);
assert.strictEqual(hasRichTextMarkup('Important: {highlight:#fef08a}Save the Date{/highlight}'), true);
assert.strictEqual(hasRichTextMarkup('Title in {font:Cinzel}Elegance{/font}'), true);
assert.strictEqual(hasRichTextMarkup('A {size:40}Big{/size} moment'), true);
console.log('✓ Fast-path rich markup detection verified.');

// 2. Parsing plain text into single run
const plainRuns = parseRichTextRuns('Hello World', DEFAULT_TEXT_STYLE);
assert.strictEqual(plainRuns.length, 1);
assert.strictEqual(plainRuns[0].text, 'Hello World');
assert.strictEqual(plainRuns[0].fontWeight, 'normal');
assert.strictEqual(plainRuns[0].fill, DEFAULT_TEXT_STYLE.fill);

// 3. Parsing **bold** and *italic*
const boldRuns = parseRichTextRuns('Our **Wedding** Day', DEFAULT_TEXT_STYLE);
assert.strictEqual(boldRuns.length, 3);
assert.strictEqual(boldRuns[0].text, 'Our ');
assert.strictEqual(boldRuns[0].fontWeight, 'normal');
assert.strictEqual(boldRuns[1].text, 'Wedding');
assert.strictEqual(boldRuns[1].fontWeight, 'bold');
assert.strictEqual(boldRuns[2].text, ' Day');
assert.strictEqual(boldRuns[2].fontWeight, 'normal');
console.log('✓ Bold and plain run separation verified.');

// 4. Parsing underline and strikethrough
const decRuns = parseRichTextRuns('__Underline__ and ~~Strike~~', DEFAULT_TEXT_STYLE);
assert.strictEqual(decRuns.length, 3);
assert.strictEqual(decRuns[0].text, 'Underline');
assert.strictEqual(decRuns[0].textDecoration, 'underline');
assert.strictEqual(decRuns[1].text, ' and ');
assert.strictEqual(decRuns[1].textDecoration, 'none');
assert.strictEqual(decRuns[2].text, 'Strike');
assert.strictEqual(decRuns[2].textDecoration, 'line-through');
console.log('✓ Underline and strikethrough decorations verified.');

// 5. Parsing custom color and background highlight per kata
const colorHlRuns = parseRichTextRuns(
  'A {color:#ef4444}Red Word{/color} and {highlight:#fef08a}Yellow Highlight{/highlight}!',
  DEFAULT_TEXT_STYLE
);
assert.strictEqual(colorHlRuns.length, 5);
assert.strictEqual(colorHlRuns[0].text, 'A ');
assert.strictEqual(colorHlRuns[1].text, 'Red Word');
assert.strictEqual(colorHlRuns[1].fill, '#ef4444');
assert.strictEqual(colorHlRuns[2].text, ' and ');
assert.strictEqual(colorHlRuns[3].text, 'Yellow Highlight');
assert.strictEqual(colorHlRuns[3].highlight, '#fef08a');
assert.strictEqual(colorHlRuns[4].text, '!');
console.log('✓ Color and background highlight per-word verified.');

// 6. Nested formatting: **{color:#3b82f6}Bold and Blue{/color}**
const nestedRuns = parseRichTextRuns('**{color:#3b82f6}Bold Blue{/color}**', DEFAULT_TEXT_STYLE);
assert.strictEqual(nestedRuns.length, 1);
assert.strictEqual(nestedRuns[0].text, 'Bold Blue');
assert.strictEqual(nestedRuns[0].fontWeight, 'bold');
assert.strictEqual(nestedRuns[0].fill, '#3b82f6');
console.log('✓ Nested tags styling verified.');

// 7. Strip markup helper
const clean = stripRichTextMarkup('**Hello** {color:blue}World{/color}!');
assert.strictEqual(clean, 'Hello World!');
console.log('✓ Strip rich text markup verified.');

// 8. Selection wrapping helper (Toolbar / Shortcut action)
const wrapped = wrapSelectionWithMarkup('Hello World', 6, 11, '**', '**');
assert.strictEqual(wrapped.newText, 'Hello **World**');

// Toggle unwrap when already wrapped
const unwrapped = wrapSelectionWithMarkup('Hello **World**', 6, 15, '**', '**');
assert.strictEqual(unwrapped.newText, 'Hello World');

// Zero-length selection insertion
const inserted = wrapSelectionWithMarkup('Hello ', 6, 6, '**', '**');
assert.strictEqual(inserted.newText, 'Hello ****');
assert.strictEqual(inserted.newStart, 8); // cursor positioned inside the asterisks
console.log('✓ Selection wrapping and unwrapping toggles verified.');

// 9. Layout engine tokenization & line wrapping
const runsForLayout = parseRichTextRuns('The quick brown fox jumps over the lazy dog', DEFAULT_TEXT_STYLE);
const layoutNarrow = layoutRichText(runsForLayout, DEFAULT_TEXT_STYLE, 180, 200, 1.5, 'mm', 300);
assert.ok(layoutNarrow.lines.length >= 2, 'Narrow width must wrap into multiple lines');
assert.ok(layoutNarrow.totalHeight > 0, 'Total layout height must be positive');
console.log('✓ Multi-line word-wrapping layout verified.');

// 10. Auto-fit height calculation with rich text
const fitHeight = calculateTextFitHeight(
  '**Title One**\n{size:36}Subtitle Big{/size}\nCaption small',
  DEFAULT_TEXT_STYLE,
  120,
  'mm',
  300
);
assert.ok(fitHeight > 0, 'Calculated fit height must be positive');
assert.ok(fitHeight < 500, 'Calculated fit height must be within realistic bounds');
console.log('✓ Rich text auto-fit height calculation verified.');

console.log('ALL RICH TEXT DOMAIN TESTS PASSED SUCCESSFULLY! 🎉');
