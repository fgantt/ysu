import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShogiControllerProvider } from '../context/ShogiControllerContext';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShogiController } from '../usi/controller';
import GamePage from './GamePage';
import { invoke } from '@tauri-apps/api/core';
import { InitialPositionSFEN } from 'tsshogi';
import type { StudyGameBranch } from '../utils/studyGame';
vi.mock('./CandidateMovesHost', () => ({ CandidateMovesHost: ({ onLoadStudyGame }: { onLoadStudyGame: (value: StudyGameBranch) => void }) => <button onClick={() => onLoadStudyGame({ rootSfen: InitialPositionSFEN.STANDARD, moves: ['7g7f'], comments: ['Opening', 'Study note'], finalSfen: '', key: 'test' })}>Request study import</button> }));
vi.mock('../utils/pieceThemes', async importOriginal => ({ ...await importOriginal<typeof import('../utils/pieceThemes')>(), getAvailablePieceThemes: vi.fn().mockResolvedValue([]) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({ success: true, data: [] }) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}), emit: vi.fn() }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: { getByLabel: vi.fn().mockResolvedValue(null) } }));
vi.mock('../utils/audio', () => ({ playPieceMoveSound: vi.fn(), playCheckmateSound: vi.fn(), playDrawSound: vi.fn(), setSoundsEnabled: vi.fn(), setVolume: vi.fn() }));

describe('GamePage', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
  afterEach(() => vi.unstubAllGlobals());
  it('plays a legal move through the real controller and board', async () => {
    const controller = new ShogiController();
    await controller.initialize();
    const move = vi.spyOn(controller, 'handleUserMove');
    render(<MemoryRouter initialEntries={[{ pathname: '/game', state: { player1Type: 'human', player2Type: 'human' } }]}>
      <ShogiControllerProvider controller={controller}>
        <GamePage isUsiMonitorVisible={false} lastSentCommand="" lastReceivedCommand=""
          communicationHistory={[]} sessions={[]} onToggleUsiMonitor={vi.fn()}
          onDismissUsiMonitor={vi.fn()} clearUsiHistory={vi.fn()} />
      </ShogiControllerProvider>
    </MemoryRouter>);
    fireEvent.click(await screen.findByTestId('square-6-8'));
    fireEvent.click(screen.getByTestId('square-5-8'));
    expect(move).toHaveBeenCalledWith('1g1f');
    expect(controller.getPosition().sfen).toContain(' w ');
  });
  it('reviews a branch before replacement, cancels safely, then loads and continues playing', async () => {
    let releaseStartup!: () => void;
    const startup = new Promise<void>(resolve => { releaseStartup = resolve; });
    vi.mocked(invoke).mockImplementation(async command => {
      if (command === 'spawn_engine') await startup;
      return { success: true, data: [{ id: 'analysis', name: 'Analysis', display_name: 'Analysis', enabled: true }] };
    });
    const controller = new ShogiController();
    await controller.initialize();
    const load = vi.spyOn(controller, 'loadStudyBranch');
    render(<MemoryRouter initialEntries={[{ pathname: '/game', state: { player1Type: 'human', player2Type: 'human' } }]}>
      <ShogiControllerProvider controller={controller}>
        <GamePage isUsiMonitorVisible={false} lastSentCommand="" lastReceivedCommand="" communicationHistory={[]} sessions={[]} onToggleUsiMonitor={vi.fn()} onDismissUsiMonitor={vi.fn()} clearUsiHistory={vi.fn()} />
      </ShogiControllerProvider>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Request study import' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Request study import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace game with this branch' }));
    await waitFor(() => expect(load).toHaveBeenCalledWith(InitialPositionSFEN.STANDARD, ['7g7f'], ['Opening', 'Study note']));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(controller.getSessionSettings()).toMatchObject({ player1Type: 'human', player2Type: 'human', btime: 1800000, wtime: 1800000 });
    await act(async () => { releaseStartup(); await startup; });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('stop_engine', expect.any(Object)));
    expect(controller.getRecord().current.comment).toBe('Study note');
    fireEvent.click(screen.getByTestId('square-2-6'));
    fireEvent.click(screen.getByTestId('square-3-6'));
    expect(controller.getPosition().sfen).toContain(' b ');
  });

});
