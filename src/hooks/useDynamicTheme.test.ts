import { describe, expect, it } from 'vitest';
import { paletteFromColors } from './useDynamicTheme';

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
    expect(warm['text-primary']).toMatch(/96%\)$/);
  });
});
