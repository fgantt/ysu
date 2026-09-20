import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSelector from './ThemeSelector';
import { getAvailablePieceThemes } from '../utils/pieceThemes';

vi.mock('../utils/pieceThemes', () => ({ getAvailablePieceThemes: vi.fn() }));

describe('ThemeSelector', () => {
  beforeEach(() => vi.resetAllMocks());

  it('refreshes themes when the window regains focus', async () => {
    const getThemes = vi.mocked(getAvailablePieceThemes);
    getThemes
      .mockResolvedValueOnce([{ id: 'mikurajima-moriage', displayName: 'Mikurajima Lacquer' }])
      .mockResolvedValue([{ id: 'mikurajima-moriage', displayName: 'Mikurajima Lacquer' }, { id: 'mikurajima-moriage-dark', displayName: 'Mikurajima Lacquer — Dark' }]);

    render(<ThemeSelector selectedTheme="mikurajima-moriage" onThemeChange={vi.fn()} />);
    await screen.findByText('Mikurajima Lacquer');
    expect(screen.queryByText('Mikurajima Lacquer — Dark')).toBeNull();

    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByText('Mikurajima Lacquer — Dark')).toBeTruthy());
  });
});
