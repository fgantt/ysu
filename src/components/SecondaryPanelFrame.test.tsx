import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecondaryPanelFrame } from './SecondaryPanelFrame';

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
});
