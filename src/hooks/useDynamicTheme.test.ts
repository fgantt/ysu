import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { paletteFromColors, useDynamicTheme } from './useDynamicTheme';
import { bundledBoardColor } from '../utils/boardPalette';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('dynamic theme palette', () => {
  it('provides a readable fallback without any selected images', () => {
    const palette = paletteFromColors(null, null);
    expect(palette['button-primary-text']).toBe('#ffffff');
    expect(palette['bg-panel']).toMatch(/^hsl\(/);
  });

  it('responds to board and piece colors while keeping light text', () => {
    const warm = paletteFromColors([180, 90, 35], [150, 80, 40]);
    const cool = paletteFromColors([35, 95, 170], [150, 80, 40]);
    expect(warm['bg-panel']).not.toBe(cool['bg-panel']);
    expect(warm['text-primary']).toMatch(/98%\)$/);
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
