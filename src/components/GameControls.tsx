import React from 'react';
import { SecondaryViewMenu, SECONDARY_VIEW_OPEN_EVENT } from './SecondaryViewMenu';
import { gameMenuShortcut, type GameMenuCommand } from '../hooks/useGameMenuShortcuts';
import '../styles/shogi.css';
import './GameControls.css';

interface GameControlsProps {
  secondaryUsiAvailable?: boolean;
  secondaryAnalysisAvailable?: boolean;
  secondaryEngineViewsAvailable?: boolean;
  onExitGame: () => void;
  onNewGame: () => void;
  onOpenSettings: () => void;
  onOpenSaveModal: () => void;
  onOpenLoadModal: () => void;
  onExportGif: () => void;
  onCyclePieceTheme: () => void;
  onCycleBoardBackground: () => void;
  onToggleRecommendations?: () => void;
  recommendationsEnabled?: boolean;
  hasHumanPlayer?: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({ secondaryUsiAvailable = false, secondaryAnalysisAvailable = false, secondaryEngineViewsAvailable = false, onExitGame, onNewGame, onOpenSettings, onOpenSaveModal, onOpenLoadModal, onExportGif, onCyclePieceTheme, onCycleBoardBackground, onToggleRecommendations, recommendationsEnabled, hasHumanPlayer }) => {
  const shortcut = (command: GameMenuCommand) => <kbd aria-hidden="true">{gameMenuShortcut(command).label}</kbd>;
  return (
    <div className="game-controls">
      <div className="game-controls-left">
        <button aria-keyshortcuts={gameMenuShortcut('exit').aria} onClick={onExitGame} className="exit-game-btn">
          <span role="img" aria-label="Exit Game">🏠</span> Exit {shortcut('exit')}
        </button>
        <button aria-keyshortcuts={gameMenuShortcut('newGame').aria} onClick={onNewGame} className="new-game-btn">
          <span role="img" aria-label="New Game">🔄</span> New Game {shortcut('newGame')}
        </button>
        <button aria-keyshortcuts={gameMenuShortcut('save').aria} onClick={onOpenSaveModal}>
          <span role="img" aria-label="Save Game">💾</span> Save Game {shortcut('save')}
        </button>
        <button aria-keyshortcuts={gameMenuShortcut('load').aria} onClick={onOpenLoadModal}>
          <span role="img" aria-label="Load Game">📂</span> Load Game {shortcut('load')}
        </button>
        <button aria-keyshortcuts={gameMenuShortcut('exportGif').aria} onClick={onExportGif}>
          <span role="img" aria-label="Export animated GIF">🎞️</span> Export GIF {shortcut('exportGif')}
        </button>
      </div>
      <div className="game-controls-right">
        <SecondaryViewMenu handleShortcuts={false} available={view => view === 'usi' ? secondaryUsiAvailable : view === 'evaluation' ? secondaryEngineViewsAvailable : secondaryAnalysisAvailable} onOpen={view => window.dispatchEvent(new CustomEvent(SECONDARY_VIEW_OPEN_EVENT, { detail: view }))} />
        {hasHumanPlayer && onToggleRecommendations && (
          <button 
            aria-keyshortcuts={gameMenuShortcut('hints').aria}
            onClick={onToggleRecommendations}
            className={recommendationsEnabled ? 'active' : ''}
            title={recommendationsEnabled ? 'Hide AI recommendations' : 'Show AI recommendations'}
          >
            <span role="img" aria-label="AI Recommendations">💡</span> 
            {recommendationsEnabled ? 'Hide Hints' : 'Show Hints'} {shortcut('hints')}
          </button>
        )}
        <button aria-keyshortcuts={gameMenuShortcut('pieces').aria} onClick={onCyclePieceTheme}>
          <span role="img" aria-label="Cycle Piece Theme">♟️</span> Pieces {shortcut('pieces')}
        </button>
        <button aria-keyshortcuts={gameMenuShortcut('board').aria} onClick={onCycleBoardBackground}>
          <span role="img" aria-label="Cycle Board Background">🎨</span> Board {shortcut('board')}
        </button>
        <button aria-keyshortcuts={gameMenuShortcut('settings').aria} onClick={onOpenSettings}>
          <span role="img" aria-label="Settings">⚙️</span> Settings {shortcut('settings')}
        </button>
      </div>
    </div>
  );
};

export default GameControls;
