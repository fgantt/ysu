import { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { VariationTree, type VariationAction } from './VariationTree';
import { commentVariation, emptyStudy, saveVariation } from '../utils/variationTree';
afterEach(cleanup);
it('edits selected comments and offers a branched KIF download with saved notes', () => {
  const initial = saveVariation(emptyStudy(), InitialPositionSFEN.STANDARD, ['7g7f'], 'Test');
  function Study() {
    const [study, setStudy] = useState(initial);
    const action = (value: VariationAction) => {
      if (value.type === 'variation-comment') setStudy(current => commentVariation(current, value.id, value.comment));
      if (value.type === 'variation-select') setStudy(current => ({ ...current, selectedId: value.id }));
    };
    return <VariationTree study={study} onAction={action} />;
  }
  const view = render(<Study />);
  fireEvent.change(view.getByLabelText('Selected position comment'), { target: { value: 'Opening note\n日本語' } });
  fireEvent.click(view.getByText('Save comment'));
  expect(view.getByLabelText('Has comment')).toBeTruthy();
  fireEvent.click(view.getByText('Starting position 1'));
  expect((view.getByLabelText('Selected position comment') as HTMLTextAreaElement).value).toBe('');
  fireEvent.click(view.getByText('1. 7g7f'));
  expect((view.getByLabelText('Selected position comment') as HTMLTextAreaElement).value).toBe('Opening note\n日本語');
  fireEvent.click(view.getByText('Import / export study'));
  fireEvent.click(view.getByText('Prepare KIF for starting position 1'));
  const download = view.getByRole('link', { name: 'Download KIF' });
  expect(download.getAttribute('download')).toBe('shogi-study-position-1.kif');
  expect(decodeURIComponent(download.getAttribute('href')!)).toContain('*Opening note');
});
