import { describe, expect, it } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { buildGifPositions, formatGifPlayedDate, hasVisibleGifContent } from './GameGifExportDialog';

describe('animated GIF game replay', () => {
  it('includes the initial position and every move', () => {
    const positions = buildGifPositions({
      position: InitialPositionSFEN.STANDARD,
      moves: ['7g7f', '3c3d', '2g2f'],
      metadata: {},
      appearance: {
        boardBackground: '/boards/fox-sun.png',
        pieceThemeType: 'mikurajima-lacquer',
      },
    });
    expect(positions).toHaveLength(4);
    expect(positions[0].sfen).toBe(InitialPositionSFEN.STANDARD);
    expect(positions[3].sfen).toContain(' w ');
  });

  it('reports a broken move instead of silently dropping frames', () => {
    expect(() => buildGifPositions({
      position: InitialPositionSFEN.STANDARD,
      moves: ['not-a-move'],
      metadata: {},
    })).toThrow(/Move 1/);
  });

  it('rejects a uniformly blank capture but accepts rendered content', () => {
    expect(hasVisibleGifContent(new Uint8ClampedArray(256).fill(20))).toBe(false);
    const rendered = new Uint8ClampedArray(256).fill(20);
    rendered[68] = 180;
    expect(hasVisibleGifContent(rendered)).toBe(true);
  });

  it('formats a played date and safely handles missing metadata', () => {
    expect(formatGifPlayedDate('2026-09-27T12:00:00Z')).toContain('2026');
    expect(formatGifPlayedDate()).toBe('Date unavailable');
    expect(formatGifPlayedDate('invalid')).toBe('Date unavailable');
  });
});
