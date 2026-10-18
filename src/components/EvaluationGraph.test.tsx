import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeEvaluation, EvaluationGraph } from './EvaluationGraph';

let resize: ResizeObserverCallback;
const disconnect = vi.fn();
beforeEach(() => {
  disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function resizeChart(width: number, height: number) {
  act(() => resize([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver));
}

describe('EvaluationGraph', () => {
  it('plots evaluations and reports the latest Sente-normalized score', () => {
    const { container, getByText } = render(<EvaluationGraph
      points={[{ ply: 1, score: -80, engineId: 'gote' }, { ply: 2, score: 135, engineId: 'sente' }]}
      isVisible onToggle={vi.fn()}
    />);
    expect(getByText('+135 cp')).toBeTruthy();
    expect(container.querySelectorAll('.evaluation-point')).toHaveLength(2);
    expect(container.querySelector('.evaluation-current')).toBeTruthy();
  });

  it('renders no launcher when minimized', () => {
    const onToggle = vi.fn();
    const { queryByRole } = render(<EvaluationGraph points={[]} isVisible={false} onToggle={onToggle} />);
    expect(queryByRole('button')).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('shows only a close action when used in a popped-out window', () => {
    const { queryByLabelText, getByLabelText } = render(<EvaluationGraph
      points={[]} isVisible externalWindow onToggle={vi.fn()}
    />);
    expect(getByLabelText('Close Evaluation window')).toBeTruthy();
    expect(queryByLabelText('Dock Evaluation')).toBeNull();
    expect(queryByLabelText('Pop out Evaluation')).toBeNull();
  });

  it('explains the favored side and recent trend in plain language', () => {
    const explanation = describeEvaluation([
      { ply: 8, score: -120, engineId: 'gote' },
      { ply: 9, score: 360, engineId: 'sente' },
    ]);
    expect(explanation.headline).toContain('clear Sente advantage');
    expect(explanation.detail).toContain('shifted 480 cp toward Sente');
  });

  it('describes small scores as approximately even', () => {
    expect(describeEvaluation([{ ply: 4, score: -45, engineId: 'gote' }]).headline)
      .toContain('approximately even');
  });
});


it('resizes chart geometry in both dimensions and reduces labels in a compact window', () => {
  const view = render(<EvaluationGraph points={[{ ply: 1, score: 0, engineId: 'engine' }, { ply: 10, score: 3000, engineId: 'engine' }]} isVisible onToggle={vi.fn()} />);
  resizeChart(720, 300);
  expect(view.getByRole('img').getAttribute('viewBox')).toBe('0 0 720 300');
  const wideLabels = view.container.querySelectorAll('svg text').length;
  resizeChart(340, 100);
  expect(view.getByRole('img').getAttribute('viewBox')).toBe('0 0 340 100');
  expect(view.container.querySelectorAll('svg text').length).toBeLessThan(wideLabels);
  for (const dot of view.container.querySelectorAll('.evaluation-point')) {
    expect(Number(dot.getAttribute('cx'))).toBeGreaterThan(0);
    expect(Number(dot.getAttribute('cx'))).toBeLessThan(340);
    expect(Number(dot.getAttribute('cy'))).toBeGreaterThan(0);
    expect(Number(dot.getAttribute('cy'))).toBeLessThan(100);
  }
  expect(view.getByText('+3000 cp')).toBeTruthy();
});
it('ignores zero-size hidden observations and releases its observer on unmount', () => {
  const view = render(<EvaluationGraph points={[]} isVisible onToggle={vi.fn()} />);
  resizeChart(360, 120);
  resizeChart(0, 0);
  expect(view.getByRole('img').getAttribute('viewBox')).toBe('0 0 360 120');
  expect(view.container.querySelectorAll('.evaluation-empty tspan')).toHaveLength(2);
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
it('keeps the interpretation headline visible and lets users expand the longer details', () => {
  const view = render(<EvaluationGraph points={[{ ply: 3, score: 360, engineId: 'engine' }]} isVisible onToggle={vi.fn()} />);
  const details = view.container.querySelector('details')!;
  expect(details.open).toBe(false);
  expect(view.getByText(/clear Sente advantage/)).toBeTruthy();
  fireEvent.click(view.getByText('Evaluation details'));
  expect(details.open).toBe(true);
});
