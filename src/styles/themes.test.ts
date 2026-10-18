import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NEW_COLOR_THEMES } from '../hooks/useTheme';

const css = readFileSync('src/styles/themes.css', 'utf8');
function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

describe('new palette readability', () => {
  it.each(NEW_COLOR_THEMES)('%s defines all tokens and readable text and actions', theme => {
    const block = css.match(new RegExp(`\\[data-theme="${theme}"\\] \\{([^}]+)\\}`))![1];
    const tokens = Object.fromEntries(Array.from(block.matchAll(/(--[\w-]+):\s*([^;]+);/g), match => [match[1], match[2]]));
    const defaults = Array.from(css.slice(css.indexOf(':root,'), css.indexOf('/* ===========================\n   DARK THEME')).matchAll(/(--[\w-]+):/g), match => match[1]);
    for (const token of defaults) expect(tokens[token]).toBeTruthy();
    for (const text of ['text-primary', 'text-secondary', 'text-muted', 'accent']) {
      expect(contrast(tokens[`--color-${text}`], tokens['--color-bg-panel'])).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(tokens['--color-button-primary-text'], tokens['--color-button-primary'])).toBeGreaterThanOrEqual(4.5);
  });
});
