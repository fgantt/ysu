import { describe, expect, it } from 'vitest';
import { generateJSON, parseJSON, type GameData } from './gameFormats';

describe('JSON save appearance metadata', () => {
  it('round-trips the board, pieces, and clock snapshots used by GIF export', () => {
    const game: GameData = {
      position: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1',
      moves: ['7g7f'],
      metadata: { name: 'Theme test' },
      appearance: {
        boardBackground: '/boards/marble.png',
        pieceThemeType: 'mikurajima-dark',
        notation: 'kifu',
      },
      clockSnapshots: [
        { blackTime: 60000, whiteTime: 60000 },
        { blackTime: 57000, whiteTime: 60000 },
      ],
    };

    const parsed = parseJSON(generateJSON(game));

    expect(parsed.success).toBe(true);
    expect(parsed.data?.appearance).toEqual(game.appearance);
    expect(parsed.data?.clockSnapshots).toEqual(game.clockSnapshots);
  });
});
