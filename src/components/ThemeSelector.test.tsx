import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSelector from './ThemeSelector';
import { getAvailablePieceThemes } from '../utils/pieceThemes';

vi.mock('../utils/pieceThemes', () => ({ getAvailablePieceThemes: vi.fn() }));
vi.mock('./SvgPiece', () => ({ default: () => <span /> }));

describe('ThemeSelector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAvailablePieceThemes).mockResolvedValue([
      { id: 'mikurajima-moriage', displayName: 'Mikurajima Lacquer', description: 'Figured boxwood pieces' },
      { id: 'doubutsu', displayName: 'Doubutsu', description: 'Animal pieces' },
    ]);
  });

  it('selects a theme from its named card', async () => {
    const change = vi.fn();
    render(<ThemeSelector selectedTheme="kanji" onThemeChange={change} />);
    const card = await screen.findByRole('radio', { name: 'Mikurajima Lacquer' });
    expect((screen.getByRole('radio', { name: 'Kanji' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(card);
    expect(change).toHaveBeenCalledWith('mikurajima-moriage');
  });

  it('combines description search and style filtering without changing the selection', async () => {
    const change = vi.fn();
    render(<ThemeSelector selectedTheme="mikurajima-moriage" onThemeChange={change} />);
    await screen.findByRole('radio', { name: 'Doubutsu' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'animal' } });
    expect(screen.getByRole('radio', { name: 'Doubutsu' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Mikurajima Lacquer' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Style' }), { target: { value: 'Japanese' } });
    expect(screen.getByText(/No matching themes/)).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect((screen.getByRole('radio', { name: 'Mikurajima Lacquer' }) as HTMLInputElement).checked).toBe(true);
  });

  it('finds the learning guides in Illustrated and dark Hari-Seldon in Japanese', async () => {
    vi.mocked(getAvailablePieceThemes).mockResolvedValue([
      { id: 'learning-arrows', displayName: 'Learning Arrows' },
      { id: 'Hari-Seldon-2-kanji-dark', displayName: 'Hari-Seldon 2 — Dark' },
    ]);
    render(<ThemeSelector selectedTheme="kanji" onThemeChange={vi.fn()} />);
    await screen.findByRole('radio', { name: 'Learning Arrows' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Style' }), { target: { value: 'Illustrated' } });
    expect(screen.getByRole('radio', { name: 'Learning Arrows' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Hari-Seldon 2 — Dark' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Style' }), { target: { value: 'Japanese' } });
    expect(screen.getByRole('radio', { name: 'Hari-Seldon 2 — Dark' })).toBeTruthy();
  });

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
