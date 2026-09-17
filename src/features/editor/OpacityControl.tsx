import { useEffect, useRef, useState } from 'react';
import type { AlbumElement } from '../../domain/album';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useHistoryStore } from '../../stores/historyStore';
import styles from './OpacityControl.module.css';

interface OpacityControlProps {
  spreadId: string;
  elements: AlbumElement[];
}

export function OpacityControl({ spreadId, elements }: OpacityControlProps) {
  const setSelectedOpacity = useEditorStore((state) => state.setSelectedOpacity);
  const editable = elements.filter((element) => !element.locked);
  const disabled = editable.length === 0;
  const displayed = disabled ? elements : editable;
  const rawValue = displayed[0]?.opacity;
  const value = typeof rawValue === 'number' && Number.isFinite(rawValue)
    ? Math.max(0, Math.min(1, rawValue)) : 1;
  const mixed = displayed.some((element) => Math.abs((element.opacity ?? 1) - value) > 1e-9);
  const percent = Math.round(value * 100);
  const [draft, setDraft] = useState(mixed ? '' : String(percent));
  const numberFocused = useRef(false);
  const cancelNumber = useRef(false);
  const pointerGesture = useRef(false);
  const historyCaptured = useRef(false);

  useEffect(() => {
    if (!numberFocused.current) setDraft(mixed ? '' : String(percent));
  }, [mixed, percent, elements]);

  const endGesture = () => {
    pointerGesture.current = false;
    historyCaptured.current = false;
  };

  const changeFromSlider = (nextPercent: number) => {
    const nextOpacity = nextPercent / 100;
    if (pointerGesture.current) {
      if (!historyCaptured.current && editable.some((element) => (element.opacity ?? 1) !== nextOpacity)) {
        const album = useAlbumStore.getState().currentAlbum;
        if (album) useHistoryStore.getState().pushState(album);
        historyCaptured.current = true;
      }
      setSelectedOpacity(spreadId, nextOpacity, true);
    } else {
      setSelectedOpacity(spreadId, nextOpacity);
    }
  };

  const commitNumber = () => {
    numberFocused.current = false;
    if (cancelNumber.current) {
      cancelNumber.current = false;
      setDraft(mixed ? '' : String(percent));
      return;
    }
    const parsed = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(parsed)) {
      const nextPercent = Math.max(0, Math.min(100, Math.round(parsed)));
      setSelectedOpacity(spreadId, nextPercent / 100);
      setDraft(String(nextPercent));
    } else {
      setDraft(mixed ? '' : String(percent));
    }
  };

  return (
    <div className={styles.control}>
      <div className={styles.heading}>
        <label htmlFor="object-opacity-range" className={styles.label}>Opacity</label>
        {mixed && <span className={styles.mixed}>Mixed</span>}
      </div>
      <div className={styles.row}>
        <input
          id="object-opacity-range"
          className={styles.slider}
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          disabled={disabled}
          aria-label="Object opacity"
          aria-valuetext={mixed ? 'Mixed' : `${percent}%`}
          onPointerDown={() => { pointerGesture.current = true; historyCaptured.current = false; }}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onBlur={endGesture}
          onChange={(event) => changeFromSlider(Number(event.target.value))}
        />
        <div className={styles.numberWrap}>
          <input
            className={styles.number}
            type="number"
            min={0}
            max={100}
            step={1}
            value={draft}
            placeholder={mixed ? 'Mixed' : undefined}
            disabled={disabled}
            aria-label="Opacity percentage"
            onFocus={() => { numberFocused.current = true; cancelNumber.current = false; }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitNumber}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                cancelNumber.current = true;
                event.currentTarget.blur();
              }
            }}
          />
          <span className={styles.percent}>%</span>
        </div>
      </div>
    </div>
  );
}
