
import React, { useLayoutEffect, useRef, useState } from 'react';
import './MoveLog.css';
import { formatMoveForDisplay } from '../utils/moveNotation';

interface MoveLogProps {
  moves: any[];
  notation: 'western' | 'kifu' | 'usi' | 'csa';
  startColor?: 'black' | 'white';
}

const MoveLog: React.FC<MoveLogProps> = ({ moves, notation, startColor = 'black' }) => {
  const [newestFirst, setNewestFirst] = useState(false);
  const scrollArea = useRef<HTMLDivElement>(null);

  // Filter out the initial "開始局面" (Starting phase) special move
  const actualMoves = moves.filter(move => {
    if ('move' in move && move.move && typeof move.move === 'object' && 'type' in move.move) {
      // This is a special move, check if it's the START type
      return move.move.type !== 'start';
    }
    return true; // Keep regular moves
  });

  // Group moves into pairs (black, white) for table display
  const movePairs: { black: string; white: string }[] = [];
  
  let startIndex = 0;
  if (startColor === 'white' && actualMoves.length > 0) {
    movePairs.push({
      black: '',
      white: actualMoves[0] ? formatMoveForDisplay(actualMoves[0], notation, false) : ''
    });
    startIndex = 1;
  }
  
  for (let i = startIndex; i < actualMoves.length; i += 2) {
    const blackMove = actualMoves[i] ? formatMoveForDisplay(actualMoves[i], notation, true) : '';
    const whiteMove = actualMoves[i + 1] ? formatMoveForDisplay(actualMoves[i + 1], notation, false) : '';
    
    movePairs.push({
      black: blackMove,
      white: whiteMove
    });
  }

  const latestPair = movePairs.at(-1);
  const numberedPairs = movePairs.map((pair, index) => ({ ...pair, number: index + 1 }));
  const displayedPairs = newestFirst ? numberedPairs.reverse() : numberedPairs;

  useLayoutEffect(() => {
    const area = scrollArea.current;
    if (area) area.scrollTop = newestFirst ? 0 : area.scrollHeight;
  }, [actualMoves.length, newestFirst, notation, startColor, latestPair?.black, latestPair?.white]);

  return (
    <div className="move-log">
      <div className="move-log-header">
        <h3>Move History</h3>
        <button type="button" className="move-log-sort" aria-label="Newest moves first" aria-pressed={newestFirst}
          title={newestFirst ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
          onClick={() => setNewestFirst(value => !value)}>
          <span aria-hidden="true">{newestFirst ? '↓' : '↑'}</span> {newestFirst ? 'Newest first' : 'Oldest first'}
        </button>
      </div>
      <div ref={scrollArea} className="move-table-container" role="region" aria-label="Move history list" tabIndex={0}>

        <table className="move-table">
          <thead>
            <tr>
              <th></th>
              <th style={{ color: 'black' }}>☗</th>
              <th style={{ color: 'white' }}>☗</th>
            </tr>
          </thead>
          <tbody>
            {displayedPairs.map(pair => (
              <tr key={pair.number}>
                <td>{pair.number}</td>
                <td>{pair.black}</td>
                <td>{pair.white}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MoveLog;
