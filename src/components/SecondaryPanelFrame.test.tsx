import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SECONDARY_PANEL_FOCUS_EVENT, SecondaryPanelFrame } from './SecondaryPanelFrame';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

afterEach(() => localStorage.clear());

describe('SecondaryPanelFrame', () => {
  it('restores a floating panel and docks it again', () => {
    localStorage.setItem('secondary-panel:test', JSON.stringify({ floating: true, left: 40, top: 50, width: 500, height: 350 }));
    const { container } = render(
      <SecondaryPanelFrame id="test">
        {(floating, dock) => <div className="usi-monitor-header"><span>Monitor</span>{floating && <button onClick={dock}>Dock</button>}</div>}
      </SecondaryPanelFrame>
    );
    const frame = container.querySelector('.secondary-panel-frame') as HTMLElement;
    expect(frame.classList.contains('secondary-panel-frame-floating')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Dock' }));
    expect(frame.classList.contains('secondary-panel-frame-floating')).toBe(false);
  });

  it('temporarily returns a minimized panel to its dock without losing placement', () => {
    localStorage.setItem('secondary-panel:test', JSON.stringify({ floating: true, left: 40, top: 50, width: 500, height: 350 }));
    const { container, rerender } = render(<SecondaryPanelFrame id="test" active={false}>{() => <button>Open</button>}</SecondaryPanelFrame>);
    const frame = container.querySelector('.secondary-panel-frame') as HTMLElement;
    expect(frame.classList.contains('secondary-panel-frame-floating')).toBe(false);
    rerender(<SecondaryPanelFrame id="test" active>{() => <div className="usi-monitor-header">Monitor</div>}</SecondaryPanelFrame>);
    expect(frame.classList.contains('secondary-panel-frame-floating')).toBe(true);
  });

  it('lifts a docked panel when its header is dragged', () => {
    const { container } = render(
      <SecondaryPanelFrame id="test">{() => <div className="usi-monitor-header">Drag monitor</div>}</SecondaryPanelFrame>
    );
    const frame = container.querySelector('.secondary-panel-frame') as HTMLElement;
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 30, width: 500, height: 400 } as DOMRect);
    frame.setPointerCapture = vi.fn();
    frame.releasePointerCapture = vi.fn();
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperties(down, { button: { value: 0 }, pointerId: { value: 1 }, clientX: { value: 40 }, clientY: { value: 50 } });
    fireEvent(screen.getByText('Drag monitor'), down);
    const move = new Event('pointermove', { bubbles: true, cancelable: true });
    Object.defineProperties(move, { pointerId: { value: 1 }, clientX: { value: 60 }, clientY: { value: 70 } });
    fireEvent(frame, move);
    expect(frame.classList.contains('secondary-panel-frame-floating')).toBe(true);
    expect(frame.style.left).toBe('40px');
    expect(frame.style.top).toBe('50px');
  });

  it.each([
    { left: 700, top: 600 },
    { left: -300, top: 600 },
  ])('preserves partially offscreen placement on restore and viewport resize: %o', ({ left, top }) => {
    localStorage.setItem('secondary-panel:test', JSON.stringify({ floating: true, left, top, width: 500, height: 350 }));
    const { container } = render(
      <SecondaryPanelFrame id="test">{() => <div className="usi-monitor-header">Monitor</div>}</SecondaryPanelFrame>
    );
    const frame = container.querySelector('.secondary-panel-frame') as HTMLElement;
    expect(frame.style.left).toBe(`${left}px`);
    expect(frame.style.top).toBe(`${top}px`);
    fireEvent(window, new Event('resize'));
    expect(frame.style.left).toBe(`${left}px`);
    expect(frame.style.top).toBe(`${top}px`);
  });

  it.each([
    { x: 900, y: 740, left: 880, top: 720 },
    { x: -500, y: 1000, left: -380, top: window.innerHeight - 32 },
    { x: 2000, y: -100, left: window.innerWidth - 120, top: 8 },
  ])('allows dragging past viewport edges while leaving the header reachable: %o', ({ x, y, left, top }) => {
    const { container } = render(
      <SecondaryPanelFrame id="test">{() => <div className="usi-monitor-header">Drag monitor</div>}</SecondaryPanelFrame>
    );
    const frame = container.querySelector('.secondary-panel-frame') as HTMLElement;
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 30, width: 500, height: 400 } as DOMRect);
    frame.setPointerCapture = vi.fn();
    frame.releasePointerCapture = vi.fn();
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperties(down, { button: { value: 0 }, pointerId: { value: 1 }, clientX: { value: 40 }, clientY: { value: 50 } });
    fireEvent(screen.getByText('Drag monitor'), down);
    const move = new Event('pointermove', { bubbles: true, cancelable: true });
    Object.defineProperties(move, { pointerId: { value: 1 }, clientX: { value: x }, clientY: { value: y } });
    fireEvent(frame, move);
    expect(frame.style.left).toBe(`${left}px`);
    expect(frame.style.top).toBe(`${top}px`);
  });

});

it('brings the selected floating panel above its siblings', () => {
  for (const id of ['first', 'second']) localStorage.setItem(`secondary-panel:${id}`, JSON.stringify({ floating: true, left: 40, top: 50, width: 500, height: 350 }));
  const view = render(<><SecondaryPanelFrame id="first">{() => <p>First</p>}</SecondaryPanelFrame><SecondaryPanelFrame id="second">{() => <p>Second</p>}</SecondaryPanelFrame></>);
  fireEvent(window, new CustomEvent(SECONDARY_PANEL_FOCUS_EVENT, { detail: 'first' }));
  const frames = view.container.querySelectorAll<HTMLElement>('.secondary-panel-frame');
  expect(Number(frames[0].style.zIndex)).toBeGreaterThan(Number(frames[1].style.zIndex));
  fireEvent(window, new CustomEvent(SECONDARY_PANEL_FOCUS_EVENT, { detail: 'second' }));
  expect(Number(frames[1].style.zIndex)).toBeGreaterThan(Number(frames[0].style.zIndex));
});

it('returns a native panel to its original dock rather than its previous floating position', () => {
  localStorage.setItem('secondary-panel:returned', JSON.stringify({ floating: true, left: 200, top: 100, width: 500, height: 350 }));
  const view = render(<SecondaryPanelFrame id="returned">{() => <p>Returned panel</p>}</SecondaryPanelFrame>);
  const frame = view.container.querySelector('.secondary-panel-frame') as HTMLElement;
  expect(frame.classList.contains('secondary-panel-frame-floating')).toBe(true);
  fireEvent(window, new CustomEvent('secondary-panel:dock', { detail: 'returned' }));
  expect(frame.classList.contains('secondary-panel-frame-floating')).toBe(false);
  expect(frame.style.left).toBe('');
});

it('retains the last geometry through hidden and stale resize notifications', () => {
  const observers: Array<{ callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = [];
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    constructor(callback: ResizeObserverCallback) { observers.push({ callback, disconnect: this.disconnect }); }
    observe() {}
  });
  const bounds = { floating: true, left: 150, top: 120, width: 720, height: 560 };
  localStorage.setItem('secondary-panel:remembered', JSON.stringify(bounds));
  const content = <div className="usi-monitor-header">Remembered</div>;
  const view = render(<section><SecondaryPanelFrame id="remembered">{() => content}</SecondaryPanelFrame></section>);
  const resize = (index: number, width: number, height: number) => act(() => observers[index].callback([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver));
  resize(0, 0, 0);
  expect(JSON.parse(localStorage.getItem('secondary-panel:remembered')!)).toEqual(bounds);
  view.rerender(<section hidden><SecondaryPanelFrame id="remembered" active={false}>{() => content}</SecondaryPanelFrame></section>);
  resize(0, 360, 240);
  expect(observers[0].disconnect).toHaveBeenCalled();
  view.rerender(<section><SecondaryPanelFrame id="remembered" active>{() => content}</SecondaryPanelFrame></section>);
  const frame = view.container.querySelector<HTMLElement>('.secondary-panel-frame')!;
  expect([frame.style.left, frame.style.top, frame.style.width, frame.style.height]).toEqual(['150px', '120px', '720px', '560px']);
  resize(1, 680, 520);
  expect(JSON.parse(localStorage.getItem('secondary-panel:remembered')!)).toEqual({ ...bounds, width: 680, height: 520 });
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});
