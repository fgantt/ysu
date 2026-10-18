import { describe, expect, it } from 'vitest';
import { InitialPositionSFEN, importKIF, Move } from 'tsshogi';
import { commentVariation, emptyStudy, exportVariationKif, parseVariationStudy, saveVariation } from './variationTree';
const root = InitialPositionSFEN.STANDARD;
describe('variation comments and KIF export', () => {
  it('preserves optional comments through JSON and leaves the original unchanged', () => {
    const original = saveVariation(emptyStudy(), root, ['7g7f'], 'Engine');
    const edited = commentVariation(original, original.selectedId!, '日本語 notes\nSecond line');
    expect(original.roots[0].children[0].comment).toBeUndefined();
    expect(parseVariationStudy(JSON.stringify(edited))).toEqual(edited);
    expect(commentVariation(edited, edited.selectedId!, '').roots[0].children[0].comment).toBe('');
    expect(() => commentVariation(edited, 'missing', 'note')).toThrow();
    expect(() => commentVariation(edited, edited.selectedId!, 'x'.repeat(10001))).toThrow();
    const invalid = JSON.parse(JSON.stringify(edited)); invalid.roots[0].comment = 12;
    expect(() => parseVariationStudy(JSON.stringify(invalid))).toThrow('comment');
    invalid.roots[0].comment = 'x'.repeat(10001);
    expect(() => parseVariationStudy(JSON.stringify(invalid))).toThrow('comment');
  });
  it('round-trips sibling branches and multiline comments in a standard KIF', () => {
    let study = saveVariation(emptyStudy(), root, ['7g7f', '3c3d', '2g2f'], 'A');
    study = commentVariation(study, study.selectedId!, 'Main line\n日本語');
    study = saveVariation(study, root, ['7g7f', '8c8d'], 'B');
    study = commentVariation(study, study.selectedId!, 'Alternative');
    study = saveVariation(study, root, ['2g2f', '3c3d'], 'C');
    study = commentVariation(study, study.roots[0].id, 'Root note');
    const before = JSON.stringify(study);
    const text = exportVariationKif(study, study.roots[0].id);
    expect(text).toContain('変化：');
    const record = importKIF(text);
    if (record instanceof Error) throw record;
    expect(record.initialPosition.sfen).toBe(root);
    const lines: string[][] = []; const comments: string[] = [];
    record.forEach(node => {
      comments.push(node.comment.trim());
      if (node.move instanceof Move && !node.next) {
        record.gotoNode(node);
        lines.push(record.movesBefore.filter(value => value.move instanceof Move).map(value => (value.move as Move).usi));
      }
    });
    expect(lines).toEqual(expect.arrayContaining([['7g7f', '3c3d', '2g2f'], ['7g7f', '8c8d'], ['2g2f', '3c3d']]));
    expect(comments).toEqual(expect.arrayContaining(['Root note', 'Main line\n日本語', 'Alternative']));
    expect(JSON.stringify(study)).toBe(before);
  });
  it('exports custom starting positions with drops and promotion, without combining roots', () => {
    const custom = '4k4/9/9/9/9/9/9/9/4K4 b P 1';
    let study = saveVariation(emptyStudy(), custom, ['P*7c', '5a4a', '7c7b+'], 'Puzzle');
    study = saveVariation(study, root, ['7g7f'], 'Other root');
    const record = importKIF(exportVariationKif(study, study.roots[0].id));
    if (record instanceof Error) throw record;
    expect(record.initialPosition.sfen).toBe(custom);
    record.goto(3);
    expect(record.movesBefore.filter(node => node.move instanceof Move).map(node => (node.move as Move).usi)).toEqual(['P*7c', '5a4a', '7c7b+']);
    expect(() => exportVariationKif(study, 'missing')).toThrow();
  });
});
