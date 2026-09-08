import Konva from 'konva';
import { TextNodeElement, createTextNode, fitTextFrame } from '../src/domain/text';

// Drive Konva's actual Transformer mouse handlers, with a React paint between moves.
export async function testTextResize(
  stage: Konva.Stage,
  transformer: Konva.Transformer,
  reset: (element: TextNodeElement) => void,
  read: () => TextNodeElement,
) {
  let assertions = 0;
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => {
    assertions++;
    if (!condition && failures.length < 12) failures.push(message);
  };
  const paint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  for (const rotation of [0, 45]) {
    for (const anchorName of ['bottom-right', 'top-left', 'top-right', 'bottom-left', 'middle-right', 'middle-left', 'top-center', 'bottom-center']) {
      const initial = createTextNode({ text: 'Hello beautiful world', x: 55, y: 35, width: 100, height: 35,
        style: { fontSize: 24, padding: 4, align: 'center', verticalAlign: 'middle' } });
      initial.rotation = rotation;
      initial.styledRanges = [{ id: 'large', start: 6, end: 15, fontSize: 32.37, fill: '#b91c1c' }];
      reset(initial);
      await paint();
      const node = stage.findOne(`#${initial.id}`)!;
      transformer.nodes([node]);
      stage.draw();
      const anchor = transformer.findOne(`.${anchorName}`)!;
      const start = anchor.getAbsolutePosition();
      const bounds = stage.container().getBoundingClientRect();
      const mouse = (type: string, x: number, y: number) => new MouseEvent(type, {
        clientX: bounds.left + x, clientY: bounds.top + y, button: 0, buttons: type === 'mouseup' ? 0 : 1, bubbles: true,
      });
      const down = mouse('mousedown', start.x, start.y);
      stage.setPointersPositions(down);
      anchor.fire('mousedown', { evt: down }, true);
      const corner = !anchorName.includes('middle') && !anchorName.includes('center');
      const angle = rotation * Math.PI / 180;
      // Expand, contract and reverse direction during one continuous gesture.
      for (const distance of [2, 5, 10, 20, 10, 0, -5, -10, 0]) {
        const dx = anchorName.includes('left') ? -distance : anchorName.includes('right') ? distance : 0;
        const dy = anchorName.includes('top') ? -distance : anchorName.includes('bottom') ? distance : 0;
        window.dispatchEvent(mouse('mousemove', start.x + dx * Math.cos(angle) - dy * Math.sin(angle),
          start.y + dx * Math.sin(angle) + dy * Math.cos(angle)));
        // Transformer reads these bounds synchronously, before React's next scheduled render.
        const rect = node.getClientRect({ skipTransform: true });
        check(Math.abs(rect.width - node.width()) < 0.01 && Math.abs(rect.height - node.height()) < 0.01,
          `${rotation} ${anchorName}: child bounds lag behind frame during resize`);
        await paint();
        check(Math.abs(transformer.width() - node.width()) < 0.01 && Math.abs(transformer.height() - node.height()) < 0.01,
          `${rotation} ${anchorName}: handle bounds differ from frame after paint`);
      }
      const liveWidth = node.width();
      const liveHeight = node.height();
      check(Math.abs(liveWidth - initial.width * 4) < 0.1 && Math.abs(liveHeight - initial.height * 4) < 0.1,
        `${rotation} ${anchorName}: reversing pointer to start must restore frame size`);
      window.dispatchEvent(mouse('mouseup', start.x, start.y));
      await paint();
      check(Math.abs(read().width * 4 - liveWidth) < 0.01 && Math.abs(read().height * 4 - liveHeight) < 0.01,
        `${rotation} ${anchorName}: frame jumps on release`);
      check(corner || read().style.fontSize === initial.style.fontSize, `${anchorName}: side resize changed font size`);
      if (corner) check(Math.abs(read().styledRanges![0]!.fontSize! / initial.styledRanges[0]!.fontSize!
        - read().style.fontSize / initial.style.fontSize) < 1e-9, `${anchorName}: rich text scales differently on release`);
    }
  }
  // A fitted frame is sensitive to fractional font-size rounding during corner scaling.
  const fitted = createTextNode({ text: 'Hello beautiful world', x: 20, y: 20, width: 120, height: 65 });
  reset({ ...fitted, ...fitTextFrame(fitted, 'content', 'mm', 300) });
  await paint();
  const node = stage.findOne(`#${fitted.id}`)!;
  transformer.nodes([node]);
  stage.draw();
  const start = transformer.findOne('.bottom-right')!.getAbsolutePosition();
  const bounds = stage.container().getBoundingClientRect();
  const mouse = (type: string, delta: number) => new MouseEvent(type, {
    clientX: bounds.left + start.x + delta, clientY: bounds.top + start.y + delta,
    button: 0, buttons: type === 'mouseup' ? 0 : 1, bubbles: true,
  });
  const down = mouse('mousedown', 0);
  stage.setPointersPositions(down);
  transformer.findOne('.bottom-right')!.fire('mousedown', { evt: down }, true);
  const ctx = document.createElement('canvas').getContext('2d')!;
  const baselines = new Set<number>();
  ctx.fillText = (_text, _x, y) => { baselines.add(y); };
  for (let delta = 0.1; delta <= 10; delta += 0.1) {
    window.dispatchEvent(mouse('mousemove', delta));
    await paint();
    baselines.clear();
    const shape = (node as Konva.Group).getChildren().find((child) => child.getClassName() === 'Shape') as Konva.Shape;
    shape.sceneFunc().call(shape, { _context: ctx } as unknown as Konva.Context, shape);
    check(baselines.size === 1, `fitted corner at ${delta.toFixed(1)}px: text jumps onto another line`);
    const rect = node.getClientRect({ skipTransform: true });
    check(Math.abs(rect.width - node.width()) < 0.01 && Math.abs(rect.height - node.height()) < 0.01,
      'fitted corner: overflow marker changes the resize bounds');
  }
  window.dispatchEvent(mouse('mouseup', 10));
  await paint();
  baselines.clear();
  const releasedShape = (node as Konva.Group).getChildren().find((child) => child.getClassName() === 'Shape') as Konva.Shape;
  releasedShape.sceneFunc().call(releasedShape, { _context: ctx } as unknown as Konva.Context, releasedShape);
  check(baselines.size === 1, 'fitted corner: text rewraps on release');

  const completed = read();
  for (const size of [20, 0.5]) {
    const overflow = createTextNode({ text: 'Overflow '.repeat(20), width: size, height: size });
    reset(overflow);
    await paint();
    const frame = stage.findOne(`#${overflow.id}`)!;
    const rect = frame.getClientRect({ skipTransform: true });
    check(Math.abs(rect.width - frame.width()) < 0.01 && Math.abs(rect.height - frame.height()) < 0.01,
      `overflow marker must stay inside a ${size}mm frame`);
  }
  reset(completed);
  return { assertions, failures };
}
