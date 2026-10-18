import { describe, expect, it } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { emptyStudy, parseVariationStudy, removeVariation, saveVariation, variationPath } from './variationTree';
const root = InitialPositionSFEN.STANDARD;
describe('independent variation study', () => {
  it('shares common prefixes without duplicating branches or modifying the original', () => {
    const first = saveVariation(emptyStudy(), root, ['7g7f', '3c3d'], 'Engine A');
    const second = saveVariation(first, root, ['7g7f', '8c8d'], 'Engine B');
    const repeated = saveVariation(second, root, ['7g7f', '3c3d'], 'Engine C');
    expect(first.roots[0].children[0].children).toHaveLength(1);
    expect(second.roots).toHaveLength(1);
    expect(second.roots[0].children).toHaveLength(1);
    expect(second.roots[0].children[0].children.map(node => node.move)).toEqual(['3c3d', '8c8d']);
    expect(repeated.selectedId).toBe(first.selectedId);
    expect(variationPath(second, second.selectedId!)?.slice(1).map(node => node.move)).toEqual(['7g7f', '8c8d']);
  });
  it('rejects an illegal suffix atomically and retains distinct starting positions', () => {
    const first = saveVariation(emptyStudy(), root, ['7g7f'], 'Engine');
    expect(() => saveVariation(first, root, ['2g2f', '2g2f'], 'Illegal')).toThrow('Illegal move');
    expect(first.roots[0].children).toHaveLength(1);
    const second = saveVariation(first, first.roots[0].children[0].sfen, ['3c3d'], 'Review');
    expect(second.roots).toHaveLength(2);
  });
  it('removes a subtree and selects its surviving parent without affecting siblings', () => {
    const first = saveVariation(emptyStudy(), root, ['7g7f', '3c3d'], 'A');
    const second = saveVariation(first, root, ['2g2f', '8c8d'], 'B');
    const selected = { ...second, selectedId: first.selectedId };
    const pruned = removeVariation(selected, first.roots[0].children[0].id);
    expect(pruned.selectedId).toBe(first.roots[0].id);
    expect(pruned.roots[0].children[0].move).toBe('2g2f');
    expect(removeVariation(pruned, pruned.roots[0].id)).toEqual(emptyStudy());
  });
  it('round-trips all branches and selected position through validated JSON', () => {
    const study = saveVariation(saveVariation(emptyStudy(), root, ['7g7f', '3c3d'], 'A'), root, ['2g2f'], 'B');
    expect(parseVariationStudy(JSON.stringify(study))).toEqual(study);
  });
  it('rejects forged positions, duplicate IDs, illegal moves and missing selections', () => {
    const study = saveVariation(emptyStudy(), root, ['7g7f'], 'A');
    const forged = JSON.parse(JSON.stringify(study));
    forged.roots[0].children[0].sfen = root;
    expect(() => parseVariationStudy(JSON.stringify(forged))).toThrow('does not match');
    forged.roots[0].children[0].id = forged.roots[0].id;
    expect(() => parseVariationStudy(JSON.stringify(forged))).toThrow('Invalid');
    const illegal = JSON.parse(JSON.stringify(study));
    illegal.roots[0].children[0].move = '7a7b';
    expect(() => parseVariationStudy(JSON.stringify(illegal))).toThrow('Illegal');
    expect(() => parseVariationStudy(JSON.stringify({ ...study, selectedId: 'missing' }))).toThrow('selected');
  });
});
