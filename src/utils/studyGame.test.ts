import { describe, expect, it } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { commentVariation, emptyStudy, saveVariation, variationPath } from './variationTree';
import { createStudyGameRecord, studyGameBranch } from './studyGame';
import { ShogiController } from '../usi/controller';

describe('Study branch game loading', () => {
  it('loads only the selected prefix, preserving root and position comments', () => {
    const study = saveVariation(emptyStudy(), InitialPositionSFEN.STANDARD, ['7g7f', '3c3d', '2g2f'], 'Test');
    const path = variationPath(study, study.selectedId!)!;
    const annotated = commentVariation(commentVariation(study, path[0].id, 'Opening'), path[1].id, 'First move');
    const branch = studyGameBranch(annotated, path[1].id);
    expect(branch.moves).toEqual(['7g7f']);
    expect(branch.comments).toEqual(['Opening', 'First move']);
    expect(branch.finalSfen).toBe(path[1].sfen);
    const controller = new ShogiController();
    controller.loadStudyBranch(branch.rootSfen, branch.moves, branch.comments);
    expect(controller.getPosition().sfen).toBe(branch.finalSfen);
    expect(controller.getRecord().initialPosition.sfen).toBe(InitialPositionSFEN.STANDARD);
    expect(controller.getRecord().current.comment).toBe('First move');
    expect(controller.handleUserMove('3c3d')).toBe(true);
  });
  it('leaves the current record unchanged when any branch move is illegal', () => {
    const controller = new ShogiController();
    controller.handleUserMove('2g2f');
    const record = controller.getRecord();
    const sfen = controller.getPosition().sfen;
    expect(() => controller.loadStudyBranch(InitialPositionSFEN.STANDARD, ['7g7f', '1a1i'])).toThrow(/Illegal/);
    expect(controller.getRecord()).toBe(record);
    expect(controller.getPosition().sfen).toBe(sfen);
  });
  it('supports custom Gote roots and a root without moves', () => {
    const root = InitialPositionSFEN.STANDARD.replace(' b ', ' w ');
    const record = createStudyGameRecord(root, ['3c3d']);
    expect(record.initialPosition.sfen).toBe(root);
    expect(record.position.sfen).toContain(' b ');
    const study = saveVariation(emptyStudy(), root, [], 'Custom root');
    expect(studyGameBranch(study, study.selectedId!).moves).toEqual([]);
  });
  it('rejects inconsistent saved positions and detects comment edits in the branch key', () => {
    const study = saveVariation(emptyStudy(), InitialPositionSFEN.STANDARD, ['7g7f'], 'Test');
    const before = studyGameBranch(study, study.selectedId!);
    const edited = commentVariation(study, study.selectedId!, 'Changed');
    expect(studyGameBranch(edited, edited.selectedId!).key).not.toBe(before.key);
    edited.roots[0].children[0].sfen = InitialPositionSFEN.STANDARD;
    expect(() => studyGameBranch(edited, edited.selectedId!)).toThrow(/inconsistent/);
    expect(() => studyGameBranch(study, 'deleted')).toThrow(/no longer exists/);
  });
});
