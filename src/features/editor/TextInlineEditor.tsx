import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { TextNodeElement, DEFAULT_TEXT_STYLE, StyledRange, applyStyleToRange,
  updateRangesForTextChange, getTextRuns, resolveCssFontFamily } from '../../domain/text';
import { Unit, convertPtToUnit, convertUnitToPt } from '../../domain/units';

interface TextInlineEditorProps {
  element: TextNodeElement;
  stageRef: React.RefObject<Konva.Stage | null>;
  scaleFactor: number;
  canvasUnit?: Unit;
  dpi?: number;
  onCommit: (text: string, ranges?: StyledRange[]) => void;
  onCancel: () => void;
}

type Draft = { text: string; ranges: StyledRange[] };
type SelectionOffsets = { start: number; end: number };

function getSelectionOffsets(root: HTMLElement): SelectionOffsets | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  return { start: before.toString().length, end: before.toString().length + range.toString().length };
}

function restoreSelection(root: HTMLElement, offsets: SelectionOffsets) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const locate = (offset: number): [Node, number] => {
    for (const node of nodes) {
      if (offset <= node.length) return [node, offset];
      offset -= node.length;
    }
    const last = nodes[nodes.length - 1];
    return last ? [last, last.length] : [root, 0];
  };
  const range = document.createRange();
  range.setStart(...locate(offsets.start));
  range.setEnd(...locate(offsets.end));
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function TextInlineEditor({ element, stageRef, scaleFactor, canvasUnit = 'mm', dpi = 300, onCommit, onCancel }: TextInlineEditorProps) {
  const [draft, setDraft] = useState<Draft>({ text: element.text || '', ranges: element.styledRanges || [] });
  const draftRef = useRef(draft);
  const rootRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const composing = useRef(false);
  const selectionRef = useRef<SelectionOffsets>({ start: 0, end: draft.text.length });
  const past = useRef<Draft[]>([]);
  const future = useRef<Draft[]>([]);
  const style = { ...DEFAULT_TEXT_STYLE, ...element.style };
  const unit = canvasUnit;
  const internalScale = 4;
  const visualScale = convertPtToUnit(1, unit, dpi) * scaleFactor / internalScale;
  const width = convertUnitToPt(element.width, unit, dpi) * internalScale;
  const height = convertUnitToPt(element.height, unit, dpi) * internalScale;
  const node = stageRef.current?.findOne(`#${element.id}`);
  const pos = node?.getAbsolutePosition() || { x: element.x * scaleFactor, y: element.y * scaleFactor };
  const rotation = node?.getAbsoluteRotation() ?? element.rotation;

  const updateDraft = (next: Draft, selection?: SelectionOffsets) => {
    if (JSON.stringify(next) !== JSON.stringify(draftRef.current)) {
      past.current.push(draftRef.current);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
    }
    draftRef.current = next;
    if (selection) selectionRef.current = selection;
    setDraft(next);
  };
  const readInput = () => {
    const root = rootRef.current;
    if (!root || composing.current) return;
    const text = root.textContent || '';
    const selection = getSelectionOffsets(root) || { start: text.length, end: text.length };
    updateDraft({ text, ranges: updateRangesForTextChange(draftRef.current.ranges, draftRef.current.text, text) }, selection);
  };
  const commit = () => {
    if (done.current || composing.current) return;
    done.current = true;
    onCommit(draftRef.current.text, draftRef.current.ranges);
  };
  const cancel = () => { if (!done.current) { done.current = true; onCancel(); } };

  // Own the editable DOM explicitly. Never parse or inject user-supplied HTML.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || composing.current) return;
    const fragment = document.createDocumentFragment();
    const runs = getTextRuns(draft.text, style, draft.ranges);
    // Legacy markup remains editable as source until it is explicitly converted.
    const displayRuns = runs.map((run) => run.text).join('') === draft.text ? runs : [{ ...style, text: draft.text }];
    for (const run of displayRuns) {
      const span = document.createElement('span');
      span.textContent = run.text;
      Object.assign(span.style, {
        fontFamily: resolveCssFontFamily(run.fontFamily || style.fontFamily),
        fontSize: `${(run.fontSize || style.fontSize) * internalScale}px`,
        fontWeight: run.fontWeight || style.fontWeight,
        fontStyle: run.fontStyle || style.fontStyle,
        textDecoration: run.textDecoration || style.textDecoration,
        color: run.fill || style.fill,
        backgroundColor: run.highlight || 'transparent',
      });
      fragment.appendChild(span);
    }
    if (!fragment.childNodes.length) fragment.appendChild(document.createTextNode(''));
    root.replaceChildren(fragment);
    restoreSelection(root, selectionRef.current);
  }, [draft]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    if (rootRef.current) restoreSelection(rootRef.current, selectionRef.current);
  }, []);

  const insertText = (text: string) => {
    const root = rootRef.current;
    if (!root) return;
    const selection = getSelectionOffsets(root) || selectionRef.current;
    const previous = draftRef.current;
    const nextText = previous.text.slice(0, selection.start) + text + previous.text.slice(selection.end);
    const cursor = selection.start + text.length;
    updateDraft({ text: nextText, ranges: updateRangesForTextChange(previous.ranges, previous.text, nextText) }, { start: cursor, end: cursor });
  };
  const format = (patch: Partial<Omit<StyledRange, 'id' | 'start' | 'end'>>) => {
    const selection = rootRef.current && getSelectionOffsets(rootRef.current);
    if (!selection || selection.start === selection.end) return;
    updateDraft({ ...draftRef.current, ranges: applyStyleToRange(draftRef.current.ranges, selection.start, selection.end, patch) }, selection);
  };

  return <div style={{ position: 'absolute', inset: 0, zIndex: 50 }} onPointerDown={(event) => {
    if (event.target === event.currentTarget) commit();
  }}>
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, width: element.width * scaleFactor,
      height: element.height * scaleFactor, transform: `rotate(${rotation}deg)`, transformOrigin: 'top left',
      outline: '1px solid var(--color-accent)', background: 'rgba(15,23,42,0.08)' }}>
      <div style={{ width, minHeight: height, height: style.autoSize === 'height' ? undefined : height,
        transform: `scale(${visualScale})`, transformOrigin: 'top left', boxSizing: 'border-box',
        padding: style.padding * internalScale, display: 'flex', flexDirection: 'column', overflow: 'auto',
        justifyContent: style.verticalAlign === 'middle' ? 'safe center' : style.verticalAlign === 'bottom' ? 'safe flex-end' : 'flex-start' }}>
        <div ref={rootRef} role="textbox" aria-label="Edit album text" aria-multiline="true" contentEditable={!element.locked}
          suppressContentEditableWarning spellCheck={false}
          onInput={readInput}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; readInput(); }}
          onBeforeInput={(event) => {
            const input = event.nativeEvent as InputEvent;
            if (!composing.current && (input.inputType === 'insertParagraph' || input.inputType === 'insertLineBreak')) {
              event.preventDefault(); insertText('\n');
            }
          }}
          onPaste={(event) => { event.preventDefault(); insertText(event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')); }}
          onDrop={(event) => event.preventDefault()}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.nativeEvent.isComposing || composing.current) return;
            const mod = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();
            if (key === 'escape') { event.preventDefault(); cancel(); }
            else if (key === 'enter') { event.preventDefault(); if (mod) commit(); else insertText('\n'); }
            else if (mod && ['b', 'i', 'u'].includes(key)) {
              event.preventDefault();
              format(key === 'b' ? { fontWeight: 'bold' } : key === 'i' ? { fontStyle: 'italic' } : { textDecoration: 'underline' });
            } else if (mod && (key === 'z' || key === 'y')) {
              event.preventDefault();
              const redo = key === 'y' || event.shiftKey;
              const source = redo ? future : past;
              const destination = redo ? past : future;
              const next = source.current.pop();
              if (next) {
                destination.current.push(draftRef.current);
                draftRef.current = next;
                selectionRef.current = { start: next.text.length, end: next.text.length };
                setDraft(next);
              }
            }
          }}
          style={{ flexShrink: 0, minHeight: style.fontSize * style.lineHeight * internalScale,
            fontFamily: resolveCssFontFamily(style.fontFamily), fontSize: style.fontSize * internalScale,
            lineHeight: style.lineHeight, letterSpacing: style.letterSpacing * internalScale,
            textAlign: style.align, whiteSpace: style.wordWrap === 'none' ? 'pre' : 'pre-wrap',
            overflowWrap: 'anywhere', wordBreak: style.wordWrap === 'char' ? 'break-all' : 'normal',
            color: style.fill, outline: 'none', caretColor: 'var(--color-accent)' }} />
      </div>
      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 5, whiteSpace: 'nowrap', fontSize: 10,
        color: '#cbd5e1', background: '#0f172a', padding: '3px 6px', pointerEvents: 'none' }}>
        Ctrl+Enter apply · Esc cancel
      </div>
    </div>
  </div>;
}
