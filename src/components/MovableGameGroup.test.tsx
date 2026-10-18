import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SecondaryPanelFrame } from './SecondaryPanelFrame';
import { GAME_GROUP_POSITION_KEY, GAME_GROUP_SIZE_KEY, resizeGameGroup, MovableGameGroup } from './MovableGameGroup';
class Observer { observe() {} disconnect() {} }
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const element = this.closest('.movable-game-group') as HTMLElement | null;
    const match = element?.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    const x = Number(match?.[1] ?? 0), y = Number(match?.[2] ?? 0);
    const size = Number(element?.style.transform.match(/scale\(([\d.]+)\)/)?.[1] ?? 1);
    return { left: 200 + x, right: 200 + x + 600 * size, top: 50 + y, bottom: 50 + y + 400 * size, width: 600 * size, height: 400 * size } as DOMRect;
  });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function pointer(element: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { button: { value: 0 }, pointerId: { value: 1 }, clientX: { value: x }, clientY: { value: y } });
  fireEvent(element, event);
}
function setup() {
  const pieceClick = vi.fn();
  const view = render(<MovableGameGroup><div className="column-numbers">9 8 7</div><div className="captured-pieces"><h3>Gote</h3><button onClick={pieceClick}>Pawn in hand</button></div><div className="move-log"><h3>Move History</h3></div><div className="board-square" onClick={pieceClick}>Board square</div></MovableGameGroup>);
  const frame = view.container.firstElementChild as HTMLElement;
  frame.setPointerCapture = vi.fn(); frame.hasPointerCapture = () => true; frame.releasePointerCapture = vi.fn();
  Object.defineProperty(frame, 'offsetWidth', { value: 600 });
  return { ...view, frame, pieceClick };
}
it('drags the whole workspace from existing headings and saves its position', () => {
  const view = setup();
  pointer(view.getByText('Move History'), 'pointerdown', 200, 100);
  pointer(view.frame, 'pointermove', 350, 200);
  pointer(view.frame, 'pointerup', 350, 200);
  expect(view.frame.style.transform).toBe('translate(150px, 100px)');
  expect(JSON.parse(localStorage.getItem(GAME_GROUP_POSITION_KEY)!)).toEqual({ x: 150, y: 100 });
  fireEvent.doubleClick(view.getByText('Gote'));
  expect(view.frame.style.transform).toBe('translate(0px, 0px)');
});
it('keeps board and hand interactions usable and ignores tiny heading movements', () => {
  const view = setup();
  for (const label of ['Pawn in hand', 'Board square']) {
    pointer(view.getByText(label), 'pointerdown', 100, 100);
    pointer(view.frame, 'pointermove', 300, 300);
    fireEvent.click(view.getByText(label));
  }
  expect(view.pieceClick).toHaveBeenCalledTimes(2);
  expect(view.frame.style.transform).toBe('translate(0px, 0px)');
  pointer(view.getByText('Gote'), 'pointerdown', 100, 100);
  pointer(view.frame, 'pointermove', 102, 102);
  expect(view.frame.style.transform).toBe('translate(0px, 0px)');
});
it('restores placement and keeps the board heading reachable after extreme dragging', () => {
  localStorage.setItem(GAME_GROUP_POSITION_KEY, JSON.stringify({ x: -100, y: 20 }));
  const view = setup();
  expect(view.frame.style.transform).toBe('translate(-100px, 20px)');
  pointer(view.getByText('9 8 7'), 'pointerdown', 100, 100);
  pointer(view.frame, 'pointermove', -10000, 10000);
  const rect = view.frame.getBoundingClientRect();
  expect(rect.right).toBeGreaterThanOrEqual(80);
  expect(rect.top).toBeLessThanOrEqual(window.innerHeight - 40);
});

it('resets using two heading pointer clicks even when native double-click is suppressed', () => {
  localStorage.setItem(GAME_GROUP_POSITION_KEY, JSON.stringify({ x: 100, y: 100 }));
  const view = setup();
  for (let index = 0; index < 2; index++) {
    pointer(view.getByText('Gote'), 'pointerdown', 400, 200);
    pointer(view.frame, 'pointerup', 400, 200);
    fireEvent(view.frame, new Event('lostpointercapture', { bubbles: true }));
  }
  expect(view.frame.style.transform).toBe('translate(0px, 0px)');
  expect(JSON.parse(localStorage.getItem(GAME_GROUP_POSITION_KEY)!)).toEqual({ x: 0, y: 0 });
});

it('resizes from a corner proportionally without moving its opposite corner and persists size', () => {
  const view = setup();
  pointer(view.getByRole('button', { name: 'Resize game group se' }), 'pointerdown', 800, 450);
  pointer(view.frame, 'pointermove', 920, 530);
  pointer(view.frame, 'pointerup', 920, 530);
  expect(Number(localStorage.getItem(GAME_GROUP_SIZE_KEY))).toBeCloseTo(1.2);
  const rect = view.frame.getBoundingClientRect();
  expect(rect.left).toBe(200); expect(rect.top).toBe(50);
  expect(rect.width / rect.height).toBe(1.5);
  view.unmount();
  const restored = setup();
  expect(restored.frame.style.transform).toContain('scale(1.2)');
  for (let index = 0; index < 2; index++) {
    pointer(restored.getByRole('button', { name: 'Resize game group se' }), 'pointerdown', 920, 530);
    pointer(restored.frame, 'pointerup', 920, 530);
  }
  expect(Number(localStorage.getItem(GAME_GROUP_SIZE_KEY))).toBe(1);
});
it('anchors all four opposite corners under responsive zoom and enforces size limits', () => {
  for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
    const west = corner.includes('w'), north = corner.includes('n');
    const next = resizeGameGroup({ width: 600, height: 400, size: 1, outerZoom: 0.8, offset: { x: 50, y: 60 }, corner }, west ? -120 : 120, north ? -80 : 80);
    expect(next.size).toBeCloseTo(1.2);
    const left = 50 * .8, top = 60 * .8;
    const newLeft = next.offset.x * .8, newTop = next.offset.y * .8;
    expect(west ? newLeft + 600 * next.size : newLeft).toBeCloseTo(west ? left + 600 : left);
    expect(north ? newTop + 400 * next.size : newTop).toBeCloseTo(north ? top + 400 : top);
    const huge = resizeGameGroup({ width: 600, height: 400, size: 1, outerZoom: 1, offset: { x: 0, y: 0 }, corner: 'se' }, 10000, 10000);
    const small = resizeGameGroup({ width: 600, height: 400, size: 1, outerZoom: 1, offset: { x: 0, y: 0 }, corner: 'se' }, -10000, -10000);
    expect(huge.size).toBe(1.5); expect(small.size).toBe(.5);
  }
});
it('keeps heading drags accurate after scaling and allows keyboard size reset', () => {
  localStorage.setItem(GAME_GROUP_SIZE_KEY, '1.2');
  const view = setup();
  pointer(view.getByText('Move History'), 'pointerdown', 200, 100);
  pointer(view.frame, 'pointermove', 300, 200);
  pointer(view.frame, 'pointerup', 300, 200);
  expect(JSON.parse(localStorage.getItem(GAME_GROUP_POSITION_KEY)!)).toEqual({ x: 100, y: 100 });
  fireEvent.keyDown(view.getByRole('button', { name: 'Resize game group nw' }), { key: 'Home' });
  expect(Number(localStorage.getItem(GAME_GROUP_SIZE_KEY))).toBe(1);
  expect(JSON.parse(localStorage.getItem(GAME_GROUP_POSITION_KEY)!)).toEqual({ x: 100, y: 100 });
});

it('stops enlarging at the viewport edge while keeping the opposite corner fixed', () => {
  const next = resizeGameGroup({ width: 600, height: 400, size: 1, outerZoom: 1, offset: { x: 0, y: 0 }, corner: 'nw', visible: { left: 200, top: 50, boardLeft: 200, boardRight: 800, boardTop: 50, viewportWidth: 1024, viewportHeight: 768 } }, -300, -200);
  expect(50 + next.offset.y).toBeCloseTo(8);
  expect(50 + next.offset.y + 400 * next.size).toBeCloseTo(450);
});

it('raises the game group and secondary panels in turn while retaining other panel order', () => {
  for (const id of ['first', 'second']) localStorage.setItem(`secondary-panel:${id}`, JSON.stringify({ floating: true, left: 40, top: 50, width: 500, height: 350 }));
  const click = vi.fn();
  const view = render(<>
    <MovableGameGroup><div className="column-numbers">Numbers</div><button onPointerDown={event => event.stopPropagation()} onClick={click}>Game control</button></MovableGameGroup>
    <SecondaryPanelFrame id="first">{() => <p>First panel</p>}</SecondaryPanelFrame>
    <SecondaryPanelFrame id="second">{() => <p>Second panel</p>}</SecondaryPanelFrame>
  </>);
  const group = view.container.querySelector<HTMLElement>('.movable-game-group')!;
  const frames = view.container.querySelectorAll<HTMLElement>('.secondary-panel-frame');
  const z = (element: HTMLElement) => Number(element.style.zIndex);
  pointer(view.getByText('Game control'), 'pointerdown', 400, 200);
  fireEvent.click(view.getByText('Game control'));
  expect(click).toHaveBeenCalledOnce();
  expect(z(group)).toBeGreaterThan(z(frames[0]));
  expect(z(group)).toBeGreaterThan(z(frames[1]));
  pointer(view.getByText('First panel'), 'pointerdown', 400, 200);
  expect(z(frames[0])).toBeGreaterThan(z(group));
  expect(z(group)).toBeGreaterThan(z(frames[1]));
  pointer(view.getByText('Second panel'), 'pointerdown', 400, 200);
  expect(z(frames[1])).toBeGreaterThan(z(frames[0]));
  expect(z(frames[0])).toBeGreaterThan(z(group));
  expect(group.style.transform).toBe('translate(0px, 0px)');
});
