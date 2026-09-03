import assert from 'node:assert';
import {
  createTextNode,
  editTextNode,
  applyTextPreset,
  serializeTextPayload,
  deserializeTextPayload,
  isTextElement,
  TEXT_PRESETS,
  DEFAULT_TEXT_STYLE,
} from '../src/domain/text';
import { convertPtToUnit, ptToScreenPx } from '../src/domain/units';

console.log('Testing Text Domain Model & Helpers...');

// 1. Creation with defaults
const defaultNode = createTextNode({});
assert.strictEqual(defaultNode.type, 'text');
assert.strictEqual(defaultNode.text, 'Add your text here');
assert.strictEqual(defaultNode.style.fontFamily, 'Inter');
assert.strictEqual(defaultNode.style.fontSize, 24);
assert.strictEqual(defaultNode.style.align, 'center');
assert.strictEqual(isTextElement(defaultNode), true);
assert.strictEqual(isTextElement({ type: 'photo' }), false);

// 2. Creation with preset
const titleNode = createTextNode({ preset: 'title' });
assert.strictEqual(titleNode.text, TEXT_PRESETS.title.defaultText);
assert.strictEqual(titleNode.style.fontFamily, 'Playfair Display');
assert.strictEqual(titleNode.style.fontWeight, 'bold');
assert.strictEqual(titleNode.width, TEXT_PRESETS.title.defaultWidth);

// 3. Edit text
const editedNode = editTextNode(titleNode, 'Our Summer Holiday');
assert.strictEqual(editedNode.text, 'Our Summer Holiday');
assert.strictEqual(editedNode.style.fontFamily, 'Playfair Display');

// 4. Apply preset to existing node
const captionNode = applyTextPreset(defaultNode, 'caption');
assert.strictEqual(captionNode.style.fontStyle, 'italic');
assert.strictEqual(captionNode.style.fontSize, 11);

// 5. Serialize and Deserialize payload
const payloadStr = serializeTextPayload(titleNode);
assert.ok(payloadStr.includes('Playfair Display'));
const restored = deserializeTextPayload(payloadStr);
assert.strictEqual(restored.text, titleNode.text);
assert.strictEqual(restored.style.fontFamily, 'Playfair Display');
assert.strictEqual(restored.style.fontWeight, 'bold');

// 6. Deserialize fallback handling
const fallbackRes = deserializeTextPayload(null, 'My Fallback');
assert.strictEqual(fallbackRes.text, 'My Fallback');
assert.strictEqual(fallbackRes.style.fontFamily, DEFAULT_TEXT_STYLE.fontFamily);

// 7. Point-to-Unit physical conversion math
const pt24InMm = convertPtToUnit(24, 'mm');
assert.ok(Math.abs(pt24InMm - 8.4667) < 0.01, '24pt in mm must be ~8.47mm');

const pt24InInches = convertPtToUnit(24, 'inch');
assert.ok(Math.abs(pt24InInches - 0.3333) < 0.01, '24pt in inches must be 1/3 inch');

const pt24InPx = convertPtToUnit(24, 'px', 300);
assert.strictEqual(pt24InPx, 100, '24pt at 300 DPI must be 100px');

// Screen pixel rendering must be identical regardless of whether project unit is mm, cm, inch, or px
const scaleFactorMm = 1.5; // 900px / 600mm
const screenPxFromMm = ptToScreenPx(24, 'mm', 300, scaleFactorMm);

const scaleFactorInch = 37.5; // 900px / 24 inches
const screenPxFromInch = ptToScreenPx(24, 'inch', 300, scaleFactorInch);

assert.strictEqual(screenPxFromMm, screenPxFromInch, 'Screen pixel font size must match across physical units');

// 8. 1pt fine-print font size validation
const pt1InMm = convertPtToUnit(1, 'mm');
assert.ok(pt1InMm > 0, '1pt in mm must be positive');
const screenPx1Pt = ptToScreenPx(1, 'mm', 300, 1.5);
assert.ok(screenPx1Pt >= 1, '1pt font size on screen must render at least 1px');

// 9. Text persistence under auto-save sanitization
const textNode: TextNodeElement = createTextNode({ text: 'Wedding Album 2026', style: { fontSize: 32, fontWeight: 'bold' } });
const payload = serializeTextPayload(textNode);
const restoredAutoSave = deserializeTextPayload(payload);
assert.strictEqual(restoredAutoSave.text, 'Wedding Album 2026', 'Text content must be preserved across save/restore');
assert.strictEqual(restoredAutoSave.style.fontSize, 32, 'Font size must be preserved across save/restore');
assert.strictEqual(restoredAutoSave.style.fontWeight, 'bold', 'Font weight must be preserved across save/restore');

console.log('✓ All Text Domain unit tests passed successfully!');
