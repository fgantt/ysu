import { describe, expect, it } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { parseMateReply, validateMateLine } from './mateResult';
export const mateRoot = '4k4/9/4G4/9/9/9/9/9/4K4 b G 1';
describe('dedicated mate replies and principal-line validation', () => {
  it('distinguishes terminal replies and ignores normal search claims', () => {
    expect(parseMateReply('checkmate G*5b')).toEqual({ kind: 'found', moves: ['G*5b'] });
    expect(parseMateReply('checkmate nomate')).toEqual({ kind: 'nomate' });
    expect(parseMateReply('checkmate timeout')).toEqual({ kind: 'timeout' });
    expect(parseMateReply('checkmate notimplemented')).toEqual({ kind: 'unsupported' });
    expect(parseMateReply('info score mate 1 pv G*5b')).toBeNull();
    expect(parseMateReply('bestmove G*5b')).toBeNull();
  });
  it('accepts a legal checking line ending in mate', () => {
    expect(() => validateMateLine(mateRoot, ['G*5b'])).not.toThrow();
  });
  it('rejects malformed, illegal, non-checking and non-mating lines', () => {
    expect(() => parseMateReply('checkmate')).toThrow('malformed');
    expect(() => parseMateReply('checkmate resign')).toThrow('malformed');
    expect(() => validateMateLine(mateRoot, ['P*5b'])).toThrow('illegal');
    expect(() => validateMateLine(InitialPositionSFEN.STANDARD, ['7g7f'])).toThrow('non-checking');
    expect(() => validateMateLine(mateRoot, ['5c5b'])).toThrow('does not end');
    expect(() => validateMateLine(mateRoot, ['G*5b', '5a5b'])).toThrow('searching side');
  });
});
