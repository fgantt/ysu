import { studyGameBranch } from '../utils/studyGame';
import { thinkingHistoryStore } from '../utils/thinkingHistory';
import { act, cleanup, fireEvent, render as renderAll } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InitialPositionSFEN } from 'tsshogi';
import { CandidateMovesHost } from './CandidateMovesHost';
import type { MateSearchState } from '../usi/mateSearchSession';
import { emptyReview, reviewSnapshotKey, type ReviewState } from '../usi/gameReview';
import type { ComparisonState } from '../usi/engineComparison';
import { saveVariation, emptyStudy, VARIATION_STORAGE_KEY } from '../utils/variationTree';
import type { CandidatePayload } from './CandidateMoves';

const analysisAction = vi.hoisted(() => vi.fn());
const reviewStart = vi.hoisted(() => vi.fn());
const reviewMock = vi.hoisted(() => ({ state: { status: 'idle', rows: [] } as unknown as ReviewState }));

// Hidden panels stay mounted; these assertions target the view visible to the user.
function render(...args: Parameters<typeof renderAll>) {
  const view = renderAll(...args);
  return { ...view,
    getByText: (...values: Parameters<typeof view.getAllByText>) => {
      const matches = view.getAllByText(...values).filter(element => !element.closest('[hidden]'));
      expect(matches).toHaveLength(1); return matches[0];
    },
    getByTestId: (...values: Parameters<typeof view.getAllByTestId>) => {
      const matches = view.getAllByTestId(...values).filter(element => !element.closest('[hidden]'));
      expect(matches).toHaveLength(1); return matches[0];
    },
  };
}

const mateMock = vi.hoisted(() => ({ state: { status: 'idle' } as MateSearchState, capabilities: {}, onAction: vi.fn() }));
const comparisonMock = vi.hoisted(() => ({ state: { version: 1, busy: false, sides: [{ status: 'idle' }, { status: 'idle' }] } as ComparisonState, onAction: vi.fn() }));
const handlers = new Map<string, (event: { payload: unknown }) => void>();
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (name, handler) => { handlers.set(name, handler); return () => { if (handlers.get(name) === handler) handlers.delete(name); }; }) }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: { getByLabel: vi.fn(async () => null) } }));
vi.mock('../hooks/useAnalysisSession', () => ({ useAnalysisSession: () => ({ state: { status: 'idle' }, onAction: analysisAction }) }));
vi.mock('../hooks/useMateSearch', () => ({ useMateSearch: () => mateMock }));
vi.mock('../hooks/useEngineComparison', () => ({ useEngineComparison: () => comparisonMock }));
vi.mock('../hooks/useGameReview', () => ({ useGameReview: () => ({ state: reviewMock.state, start: reviewStart, stop: vi.fn() }) }));
vi.mock('./Board', () => ({ default: ({ position }: { position: { sfen: string } }) => <div data-testid="preview-position">{position.sfen}</div> }));
vi.mock('./CapturedPieces', () => ({ default: () => <div>Pieces in hand</div> }));

const payload: CandidatePayload = { currentSfen: InitialPositionSFEN.STANDARD, engineNames: { engine: 'Engine' }, searches: [{ engineId: 'engine', rootSfen: InitialPositionSFEN.STANDARD, complete: true, lines: [{ rank: 1, score: 100, moves: ['7g7f', '3c3d'] }] }] };
const record = { initialSfen: InitialPositionSFEN.STANDARD, moves: ['7g7f'] };
afterEach(() => { reviewMock.state = emptyReview; analysisAction.mockClear(); reviewStart.mockClear(); mateMock.state = { status: 'idle' }; mateMock.onAction.mockClear(); comparisonMock.state = { version: 1, busy: false, sides: [{ status: 'idle' }, { status: 'idle' }] }; comparisonMock.onAction.mockClear(); cleanup(); thinkingHistoryStore.clearFinished(); handlers.clear(); localStorage.clear(); });
describe('shared continuation view', () => {
  it('preserves playback and pins the line when detaching and reattaching', () => {
    const props = { payload, record, engines: [], isVisible: true, onToggle: vi.fn(), onDismiss: vi.fn() };
    const { getByRole, getByText, getByTestId, rerender } = render(<CandidateMovesHost {...props} />);
    act(() => getByRole('button', { name: 'Next' }).click());
    const first = getByTestId('preview-position').textContent;
    act(() => getByRole('button', { name: 'Separate Continuation Board' }).click());
    expect(getByText('Move 1 / 2')).toBeTruthy();
    expect(getByTestId('preview-position').textContent).toBe(first);
    act(() => getByRole('button', { name: 'Next' }).click());
    expect(getByText('Move 2 / 2')).toBeTruthy();
    act(() => getByRole('button', { name: 'Reattach to Candidate Moves' }).click());
    expect(getByText('Move 2 / 2')).toBeTruthy();
    rerender(<CandidateMovesHost {...props} payload={{ ...payload, searches: [{ ...payload.searches[0], lines: [{ rank: 1, moves: ['2g2f'], score: 200 }] }] }} />);
    expect(getByText('Move 2 / 2')).toBeTruthy();
  });
  it('applies native playback actions to the same shared state and clamps invalid steps', async () => {
    const { getByText } = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'continuation-step', step: 100 } }));
    expect(getByText('Move 2 / 2')).toBeTruthy();
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'continuation-step', step: -100 } }));
    expect(getByText('Move 0 / 2')).toBeTruthy();
  });
});

describe('Variation Tree integration', () => {
  it('saves a candidate, creates a branch from an earlier step, selects siblings and persists the study', () => {
    const props = { payload, record, engines: [], isVisible: true, onToggle: vi.fn(), onDismiss: vi.fn() };
    const view = render(<CandidateMovesHost {...props} />);
    act(() => fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, altKey: true }));
    act(() => view.getByRole('button', { name: 'Save preview line' }).click());
    expect(view.getByText('Move 2 / 2')).toBeTruthy();
    act(() => view.getByRole('button', { name: 'Previous' }).click());
    fireEvent.change(view.getByLabelText('Branch move (USI)'), { target: { value: '8c8d' } });
    fireEvent.click(view.getByRole('button', { name: 'Add from preview position' }));
    expect(view.getByRole('button', { name: '2. 3c3d' })).toBeTruthy();
    expect(view.getByRole('button', { name: '2. 8c8d' }).getAttribute('aria-pressed')).toBe('true');
    act(() => view.getByRole('button', { name: '2. 3c3d' }).click());
    const before = view.getByTestId('preview-position').textContent;
    act(() => view.getByRole('button', { name: '2. 8c8d' }).click());
    expect(view.getByTestId('preview-position').textContent).not.toBe(before);
    const saved = localStorage.getItem(VARIATION_STORAGE_KEY)!;
    expect(JSON.parse(saved).roots[0].children[0].children).toHaveLength(2);
    view.unmount();
    const restored = render(<CandidateMovesHost {...props} />);
    act(() => fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, altKey: true }));
    expect(restored.getByRole('button', { name: '2. 8c8d' })).toBeTruthy();
    expect(record.moves).toEqual(['7g7f']);
  });
  it('rejects illegal manual branches without changing the saved tree or board', () => {
    const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
    act(() => fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, altKey: true }));
    act(() => view.getByRole('button', { name: 'Save preview line' }).click());
    const before = view.getByTestId('preview-position').textContent;
    const saved = localStorage.getItem(VARIATION_STORAGE_KEY);
    fireEvent.change(view.getByLabelText('Branch move (USI)'), { target: { value: '7a7b' } });
    fireEvent.click(view.getByRole('button', { name: 'Add from preview position' }));
    expect(view.getByRole('alert').textContent).toContain('Illegal move');
    expect(view.getByTestId('preview-position').textContent).toBe(before);
    expect(localStorage.getItem(VARIATION_STORAGE_KEY)).toBe(saved);
  });
  it('handles native tree selection and deletion through the authoritative main state', async () => {
    const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-save' } }));
    const saved = JSON.parse(localStorage.getItem(VARIATION_STORAGE_KEY)!);
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-select', id: saved.roots[0].id } }));
    expect(view.getByText('Move 0 / 0')).toBeTruthy();
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-remove', id: saved.roots[0].id } }));
    expect(JSON.parse(localStorage.getItem(VARIATION_STORAGE_KEY)!).roots).toHaveLength(0);
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-undo' } }));
    expect(JSON.parse(localStorage.getItem(VARIATION_STORAGE_KEY)!).roots).toHaveLength(1);
  });
});

it('preserves a corrupt cache until the user deliberately replaces it', () => {
  localStorage.setItem(VARIATION_STORAGE_KEY, '{broken');
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  act(() => fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, altKey: true }));
  expect(view.getByRole('alert').textContent).toContain('has not been overwritten');
  expect(localStorage.getItem(VARIATION_STORAGE_KEY)).toBe('{broken');
  act(() => view.getByRole('button', { name: 'Save preview line' }).click());
  expect(JSON.parse(localStorage.getItem(VARIATION_STORAGE_KEY)!).roots).toHaveLength(1);
});

it('imports validated branches, exports them and retains the study on invalid import', () => {
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  act(() => fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, altKey: true }));
  act(() => view.getByRole('button', { name: 'Save preview line' }).click());
  act(() => view.getByRole('button', { name: 'Import / export study' }).click());
  const exported = (view.getByLabelText('Exported study JSON') as HTMLTextAreaElement).value;
  expect(view.getByRole('link', { name: 'Download study JSON' }).getAttribute('download')).toBe('shogi-variation-study.json');
  fireEvent.change(view.getByLabelText('Import study JSON'), { target: { value: '{bad' } });
  fireEvent.click(view.getByRole('button', { name: 'Import study' }));
  expect(view.getByRole('alert')).toBeTruthy();
  expect(localStorage.getItem(VARIATION_STORAGE_KEY)).toBe(JSON.stringify(JSON.parse(exported)));
  act(() => view.getByRole('button', { name: 'Remove selected branch' }).click());
  expect(view.queryByRole('button', { name: '2. 3c3d' })).toBeNull();
  fireEvent.change(view.getByLabelText('Import study JSON'), { target: { value: exported } });
  fireEvent.click(view.getByRole('button', { name: 'Import study' }));
  expect(view.getByRole('button', { name: '2. 3c3d' })).toBeTruthy();
});

it('opens comparison continuations in the shared study without changing the main record', () => {
  comparisonMock.state = { version: 1, busy: false, rootSfen: payload.currentSfen, seconds: 1, candidates: 1, engines: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], sides: [{ status: 'complete', search: { engineId: 'compare-a', rootSfen: payload.currentSfen, complete: true, lines: [{ rank: 1, score: 42, moves: ['2g2f', '8c8d'] }] } }, { status: 'error', error: 'Unavailable' }] };
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  act(() => fireEvent.keyDown(window, { code: 'Digit4', ctrlKey: true, altKey: true }));
  act(() => view.getByRole('button', { name: /Preview continuation/ }).click());
  expect(view.getByText(/A candidate 1/)).toBeTruthy();
  act(() => view.getByRole('button', { name: 'Save preview line' }).click());
  expect(view.getByRole('button', { name: '1. 2g2f' })).toBeTruthy();
  expect(record.moves).toEqual(['7g7f']);
});
it('routes native comparison start and stop to the main coordinator', async () => {
  render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
  const start = { type: 'comparison-start', engineIds: ['a', 'b'], seconds: 60, candidates: 1, budget: { kind: 'nodes', value: 100000 } };
  act(() => handlers.get('analysis-panels:action')?.({ payload: start }));
  expect(comparisonMock.onAction).toHaveBeenCalledWith(start);
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'comparison-stop' } }));
  expect(comparisonMock.onAction).toHaveBeenCalledWith({ type: 'comparison-stop' });
});

it('opens validated mate lines as independent saved study branches', () => {
  const root = '4k4/9/4G4/9/9/9/9/9/4K4 b G 1';
  mateMock.state = { status: 'found', rootSfen: root, engineName: 'Apery', moves: ['G*5b'] };
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  act(() => fireEvent.keyDown(window, { code: 'Digit3', ctrlKey: true, altKey: true }));
  act(() => view.getByRole('button', { name: 'Preview mate line' }).click());
  expect(view.getByText(/Apery mate line/)).toBeTruthy();
  act(() => view.getByRole('button', { name: 'Save preview line' }).click());
  expect(view.getByRole('button', { name: '1. G*5b' })).toBeTruthy();
  expect(record.moves).toEqual(['7g7f']);
});
it('routes native mate-search actions through the main session owner', async () => {
  render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
  const start = { type: 'mate-start', engineId: 'apery', seconds: 5, rootSfen: 'custom-root' };
  act(() => handlers.get('analysis-panels:action')?.({ payload: start }));
  expect(mateMock.onAction).toHaveBeenCalledWith(start);
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'mate-stop' } }));
  expect(mateMock.onAction).toHaveBeenCalledWith({ type: 'mate-stop' });
});

 describe('native board branch requests', () => {
  it('saves the expected position and rejects requests from a stale preview', async () => {
    const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-board-add', rootSfen: payload.currentSfen, prefix: [], move: '2g2f' } }));
    expect(view.getByText('Move 1 / 1')).toBeTruthy();
    const saved = localStorage.getItem(VARIATION_STORAGE_KEY);
    act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-board-add', rootSfen: payload.currentSfen, prefix: [], move: '7g7f' } }));
    expect(localStorage.getItem(VARIATION_STORAGE_KEY)).toBe(saved);
    fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, altKey: true });
    expect(view.getByText('The preview changed. Select your move again.')).toBeTruthy();
  });
});

it('persists native position comments and restores them with Undo tree edit', async () => {
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  fireEvent.keyDown(window, { code: 'Digit2', ctrlKey: true, altKey: true });
  fireEvent.click(view.getByText('Save preview line'));
  await act(async () => { await Promise.resolve(); });
  const saved = JSON.parse(localStorage.getItem(VARIATION_STORAGE_KEY)!);
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-comment', id: saved.selectedId, comment: 'Native note' } }));
  expect(localStorage.getItem(VARIATION_STORAGE_KEY)).toContain('Native note');
  expect((view.getByLabelText('Selected position comment') as HTMLTextAreaElement).value).toBe('Native note');
  fireEvent.click(view.getByText('Undo tree edit'));
  expect(localStorage.getItem(VARIATION_STORAGE_KEY)).not.toContain('Native note');
  expect((view.getByLabelText('Selected position comment') as HTMLTextAreaElement).value).toBe('');
});

it('routes selected-branch review requests through the authoritative saved tree', async () => {
  const study = saveVariation(emptyStudy(), InitialPositionSFEN.STANDARD, ['2g2f', '8c8d'], 'Study');
  localStorage.setItem(VARIATION_STORAGE_KEY, JSON.stringify(study));
  render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'review-start', engineId: 'engine', seconds: 3, scope: 'branch' } }));
  expect(reviewStart).toHaveBeenCalledWith('engine', 3, { initialSfen: InitialPositionSFEN.STANDARD, moves: ['2g2f', '8c8d'] });
  expect(record.moves).toEqual(['7g7f']);
});

it('hides review without a launcher and preserves its search controls for menu reopening', () => {
  const engine = { id: 'engine', name: 'Engine', display_name: 'Engine', enabled: true, is_builtin: false, path: '/engine', created_at: '', is_favorite: false };
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[engine]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  fireEvent.keyDown(window, { code: 'Digit6', ctrlKey: true, altKey: true });
  fireEvent.change(view.getByRole('combobox', { name: 'Review time per search' }), { target: { value: '5' } });
  const time = view.getByRole('combobox', { name: 'Review time per search' });
  fireEvent.click(view.getByRole('button', { name: 'Minimize Game Review' }));
  expect(view.queryByRole('button', { name: 'Show Game Review window' })).toBeNull();
  expect(view.queryByRole('combobox', { name: 'Review time per search' })).toBeNull();
  expect(document.body.contains(time)).toBe(true);
  fireEvent.keyDown(window, { code: 'Digit6', ctrlKey: true, altKey: true });
  expect((view.getByRole('combobox', { name: 'Review time per search' }) as HTMLSelectElement).value).toBe('5');
});


it('records history while hidden and resolves native previews through the authoritative captured root', async () => {
  render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible={false} onToggle={vi.fn()} onDismiss={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
  const root = payload.currentSfen.replace(' b ', ' w ');
  act(() => thinkingHistoryStore.record({ ...payload.searches[0], rootSfen: root, lines: [{ rank: 1, moves: ['3c3d', '7g7f'] }], searchId: 'history-native' }, 'Historical engine', 'game'));
  const entry = thinkingHistoryStore.getSnapshot().find(value => value.search.searchId === 'history-native')!;
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'thinking-preview', id: entry.id, rank: 1 } }));
  expect(record.moves).toEqual(['7g7f']);
  const board = [...document.querySelectorAll('[data-testid="preview-position"]')].find(element => !element.closest('[hidden]'));
  expect(board?.textContent).toBe(root);
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'thinking-clear' } }));
  expect(thinkingHistoryStore.getSnapshot().filter(value => value.status !== 'searching')).toHaveLength(0);
});


it('routes native reuse preferences and retained-engine release to the main owner', async () => {
  render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
  act(() => handlers.get('candidate-monitor:action')?.({ payload: { type: 'reuse', enabled: true } }));
  expect(analysisAction).toHaveBeenLastCalledWith({ type: 'reuse', enabled: true });
  act(() => handlers.get('candidate-monitor:action')?.({ payload: { type: 'release' } }));
  expect(analysisAction).toHaveBeenLastCalledWith({ type: 'release' });
});

it('routes review navigation to its captured root and ignores stale native snapshots', async () => {
  const root = payload.currentSfen.replace(' b ', ' w ');
  reviewMock.state = { ...emptyReview, status: 'complete', record, rows: [{ ply: 1, move: '3c3d', side: 'Gote', rootSfen: root, afterSfen: root, bestLine: ['8c8d'], playedLine: ['3c3d', '7g7f'] }] };
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible={false} onToggle={vi.fn()} onDismiss={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
  const action = { type: 'review-preview', ply: 1, best: false, rootSfen: root, snapshot: reviewSnapshotKey(reviewMock.state) };
  act(() => handlers.get('analysis-panels:action')?.({ payload: { ...action, snapshot: 'earlier review' } }));
  expect(view.queryByRole('button', { name: 'Reattach to Candidate Moves' })).toBeNull();
  act(() => handlers.get('analysis-panels:action')?.({ payload: action }));
  expect(view.getByTestId('preview-position').textContent).toBe(root);
  expect(view.getByText(/Review move 1 · Played move/)).toBeTruthy();
  act(() => handlers.get('analysis-panels:action')?.({ payload: { ...action, best: true } }));
  expect(view.getByText(/Review move 1 · Engine line/)).toBeTruthy();
  expect(view.getByText('Move 0 / 1')).toBeTruthy();
  expect(record.moves).toEqual(['7g7f']);
});


it('resolves native study import requests from main-owned data and rejects stale keys', async () => {
  const study = saveVariation(emptyStudy(), InitialPositionSFEN.STANDARD, ['7g7f'], 'Test');
  localStorage.setItem(VARIATION_STORAGE_KEY, JSON.stringify(study));
  const load = vi.fn();
  render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} onLoadStudyGame={load} />);
  await act(async () => { await Promise.resolve(); });
  const branch = studyGameBranch(study, study.selectedId!);
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-load-game', id: study.selectedId, key: 'stale' } }));
  expect(load).not.toHaveBeenCalled();
  act(() => handlers.get('analysis-panels:action')?.({ payload: { type: 'variation-load-game', id: study.selectedId, key: branch.key, rootSfen: 'forged' } }));
  expect(load).toHaveBeenCalledWith(branch);
});

it('toggles each analysis panel twice and keeps menu open requests idempotent', () => {
  const view = render(<CandidateMovesHost payload={payload} record={record} engines={[]} isVisible onToggle={vi.fn()} onDismiss={vi.fn()} />);
  for (const [number, label] of [[2, 'Continuation Board'], [3, 'Mate Search'], [4, 'Engine Comparison'], [5, 'Engine Thinking'], [6, 'Game Review']] as const) {
    const shortcut = () => fireEvent.keyDown(window, { code: `Digit${number}`, ctrlKey: true, altKey: true });
    act(shortcut);
    expect(view.getByRole('region', { name: `${label} panel` })).toBeTruthy();
    act(shortcut);
    expect(view.queryByRole('region', { name: `${label} panel` })).toBeNull();
    act(shortcut);
    expect(view.getByRole('region', { name: `${label} panel` })).toBeTruthy();
    act(shortcut);
  }
  act(() => window.dispatchEvent(new CustomEvent('secondary-view:open', { detail: 'thinking' })));
  act(() => window.dispatchEvent(new CustomEvent('secondary-view:open', { detail: 'thinking' })));
  expect(view.getByRole('region', { name: 'Engine Thinking panel' })).toBeTruthy();
});
