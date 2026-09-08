import assert from 'node:assert/strict';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { createInitialAlbum } from '../src/domain/album';
import { createTextNode, calculateTextFitDimensions, fitTextFrame, getTextRuns, layoutRichText,
  updateTextNode, DEFAULT_TEXT_STYLE, serializeTextPayload, updateRangesForTextChange } from '../src/domain/text';
import { convertPtToUnit, convertUnitToPt, ptToScreenPx, Unit } from '../src/domain/units';
import { useAlbumStore } from '../src/stores/albumStore';
import { useProjectStore } from '../src/stores/projectStore';
import { useEditorStore } from '../src/stores/editorStore';
import { useHistoryStore } from '../src/stores/historyStore';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
const text = 'A large word followed by a small paragraph with several wrapped lines.';
const ranges = [{ id: 'large', start: 2, end: 7, fontSize: 36, fontWeight: 'bold' as const }];
const style = { ...DEFAULT_TEXT_STYLE, fontSize: 14, letterSpacing: 0.7 };

for (const unit of ['mm', 'cm', 'inch', 'px'] as Unit[]) {
  const width = convertPtToUnit(180, unit, 300);
  const fit = calculateTextFitDimensions(text, style, unit, 300, width, undefined, ranges);
  const layout = layoutRichText(getTextRuns(text, style, ranges), style, 180, 1e6, 72, 'inch', 300);
  close(convertUnitToPt(fit.height, unit, 300), layout.totalHeight + style.padding * 2);
  assert.equal(fit.lineCount, layout.lines.length);
  const node = createTextNode({ text, style, width, height: fit.height, unit });
  node.styledRanges = ranges;
  for (const rotation of [0, 45, 90, 180]) {
    node.rotation = rotation;
    const fitted = { ...node, ...fitTextFrame(node, 'content', unit, 300) };
    const twice = { ...fitted, ...fitTextFrame(fitted, 'content', unit, 300) };
    close(twice.width, fitted.width);
    close(twice.height, fitted.height);
    close(twice.x, fitted.x);
    close(twice.y, fitted.y);
  }
  // 24 pt occupies the same number of display pixels at an equivalent viewport.
  close(ptToScreenPx(24, unit, 300, 3 / convertPtToUnit(1, unit, 300)), 72);
}

const plain = { ...DEFAULT_TEXT_STYLE, fontSize: 12, padding: 0 };
const layout = (value: string, overrides = {}) => layoutRichText(getTextRuns(value, { ...plain, ...overrides }),
  { ...plain, ...overrides }, 60, 1000, 72, 'inch', 300);
assert.equal(layout('A \nB').lines.length, 2, 'Whitespace before newline must not swallow a paragraph break');
assert.equal(layout('A\n\nB\n').lines.length, 4, 'Empty and trailing paragraphs must survive');
assert.ok(layout('ABCDEFGHIJKLMNOPQRSTUVWXYZ').lines.length > 1, 'Unbroken words must wrap in narrow frames');
assert.equal(layout('ABCDEFGHIJKLMNOPQRSTUVWXYZ', { wordWrap: 'none' }).lines.length, 1);
assert.ok(layout('ABCDEFGHIJKLMNOPQRSTUVWXYZ', { wordWrap: 'none' }).overflow);
assert.ok(layout('ABCD', { letterSpacing: 2 }).totalWidth > layout('ABCD').totalWidth);
assert.ok(layout('ABCD', { letterSpacing: -1 }).totalWidth < layout('ABCD').totalWidth);
assert.equal(calculateTextFitDimensions('one two three', { ...plain, wordWrap: 'none' }, 'inch', 300, 0.2).lineCount, 1);

const framed = createTextNode({ text: 'Hello', style: { align: 'center', verticalAlign: 'middle' }, width: 100, height: 80 });
framed.rotation = 90;
const fit = fitTextFrame(framed, 'height', 'mm', 300);
close(fit.y!, framed.y);
close(fit.x!, framed.x - (framed.height - fit.height!) / 2);
const edited = updateTextNode(framed, { text: 'Longer '.repeat(50) }, 'mm', 300);
assert.equal(edited.height, framed.height, 'Fixed frames must not resize on content edits');
const auto = updateTextNode(edited, { style: { autoSize: 'height' } }, 'mm', 300);
assert.ok(auto.height > edited.height);
assert.equal(updateTextNode({ ...framed, locked: true }, { text: 'changed' }, 'mm', 300).text, framed.text);
assert.deepEqual(fitTextFrame({ ...framed, locked: true }, 'content', 'mm', 300), {});

const bold = [{ id: 'b', start: 6, end: 11, fontWeight: 'bold' as const }];
const moved = updateRangesForTextChange(bold, 'Hello world', 'Hello Xworld');
assert.deepEqual([moved[0].start, moved[0].end], [7, 12], 'Insertion before a styled range keeps original text styled');
const removed = updateRangesForTextChange(bold, 'Hello world', 'Hello');
assert.equal(removed.length, 0);
const unicode = updateRangesForTextChange([{ ...bold[0], start: 2, end: 3 }], '😀A', '😀XA');
assert.deepEqual([unicode[0].start, unicode[0].end], [3, 4]);

// Exercise the real store hydration/save path with only the native transport mocked.
(globalThis as any).window = {};
let payload: any;
let saved: any;
mockIPC((command, args) => {
  if (command === 'load_album_structure') return payload;
  if (command === 'save_album_structure') { saved = args; return null; }
  return null;
});
for (const unit of ['mm', 'cm', 'inch', 'px'] as Unit[]) {
  const project: any = { id: 'text-regression', name: 'Text regression', canvasUnit: unit, canvasDpi: 300,
    canvasWidth: convertPtToUnit(576, unit, 300), canvasHeight: convertPtToUnit(576, unit, 300),
    marginValue: 10, marginUnit: 'mm', spacingValue: 3, spacingUnit: 'mm', backgroundColor: '#fff' };
  useProjectStore.setState({ currentProject: project });
  useAlbumStore.getState().initializeAlbum(project);
  const originalAlbum = useAlbumStore.getState().currentAlbum!;
  const spreadId = originalAlbum.spreads[0].id;
  const editor = useEditorStore.getState();
  const id = editor.addTextToSpread(spreadId, { text: 'Hello world', preset: 'title' });
  const created: any = useAlbumStore.getState().currentAlbum!.spreads[0].elements[0];
  assert.ok(created.y >= 0 && created.y + created.height <= project.canvasHeight);
  assert.ok(created.x >= project.canvasWidth && created.x + created.width <= project.canvasWidth * 2);
  assert.equal(created.style.fontFamily, 'Playfair Display');
  editor.updateTextElement(spreadId, id, { styledRanges: bold });
  const album = useAlbumStore.getState().currentAlbum!;
  const stored: any = album.spreads[0].elements[0];
  payload = JSON.parse(JSON.stringify(album));
  payload.spreads[0].elements = [{ ...stored, styledRanges: undefined, style: undefined, textPayload: serializeTextPayload(stored) }];
  assert.equal(await useAlbumStore.getState().loadAlbumFromDb(project.id), true);
  const loaded: any = useAlbumStore.getState().currentAlbum!.spreads[0].elements[0];
  assert.deepEqual(loaded.styledRanges, bold);
  assert.equal(loaded.style.fontFamily, stored.style.fontFamily);

  const history = useHistoryStore.getState();
  history.clearHistory();
  const before = useAlbumStore.getState().currentAlbum!;
  history.pushState(before); // once, at the first panel/slider change
  editor.updateTextElement(spreadId, id, { text: 'Draft one' }, true);
  editor.updateTextElement(spreadId, id, { text: 'Draft two' }, true);
  const after = useAlbumStore.getState().currentAlbum!;
  assert.equal((history.undo(after)!.spreads[0].elements[0] as any).text, 'Hello world');
  assert.equal((history.redo(before)!.spreads[0].elements[0] as any).text, 'Draft two');
  // Empty/no-op changes and locked text must not dirty the album or append history.
  const lockedAlbum = createInitialAlbum(project);
  lockedAlbum.spreads[0].elements = [{ ...loaded, locked: true }];
  useAlbumStore.setState({ currentAlbum: lockedAlbum, saveStatus: 'saved' });
  editor.updateTextElement(lockedAlbum.spreads[0].id, id, { text: 'forbidden' });
  assert.equal(useAlbumStore.getState().currentAlbum, lockedAlbum);
  assert.equal(useAlbumStore.getState().saveStatus, 'saved');
}
void saved;
clearMocks();
console.log('✓ Typography regressions passed: units, fitting, rotation, wrapping, ranges, load, placement, lock and history.');
