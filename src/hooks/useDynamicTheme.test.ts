import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { extractImagePalette, paletteFromColors, paletteFromImagePalette, useDynamicTheme } from './useDynamicTheme';
import { bundledBoardColor } from '../utils/boardPalette';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('dynamic theme palette', () => {
  it('applies sampled custom board colors after image loading', async () => {
    localStorage.setItem('shogiVibeTheme', 'dynamic');
    localStorage.setItem('shogi-board-background', '/boards/custom.png');
    localStorage.setItem('shogi-piece-label-type', 'kanji');
    document.documentElement.setAttribute('data-theme', 'dynamic');
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([220, 205, 160, 255]) }),
    } as unknown as CanvasRenderingContext2D);
    renderHook(() => useDynamicTheme());
    const expected = paletteFromImagePalette(extractImagePalette([[220, 205, 160]]), null)['bg-panel'];
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--color-bg-panel')).toBe(expected));
  });

  it('provides a readable fallback without any selected images', () => {
    const palette = paletteFromColors(null, null);
    expect(palette['button-primary-text']).toBe('#ffffff');
    expect(palette['bg-panel']).toMatch(/^hsl\(/);
  });

  it('responds to board and piece colors while keeping light text', () => {
    const warm = paletteFromColors([180, 90, 35], [150, 80, 40]);
    const cool = paletteFromColors([35, 95, 170], [150, 80, 40]);
    expect(warm['bg-panel']).not.toBe(cool['bg-panel']);
    expect(warm['text-primary']).toMatch(/97%\)$/);
  });

  it('uses distinct image tones across surfaces and accents', () => {
    const sampled = extractImagePalette([
      [32, 20, 12], [42, 27, 16], [105, 58, 24], [126, 73, 31],
      [176, 116, 54], [205, 158, 90], [227, 199, 143], [182, 48, 22],
    ]);
    expect(sampled).not.toBeNull();
    const palette = paletteFromImagePalette(sampled, null);
    expect(palette['bg-modal']).not.toBe(palette['bg-card']);
    expect(palette.accent).not.toBe(palette['bg-panel']);
    expect(palette['border-medium']).not.toBe(palette['bg-card']);
  });

  it('keeps board surfaces stable when only the piece theme changes', () => {
    const board = { dominant: [112, 69, 38], dark: [35, 24, 18], mid: [112, 69, 38], light: [210, 164, 103], accent: [154, 75, 28] } as const;
    const palePieces = paletteFromImagePalette(board, [230, 180, 95]);
    const darkPieces = paletteFromImagePalette(board, [55, 35, 20]);
    expect(palePieces['bg-panel']).toBe(darkPieces['bg-panel']);
    expect(palePieces['bg-card']).toBe(darkPieces['bg-card']);
    expect(palePieces.accent).not.toBe(darkPieces.accent);
  });

  it('changes panel brightness when switching light and dark boards of the same wood', () => {
    const lightBoard = bundledBoardColor('/boards/wood-mikurajima-boxwood-natural.webp');
    const darkBoard = bundledBoardColor('/boards/wood-mikurajima-boxwood-dark.webp');
    expect(lightBoard).not.toBeNull();
    expect(darkBoard).not.toBeNull();
    const light = paletteFromColors(lightBoard, null);
    const dark = paletteFromColors(darkBoard, null);
    const lightPanel = Number(light['bg-panel'].match(/ (\d+)%\)$/)?.[1]);
    const darkPanel = Number(dark['bg-panel'].match(/ (\d+)%\)$/)?.[1]);
    expect(lightPanel).toBeGreaterThan(darkPanel);
    expect(lightPanel - darkPanel).toBeGreaterThanOrEqual(12);
    expect(light['bg-card']).not.toBe(dark['bg-card']);
    expect(light['button-primary-text']).toBe('#ffffff');
  });

  it('uses genuinely light chrome and dark text for pale marble', () => {
    const marble = paletteFromColors(bundledBoardColor('/boards/marble-calacatta.jpg'), null);
    const panelLightness = Number(marble['bg-panel'].match(/ (\d+)%\)$/)?.[1]);
    const textLightness = Number(marble['text-primary'].match(/ (\d+)%\)$/)?.[1]);
    expect(panelLightness).toBeGreaterThanOrEqual(72);
    expect(textLightness).toBeLessThanOrEqual(15);
  });

  it('uses a dominant pale background instead of averaging illustration colors into brown', () => {
    const colors: [number, number, number][] = [
      ...Array(12).fill([225, 205, 158] as [number, number, number]),
      ...Array(4).fill([196, 58, 28] as [number, number, number]),
      ...Array(4).fill([38, 35, 29] as [number, number, number]),
      ...Array(4).fill([116, 105, 83] as [number, number, number]),
    ];
    const sampled = extractImagePalette(colors);
    expect(sampled?.dominant).toEqual([225, 205, 158]);
    const palette = paletteFromImagePalette(sampled, null);
    const panelLightness = Number(palette['bg-panel'].match(/ (\d+)%\)$/)?.[1]);
    expect(panelLightness).toBeGreaterThanOrEqual(72);
  });

  it('has a light fallback for the bundled fox board when canvas sampling is unavailable', () => {
    const fox = paletteFromColors(bundledBoardColor('/boards/fox-sun.png'), null);
    const panelLightness = Number(fox['bg-panel'].match(/ (\d+)%\)$/)?.[1]);
    const textLightness = Number(fox['text-primary'].match(/ (\d+)%\)$/)?.[1]);
    expect(panelLightness).toBeGreaterThanOrEqual(72);
    expect(textLightness).toBeLessThanOrEqual(15);
  });

  it('places medium wood between dark and pale wood', () => {
    const panelLightness = (path: string) => {
      const palette = paletteFromColors(bundledBoardColor(path), null);
      return Number(palette['bg-panel'].match(/ (\d+)%\)$/)?.[1]);
    };
    expect(panelLightness('/boards/wood-cherry-3.jpg'))
      .toBeLessThan(panelLightness('/boards/wood-pecan-2.jpg'));
    expect(panelLightness('/boards/wood-pecan-2.jpg'))
      .toBeLessThan(panelLightness('/boards/wood-hiba-1.jpeg'));
  });

  it('leaves unknown board images available for live sampling', () => {
    expect(bundledBoardColor('/boards/my-custom-board.png')).toBeNull();
  });

  it('updates active UI colors when the in-game board setting changes', () => {
    localStorage.setItem('shogiVibeTheme', 'dynamic');
    localStorage.setItem('shogi-board-background', '/boards/wood-mikurajima-boxwood-natural.webp');
    const { unmount } = renderHook(() => useDynamicTheme());
    const first = document.documentElement.style.getPropertyValue('--color-bg-panel');
    act(() => {
      localStorage.setItem('shogi-board-background', '/boards/wood-mikurajima-boxwood-dark.webp');
      window.dispatchEvent(new Event('shogi-appearance-change'));
    });
    const second = document.documentElement.style.getPropertyValue('--color-bg-panel');
    expect(first).not.toBe('');
    expect(second).not.toBe(first);
    unmount();
  });
});
