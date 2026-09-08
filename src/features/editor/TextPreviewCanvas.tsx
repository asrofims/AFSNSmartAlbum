import { useEffect, useRef } from 'react';
import { DEFAULT_TEXT_STYLE, TextNodeElement, getTextRuns, layoutRichText, drawRichTextLayout } from '../../domain/text';
import { Unit, convertUnitToPt } from '../../domain/units';

/** Navigator and export preview share the editor's point-based layout. */
export function TextPreviewCanvas({ element, unit, dpi, width, height }: {
  element: TextNodeElement; unit: Unit; dpi: number; width: number; height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas || cancelled || width <= 0 || height <= 0) return;
      const density = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.ceil(width * density));
      canvas.height = Math.max(1, Math.ceil(height * density));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = convertUnitToPt(element.width, unit, dpi);
      const h = convertUnitToPt(element.height, unit, dpi);
      const style = { ...DEFAULT_TEXT_STYLE, ...element.style };
      ctx.scale(canvas.width / w, canvas.height / h);
      drawRichTextLayout(ctx, layoutRichText(getTextRuns(element.text, style, element.styledRanges), style, w, h, 72, 'inch', dpi));
    };
    draw();
    document.fonts?.ready.then(draw);
    document.fonts?.addEventListener('loadingdone', draw);
    return () => { cancelled = true; document.fonts?.removeEventListener('loadingdone', draw); };
  }, [element, unit, dpi, width, height]);
  return <canvas ref={ref} style={{ display: 'block', width, height }} aria-hidden="true" />;
}
