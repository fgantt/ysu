import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsPanel from './SettingsPanel';
import { loadSettingsViewState } from '../utils/settingsViewState';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({ success: false }) }));
vi.mock('../utils/audio', () => ({ playPreviewSound: vi.fn() }));
vi.mock('./ThemeSelector', () => ({ default: () => <div>Theme selector</div> }));
vi.mock('./PiecePreview', () => ({ default: () => <div>Piece preview</div> }));
vi.mock('./EngineSelector', () => ({ EngineSelector: () => <div>Engine selector</div> }));

const props: React.ComponentProps<typeof SettingsPanel> = {
  pieceThemeType: 'mikurajima-moriage', onPieceThemeTypeChange: vi.fn(),
  notation: 'western', onNotationChange: vi.fn(),
  wallpaperList: ['/wallpapers/test.jpg'], onSelectWallpaper: vi.fn(),
  boardBackgroundList: ['/boards/test.jpg'], onSelectBoardBackground: vi.fn(),
  onClose: vi.fn(), currentWallpaper: '/wallpapers/test.jpg', currentBoardBackground: '/boards/test.jpg',
  showAttackedPieces: false, onShowAttackedPiecesChange: vi.fn(),
  showPieceTooltips: true, onShowPieceTooltipsChange: vi.fn(),
  showEngineThinking: false, onShowEngineThinkingChange: vi.fn(),
  soundsEnabled: false, onSoundsEnabledChange: vi.fn(),
  soundVolume: 0.5, onSoundVolumeChange: vi.fn(),
  recommendationEngineId: null, onRecommendationEngineChange: vi.fn(),
  recommendationEngineOptions: null, onRecommendationEngineOptionsChange: vi.fn(),
};

afterEach(() => localStorage.clear());

describe('SettingsPanel view state', () => {
  it('reopens on the previous tab with its section and scroll position', () => {
    const first = render(<SettingsPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Backgrounds/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Board Background' }));
    expect(screen.queryByRole('button', { name: 'Select board background: Test' })).toBeNull();

    const content = first.container.querySelector('.settings-tab-content') as HTMLDivElement;
    content.scrollTop = 120;
    fireEvent.scroll(content);
    fireEvent.click(first.container.querySelector('.settings-close-btn') as HTMLButtonElement);
    first.unmount();

    expect(loadSettingsViewState().activeTab).toBe('backgrounds');
    expect(loadSettingsViewState().scrollTop.backgrounds).toBe(120);

    const second = render(<SettingsPanel {...props} />);
    expect(screen.getByRole('button', { name: /Backgrounds/ }).classList.contains('active')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Select board background: Test' })).toBeNull();
    expect((second.container.querySelector('.settings-tab-content') as HTMLDivElement).scrollTop).toBe(120);
  });
});

it('offers a persistent global transparency slider in Display and an opaque reset', () => {
  const first = render(<SettingsPanel {...props} />);
  fireEvent.click(first.getByRole('button', { name: /Display/ }));
  fireEvent.change(first.getByRole('slider', { name: 'Secondary window transparency' }), { target: { value: '30' } });
  expect(first.getByText('Transparency: 30%')).toBeTruthy();
  first.unmount();
  const second = render(<SettingsPanel {...props} />);
  expect((second.getByRole('slider', { name: 'Secondary window transparency' }) as HTMLInputElement).value).toBe('30');
  fireEvent.click(second.getByText('Restore opaque windows'));
  expect(second.getByText('Transparency: 0%')).toBeTruthy();
});


it('offers the bundled artwork immediately and forwards both background selections', () => {
  const board = vi.fn(); const wallpaper = vi.fn();
  const view = render(<SettingsPanel {...props} onSelectBoardBackground={board} onSelectWallpaper={wallpaper} />);
  fireEvent.click(view.getByRole('button', { name: /Backgrounds/ }));
  fireEvent.click(view.getByRole('button', { name: 'Select board background: Ocean Tide' }));
  fireEvent.click(view.getByRole('button', { name: 'Select wallpaper: Celestial Dragon' }));
  expect(board).toHaveBeenCalledWith('/boards/ocean-tide.png');
  expect(wallpaper).toHaveBeenCalledWith('/wallpapers/celestial-dragon.png');
});
