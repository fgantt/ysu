import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckmateModal from './CheckmateModal';

describe('CheckmateModal', () => {
  it('uses a shogi emblem for a timeout and calls the selected action', () => {
    const onDismiss = vi.fn();
    const onNewGame = vi.fn();

    render(
      <CheckmateModal
        winner="player2"
        endgameType="timeout"
        details="Black ran out of time"
        onDismiss={onDismiss}
        onNewGame={onNewGame}
      />
    );

    expect(screen.getByRole('img', { name: 'Shogi king piece' })).toBeInTheDocument();
    expect(screen.getByText('Gote (Player 2) wins on time.')).toBeInTheDocument();
    expect(screen.queryByText('🎌')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review Position' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onNewGame).toHaveBeenCalledOnce();
  });
});
