import { NEW_BOARD_BACKGROUNDS, NEW_WALLPAPERS } from '../data/backgroundArtwork';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadBoardImages, loadWallpaperImages } from './imageLoader';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
describe('imageLoader', () => {
  beforeEach(() => vi.resetAllMocks());
  it('discovers native board files and filters nonimages', async () => {
    vi.mocked(invoke).mockResolvedValue(['/boards/wood.PNG', '/boards/grain.webp', '/boards/readme.txt']);
    expect(await loadBoardImages()).toEqual([...NEW_BOARD_BACKGROUNDS, '/boards/wood.PNG', '/boards/grain.webp']);
    expect(invoke).toHaveBeenCalledWith('list_image_files', { directory: 'boards' });
  });
  it('discovers native wallpapers and filters unsupported files', async () => {
    vi.mocked(invoke).mockResolvedValue(['/wallpapers/temple.jpg', '/wallpapers/ocean.svg', '/wallpapers/notes.txt']);
    expect(await loadWallpaperImages()).toEqual([...NEW_WALLPAPERS, '/wallpapers/temple.jpg', '/wallpapers/ocean.svg']);
    expect(invoke).toHaveBeenCalledWith('list_image_files', { directory: 'wallpapers' });
  });
  it('deduplicates bundled artwork discovered by the native loader', async () => {
    vi.mocked(invoke).mockResolvedValue(NEW_BOARD_BACKGROUNDS);
    expect(await loadBoardImages()).toEqual(NEW_BOARD_BACKGROUNDS);
  });
  it('keeps bundled artwork available on discovery failure', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Unavailable'));
    expect(await loadBoardImages()).toEqual(NEW_BOARD_BACKGROUNDS);
    expect(await loadWallpaperImages()).toEqual(NEW_WALLPAPERS);
  });
});
