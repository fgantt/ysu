import { describe, expect, it } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { analysisMoveLabels } from './analysisNotation';
describe('analysis Japanese notation', () => {
  it('formats both sides from the exact replay position', () => {
    const labels = analysisMoveLabels(InitialPositionSFEN.STANDARD, ['7g7f', '3c3d']);
    expect(labels[0]).toContain('７六歩');
    expect(labels[1]).toContain('３四歩');
  });
  it('formats drops and promotion while retaining invalid suffixes verbatim', () => {
    const labels = analysisMoveLabels('4k4/9/9/9/9/9/9/9/4K4 b P 1', ['P*7c', '5a4a', '7c7b+', 'bad', '7b7a']);
    expect(labels[0]).toContain('７三歩');
    expect(labels[2]).toContain('歩成');
    expect(labels.slice(3)).toEqual(['bad', '7b7a']);
    expect(analysisMoveLabels('invalid', ['7g7f'])).toEqual(['7g7f']);
  });
});
