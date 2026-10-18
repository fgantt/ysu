import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MoveLog from './MoveLog';
const moves = ['7g7f', '3c3d', '2g2f', '8c8d', '2f2e'].map(usi => ({ move: { usi } }));
const rowNumbers = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent);

describe('Move History', () => {
  it('defaults to ascending pairs and scrolls on every added move, including the second move of a pair', () => {
    const view = render(<MoveLog moves={moves.slice(0, 3)} notation="usi" />);
    const area = screen.getByRole('region', { name: 'Move history list' });
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 1000 });
    area.scrollTop = 25;
    view.rerender(<MoveLog moves={moves.slice(0, 4)} notation="usi" />);
    expect(area.scrollTop).toBe(1000);
    expect(rowNumbers()).toEqual(['1', '2']);
    area.scrollTop = 100;
    view.rerender(<MoveLog moves={moves} notation="usi" />);
    expect(area.scrollTop).toBe(1000);
    expect(rowNumbers()).toEqual(['1', '2', '3']);
    expect(screen.getByRole('button', { name: 'Newest moves first' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('reverses complete rows without renumbering or swapping players, keeps new moves at the top, and switches back', () => {
    const view = render(<MoveLog moves={moves.slice(0, 4)} notation="usi" />);
    const area = screen.getByRole('region', { name: 'Move history list' });
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 1000 });
    area.scrollTop = 600;
    fireEvent.click(screen.getByRole('button', { name: 'Newest moves first' }));
    expect(rowNumbers()).toEqual(['2', '1']);
    expect(area.scrollTop).toBe(0);
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['2', '2g2f', '8c8d']);
    area.scrollTop = 100;
    view.rerender(<MoveLog moves={moves} notation="usi" />);
    expect(rowNumbers()).toEqual(['3', '2', '1']);
    expect(area.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Newest moves first' }));
    expect(rowNumbers()).toEqual(['1', '2', '3']);
    expect(area.scrollTop).toBe(1000);
    expect(moves[0].move.usi).toBe('7g7f');
  });

  it('keeps a Gote-starting record in the correct columns and ignores the initial special move', () => {
    render(<MoveLog moves={[{ move: { type: 'start' } }, ...moves.slice(0, 3)]} notation="usi" startColor="white" />);
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['1', '', '7g7f']);
    fireEvent.click(screen.getByRole('button', { name: 'Newest moves first' }));
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['2', '3c3d', '2g2f']);
  });
});
