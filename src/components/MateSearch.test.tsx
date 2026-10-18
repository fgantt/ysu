import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MateSearch } from './MateSearch';
const root = '4k4/9/4G4/9/9/9/9/9/4K4 b G 1';
const engines = [{ id: 'engine', name: 'Engine' }];
afterEach(cleanup);
describe('mate-search panel', () => {
  it('starts on the main position or on a separate custom puzzle', () => {
    const onAction = vi.fn();
    const view = render(<MateSearch state={{ status: 'idle' }} engines={engines} capabilities={{}} currentSfen={root} onAction={onAction} onPreview={vi.fn()} />);
    fireEvent.click(view.getByRole('button', { name: 'Search for mate' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'mate-start', engineId: 'engine', seconds: 5 });
    fireEvent.change(view.getByLabelText('Custom mate position'), { target: { value: root } });
    fireEvent.click(view.getByRole('button', { name: 'Search custom position' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'mate-start', engineId: 'engine', seconds: 5, rootSfen: root });
  });
  it('previews only validated mate lines from the captured root and exports results', () => {
    const onPreview = vi.fn();
    const view = render(<MateSearch state={{ status: 'found', rootSfen: root, engineName: 'Apery', moves: ['G*5b'] }} engines={engines} capabilities={{ engine: 'responded' }} currentSfen="another position" onAction={vi.fn()} onPreview={onPreview} />);
    expect(view.getByRole('status').textContent).toContain('Different from the current main-board position');
    fireEvent.click(view.getByRole('button', { name: 'Preview mate line' }));
    expect(onPreview).toHaveBeenCalledWith({ rootSfen: root, moves: ['G*5b'], step: 0, pinned: true, source: 'Apery mate line' });
    expect(view.getByRole('link').getAttribute('download')).toBe('shogi-mate-search.json');
    view.rerender(<MateSearch state={{ status: 'timeout' }} engines={engines} capabilities={{}} currentSfen={root} onAction={vi.fn()} onPreview={onPreview} />);
    expect(view.queryByRole('button', { name: 'Preview mate line' })).toBeNull();
  });
});
