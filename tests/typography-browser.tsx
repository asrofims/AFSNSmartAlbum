import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Stage, Layer, Transformer } from 'react-konva';
import Konva from 'konva';
import { TextNode } from '../src/features/editor/TextNode';
import { TextInlineEditor } from '../src/features/editor/TextInlineEditor';
import { loadAlbumFonts } from '../src/domain/bundledFonts';
import { createTextNode, DEFAULT_TEXT_STYLE, fitTextFrame, layoutRichText, getTextRuns, calculateTextFitDimensions } from '../src/domain/text';
import { convertUnitToPt, convertPtToUnit } from '../src/domain/units';

await loadAlbumFonts();
const failures: string[] = [];
let assertions = 0;
const check = (condition: boolean, label: string) => { assertions++; if (!condition) failures.push(label); };
for (const family of ['Inter', 'Playfair Display', 'Cinzel', 'Great Vibes', 'Montserrat', 'Cormorant Garamond']) {
  for (const text of ['Enjoying joy, laughter and high energy', 'A \nB\n', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Hello 😀 world', 'A small word and a LARGE word']) {
    const style = { ...DEFAULT_TEXT_STYLE, fontFamily: family, fontSize: 24, letterSpacing: 1.5 };
    const ranges = [{ id: 'large', start: 2, end: 7, fontSize: 36 }];
    for (const unit of ['mm', 'cm', 'inch', 'px'] as const) {
      const fit = calculateTextFitDimensions(text, style, unit, 300, convertPtToUnit(200, unit, 300), undefined, ranges);
      const widthPt = convertUnitToPt(fit.width, unit, 300);
      const heightPt = convertUnitToPt(fit.height, unit, 300);
      const layout = layoutRichText(getTextRuns(text, style, ranges), style, widthPt, heightPt, 72, 'inch', 300);
      check(!layout.overflow, `${family}: ${unit}: fitted text must not overflow: ${text}`);
      const twice = calculateTextFitDimensions(text, style, unit, 300, fit.width, undefined, ranges);
      check(Math.abs(convertUnitToPt(twice.height - fit.height, unit, 300)) < 0.01, `${family}: fitting twice must not change height`);
    }
  }
}

function Harness() {
  const [element, setElement] = useState(() => ({ ...createTextNode({ text: 'Hello beautiful world', x: 20, y: 20,
    width: 120, height: 65, style: { fontFamily: 'Inter', fontSize: 24, verticalAlign: 'middle' } }),
    styledRanges: [{ id: 'bold', start: 6, end: 15, fontWeight: 'bold' as const, fill: '#b91c1c' }] }));
  const [editing, setEditing] = useState(false);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => {
    const node = stage.current?.findOne(`#${element.id}`);
    if (node && transformer.current) transformer.current.nodes(editing ? [] : [node]);
  }, [element, editing]);
  return <main style={{ fontFamily: 'Inter', padding: 20, background: '#e2e8f0' }}>
    <h1>Typography regression harness</h1>
    <p role="status">{failures.length ? `${failures.length} failures: ${failures.join('; ')}` : `${assertions} real-canvas assertions passed`}</p>
    <button onClick={() => setEditing(true)}>Edit Text</button>{' '}
    <button onClick={() => setElement((value) => ({ ...value, ...fitTextFrame(value, 'height', 'mm', 300) }))}>Fit Height</button>{' '}
    <button onClick={() => setElement((value) => ({ ...value, ...fitTextFrame(value, 'content', 'mm', 300) }))}>Fit Content</button>{' '}
    <button onClick={() => setElement((value) => ({ ...value, rotation: (value.rotation + 45) % 360 }))}>Rotate</button>
    <div style={{ position: 'relative', width: 850, height: 430, background: '#fff', marginTop: 12 }}>
      <Stage width={850} height={430} ref={stage}><Layer>
        <TextNode element={element} isSelected isEditing={editing} scaleFactor={4} canvasUnit="mm" dpi={300}
          onSelect={() => {}} onDragMove={() => {}} onDragEnd={(e) => setElement((value) => ({ ...value, x: e.target.x() / 4, y: e.target.y() / 4 }))}
          onDoubleClick={() => setEditing(true)} onElementChange={(patch) => setElement((value) => ({ ...value, ...patch }))} />
        <Transformer ref={transformer} keepRatio rotateEnabled onTransformStart={() => {
          const anchor = transformer.current?.getActiveAnchor();
          transformer.current?.keepRatio(Boolean(anchor?.includes('left') || anchor?.includes('right')) && !anchor?.includes('middle'));
        }} />
      </Layer></Stage>
      {editing && <TextInlineEditor element={element} stageRef={stage} scaleFactor={4} canvasUnit="mm" dpi={300}
        onCommit={(text, ranges) => { setElement((value) => ({ ...value, text, styledRanges: ranges || [] })); setEditing(false); }}
        onCancel={() => setEditing(false)} />}
    </div>
    <pre aria-label="Current text state">{JSON.stringify(element, null, 2)}</pre>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
