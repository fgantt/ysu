import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PieceType } from 'tsshogi';
import { AVAILABLE_PIECE_THEMES, getSvgPathForPiece } from './pieceThemes';

const newThemes = ['ivory-vermilion-kanji', 'midnight-lacquer-kanji', 'indigo-porcelain-kanji', 'modern-mono-kanji', 'learning-arrows', 'Hari-Seldon-1-kanji-dark', 'Hari-Seldon-2-kanji-dark'];
const codes = ['FU', 'KY', 'KE', 'GI', 'KI', 'KA', 'HI', 'OU', 'GY', 'TO', 'NY', 'NK', 'NG', 'UM', 'RY'];
const asset = (theme: string, piece: string) => readFileSync(`public/piece-themes/${theme}/${piece}.svg`, 'utf8');
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('additional piece theme assets', () => {
  it('registers complete, valid SVG sets for both players and both kings', () => {
    const catalog = JSON.parse(readFileSync('public/piece-themes/themes.json', 'utf8')) as { themes: { id: string; attribution?: { license: string } }[] };
    for (const theme of newThemes) {
      expect(AVAILABLE_PIECE_THEMES).toContain(theme);
      expect(catalog.themes.filter(value => value.id === theme)).toHaveLength(1);
      for (const code of codes) for (const side of ['0', '1']) {
        const svg = asset(theme, `${side}${code}`);
        const document = parse(svg);
        expect(document.querySelector('parsererror'), `${theme}/${side}${code}`).toBeNull();
        expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 100 110');
        expect(document.documentElement.getAttribute('role')).toBe('img');
        expect(document.documentElement.firstElementChild).not.toBeNull();
        expect(svg.includes('rotate(180 50 55)')).toBe(side === '1');
      }
      if (theme !== 'learning-arrows') expect(catalog.themes.find(value => value.id === theme)?.attribution?.license).toBe('CC BY-SA 4.0');
      expect(getSvgPathForPiece(PieceType.KING, 'player1', theme)).toContain('/0GY.svg');
      expect(getSvgPathForPiece(PieceType.KING, 'player2', theme)).toContain('/1OU.svg');
    }
  });

  it('uses researched face proportions in all nine sets and retains sizes after promotion', () => {
    const sizes: Record<string, [number, number]> = {
      FU: [22.5, 27], KY: [23.5, 28], KE: [25.5, 29], GI: [26.7, 30], KI: [26.7, 30],
      KA: [27.7, 31], HI: [27.7, 31], OU: [28.7, 32], GY: [28.7, 32],
      TO: [22.5, 27], NY: [23.5, 28], NK: [25.5, 29], NG: [26.7, 30], UM: [27.7, 31], RY: [27.7, 31],
    };
    for (const theme of [...newThemes, 'mikurajima-moriage', 'mikurajima-moriage-dark']) {
      for (const code of codes) for (const side of ['0', '1']) {
        const document = parse(asset(theme, `${side}${code}`));
        expect(document.querySelector('parsererror'), `${theme}/${side}${code}`).toBeNull();
        const artwork = document.querySelector('[data-piece-width-mm]');
        const [width, height] = sizes[code];
        expect(Number(artwork?.getAttribute('data-piece-width-mm'))).toBe(width);
        expect(Number(artwork?.getAttribute('data-piece-height-mm'))).toBe(height);
        const scale = artwork?.getAttribute('transform')?.match(/scale\(([^ ]+) ([^)]+)\)/);
        expect(Number(scale?.[1])).toBeCloseTo(width / 28.7, 7);
        expect(Number(scale?.[2])).toBeCloseTo(height / 32, 7);
        expect(artwork?.querySelector('path, image')).not.toBeNull();
      }
      for (const [base, promoted] of [['FU', 'TO'], ['KY', 'NY'], ['KE', 'NK'], ['GI', 'NG'], ['KA', 'UM'], ['HI', 'RY']]) {
        const transform = (code: string) => parse(asset(theme, `0${code}`)).querySelector('[data-piece-width-mm]')?.getAttribute('transform');
        expect(transform(base)).toBe(transform(promoted));
      }
    }
  });

  it('keeps the dark Hari-Seldon artwork distinct and independent of system fonts', () => {
    for (const theme of ['Hari-Seldon-1-kanji-dark', 'Hari-Seldon-2-kanji-dark']) {
      const svg = asset(theme, '0FU');
      expect(svg).toContain('data:image/png;base64,');
      expect(parse(svg).querySelector('text')).toBeNull();
      expect(parse(svg).querySelector('path')).not.toBeNull();
    }
    expect(asset('Hari-Seldon-1-kanji-dark', '0FU')).not.toBe(asset('Hari-Seldon-2-kanji-dark', '0FU'));
  });

  it('shows the correct step and sliding directions, including changed promotions', () => {
    const steps: Record<string, number> = { FU: 2, KY: 1, KE: 3, GI: 6, KI: 7, KA: 1, HI: 1, GY: 9, TO: 7, NY: 7, NK: 7, NG: 7, UM: 5, RY: 5 };
    for (const [code, count] of Object.entries(steps)) {
      const document = parse(asset('learning-arrows', `0${code}`));
      expect(document.querySelectorAll('circle'), code).toHaveLength(count);
      expect(document.querySelectorAll('path[marker-end]'), code).toHaveLength(code === 'KY' ? 1 : ['KA', 'HI', 'UM', 'RY'].includes(code) ? 4 : 0);
    }
    const knightDots = Array.from(parse(asset('learning-arrows', '0KE')).querySelectorAll('circle')).map(dot => [dot.getAttribute('cx'), dot.getAttribute('cy')]);
    expect(knightDots).toEqual([['50', '81'], ['38', '63'], ['62', '63']]);
    for (const code of ['TO', 'NY', 'NK', 'NG', 'UM', 'RY']) expect(parse(asset('learning-arrows', `0${code}`)).querySelector('text')?.textContent).toMatch(/^\+/);
  });
});
