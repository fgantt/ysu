import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PiecePreview from './PiecePreview';
import { getThemeById, ThemeConfig } from '../utils/themeConfig';
vi.mock('../utils/themeConfig', () => ({ getThemeById: vi.fn() }));
vi.mock('./SvgPiece', () => ({ default: ({ type, player }: { type: string; player: string }) => <span data-testid={`${type}-${player}`} /> }));

describe('PiecePreview', () => {
  it('keeps promotions, both kings, and attribution in the selected preview', async () => {
    vi.mocked(getThemeById).mockResolvedValue({ id: 'test', displayName: 'Example pieces', description: 'Readable description', attribution: { name: 'Artist', url: 'https://example.com', license: 'CC BY', licenseUrl: 'https://example.com/license' } });
    render(<PiecePreview theme="test" />);
    await screen.findByRole('heading', { name: 'Example pieces' });
    expect(screen.getByTestId('promPawn-player1')).toBeTruthy();
    expect(screen.getByTestId('king-player2')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Artist' }).getAttribute('href')).toBe('https://example.com');
    expect(screen.getByRole('link', { name: 'CC BY' })).toBeTruthy();
  });

  it('ignores late metadata from a previously selected theme', async () => {
    let resolveOld!: (value: ThemeConfig) => void;
    vi.mocked(getThemeById).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ id: 'new', displayName: 'New pieces' });
    const view = render(<PiecePreview theme="old" />);
    view.rerender(<PiecePreview theme="new" />);
    await screen.findByRole('heading', { name: 'New pieces' });
    await act(async () => resolveOld({ id: 'old', displayName: 'Old pieces' }));
    expect(screen.queryByText('Old pieces')).toBeNull();
    expect(screen.getByRole('heading', { name: 'New pieces' })).toBeTruthy();
  });
});
