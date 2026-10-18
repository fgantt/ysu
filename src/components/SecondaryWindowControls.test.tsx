import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SecondaryWindowControls } from './SecondaryWindowControls';
afterEach(cleanup);
it('uses the same dock, pop-out and hide controls with descriptive tooltips', () => {
  const dock = vi.fn(), pop = vi.fn(), hide = vi.fn();
  const view = render(<SecondaryWindowControls title="Engine Thinking" onDock={dock} onPopOut={pop} onHide={hide} />);
  fireEvent.click(view.getByTitle('Dock in original location'));
  fireEvent.click(view.getByTitle('Pop out window'));
  fireEvent.click(view.getByTitle('Hide panel (reopen through View)'));
  expect(dock).toHaveBeenCalledOnce(); expect(pop).toHaveBeenCalledOnce(); expect(hide).toHaveBeenCalledOnce();
});
it('offers native return and close actions with tooltips', () => {
  const dock = vi.fn(), close = vi.fn();
  const view = render(<SecondaryWindowControls title="Evaluation" externalWindow onDock={dock} onHide={close} />);
  fireEvent.click(view.getByRole('button', { name: 'Return Evaluation to main window' }));
  fireEvent.click(view.getByTitle('Close window (reopen through View)'));
  expect(dock).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  expect(view.queryByTitle('Pop out window')).toBeNull();
});
