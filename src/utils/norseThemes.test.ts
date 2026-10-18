import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { getSvgPathForPiece, PIECE_TYPE_TO_CSA } from './pieceThemes';
import themes from '../../public/piece-themes/themes.json';
import dimensions from '../../scripts/shogi-piece-dimensions.json';

describe('Yggdrasil theme assets', () => {
  it('registers the rune set and supplies every piece for both players', () => {
    expect(themes.themes.some(theme => theme.id === 'yggdrasil-runes')).toBe(true);
    for (const type of Object.keys(PIECE_TYPE_TO_CSA)) {
      for (const player of ['player1', 'player2'] as const) {
        const path = getSvgPathForPiece(type as keyof typeof PIECE_TYPE_TO_CSA, player, 'yggdrasil-runes');
        const assetPath = path.split('?')[0];
        expect(path).toContain('?v=carved-oak-3');
        const svg = readFileSync(`public${assetPath}`, 'utf8');
        expect(svg).toContain('<title>');
        expect(svg).not.toContain('<text');
        expect(svg).toContain('id="oak"');
        expect(svg).toContain('id="grain"');
        expect(svg).toContain('scale(1.38 1.42)');
        const code = assetPath.split('/').pop()!.slice(1, -4) as keyof typeof dimensions.pieces;
        const size = dimensions.pieces[code];
        expect(svg).toContain(`data-piece-width-mm="${size.width}"`);
        expect(svg).toContain(`data-piece-height-mm="${size.height}"`);
        expect(svg).toContain(`scale(${(size.width / 28.7).toFixed(8)} ${(size.height / 32).toFixed(8)})`);
        expect(svg).toContain(player === 'player1' ? 'rotate(0 35 38)' : 'rotate(180 35 38)');
        if (type.startsWith('prom') || type === 'horse' || type === 'dragon') {
          expect(svg).toContain('Promoted');
          expect(svg).toContain('#edaa78');
        }
      }
    }
  });

  it('includes matching board and wallpaper assets', () => {
    expect(existsSync('public/boards/frost-ash.svg')).toBe(true);
    expect(existsSync('public/wallpapers/yggdrasil-night.svg')).toBe(true);
    for (const path of ['public/boards/frost-ash.svg', 'public/wallpapers/yggdrasil-night.svg']) {
      expect(readFileSync(path, 'utf8')).toContain('data:image/png;base64,');
    }
  });
});
