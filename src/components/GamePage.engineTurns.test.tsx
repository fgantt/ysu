import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShogiControllerProvider } from '../context/ShogiControllerContext';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShogiController } from '../usi/controller';
import GamePage from './GamePage';
import { invoke } from '@tauri-apps/api/core';
import { InitialPositionSFEN } from 'tsshogi';
import { listen, type EventCallback } from '@tauri-apps/api/event';
import { StrictMode } from 'react';
import type { StudyGameBranch } from '../utils/studyGame';
vi.mock('./CandidateMovesHost', () => ({ CandidateMovesHost: ({ onLoadStudyGame }: { onLoadStudyGame: (value: StudyGameBranch) => void }) => <button onClick={() => onLoadStudyGame({ rootSfen: InitialPositionSFEN.STANDARD, moves: ['7g7f'], comments: ['Opening', 'Study note'], finalSfen: '', key: 'test' })}>Request study import</button> }));
vi.mock('../utils/pieceThemes', async importOriginal => ({ ...await importOriginal<typeof import('../utils/pieceThemes')>(), getAvailablePieceThemes: vi.fn().mockResolvedValue([]) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({ success: true, data: [] }) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(), emit: vi.fn(), emitTo: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: { getByLabel: vi.fn().mockResolvedValue(null) } }));
vi.mock('../utils/audio', () => ({ playPieceMoveSound: vi.fn(), playCheckmateSound: vi.fn(), playDrawSound: vi.fn(), setSoundsEnabled: vi.fn(), setVolume: vi.fn() }));


const rookHandicap = 'lnsgkgsnl/7b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1';
const engines = [{ id: 'black-config', name: 'Black', is_builtin: true }, { id: 'white-config', name: 'White' }];
const handlers = new Map<string, Set<EventCallback<unknown>>>();
const commands = () => vi.mocked(invoke).mock.calls
  .filter(([name]) => name === 'send_usi_command')
  .map(([, args]) => args as { engineId: string; command: string });
const goes = () => commands().filter(call => call.command.startsWith('go '));
function reply(id: string, message: string) {
  act(() => { for (const handler of handlers.get(`usi-message::${id}`) ?? []) handler({ payload: message, id: 1, event: `usi-message::${id}` }); });
}
async function mountGame(sfen: string, player1Type = 'ai', player2Type = 'ai') {
  const controller = new ShogiController();
  await controller.initialize();
  const move = vi.spyOn(controller, 'handleUserMove');
  const view = render(<StrictMode><MemoryRouter initialEntries={[{ pathname: '/game', state: {
    player1Type, player2Type, initialSfen: sfen, player1EngineId: 'black-config', player2EngineId: 'white-config',
  } }]}><ShogiControllerProvider controller={controller}>
    <GamePage isUsiMonitorVisible={false} lastSentCommand="" lastReceivedCommand="" communicationHistory={[]} sessions={[]}
      onToggleUsiMonitor={vi.fn()} onDismissUsiMonitor={vi.fn()} clearUsiHistory={vi.fn()} />
  </ShogiControllerProvider></MemoryRouter></StrictMode>);
  return { controller, move, ...view };
}
describe('playing engine turn ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.mocked(listen).mockImplementation(async (name, handler) => {
      const listeners = handlers.get(name) ?? new Set();
      listeners.add(handler);
      handlers.set(name, listeners);
      return () => listeners.delete(handler);
    });
    vi.mocked(invoke).mockImplementation(async command => ({ success: true, data: command === 'get_engines' ? engines : [] }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([[InitialPositionSFEN.STANDARD, 'black-config'], [rookHandicap, 'white-config']])(
    'starts only the correct engine for %s', async (sfen, expected) => {
      let release!: () => void;
      const startup = new Promise<void>(resolve => { release = resolve; });
      vi.mocked(invoke).mockImplementation(async (command, args) => {
        if (command === 'spawn_engine' && String((args as { engineId: string }).engineId).startsWith('white-config')) await startup;
        return { success: true, data: command === 'get_engines' ? engines : [] };
      });
      const { unmount } = await mountGame(sfen);
      await waitFor(() => expect(invoke).toHaveBeenCalledWith('spawn_engine', expect.objectContaining({ engineId: expect.stringContaining('white-config') })), { timeout: 2000 });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
      expect(goes()).toHaveLength(0);
      await act(async () => { release(); });
      await waitFor(() => expect(goes()).toHaveLength(1), { timeout: 2500 });
      expect(goes()[0].engineId).toMatch(new RegExp(`^${expected}-`));
      expect(commands().find(call => call.command.startsWith('position sfen'))?.command).toBe(`position sfen ${sfen}`);
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
      expect(goes()).toHaveLength(1);
      unmount();
    });

  it('ignores unsolicited, duplicate and wrong-side results across handicap turns', async () => {
    const { controller, move } = await mountGame(rookHandicap);
    await waitFor(() => expect(goes()).toHaveLength(1), { timeout: 2500 });
    const white = goes()[0].engineId;
    const black = vi.mocked(invoke).mock.calls.find(([command, args]) => command === 'spawn_engine' && String((args as { engineId: string }).engineId).startsWith('black-config'))![1] as { engineId: string };
    reply(black.engineId, 'bestmove 3c3d');
    expect(move).not.toHaveBeenCalled();
    reply(white, 'bestmove 3c3d');
    expect(move).toHaveBeenCalledTimes(1);
    expect(controller.getPosition().sfen).toContain(' b ');
    reply(white, 'bestmove 7g7f');
    expect(move).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(goes()).toHaveLength(2), { timeout: 2000 });
    expect(goes()[1].engineId).toBe(black.engineId);
    reply(white, 'bestmove 7g7f');
    expect(move).toHaveBeenCalledTimes(1);
    reply(black.engineId, 'bestmove 7g7f');
    expect(move).toHaveBeenCalledTimes(2);
    expect(controller.getPosition().sfen).toContain(' w ');
  });

  it('cancels a queued request if the turn changes before its delay expires', async () => {
    const { controller } = await mountGame(rookHandicap);
    await waitFor(() => expect(controller.getPosition().sfen).toBe(rookHandicap), { timeout: 2000 });
    const blackTurn = rookHandicap.replace(' w ', ' b ');
    await act(async () => controller.loadSfen(blackTurn));
    await waitFor(() => expect(goes()).toHaveLength(1), { timeout: 2000 });
    expect(goes()[0].engineId).toMatch(/^black-config-/);
    expect(commands().filter(call => call.command.startsWith('position sfen')).map(call => call.command)).toEqual([`position sfen ${blackTurn}`]);
  });

  it('stops and drains an obsolete search before starting the new turn', async () => {
    const { controller, move } = await mountGame(rookHandicap);
    await waitFor(() => expect(goes()).toHaveLength(1), { timeout: 2500 });
    const white = goes()[0].engineId;
    await act(async () => controller.loadSfen(rookHandicap.replace(' w ', ' b ')));
    await waitFor(() => expect(commands()).toContainEqual({ engineId: white, command: 'stop' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
    expect(goes()).toHaveLength(1);
    reply(white, 'bestmove 7g7f');
    expect(move).not.toHaveBeenCalled();
    await waitFor(() => expect(goes()).toHaveLength(2), { timeout: 2000 });
    expect(goes()[1].engineId).toMatch(/^black-config-/);
  });

  it('does not search for a human on the starting side when hints are off', async () => {
    const { unmount } = await mountGame(rookHandicap, 'ai', 'human');
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('spawn_engine', expect.objectContaining({ engineId: expect.stringContaining('black-config') })), { timeout: 2000 });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1500)); });
    expect(goes()).toHaveLength(0);
    unmount();
  });
});
