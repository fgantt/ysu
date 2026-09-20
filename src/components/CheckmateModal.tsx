import React from 'react';

interface CheckmateModalProps {
  winner: 'player1' | 'player2' | 'draw' | null;
  endgameType?: 'checkmate' | 'resignation' | 'repetition' | 'stalemate' | 'illegal' | 'no_moves' | 'impasse' | 'timeout';
  details?: string;
  onDismiss: () => void;
  onNewGame: () => void;
}

const CheckmateModal: React.FC<CheckmateModalProps> = ({ 
  winner, 
  endgameType = 'checkmate',
  details,
  onDismiss, 
  onNewGame 
}) => {
  let title, message, emoji;

  if (winner === 'draw') {
    title = "Draw";
    emoji = "🤝";
    
    switch (endgameType) {
      case 'repetition':
        message = "The game is a draw by four-fold repetition (Sennichite / 千日手).";
        break;
      case 'impasse':
        message = "The game is a draw by impasse (Jishōgi / 持将棋). Both players entered each other's camp with sufficient material.";
        break;
      default:
        message = "The game is a draw.";
    }
  } else if (winner) {
    const winnerName = winner === 'player1' ? 'Sente (Player 1)' : 'Gote (Player 2)';
    const loserName = winner === 'player1' ? 'Gote (Player 2)' : 'Sente (Player 1)';
    
    switch (endgameType) {
      case 'checkmate':
        title = "Checkmate!";
        emoji = "👑";
        message = `${winnerName} wins by checkmate (Tsumi / 詰み)!`;
        break;
      case 'resignation':
        title = "Resignation";
        emoji = "🏳️";
        message = `${loserName} has resigned. ${winnerName} wins!`;
        break;
      case 'stalemate':
      case 'no_moves':
        title = "No Legal Moves";
        emoji = "🚫";
        message = `${loserName} has no legal moves. In Shogi, this counts as a loss. ${winnerName} wins!`;
        break;
      case 'illegal':
        title = "Illegal Move";
        emoji = "⚠️";
        message = `${loserName} made an illegal move. ${winnerName} wins!`;
        break;
      case 'impasse':
        title = "Impasse Victory";
        emoji = "🏯";
        message = `${winnerName} wins by impasse (Jishōgi / 持将棋)! ${loserName} had insufficient material (less than 24 points).`;
        break;
      case 'timeout':
        title = "Game Over";
        message = `${winnerName} wins on time.`;
        break;
      default:
        title = "Game Over";
        message = `${winnerName} wins!`;
    }
  } else {
    return null; // Should not happen
  }

  const overlayClass = `settings-overlay game-over-overlay`;
  const panelClass = `settings-panel game-over-modal`;
  const emojiClass = winner === 'draw' ? 'game-over-draw' : 'game-over-victory';

  return (
    <div className={overlayClass}>
      <div className={panelClass}>
        {emoji ? (
          <div className={emojiClass} style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>{emoji}</div>
        ) : (
          <div className="game-over-shogi-emblem">
            <svg viewBox="0 0 100 110" role="img" aria-label="Shogi king piece">
              <path d="M50 5 91 28 82 103H18L9 28Z" fill="#d8a968" stroke="#684425" strokeWidth="4" />
              <path d="M50 12 84 32 76 96H24L16 32Z" fill="#f1d198" stroke="#b78349" strokeWidth="2" />
              <text x="50" y="75" textAnchor="middle" fontFamily="Hiragino Mincho ProN, Yu Mincho, serif" fontSize="52" fontWeight="700" fill="#302018">王</text>
            </svg>
          </div>
        )}
        <h2 style={{ textAlign: 'center' }}>{title}</h2>
        <p style={{ textAlign: 'center', fontSize: '16px', margin: '16px 0' }}>{message}</p>
        {details && <p style={{ textAlign: 'center', fontSize: '14px', color: '#666', margin: '8px 0' }}>{details}</p>}
        <p className="game-over-note" style={{ textAlign: 'center', marginTop: '16px' }}>
          The game is now over. You can review the final position or start a new game.
        </p>
        <div className="checkmate-modal-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
          <button onClick={onNewGame}>New Game</button>
          <button onClick={onDismiss}>Review Position</button>
        </div>
      </div>
    </div>
  );
};

export default CheckmateModal;
