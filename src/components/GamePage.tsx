import { StudyGameImportDialog } from './StudyGameImportDialog';
import { createStudyGameRecord, type StudyGameBranch } from '../utils/studyGame';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { backgroundImageUrl } from '../data/backgroundArtwork';
import { thinkingHistoryStore } from '../utils/thinkingHistory';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { SECONDARY_VIEW_OPEN_EVENT, SECONDARY_VIEW_TOGGLE_EVENT, toggleSecondaryView, useSecondaryViewShortcuts, type SecondaryView } from './SecondaryViewMenu';
import { focusSecondaryPanel } from './SecondaryPanelFrame';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useShogiController } from '../context/ShogiControllerContext';
import { ImmutablePosition, Square, PieceType as TsshogiPieceType, isPromotableRank, Color } from 'tsshogi';
import Board, { BoardRef } from './Board';
import CapturedPieces from './CapturedPieces';
import GameControls from './GameControls';
import { MovableGameGroup } from './MovableGameGroup';
import { gameMenuShortcut, useGameMenuShortcuts } from '../hooks/useGameMenuShortcuts';
import RecommendationOverlay from './RecommendationOverlay';
import SettingsPanel from './SettingsPanel';
import MoveLog from './MoveLog';
import PromotionModal from './PromotionModal';
import CheckmateModal from './CheckmateModal';
import SaveGameModal from './SaveGameModal';
import LoadGameModal from './LoadGameModal';
import GameGifExportDialog from './GameGifExportDialog';
import UsiMonitor from './UsiMonitor';
import { UsiMonitorHost } from './UsiMonitorHost';
import { EvaluationHost } from './EvaluationHost';
import { CandidateMovesHost } from './CandidateMovesHost';
import { updateCandidateSearch, type CandidateSearch } from '../utils/candidateAnalysis';
import type { EvaluationPoint } from './EvaluationGraph';
import StartGameModal from './StartGameModal';
import Clock from './Clock';
import { getAvailablePieceThemes, AVAILABLE_PIECE_THEMES } from '../utils/pieceThemes';
import { GameSettings } from '../types';
import { loadWallpaperImages, loadBoardImages } from '../utils/imageLoader';
import { GameFormat, GameData, generateGame, detectFormat, parseGame } from '../utils/gameFormats';
import { playPieceMoveSound, playCheckmateSound, playDrawSound, setSoundsEnabled, setVolume } from '../utils/audio';
import { sendUsiCommand, parseBestMove, parseEngineInfo } from '../utils/tauriEngine';
import { invoke } from '@tauri-apps/api/core';
import type { CommandResponse, EngineConfig } from '../types/engine';
import { useTauriEvents } from '../hooks/useTauriEvents';
import './GamePage.css';

// Helper function to check if a piece is already promoted
const isPiecePromoted = (pieceType: TsshogiPieceType): boolean => {
  return [
    TsshogiPieceType.PROM_PAWN,
    TsshogiPieceType.PROM_LANCE,
    TsshogiPieceType.PROM_KNIGHT,
    TsshogiPieceType.PROM_SILVER,
    TsshogiPieceType.HORSE, // promoted bishop
    TsshogiPieceType.DRAGON  // promoted rook
  ].includes(pieceType);
};

// Helper function to check if the game is over
interface GamePageProps {
  isUsiMonitorVisible: boolean;
  lastSentCommand: string;
  lastReceivedCommand: string;
  communicationHistory: Array<{
    id: string;
    timestamp: Date;
    direction: 'sent' | 'received';
    command: string;
    sessionId: string;
  }>;
  sessions: string[];
  onToggleUsiMonitor: () => void;
  onDismissUsiMonitor: () => void;
  clearUsiHistory: () => void;
}

const GamePage: React.FC<GamePageProps> = ({ 
  isUsiMonitorVisible,
  lastSentCommand,
  lastReceivedCommand,
  communicationHistory,
  sessions,
  onToggleUsiMonitor,
  onDismissUsiMonitor,
  clearUsiHistory
}) => {
  const SQUARE_WIDTH = 70;
  const SQUARE_HEIGHT = 76;
  const PROMOTION_MODAL_WIDTH = SQUARE_WIDTH * 2;
  const PROMOTION_MODAL_HEIGHT = SQUARE_HEIGHT * 1;

  const location = useLocation();
  const navigate = useNavigate();
  
  // Get player types from navigation state directly
  const getPlayerTypesFromState = () => {
    const state = location.state as any;
    return {
      player1Type: state?.player1Type || 'human',
      player2Type: state?.player2Type || 'ai'
    };
  };
  const controller = useShogiController();
  const [position, setPosition] = useState<ImmutablePosition | null>(null);
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false);
  const [isEvaluationVisible, setIsEvaluationVisible] = useState(() => localStorage.getItem('shogi-evaluation-visible') !== 'false');
  const [evaluationPoints, setEvaluationPoints] = useState<EvaluationPoint[]>([]);
  const [candidateSearches, setCandidateSearches] = useState<CandidateSearch[]>([]);
  const candidateSearchRef = useRef(new Map<string, CandidateSearch>());
  const [isCandidatesVisible, setIsCandidatesVisible] = useState(() => localStorage.getItem('shogi-candidates-visible') !== 'false');
  useEffect(() => { localStorage.setItem('shogi-candidates-visible', String(isCandidatesVisible)); }, [isCandidatesVisible]);
  const handleToggleCandidates = useCallback(() => setIsCandidatesVisible(value => !value), []);
  const handleDismissCandidates = useCallback(() => setIsCandidatesVisible(false), []);
  const beginCandidateSearch = (engineId: string, rootSfen: string) => {
    const search = { engineId, searchId: crypto.randomUUID(), rootSfen, complete: false, lines: [] };
    candidateSearchRef.current.set(engineId, search);
    thinkingHistoryStore.record(search, engineNamesRef.current.get(engineId) ?? engineId, 'game');
    setCandidateSearches([...candidateSearchRef.current.values()]);
  };
  const latestEvaluationRef = useRef(new Map<string, number>());
  useEffect(() => { localStorage.setItem('shogi-evaluation-visible', String(isEvaluationVisible)); }, [isEvaluationVisible]);
  const handleToggleEvaluation = useCallback(() => setIsEvaluationVisible(visible => !visible), []);
  const handleDismissEvaluation = useCallback(() => setIsEvaluationVisible(false), []);
  const [renderKey, setRenderKey] = useState(0); // Force re-render counter
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square | null; to: Square | null } | null>(null);
  const [selectedCapturedPiece, setSelectedCapturedPiece] = useState<TsshogiPieceType | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: Square; to: Square; pieceType: TsshogiPieceType; player: 'player1' | 'player2'; destinationSquareUsi: string } | null>(null);
  const [winner, setWinnerState] = useState<'player1' | 'player2' | 'draw' | null>(null);
  const [isGameOverDialogDismissed, setIsGameOverDialogDismissed] = useState(false);
  const [endgameType, setEndgameType] = useState<'checkmate' | 'resignation' | 'repetition' | 'stalemate' | 'illegal' | 'no_moves' | 'impasse' | 'timeout'>('checkmate');
  const [endgameDetails, setEndgameDetails] = useState<string | undefined>(undefined);
  const gameInitializedRef = useRef(false); // Prevent double initialization in strict mode
  const gameStartedAtRef = useRef(new Date().toISOString());
  const componentId = useRef(`COMPONENT-${Math.random().toString(36).substr(2, 9)}`);
  
  const mountedRef = useRef(true);

  // Track component lifecycle
  useEffect(() => {
    mountedRef.current = true;
    console.log(`========================================`);
    console.log(`[${componentId.current}] GamePage MOUNTED`);
    console.log(`[${componentId.current}] gameInitializedRef.current: ${gameInitializedRef.current}`);
    console.log(`========================================`);
    
    return () => {
      console.log(`========================================`);
      mountedRef.current = false;
      console.log(`[${componentId.current}] GamePage UNMOUNTING`);
      console.log(`========================================`);
    };
  }, []);
  
  // Wrapper to log all winner state changes
  const setWinner = (value: 'player1' | 'player2' | 'draw' | null) => {
    console.log('[GAMEPAGE] ========================================');
    console.log('[GAMEPAGE] setWinner called with:', value);
    console.log('[GAMEPAGE] ========================================');
    console.trace('Stack trace:');
    setWinnerState(value);
  };
  const [studyImport, setStudyImport] = useState<StudyGameBranch | null>(null);
  const [studyImportError, setStudyImportError] = useState('');
  const [studyImportBusy, setStudyImportBusy] = useState(false);
  const [gameplayReady, setGameplayReady] = useState(false);
  const gameplayReadyRef = useRef(false);
  const turnSearchRef = useRef<{
    engineId: string; rootSfen: string; generation: number;
    kind: 'move' | 'recommendation'; cancelled: boolean;
  } | null>(null);
  const playingMessagesSuspended = useRef(false);
  const playingGenerationRef = useRef(0);
  const playingGeneration = playingGenerationRef.current;
  const studyImportInFlight = useRef(false);
  const studyEnginesToStop = useRef<string[] | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isGifExportOpen, setIsGifExportOpen] = useState(false);
  const [isStartGameModalOpen, setIsStartGameModalOpen] = useState(false);
  const [isExitConfirmModalOpen, setIsExitConfirmModalOpen] = useState(false);
  const [savedGames, setSavedGames] = useState<{[key: string]: string}>({});
  const [savedReplayMetadata, setSavedReplayMetadata] = useState<{
    [key: string]: Pick<GameData, 'appearance' | 'clockSnapshots'>;
  }>({});
  const [isInCheck, setIsInCheck] = useState(false);
  const [kingInCheckSquare, setKingInCheckSquare] = useState<Square | null>(null);
  const [attackingPieces, setAttackingPieces] = useState<Square[]>([]);
  const [startColor, setStartColor] = useState<'black' | 'white'>('black');
  const [blackTime, setBlackTime] = useState(0);
  const [whiteTime, setWhiteTime] = useState(0);
  const [byoyomi, setByoyomi] = useState(0);
  const [isByoyomiBlack, setIsByoyomiBlack] = useState(false);
  const [isByoyomiWhite, setIsByoyomiWhite] = useState(false);
  const [moves, setMoves] = useState<any[]>([]);
  const clockSnapshotsRef = useRef<NonNullable<GameData['clockSnapshots']>>([]);
  const lastClockSnapshotPlyRef = useRef(0);
  
  // Player type state (used for UI display and controller communication)
  const [player1Type, setPlayer1Type] = useState<'human' | 'ai'>('human');
  const [player2Type, setPlayer2Type] = useState<'human' | 'ai'>('ai');
  
  // Recommendation state
  const [recommendationsEnabled, setRecommendationsEnabled] = useState(false);
  const [currentRecommendation, setCurrentRecommendation] = useState<{ 
    from: Square | null; 
    to: Square | null; 
    isDrop?: boolean; 
    pieceType?: string; 
    isPromotion?: boolean; 
  } | null>(null);
  
  // Recommendation engine state
  const [recommendationEngineId, setRecommendationEngineId] = useState<string | null>(() => {
    return localStorage.getItem('shogi-recommendation-engine-id');
  });
  
  // Debug: Log when recommendationEngineId changes
  useEffect(() => {
    console.log('[GamePage] recommendationEngineId changed:', recommendationEngineId);
  }, [recommendationEngineId]);

  const [recommendationEngineOptions, setRecommendationEngineOptions] = useState<{[key: string]: string} | null>(() => {
    const stored = localStorage.getItem('shogi-recommendation-engine-options');
    return stored ? JSON.parse(stored) : null;
  });

  // Persist recommendation engine settings
  useEffect(() => {
    if (recommendationEngineId) {
      localStorage.setItem('shogi-recommendation-engine-id', recommendationEngineId);
    } else {
      localStorage.removeItem('shogi-recommendation-engine-id');
    }
  }, [recommendationEngineId]);

  useEffect(() => {
    if (recommendationEngineOptions) {
      localStorage.setItem('shogi-recommendation-engine-options', JSON.stringify(recommendationEngineOptions));
    } else {
      localStorage.removeItem('shogi-recommendation-engine-options');
    }
  }, [recommendationEngineOptions]);
  const [, setIsRequestingRecommendation] = useState(false);
  const [highlightedCapturedPiece, setHighlightedCapturedPiece] = useState<string | null>(null);
  
  // Recommendation engine settings
  
  
  // Tauri engine state
  const [useTauriEngine, setUseTauriEngine] = useState(false);
  const [player1EngineId, setPlayer1EngineId] = useState<string | null>(null);
  const [player2EngineId, setPlayer2EngineId] = useState<string | null>(null);
  const [activeEngineIds, setActiveEngineIds] = useState<string[]>([]);
  const [availableEngines, setAvailableEngines] = useState<EngineConfig[]>([]);
  const [engineNames, setEngineNames] = useState<Map<string, string>>(new Map());
  const liveTurnRef = useRef({ player1EngineId, player2EngineId, player1Type, player2Type, recommendationsEnabled, winner });
  liveTurnRef.current = { player1EngineId, player2EngineId, player1Type, player2Type, recommendationsEnabled, winner };

  const searchStillOwnsTurn = (search: NonNullable<typeof turnSearchRef.current>) => {
    const live = liveTurnRef.current;
    if (!mountedRef.current || !gameplayReadyRef.current || playingMessagesSuspended.current || live.winner || search.cancelled ||
        search.generation !== playingGenerationRef.current || controller.getPosition().sfen !== search.rootSfen) return false;
    const black = search.rootSfen.split(' ')[1] === 'b';
    const engineId = black ? live.player1EngineId : live.player2EngineId;
    const type = black ? live.player1Type : live.player2Type;
    return engineId === search.engineId && (search.kind === 'move' ? type === 'ai' : type === 'human' && live.recommendationsEnabled);
  };

  // USI bestmove has no request ID. Keep ownership until its terminal response,
  // including after stop, so a late result cannot be applied to a newer search.
  const acceptSearchMessage = (engineId: string, message: string) => {
    if (!message.startsWith('info ') && !message.startsWith('bestmove')) return true;
    const search = turnSearchRef.current;
    if (!search || search.engineId !== engineId) return false;
    const accepted = searchStillOwnsTurn(search);
    if (message.startsWith('bestmove')) {
      turnSearchRef.current = null;
      if (!accepted) setRenderKey(value => value + 1);
    }
    return accepted;
  };

  const engineNamesRef = useRef(engineNames);
  engineNamesRef.current = engineNames;
  useEffect(() => () => {
    for (const search of candidateSearchRef.current.values()) if (!search.complete) thinkingHistoryStore.record(search, engineNamesRef.current.get(search.engineId) ?? search.engineId, 'game', 'stopped');
  }, []);
  
  // Engine thinking state - track the current thinking move (first PV) for each engine
  const [thinkingMovePlayer1, setThinkingMovePlayer1] = useState<string | null>(null);
  const [thinkingMovePlayer2, setThinkingMovePlayer2] = useState<string | null>(null);
  
  // Debug: Log when thinking moves change
  useEffect(() => {
    console.log('[GamePage] Thinking move Player 1 updated:', thinkingMovePlayer1);
  }, [thinkingMovePlayer1]);
  
  useEffect(() => {
    console.log('[GamePage] Thinking move Player 2 updated:', thinkingMovePlayer2);
  }, [thinkingMovePlayer2]);
  
  // Refs for board containers to get actual dimensions
  const compactBoardRef = useRef<HTMLDivElement | null>(null);
  const boardComponentRef = useRef<BoardRef | null>(null);
  
  

  // Helper function to find the king square for a given player
  const findKingSquare = (position: ImmutablePosition, player: 'black' | 'white'): Square | null => {
    for (let rank = 0; rank < 9; rank++) {
      for (let file = 0; file < 9; file++) {
        const square = Square.newByXY(file, rank);
        if (square) {
          const piece = position.board.at(square);
          if (piece && piece.type === 'king' && piece.color === player) {
            return square;
          }
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const games = JSON.parse(localStorage.getItem('shogi-saved-games') || '{}');
    setSavedGames(games);
    const replayMetadata = JSON.parse(localStorage.getItem('shogi-saved-game-replay-metadata') || '{}');
    setSavedReplayMetadata(replayMetadata);
  }, []);

  // Handle navigation state from HomePage
  useEffect(() => {
    const initializationGeneration = playingGenerationRef.current;
    console.log(`[${componentId.current}] Navigation effect triggered`);
    console.log(`[${componentId.current}] gameInitializedRef.current: ${gameInitializedRef.current}`);
    
    // Prevent double initialization in React strict mode
    if (gameInitializedRef.current) {
      console.log(`[${componentId.current}] SKIPPING initialization - already initialized`);
      return;
    }
    
    console.log(`[${componentId.current}] PROCEEDING with initialization`);
    
    if (location.state && controller.isInitialized()) {
      const { 
        player1Type, 
        player2Type, 
        aiDifficulty, 
        showAttackedPieces: stateShowAttackedPieces, 
        showPieceTooltips: stateShowPieceTooltips,
        player1Level: statePlayer1Level,
        player2Level: statePlayer2Level,
        minutesPerSide: stateMinutesPerSide,
        byoyomiInSeconds: stateByoyomiInSeconds,
        initialSfen: stateInitialSfen,
        player1EngineId: statePlayer1EngineId,
        player2EngineId: statePlayer2EngineId,
        recommendationEngineId: stateRecommendationEngineId,
        recommendationEngineOptions: stateRecommendationEngineOptions
      } = location.state as any;
      
      if (player1Type && player2Type) {
        console.log('Initializing game from navigation state:', { 
          player1Type, 
          player2Type, 
          aiDifficulty, 
          initialSfen: stateInitialSfen,
          player1EngineId: statePlayer1EngineId,
          player2EngineId: statePlayer2EngineId
        });
        
        // Set player types in controller
        controller.setPlayerTypes(player1Type, player2Type);
        
        // Set AI levels from navigation state or fallback to difficulty
        const player1Level = statePlayer1Level || (aiDifficulty === 'easy' ? 3 : aiDifficulty === 'medium' ? 5 : 7);
        const player2Level = statePlayer2Level || (aiDifficulty === 'easy' ? 3 : aiDifficulty === 'medium' ? 5 : 7);
        controller.setAILevels(player1Level, player2Level);
        
        // Set time controls from navigation state or use defaults
        const minutesPerSide = stateMinutesPerSide || 30;
        const byoyomiInSeconds = stateByoyomiInSeconds || 10;
        controller.setTimeControls(minutesPerSide * 60 * 1000, minutesPerSide * 60 * 1000, byoyomiInSeconds * 1000);
        setBlackTime(minutesPerSide * 60 * 1000);
        setWhiteTime(minutesPerSide * 60 * 1000);
        setByoyomi(byoyomiInSeconds * 1000);
        clockSnapshotsRef.current = [{
          blackTime: minutesPerSide * 60 * 1000,
          whiteTime: minutesPerSide * 60 * 1000,
          isByoyomiBlack: false,
          isByoyomiWhite: false,
        }];
        lastClockSnapshotPlyRef.current = 0;
        
        // Update local state
        setPlayer1Type(player1Type);
        setPlayer2Type(player2Type);
        
        // Set other settings from navigation state
        if (stateShowAttackedPieces !== undefined) {
          setShowAttackedPieces(stateShowAttackedPieces);
        }
        if (stateShowPieceTooltips !== undefined) {
          setShowPieceTooltips(stateShowPieceTooltips);
        }
        
        // Set recommendation engine settings from navigation state
        if (stateRecommendationEngineId !== undefined) {
          setRecommendationEngineId(stateRecommendationEngineId);
        }
        if (stateRecommendationEngineOptions !== undefined) {
          setRecommendationEngineOptions(stateRecommendationEngineOptions);
        }
        
        // Determine start color from SFEN
        if (stateInitialSfen) {
          const turn = stateInitialSfen.split(' ')[1];
          setStartColor(turn === 'w' ? 'white' : 'black');
        } else {
          setStartColor('black');
        }

        // CRITICAL: Set the ref BEFORE async operations to prevent React Strict Mode double-initialization
        gameInitializedRef.current = true;
        gameStartedAtRef.current = new Date().toISOString();
        
        // Initialize Tauri engines if any player is AI or if we have recommendation engine settings
        const needsTauriEngine = player1Type === 'ai' || player2Type === 'ai' || (player1Type === 'human' && player2Type === 'human');
        console.log('[Navigation Init] Needs Tauri engine:', needsTauriEngine);
        
        if (needsTauriEngine) {
          // Disable auto engine moves for Tauri mode
          controller.setDisableAutoEngineMove(true);
          setUseTauriEngine(true);
          console.log('[Navigation Init] Tauri mode enabled, initializing engines...');
          
          // Get engines and auto-assign built-in if not specified
          invoke<CommandResponse<EngineConfig[]>>('get_engines').then(async response => {
            if (initializationGeneration !== playingGenerationRef.current) return;
            if (response.success && response.data && response.data.length > 0) {
              const builtinEngine = response.data.find(e => e.is_builtin);
              const defaultEngine = builtinEngine || response.data[0];
              
              // Use provided engine IDs from navigation state, or fall back to default
              const engine1 = player1Type === 'ai' ? (statePlayer1EngineId || defaultEngine.id) : null;
              const engine2 = player2Type === 'ai' ? (statePlayer2EngineId || defaultEngine.id) : null;
              
              setPlayer1EngineId(engine1);
              setPlayer2EngineId(engine2);
              
              console.log('[Navigation Init] Engine IDs:', { 
                engine1, 
                engine2,
                fromState: { statePlayer1EngineId, statePlayer2EngineId },
                usingDefault: { 
                  player1: !statePlayer1EngineId && player1Type === 'ai',
                  player2: !statePlayer2EngineId && player2Type === 'ai'
                }
              });
              
              // Set player types FIRST
              setPlayer1Type(player1Type);
              setPlayer2Type(player2Type);
              
              // Initialize engines FIRST
              await initializeTauriEngines({
                player1Type,
                player2Type,
                player1EngineId: engine1,
                player2EngineId: engine2,
                minutesPerSide,
                byoyomiInSeconds,
                useTauriEngine: true,
                initialSfen: stateInitialSfen
              });
              
              if (initializationGeneration !== playingGenerationRef.current) return;
              console.log('[Navigation Init] Engines initialized, starting game...');
              
              // THEN start the game - this will trigger the AI effect with engines ready
              return controller.newGame(stateInitialSfen).then(() => {
                if (initializationGeneration !== playingGenerationRef.current) return;
                gameplayReadyRef.current = true;
                setGameplayReady(true);
                console.log(`[${componentId.current}] Game initialized successfully`);
              });
            }
          }).catch(error => {
            console.error('[Navigation Init] Failed to initialize:', error);
            gameInitializedRef.current = false; // Reset on error
          });
        } else {
          controller.setDisableAutoEngineMove(false);
          setUseTauriEngine(false);
          
          // No Tauri engines needed, start game immediately
          console.log(`[${componentId.current}] Starting game without Tauri engines`);
          controller.newGame(stateInitialSfen).then(() => {
            if (initializationGeneration !== playingGenerationRef.current) return;
            gameplayReadyRef.current = true;
            setGameplayReady(true);
            console.log(`[${componentId.current}] Game initialized successfully`);
          }).catch(error => {
            console.error(`[${componentId.current}] Failed to start new game:`, error);
            gameInitializedRef.current = false;
          });
        }
      }
    }
    
    // DON'T reset the ref in cleanup - it should persist across React Strict Mode re-mounts
    // Only reset when actually starting a new game via handleStartGame
  }, [location.state, controller]);

  // Note: Initial AI move is now handled by the controller's newGame() method

  const [pieceLabelType, setPieceLabelType] = useState(localStorage.getItem('shogi-piece-label-type') || 'kanji');
  const [notation, setNotation] = useState(localStorage.getItem('shogi-notation') || 'kifu');
  const [showAttackedPieces, setShowAttackedPieces] = useState(localStorage.getItem('shogi-show-attacked-pieces') === 'true' || true);
  const [showPieceTooltips, setShowPieceTooltips] = useState(localStorage.getItem('shogi-show-piece-tooltips') === 'true' || false);
  const [showEngineThinking, setShowEngineThinking] = useState(localStorage.getItem('shogi-show-engine-thinking') !== 'false'); // Default to true
  const [soundsEnabled, setSoundsEnabledState] = useState(localStorage.getItem('shogi-sounds-enabled') !== 'false'); // Default to true
  const [soundVolume, setSoundVolumeState] = useState(() => {
    const stored = localStorage.getItem('shogi-sound-volume');
    return stored ? parseFloat(stored) : 0.9; // Default to 90%
  });
  const [wallpaper, setWallpaper] = useState(localStorage.getItem('shogi-wallpaper') || '');
  const [boardBackground, setBoardBackground] = useState(localStorage.getItem('shogi-board-background') || '');
  const [wallpaperList, setWallpaperList] = useState<string[]>([]);
  const [boardBackgroundList, setBoardBackgroundList] = useState<string[]>([]);
  const [pieceThemeList, setPieceThemeList] = useState<string[]>(['kanji', 'english', ...AVAILABLE_PIECE_THEMES]);

  // Sync sound settings with audio manager
  useEffect(() => {
    setSoundsEnabled(soundsEnabled);
  }, [soundsEnabled]);

  // Sync volume settings with audio manager
  useEffect(() => {
    setVolume(soundVolume);
  }, [soundVolume]);

  // Listen for AI moves to play sound
  useEffect(() => {
    const handleAiMove = () => {
      console.log('[GamePage] AI move made, playing sound');
      playPieceMoveSound();
    };

    console.log('[GamePage] Registering aiMoveMade listener');
    controller.on('aiMoveMade', handleAiMove);

    return () => {
      console.log('[GamePage] Unregistering aiMoveMade listener');
      controller.off('aiMoveMade', handleAiMove);
    };
  }, [controller]);

  // Listen for game over events from controller
  useEffect(() => {
    console.log('[GAMEPAGE] Setting up gameOver event listener');
    
    const handleGameOver = (data: { 
      winner: 'player1' | 'player2' | 'draw';
      endgameType?: 'checkmate' | 'resignation' | 'repetition' | 'stalemate' | 'illegal' | 'no_moves' | 'impasse' | 'timeout';
      details?: string;
    }) => {
      console.log('[GAMEPAGE] ========================================');
      console.log('[GAMEPAGE] GAME OVER EVENT RECEIVED!', data);
      console.log('[GAMEPAGE] Setting winner to:', data.winner);
      console.log('[GAMEPAGE] Endgame type:', data.endgameType);
      console.log('[GAMEPAGE] Details:', data.details);
      console.log('[GAMEPAGE] ========================================');
      setWinner(data.winner);
      setEndgameType(data.endgameType || 'checkmate');
      setEndgameDetails(data.details);
      
      // Play appropriate game over sound
      if (data.winner === 'draw') {
        playDrawSound();
      } else {
        playCheckmateSound();
      }
      
      console.log('[GAMEPAGE] Winner state updated');
    };

    controller.on('gameOver', handleGameOver);
    console.log('[GAMEPAGE] gameOver event listener registered');

    return () => {
      console.log('[GAMEPAGE] Cleaning up gameOver event listener');
      controller.off('gameOver', handleGameOver);
    };
  }, [controller]);

  // Wrapper function for setting sounds enabled
  const handleSoundsEnabledChange = (enabled: boolean) => {
    setSoundsEnabledState(enabled);
    setSoundsEnabled(enabled);
  };

  // Wrapper function for setting sound volume
  const handleSoundVolumeChange = (volume: number) => {
    setSoundVolumeState(volume);
    setVolume(volume);
  };

  useEffect(() => {
    const loadAssets = async () => {
      let finalWallpaperPaths: string[] = [];
      let finalBoardPaths: string[] = [];

      try {
        // Try to dynamically load images from directories
        const [wallpaperPaths, boardPaths] = await Promise.all([
          loadWallpaperImages(),
          loadBoardImages()
        ]);

        // Use dynamically loaded images (no fallbacks - users can add their own images)
        finalWallpaperPaths = wallpaperPaths;
        finalBoardPaths = boardPaths;

        setWallpaperList(finalWallpaperPaths);
        setBoardBackgroundList(finalBoardPaths);

        console.log('Loaded wallpapers:', finalWallpaperPaths.length, 'images');
        console.log('Loaded boards:', finalBoardPaths.length, 'images');
      } catch (error) {
        console.error('Error loading images dynamically:', error);
        // Use empty arrays - users can add their own images
        finalWallpaperPaths = [];
        finalBoardPaths = [];
        setWallpaperList(finalWallpaperPaths);
        setBoardBackgroundList(finalBoardPaths);
      }

      // Load available piece themes
      try {
        const themes = await getAvailablePieceThemes();
        const loadedThemeIds = themes.map(theme => theme.id);
        // Combine base themes with loaded themes and legacy themes, removing duplicates
        const allThemeIds = ['kanji', 'english', ...new Set([...loadedThemeIds, ...AVAILABLE_PIECE_THEMES])];
        setPieceThemeList(allThemeIds);
      } catch (error) {
        console.error('Error loading piece themes:', error);
        // Keep the initial state with legacy themes if loading fails
      }

      // Set random wallpaper and board background if not already set
      if (!wallpaper) {
        const randomWallpaper = finalWallpaperPaths[Math.floor(Math.random() * finalWallpaperPaths.length)];
        setWallpaper(randomWallpaper);
        localStorage.setItem('shogi-wallpaper', randomWallpaper);
      }
      
      if (!boardBackground) {
        const randomBoardBackground = finalBoardPaths[Math.floor(Math.random() * finalBoardPaths.length)];
        setBoardBackground(randomBoardBackground);
        localStorage.setItem('shogi-board-background', randomBoardBackground);
        window.dispatchEvent(new Event('shogi-appearance-change'));
      }
    };

    loadAssets();
  }, []);

  // Timer for clock counting - only start after first move
  useEffect(() => {
    if (!position || winner) return;

    // Don't start the clock until after the first move is made
    // Use the same filtering logic as MoveLog component to check for actual moves
    const actualMoves = moves.filter(move => {
      if ('move' in move && typeof move.move === 'object' && 'type' in move.move) {
        // This is a special move, check if it's the START type
        return move.move.type !== 'start';
      }
      return true; // Keep regular moves
    });
    
    if (actualMoves.length === 0) {
      return () => {}; // Return empty cleanup function
    }

    // Only create timer when moves exist
    const timer = setInterval(() => {
      const isBlackTurn = position.sfen.includes(' b ');

      if (isBlackTurn) {
        // Black's turn - count down black's time
        if (blackTime > 0) {
          setBlackTime(prev => prev - 1000);
        } else if (!isByoyomiBlack) {
          // Enter byoyomi when main time runs out
          setIsByoyomiBlack(true);
          setBlackTime(byoyomi);
        } else {
          // In byoyomi, count down the byoyomi time
          setBlackTime(prev => {
            const newTime = Math.max(0, prev - 1000);
            if (newTime === 0 && !winner) {
              // Black ran out of byoyomi time - they lose
              setWinnerState('player2'); // White wins
              setEndgameType('timeout');
              setEndgameDetails('Black ran out of time');
            }
            return newTime;
          });
        }
      } else {
        // White's turn - count down white's time
        if (whiteTime > 0) {
          setWhiteTime(prev => prev - 1000);
        } else if (!isByoyomiWhite) {
          // Enter byoyomi when main time runs out
          setIsByoyomiWhite(true);
          setWhiteTime(byoyomi);
        } else {
          // In byoyomi, count down the byoyomi time
          setWhiteTime(prev => {
            const newTime = Math.max(0, prev - 1000);
            if (newTime === 0 && !winner) {
              // White ran out of byoyomi time - they lose
              setWinnerState('player1'); // Black wins
              setEndgameType('timeout');
              setEndgameDetails('White ran out of time');
            }
            return newTime;
          });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [position, controller, moves, blackTime, whiteTime, isByoyomiBlack, isByoyomiWhite, byoyomi, winner]); // Added all dependencies

  // Reset byoyomi timer when a move is made
  useEffect(() => {
    const actualMoves = moves.filter(move => {
      if ('move' in move && typeof move.move === 'object' && 'type' in move.move) {
        return move.move.type !== 'start';
      }
      return true;
    });

    if (actualMoves.length > 0) {
      const isBlackTurn = position?.sfen.includes(' b ');
      
      if (isBlackTurn) {
        // It's black's turn, so white just made a move - reset white's byoyomi if they were in it
        if (isByoyomiWhite) {
          setWhiteTime(byoyomi);
        }
      } else {
        // It's white's turn, so black just made a move - reset black's byoyomi if they were in it
        if (isByoyomiBlack) {
          setBlackTime(byoyomi);
        }
      }
    }
  }, [moves, position, isByoyomiBlack, isByoyomiWhite, byoyomi]);

  // Capture one clock state per ply for optional playback in exported GIFs.
  // Depending only on the move record avoids recording every timer tick.
  useEffect(() => {
    const ply = moves.filter(move => {
      if ('move' in move && typeof move.move === 'object' && 'type' in move.move) {
        return move.move.type !== 'start';
      }
      return true;
    }).length;

    if (ply > lastClockSnapshotPlyRef.current) {
      const isBlackTurn = position?.sfen.includes(' b ');
      clockSnapshotsRef.current[ply] = {
        blackTime: !isBlackTurn && isByoyomiBlack ? byoyomi : blackTime,
        whiteTime: isBlackTurn && isByoyomiWhite ? byoyomi : whiteTime,
        isByoyomiBlack,
        isByoyomiWhite,
      };
      lastClockSnapshotPlyRef.current = ply;
    }
  }, [moves]);

  // Update controller with current clock times
  useEffect(() => {
    if (controller.isInitialized()) {
      controller.updateCurrentTimes(blackTime, whiteTime);
    }
  }, [blackTime, whiteTime, controller]);

  // Apply wallpaper to document body when wallpaper changes
  useEffect(() => {
    if (wallpaper) {
      document.body.style.backgroundImage = `url('${backgroundImageUrl(wallpaper)}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundPosition = 'center center';
      document.body.style.backgroundAttachment = 'fixed';
    }
  }, [wallpaper]);

  useEffect(() => {
    const onStateChanged = (newPosition: ImmutablePosition) => {
      console.log('[onStateChanged] Position updated, SFEN:', newPosition.sfen);
      console.log('[onStateChanged] isCurrentPlayerAI:', controller.isCurrentPlayerAI());
      
      // Force a re-render by updating both position and render key
      // The position object from tsshogi is mutable, so we need to trigger React's re-render
      setPosition(newPosition);
      setRenderKey(prev => prev + 1);
      
      // Update last move for highlighting
      const lastMoveData = controller.getLastMove();
      setLastMove(lastMoveData);
      
      // Update moves state for timer dependency
      setMoves(controller.getRecord().moves);
      
      // Update recommendation state
      if (controller.areRecommendationsEnabled()) {
        const newRecommendation = controller.getCurrentRecommendation();
        setCurrentRecommendation(newRecommendation);
      } else {
        setCurrentRecommendation(null);
      }
      
      
      // Check for check state
      const checked = newPosition.checked;
      setIsInCheck(checked);
      
      if (checked) {
        // Find the king that's in check
        const currentPlayer = newPosition.sfen.includes(' b ') ? 'black' : 'white';
        const kingSquare = findKingSquare(newPosition, currentPlayer);
        setKingInCheckSquare(kingSquare);
        
        if (kingSquare) {
          // Find attacking pieces - only those from the opposing player
          const allAttackers = newPosition.listAttackers(kingSquare);
          const kingPiece = newPosition.board.at(kingSquare);
          
          if (kingPiece) {
            const opposingAttackers = allAttackers.filter(attackerSquare => {
              const attackerPiece = newPosition.board.at(attackerSquare);
              return attackerPiece && attackerPiece.color !== kingPiece.color;
            });
            setAttackingPieces(opposingAttackers);
          }
        }
      } else {
        setKingInCheckSquare(null);
        setAttackingPieces([]);
      }
      
      // Check for game over (checkmate or no legal moves)
      // DISABLED: checkGameOver() has false positives - rely on controller/AI detection instead
      // console.log('🔍 State changed, checking for game over...');
      // const gameOverResult = checkGameOver(newPosition);
      // console.log('🔍 checkGameOver returned:', gameOverResult);
      // if (gameOverResult) {
      //   console.log('🎊 UI DETECTED GAME OVER:', gameOverResult);
      //   setWinner(gameOverResult);
      //   console.log('🎊 Winner set by UI to:', gameOverResult);
      // }
    };


    controller.on('stateChanged', onStateChanged);
    controller.on('recommendationReceived', () => {
      setIsRequestingRecommendation(false);
    });
    controller.on('recommendationTimeout', () => {
      setIsRequestingRecommendation(false);
    });

    
    
    setPosition(controller.getPosition());

    return () => {
      controller.off('stateChanged', onStateChanged);
      controller.off('recommendationReceived', () => {
        setIsRequestingRecommendation(false);
      });
      controller.off('recommendationTimeout', () => {
        setIsRequestingRecommendation(false);
      });
      
    };
  }, [controller]);

  const handleRecommendationToggle = () => {
    const newEnabled = !recommendationsEnabled;
    setRecommendationsEnabled(newEnabled);
    controller.setRecommendationsEnabled(newEnabled);
  };

  // Parse recommendation move from USI string
  const parseRecommendationMove = useCallback((usiMove: string) => {
    try {
      console.log('Parsing recommendation move:', usiMove);
      
      // Create a move from the USI string
      const move = controller.getPosition().createMoveByUSI(usiMove);
      if (!move) {
        console.error('Failed to parse USI move:', usiMove);
        return;
      }
      
      // Extract move information
      const fromSquare = typeof move.from === 'object' && 'x' in move.from 
        ? move.from as Square 
        : null;
      const toSquare = move.to as Square;
      
      // Check if this is a drop move
      const isDrop = fromSquare === null;
      let pieceType = '';
      
      if (isDrop) {
        // Extract piece type from USI move string (e.g., "P*5d" -> "P")
        const match = usiMove.match(/^([A-Z])\*/);
        pieceType = match ? match[1] : '';
      }
      
      // Check if this is a promotion move
      const isPromotion = usiMove.endsWith('+');
      
      console.log('Recommendation parsed:', { from: fromSquare, to: toSquare, isDrop, pieceType, isPromotion });
      
      // Set the recommendation
      setCurrentRecommendation({
        from: fromSquare,
        to: toSquare,
        isDrop,
        pieceType,
        isPromotion
      });
      
    } catch (error) {
      console.error('Error parsing recommendation move:', error);
    }
  }, [controller]);

  const handleHighlightCapturedPiece = (pieceType: string | null) => {
    setHighlightedCapturedPiece(pieceType);
  };

  const handleExitGame = () => {
    // Check if game is in progress by looking at moves
    const moves = controller.getRecord().moves;
    const isGameInProgress = moves.length > 0;
    
    if (isGameInProgress) {
      // Show confirmation modal
      setIsExitConfirmModalOpen(true);
    } else {
      // Navigate back to home page immediately if no game in progress
      navigate('/');
    }
  };

  const handleConfirmExit = () => {
    setIsExitConfirmModalOpen(false);
    navigate('/');
  };

  const handleCancelExit = () => {
    setIsExitConfirmModalOpen(false);
  };


  // Determine which player should get the highlight based on current turn
  const getHighlightedPieceForPlayer = (player: 'player1' | 'player2') => {
    if (!highlightedCapturedPiece || !position) return null;
    
    // Current player is determined by the SFEN notation
    const currentPlayerIsBlack = position.sfen.includes(' b ');
    const currentPlayer = currentPlayerIsBlack ? 'player1' : 'player2';
    
    // Only highlight for the current player
    return player === currentPlayer ? highlightedCapturedPiece : null;
  };

  const handleSquareClick = (row: number, col: number) => {
    if (!position) return;
    const clickedSquare = Square.newByXY(col, row);
    if (!clickedSquare) return;

    // Handle drop move if a captured piece is selected
    if (selectedCapturedPiece) {
      // Check if the clicked square is a valid drop square
      const validDropSquares = controller.getValidDropSquares(selectedCapturedPiece);
      const isValidDrop = validDropSquares.some(square => square.equals(clickedSquare));
      
      if (isValidDrop) {
        // Create drop move USI string (e.g., "P*5d")
        const pieceChar = controller.pieceTypeToUsiChar(selectedCapturedPiece);
        if (pieceChar) {
          const dropMove = `${pieceChar}*${clickedSquare.usi}`;
        console.log('Drop move handler - clearing recommendation');
        setIsRequestingRecommendation(false);
        setCurrentRecommendation(null);
          controller.handleUserMove(dropMove);
          playPieceMoveSound();
        }
      }
      
      // Clear selection after drop attempt
      setSelectedCapturedPiece(null);
      setLegalMoves([]);
      return;
    }

    // Deselect if clicking the same square
    if (selectedSquare?.equals(clickedSquare)) {
      setSelectedSquare(null);
      setSelectedCapturedPiece(null);
      setLegalMoves([]);
      return;
    }

    // If a piece is selected, try to move
    if (selectedSquare) {
      const piece = position.board.at(selectedSquare);
      if (!piece) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Check if the move is eligible for promotion
      const currentColor = position.sfen.includes(' b ') ? Color.BLACK : Color.WHITE;
      const isFromPromotable = isPromotableRank(currentColor, selectedSquare.rank);
      const isToPromotable = isPromotableRank(currentColor, clickedSquare.rank);
      const canPromote = !isPiecePromoted(piece.type) && // Piece is not already promoted
                        piece.type !== TsshogiPieceType.KING && 
                        piece.type !== TsshogiPieceType.GOLD && 
                        (isFromPromotable || isToPromotable);

      if (canPromote) {
        console.log('GamePage: piece.type before setPromotionMove:', piece.type);
        // Show promotion modal instead of making the move directly
        setPromotionMove({
          from: selectedSquare,
          to: clickedSquare,
          pieceType: piece.type,
          player: currentColor === Color.BLACK ? 'player1' : 'player2',
          destinationSquareUsi: clickedSquare.usi,
        });
        setSelectedSquare(null);
        setLegalMoves([]);
      } else {
        // Make the move directly
        const moveUsi = `${selectedSquare.usi}${clickedSquare.usi}`;
        console.log('[GamePage] User making move:', moveUsi);
        console.log('[GamePage] useTauriEngine:', useTauriEngine);
        console.log('[GamePage] Player types:', { player1Type, player2Type });
        setIsRequestingRecommendation(false);
        setCurrentRecommendation(null);
        controller.handleUserMove(moveUsi);
        playPieceMoveSound();
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    } else {
      // No piece selected, so select one
      const piece = position.board.at(clickedSquare);
      if (piece && piece.color === (position.sfen.includes(' b ') ? 'black' : 'white')) {
        setSelectedSquare(clickedSquare);
        setSelectedCapturedPiece(null); // Clear captured piece selection
        // Get legal moves for the selected piece
        const moves = controller.getLegalMovesForSquare(clickedSquare);
        setLegalMoves(moves);
      }
    }
  };

  const handleDragStart = (row: number, col: number) => {
    if (!position) return;
    const draggedSquare = Square.newByXY(col, row);
    if (!draggedSquare) return;

    const piece = position.board.at(draggedSquare);
    if (piece && piece.color === (position.sfen.includes(' b ') ? 'black' : 'white')) {
      // Select the piece and show legal moves (same as clicking)
      setSelectedSquare(draggedSquare);
      setSelectedCapturedPiece(null); // Clear captured piece selection
      const moves = controller.getLegalMovesForSquare(draggedSquare);
      setLegalMoves(moves);
    }
  };

  const handleDragEnd = (row: number, col: number) => {
    if (!position || !selectedSquare) return;
    const droppedSquare = Square.newByXY(col, row);
    if (!droppedSquare) return;

    // Check if the drop is on a legal move square
    const isLegalMove = legalMoves.some(move => move.equals(droppedSquare));
    
    if (isLegalMove) {
      // Make the move (same logic as clicking)
      const piece = position.board.at(selectedSquare);
      if (!piece) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Check if the move is eligible for promotion
      const currentColor = position.sfen.includes(' b ') ? Color.BLACK : Color.WHITE;
      const isFromPromotable = isPromotableRank(currentColor, selectedSquare.rank);
      const isToPromotable = isPromotableRank(currentColor, droppedSquare.rank);
      const canPromote = !isPiecePromoted(piece.type) && // Piece is not already promoted
                        piece.type !== TsshogiPieceType.KING && 
                        piece.type !== TsshogiPieceType.GOLD && 
                        (isFromPromotable || isToPromotable);

      if (canPromote) {
        // Show promotion modal instead of making the move directly
        setPromotionMove({
          from: selectedSquare,
          to: droppedSquare,
          pieceType: piece.type,
          player: currentColor === Color.BLACK ? 'player1' : 'player2',
          destinationSquareUsi: droppedSquare.usi,
        });
        setSelectedSquare(null);
        setLegalMoves([]);
      } else {
        // Make the move directly
        const moveUsi = `${selectedSquare.usi}${droppedSquare.usi}`;
        setIsRequestingRecommendation(false);
        setCurrentRecommendation(null);
        controller.handleUserMove(moveUsi);
        playPieceMoveSound();
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    } else {
      // Invalid drop - just clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handleDragOver = (_row: number, _col: number) => {
    // Optional: Could add visual feedback here
    // For now, we'll just let the legal move highlighting handle it
  };

  const handlePromotion = (promote: boolean) => {
    if (!promotionMove) return;

    const { from, to } = promotionMove;
    const move = `${from.usi}${to.usi}${promote ? '+' : ''}`;
    setIsRequestingRecommendation(false);
    controller.clearRecommendation();
    setCurrentRecommendation(null);
    controller.handleUserMove(move);
    playPieceMoveSound();
    setPromotionMove(null);
  };

  const handleNewGame = () => {
    setIsGameOverDialogDismissed(true);
    setIsStartGameModalOpen(true);
  };


  const handleStartGame = async (settings: GameSettings) => {
    playingGenerationRef.current++;
    const startGeneration = playingGenerationRef.current;
    playingMessagesSuspended.current = true;
    gameplayReadyRef.current = false;
    setGameplayReady(false);
    turnSearchRef.current = null;
    const previousEngines = [...activeEngineIds];
    setPlayer1EngineId(null);
    setPlayer2EngineId(null);
    setActiveEngineIds([]);
    await Promise.allSettled(previousEngines.map(engineId => invoke('stop_engine', { engineId })));
    if (startGeneration !== playingGenerationRef.current) return;
    console.log('[handleStartGame] Called with settings:', settings);
    gameStartedAtRef.current = new Date().toISOString();
    clearUsiHistory();
    latestEvaluationRef.current.clear();
    setEvaluationPoints([]);
    gameInitializedRef.current = true; // Mark as initialized to prevent navigation override
    setPlayer1Type(settings.player1Type);
    setPlayer2Type(settings.player2Type);
    
    // Check if we need to use Tauri engines (any AI player selected, or human vs human for recommendations)
    const needsTauriEngine = settings.player1Type === 'ai' || settings.player2Type === 'ai' || (settings.player1Type === 'human' && settings.player2Type === 'human');
    
    if (needsTauriEngine) {
      // If AI selected but no engine ID, get the built-in engine
      let player1Engine = settings.player1EngineId;
      let player2Engine = settings.player2EngineId;
      
      // Load engines and auto-select built-in if needed
      try {
        const response = await invoke<CommandResponse<EngineConfig[]>>('get_engines');
        if (response.success && response.data && response.data.length > 0) {
          const builtinEngine = response.data.find(e => e.is_builtin);
          const defaultEngine = builtinEngine || response.data[0];
          
          if (settings.player1Type === 'ai' && !player1Engine) {
            player1Engine = defaultEngine.id;
            console.log('Auto-selected engine for Player 1 (AI):', defaultEngine.name);
          }
          if (settings.player2Type === 'ai' && !player2Engine) {
            player2Engine = defaultEngine.id;
            console.log('Auto-selected engine for Player 2 (AI):', defaultEngine.name);
          }
          
          // For human vs human games, also auto-select engines for recommendations
          if (settings.player1Type === 'human' && settings.player2Type === 'human') {
            if (!player1Engine) {
              player1Engine = defaultEngine.id;
              console.log('Auto-selected recommendation engine for Player 1 (Human):', defaultEngine.name);
            }
            if (!player2Engine) {
              player2Engine = defaultEngine.id;
              console.log('Auto-selected recommendation engine for Player 2 (Human):', defaultEngine.name);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load engines for auto-selection:', error);
      }
      
      if (startGeneration !== playingGenerationRef.current) return;

      // Update settings with auto-selected engines
      const updatedSettings = {
        ...settings,
        player1EngineId: player1Engine,
        player2EngineId: player2Engine,
        useTauriEngine: true,
      };
      
      setUseTauriEngine(true);
      setPlayer1EngineId(player1Engine ?? null);
      setPlayer2EngineId(player2Engine ?? null);
      
      console.log('[handleStartGame] Using engines:', {
        player1Engine,
        player2Engine,
        originalSettings: { p1: settings.player1EngineId, p2: settings.player2EngineId },
        updated: { p1: player1Engine, p2: player2Engine }
      });
      
      // Set player types FIRST so controller knows who's AI
      controller.setPlayerTypes(settings.player1Type, settings.player2Type);
      
      // Disable automatic engine move requests in controller (Tauri handles it externally)
      controller.setDisableAutoEngineMove(true);
      console.log('[handleStartGame] Tauri mode enabled, auto engine moves disabled');
      
      await initializeTauriEngines(updatedSettings);
    } else {
      setUseTauriEngine(false);
      // Set player types and enable automatic engine move requests for non-Tauri mode
      controller.setPlayerTypes(settings.player1Type, settings.player2Type);
      controller.setDisableAutoEngineMove(false);
    }
    
    if (startGeneration !== playingGenerationRef.current) return;

    // Player types already set above based on mode
    controller.setAILevels(5, 5);
    controller.setTimeControls(settings.minutesPerSide * 60 * 1000, settings.minutesPerSide * 60 * 1000, settings.byoyomiInSeconds * 1000);
    setBlackTime(settings.minutesPerSide * 60 * 1000);
    setWhiteTime(settings.minutesPerSide * 60 * 1000);
    setByoyomi(settings.byoyomiInSeconds * 1000);
    setIsByoyomiBlack(false);
    setIsByoyomiWhite(false);
    clockSnapshotsRef.current = [{
      blackTime: settings.minutesPerSide * 60 * 1000,
      whiteTime: settings.minutesPerSide * 60 * 1000,
      isByoyomiBlack: false,
      isByoyomiWhite: false,
    }];
    lastClockSnapshotPlyRef.current = 0;
    
    // Determine start color from SFEN
    if (settings.initialSfen) {
      const turn = settings.initialSfen.split(' ')[1];
      setStartColor(turn === 'w' ? 'white' : 'black');
    } else {
      setStartColor('black');
    }

    for (const search of candidateSearchRef.current.values()) if (!search.complete) thinkingHistoryStore.record(search, engineNamesRef.current.get(search.engineId) ?? search.engineId, 'game', 'stopped');
    candidateSearchRef.current.clear();
    setCandidateSearches([]);
    await controller.newGame(settings.initialSfen).then(() => {
      if (startGeneration !== playingGenerationRef.current) return;
      playingMessagesSuspended.current = false;
      gameplayReadyRef.current = true;
      setGameplayReady(true);
    }).catch(error => {
      console.error('Failed to start new game:', error);
    });
    setWinner(null);
    setIsGameOverDialogDismissed(false);
    setIsStartGameModalOpen(false);
  };

  // Initialize Tauri engines when game starts with Tauri engine settings
  const initializeTauriEngines = async (settings: GameSettings) => {
    const initializationGeneration = playingGenerationRef.current;
    const isStale = () => !mountedRef.current || initializationGeneration !== playingGenerationRef.current;
    console.log('[initializeTauriEngines] Starting with settings:', settings);
    const engineIds: string[] = [];
    const names = new Map<string, string>();
    let runtimePlayer1Id: string | null = null;
    let runtimePlayer2Id: string | null = null;
    
    try {
      // Load engine configs
      console.log('[initializeTauriEngines] Loading engine configs...');
      const response = await invoke<CommandResponse<EngineConfig[]>>('get_engines');
      console.log('[initializeTauriEngines] Engine configs response:', response);
      
      if (!response.success || !response.data) {
        console.error('[initializeTauriEngines] Failed to load engines:', response);
        return;
      }

      if (isStale()) return;

      // Store engines for display name lookup in USI monitor
      setAvailableEngines(response.data);

      // Always spawn player 1 engine (AI or recommendation engine for human)
      let player1EngineId = settings.player1EngineId;
      if (settings.player1Type === 'human') {
        // For human players, use the recommendation engine from settings, or fall back to favorite
        if (recommendationEngineId) {
          player1EngineId = recommendationEngineId;
        } else {
          const favoriteEngine = response.data.find(e => e.is_favorite);
          const defaultEngine = favoriteEngine || response.data.find(e => e.is_builtin) || response.data[0];
          player1EngineId = defaultEngine?.id;
        }
      }
      
      if (player1EngineId) {
        console.log('[initializeTauriEngines] Player 1 engine (AI or recommendation):', player1EngineId);
        const engine = response.data.find(e => e.id === player1EngineId);
        console.log('[initializeTauriEngines] Player 1 engine found:', engine);
        
        if (engine) {
          // Generate unique runtime ID (timestamp + random) to allow same engine for both players
          const runtimeId = `${player1EngineId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          console.log('[initializeTauriEngines] Spawning player 1 engine with runtime ID:', runtimeId);
          const spawnResult = await invoke<CommandResponse>('spawn_engine', {
            engineId: runtimeId,
            name: engine.name,
            path: engine.path,
            tempOptions: settings.player1TempOptions || null,
          });
          console.log('[initializeTauriEngines] Player 1 spawn result:', spawnResult);
          
          if (spawnResult.success) {
            engineIds.push(runtimeId);
            runtimePlayer1Id = runtimeId;
            names.set(runtimeId, engine.display_name || engine.name);
            
            // Engine is now initialized by the backend
            console.log('[initializeTauriEngines] Player 1 engine spawned and initialized');
            
            // Send usinewgame to prepare for a new game
            console.log('[initializeTauriEngines] Sending usinewgame to player 1 engine...');
            await sendUsiCommand(runtimeId, 'usinewgame');
            
            // Give it a moment to process
            await new Promise(resolve => setTimeout(resolve, 300));
            
            console.log('[initializeTauriEngines] Player 1 engine ready');
          }
        }
      }

      // Always spawn player 2 engine (AI or recommendation engine for human)
      let player2EngineId = settings.player2EngineId;
      if (settings.player2Type === 'human') {
        // For human players, use the recommendation engine from settings, or fall back to favorite
        if (recommendationEngineId) {
          player2EngineId = recommendationEngineId;
        } else {
          const favoriteEngine = response.data.find(e => e.is_favorite);
          const defaultEngine = favoriteEngine || response.data.find(e => e.is_builtin) || response.data[0];
          player2EngineId = defaultEngine?.id;
        }
      }
      
      if (!isStale() && player2EngineId) {
        console.log('[initializeTauriEngines] Player 2 engine (AI or recommendation):', player2EngineId);
        const engine = response.data.find(e => e.id === player2EngineId);
        console.log('[initializeTauriEngines] Player 2 engine found:', engine);
        
        if (engine) {
          // Generate unique runtime ID (timestamp + random) to allow same engine for both players
          const runtimeId = `${player2EngineId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          console.log('[initializeTauriEngines] Spawning player 2 engine with runtime ID:', runtimeId);
          const spawnResult = await invoke<CommandResponse>('spawn_engine', {
            engineId: runtimeId,
            name: engine.name,
            path: engine.path,
            tempOptions: settings.player2TempOptions || null,
          });
          console.log('[initializeTauriEngines] Player 2 spawn result:', spawnResult);
          
          if (spawnResult.success) {
            engineIds.push(runtimeId);
            runtimePlayer2Id = runtimeId;
            names.set(runtimeId, engine.display_name || engine.name);
            
            // Engine is now initialized by the backend
            console.log('[initializeTauriEngines] Player 2 engine spawned and initialized');
            
            // Send usinewgame to prepare for a new game
            console.log('[initializeTauriEngines] Sending usinewgame to player 2 engine...');
            await sendUsiCommand(runtimeId, 'usinewgame');
            
            // Give it a moment to process
            await new Promise(resolve => setTimeout(resolve, 300));
            
            console.log('[initializeTauriEngines] Player 2 engine ready');
          }
        }
      }

      if (isStale()) {
        await Promise.allSettled(engineIds.map(engineId => invoke('stop_engine', { engineId })));
        return;
      }
      setActiveEngineIds(engineIds);
      setEngineNames(names);
      // Update the player engine IDs with runtime IDs so AI move logic uses correct IDs
      console.log('[initializeTauriEngines] Setting player engine IDs:', {
        runtimePlayer1Id,
        runtimePlayer2Id,
        engineIds
      });
      setPlayer1EngineId(runtimePlayer1Id);
      setPlayer2EngineId(runtimePlayer2Id);
      console.log('[initializeTauriEngines] All engines initialized. Active engine IDs:', engineIds);
    } catch (error) {
      console.error('[initializeTauriEngines] Error:', error);
    }
  };

  // Memoize event handlers to prevent duplicate listeners
  const captureEvaluationMessage = useCallback((engineId: string, message: string) => {
    const search = candidateSearchRef.current.get(engineId);
    if (search) {
      const updated = updateCandidateSearch(search, message);
      if (updated !== search) {
        candidateSearchRef.current.set(engineId, updated);
        thinkingHistoryStore.record(updated, engineNamesRef.current.get(engineId) ?? engineId, 'game');
        setCandidateSearches([...candidateSearchRef.current.values()]);
      }
    }
    if (message.startsWith('info ')) {
      const info = parseEngineInfo(message);
      if (info.score !== undefined && (info.multipv === undefined || info.multipv === 1)) {
        const senteScore = engineId === player2EngineId ? -info.score : info.score;
        latestEvaluationRef.current.set(engineId, senteScore);
      }
      return;
    }
    if (!message.startsWith('bestmove')) return;
    const score = latestEvaluationRef.current.get(engineId);
    if (score === undefined) return;
    latestEvaluationRef.current.delete(engineId);
    const ply = controller.getRecord().moves.filter(entry => {
      const move = (entry as any).move;
      return !(move && typeof move === 'object' && move.type === 'start');
    }).length;
    setEvaluationPoints(current => {
      const withoutSamePly = current.filter(point => point.ply !== ply);
      return [...withoutSamePly, { ply, score, engineId }].sort((a, b) => a.ply - b.ply);
    });
  }, [controller, player2EngineId]);

  const handlePlayer1UsiMessage = useCallback((engineId: string, message: string) => {
    if (playingMessagesSuspended.current || playingGeneration !== playingGenerationRef.current) return;
    if (!acceptSearchMessage(engineId, message)) return;
    // Log all USI messages from engine
    console.log(`[USI Engine ${engineId}] Received: ${message}`);
    captureEvaluationMessage(engineId, message);
    
    if (message.startsWith('bestmove')) {
      const { move } = parseBestMove(message);
      
      // Clear thinking move when bestmove is received
      setThinkingMovePlayer1(null);
      
      // Only apply moves if it's an AI player's turn
      const isBlackTurn = controller.getPosition().sfen.split(' ')[1] === 'b';
      const live = liveTurnRef.current;
      const isAITurn = isBlackTurn ? live.player1Type === 'ai' : live.player2Type === 'ai';
      
      if (move && move !== 'resign' && isAITurn) {
        // Log position state before applying move for debugging
        console.log('[Tauri Event] Applying AI move:', move);
        console.log('[Tauri Event] Current position SFEN:', position?.sfen);
        console.log('[Tauri Event] Current turn:', isBlackTurn ? 'Black' : 'White');
        console.log('[Tauri Event] Record moves count:', controller.getRecord().moves.length);
        
        // Apply the engine's move (handleUserMove returns boolean, not Promise)
        const moveResult = controller.handleUserMove(move);
        if (moveResult) {
          // Play sound for AI move
          playPieceMoveSound();
        } else {
          console.error('[Tauri Event] Failed to apply AI engine move:', move);
          console.error('[Tauri Event] Position SFEN when move failed:', position?.sfen);
          console.error('[Tauri Event] This suggests the engine searched from a different position than the frontend has');
        }
      } else if (move && move !== 'resign' && !isAITurn && recommendationsEnabled) {
        // Parse and display recommendation instead of applying move
        parseRecommendationMove(move);
      }
    }
    
    // Parse info messages to track thinking move
    if (message.startsWith('info ')) {
      const info = parseEngineInfo(message);
      if (info.pv && info.pv.length > 0) {
        const firstPvMove = info.pv[0];
        setThinkingMovePlayer1(firstPvMove);
      }
    }
    
    // Log specific USI protocol responses
    if (message === 'usiok') {
      console.log(`[USI Engine ${engineId}] Engine ready (usiok received)`);
    } else if (message === 'readyok') {
      console.log(`[USI Engine ${engineId}] Engine ready (readyok received)`);
    } else if (message.startsWith('id ')) {
      console.log(`[USI Engine ${engineId}] Engine identification: ${message}`);
    } else if (message.startsWith('option ')) {
      console.log(`[USI Engine ${engineId}] Engine option: ${message}`);
    }
  }, [position, player1Type, player2Type, controller, recommendationsEnabled, parseRecommendationMove, captureEvaluationMessage]);

  const handlePlayer1UsiError = useCallback((engineId: string, error: string) => {
    console.error(`Tauri engine ${engineId} error: ${error}`);
    const search = candidateSearchRef.current.get(engineId);
    if (search && !search.complete && error === 'Engine process died') thinkingHistoryStore.record(search, engineNamesRef.current.get(engineId) ?? engineId, 'game', 'error');
  }, []);

  // Listen to Tauri engine events
  useTauriEvents(useTauriEngine && activeEngineIds.length > 0 ? activeEngineIds[0] : null, {
    onUsiMessage: handlePlayer1UsiMessage,
    onUsiError: handlePlayer1UsiError,
  });

  // Memoize event handlers for second engine
  const handlePlayer2UsiMessage = useCallback((engineId: string, message: string) => {
    if (playingMessagesSuspended.current || playingGeneration !== playingGenerationRef.current) return;
    if (!acceptSearchMessage(engineId, message)) return;
    // Log all USI messages from engine
    console.log(`[USI Engine ${engineId}] Received: ${message}`);
    captureEvaluationMessage(engineId, message);
    
    if (message.startsWith('bestmove')) {
      const { move } = parseBestMove(message);
      
      // Clear thinking move when bestmove is received
      setThinkingMovePlayer2(null);
      
      // Only apply moves if it's an AI player's turn
      const isBlackTurn = controller.getPosition().sfen.split(' ')[1] === 'b';
      const live = liveTurnRef.current;
      const isAITurn = isBlackTurn ? live.player1Type === 'ai' : live.player2Type === 'ai';
      
      if (move && move !== 'resign' && isAITurn) {
        // Log position state before applying move for debugging
        console.log('[Tauri Event] Applying AI move (Player 2):', move);
        console.log('[Tauri Event] Current position SFEN:', position?.sfen);
        console.log('[Tauri Event] Current turn:', isBlackTurn ? 'Black' : 'White');
        console.log('[Tauri Event] Record moves count:', controller.getRecord().moves.length);
        
        // Apply the engine's move (handleUserMove returns boolean, not Promise)
        const moveResult = controller.handleUserMove(move);
        if (moveResult) {
          // Play sound for AI move
          playPieceMoveSound();
        } else {
          console.error('[Tauri Event] Failed to apply second AI engine move:', move);
          console.error('[Tauri Event] Position SFEN when move failed:', position?.sfen);
          console.error('[Tauri Event] This suggests the engine searched from a different position than the frontend has');
        }
      } else if (move && move !== 'resign' && !isAITurn && recommendationsEnabled) {
        // Parse and display recommendation instead of applying move
        parseRecommendationMove(move);
      }
    }
    
    // Parse info messages to track thinking move
    if (message.startsWith('info ')) {
      const info = parseEngineInfo(message);
      if (info.pv && info.pv.length > 0) {
        const firstPvMove = info.pv[0];
        setThinkingMovePlayer2(firstPvMove);
      }
    }
    
    // Log specific USI protocol responses
    if (message === 'usiok') {
      console.log(`[USI Engine ${engineId}] Engine ready (usiok received)`);
    } else if (message === 'readyok') {
      console.log(`[USI Engine ${engineId}] Engine ready (readyok received)`);
    } else if (message.startsWith('id ')) {
      console.log(`[USI Engine ${engineId}] Engine identification: ${message}`);
    } else if (message.startsWith('option ')) {
      console.log(`[USI Engine ${engineId}] Engine option: ${message}`);
    }
  }, [position, player1Type, player2Type, controller, recommendationsEnabled, parseRecommendationMove, captureEvaluationMessage]);

  const handlePlayer2UsiError = useCallback((engineId: string, error: string) => {
    console.error(`Tauri engine ${engineId} error: ${error}`);
    const search = candidateSearchRef.current.get(engineId);
    if (search && !search.complete && error === 'Engine process died') thinkingHistoryStore.record(search, engineNamesRef.current.get(engineId) ?? engineId, 'game', 'error');
  }, []);

  // Listen to second engine if both players are AI
  useTauriEvents(useTauriEngine && activeEngineIds.length > 1 ? activeEngineIds[1] : null, {
    onUsiMessage: handlePlayer2UsiMessage,
    onUsiError: handlePlayer2UsiError,
  });


  const requestTurnSearch = async (engineId: string, kind: 'move' | 'recommendation') => {
    const search = { engineId, rootSfen: controller.getPosition().sfen,
      generation: playingGenerationRef.current, kind, cancelled: false };
    if (!searchStillOwnsTurn(search)) return;
    const previous = turnSearchRef.current;
    if (previous) {
      if (searchStillOwnsTurn(previous)) return;
      if (!previous.cancelled) {
        previous.cancelled = true;
        await sendUsiCommand(previous.engineId, 'stop');
      }
      return; // Drain its bestmove before allowing another search.
    }
    turnSearchRef.current = search;
    try {
      const positioned = await sendUsiCommand(engineId, `position sfen ${search.rootSfen}`);
      if (!positioned.success) throw new Error(positioned.error ?? 'Engine rejected the position');
      if (turnSearchRef.current !== search || !searchStillOwnsTurn(search)) {
        if (turnSearchRef.current === search) turnSearchRef.current = null;
        return;
      }
      beginCandidateSearch(engineId, search.rootSfen);
      const go = kind === 'move'
        ? `go btime ${blackTime} wtime ${whiteTime} byoyomi ${byoyomi}`
        : 'go movetime 5000';
      const started = await sendUsiCommand(engineId, go);
      if (!started.success) throw new Error(started.error ?? 'Engine failed to start searching');
    } catch (error) {
      if (turnSearchRef.current === search) turnSearchRef.current = null;
      console.error('[requestTurnSearch] Error:', error);
    }
  };

  // Wait for both runtime IDs and the final starting position. Every delayed
  // request is cancelled on a turn/settings change and revalidated before go.
  useEffect(() => {
    const previous = turnSearchRef.current;
    if (previous && !previous.cancelled && !searchStillOwnsTurn(previous)) {
      previous.cancelled = true;
      void sendUsiCommand(previous.engineId, 'stop');
    }
    if (!gameplayReady || !useTauriEngine || !position || winner || playingMessagesSuspended.current) return;
    const black = position.sfen.split(' ')[1] === 'b';
    const engineId = black ? player1EngineId : player2EngineId;
    const type = black ? player1Type : player2Type;
    if (!engineId || (type !== 'ai' && !recommendationsEnabled)) return;
    const generation = playingGenerationRef.current;
    const rootSfen = position.sfen;
    const timer = setTimeout(() => {
      if (generation !== playingGenerationRef.current || controller.getPosition().sfen !== rootSfen) return;
      void requestTurnSearch(engineId, type === 'ai' ? 'move' : 'recommendation');
    }, 500);
    return () => clearTimeout(timer);
  }, [gameplayReady, position, renderKey, useTauriEngine, player1EngineId, player2EngineId, winner, player1Type, player2Type, recommendationsEnabled]);

  // Cleanup Tauri engines on unmount
  useEffect(() => {
    return () => {
      if (useTauriEngine && activeEngineIds.length > 0) {
        activeEngineIds.forEach(engineId => {
          invoke('stop_engine', { engineId }).catch(error => {
            console.error('Error stopping engine:', error);
          });
        });
      }
    };
  }, [useTauriEngine, activeEngineIds]);

  const handleDismiss = () => {
    setIsGameOverDialogDismissed(true);
  };

  const handleSettingChange = (setter: (value: any) => void, key: string) => (value: any) => {
    setter(value);
    localStorage.setItem(key, value.toString());
    if (key === 'shogi-board-background' || key === 'shogi-piece-label-type') {
      window.dispatchEvent(new Event('shogi-appearance-change'));
    }
    
    // Dispatch custom event for same-tab theme updates
    if (key === 'shogi-piece-label-type') {
      const event = new CustomEvent('themeChange', { detail: value.toString() });
      window.dispatchEvent(event);
    }
  };

  const handleWallpaperChange = (value: string) => {
    setWallpaper(value);
    localStorage.setItem('shogi-wallpaper', value);
    // Apply wallpaper to document body immediately
    document.body.style.backgroundImage = `url('${value}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundPosition = 'center center';
    document.body.style.backgroundAttachment = 'fixed';
  };

  const handleCyclePieceTheme = () => {
    if (pieceThemeList.length === 0) return;
    
    const currentIndex = pieceThemeList.indexOf(pieceLabelType);
    // If current theme is not in the list, start from the beginning
    const startIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (startIndex + 1) % pieceThemeList.length;
    const nextTheme = pieceThemeList[nextIndex];
    handleSettingChange(setPieceLabelType, 'shogi-piece-label-type')(nextTheme);
  };

  const handleCycleBoardBackground = () => {
    if (boardBackgroundList.length === 0) return;
    
    const currentIndex = boardBackgroundList.indexOf(boardBackground);
    // If current background is not in the list, start from the beginning
    const startIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (startIndex + 1) % boardBackgroundList.length;
    const nextBackground = boardBackgroundList[nextIndex];
    handleSettingChange(setBoardBackground, 'shogi-board-background')(nextBackground);
  };

  const handleOpenGifExport = () => {
    setIsCompactMenuOpen(false);
    setIsGifExportOpen(true);
  };

  const handleSaveGame = (name: string, format: GameFormat) => {
    const gameData: GameData = {
      ...currentGameData,
      metadata: { ...currentGameData.metadata, name },
    };

    // Save in the specified format
    const gameText = generateGame(gameData, format);
    const newSavedGames = { ...savedGames, [name]: gameText };
    setSavedGames(newSavedGames);
    localStorage.setItem('shogi-saved-games', JSON.stringify(newSavedGames));
    const newReplayMetadata = {
      ...savedReplayMetadata,
      [name]: {
        appearance: gameData.appearance,
        clockSnapshots: gameData.clockSnapshots,
      },
    };
    setSavedReplayMetadata(newReplayMetadata);
    localStorage.setItem('shogi-saved-game-replay-metadata', JSON.stringify(newReplayMetadata));
    setIsSaveModalOpen(false);
  };

  const handleLoadGame = (name: string, _format: GameFormat) => {
    const gameText = savedGames[name];
    if (gameText) {
      const format = detectFormat(gameText);
      const parsed = format ? parseGame(gameText, format) : null;
      if (parsed?.success && parsed.data) {
        void handleLoadFromText(parsed.data);
      } else {
        console.error('Failed to load saved game:', parsed?.error || 'Unknown saved game format');
      }
    }
    setIsLoadModalOpen(false);
  };

  const handleLoadFromText = async (gameData: GameData) => {
    try {
      gameStartedAtRef.current = gameData.metadata.date || new Date().toISOString();
      clockSnapshotsRef.current = gameData.clockSnapshots ? [...gameData.clockSnapshots] : [];
      lastClockSnapshotPlyRef.current = gameData.clockSnapshots
        ? Math.max(0, gameData.clockSnapshots.length - 1)
        : 0;
      const turn = gameData.position.split(' ')[1];
      setStartColor(turn === 'w' ? 'white' : 'black');
      
      // Load the position first
      await controller.loadSfen(gameData.position);
      controller.getRecord().current.comment = gameData.metadata.comments?.[0] ?? '';
      
      // Apply all moves from the move history
      if (gameData.moves && gameData.moves.length > 0) {
        console.log('Applying moves:', gameData.moves);
        for (let i = 0; i < gameData.moves.length; i++) {
          const move = gameData.moves[i];
          if (move !== 'resign') {
            console.log(`Applying move ${i + 1}: ${move}`);
            const success = controller.handleUserMove(move);
            if (success) controller.getRecord().current.comment = gameData.metadata.comments?.[i + 1] ?? '';
            if (!success) {
              console.warn(`Failed to apply move ${i + 1}: ${move}`);
              console.warn(`Current position SFEN: ${controller.getPosition().sfen}`);
              break;
            }
          }
        }
      }
      
      console.log('Game loaded successfully with', gameData.moves?.length || 0, 'moves');
    } catch (error) {
      console.error('Failed to load game from text:', error);
    }
  };

  // Memoize game data to prevent excessive re-renders
  const currentGameData = useMemo((): GameData => {
    const record = controller.getRecord();
    const playerName = (isSente: boolean) => {
      const type = isSente ? player1Type : player2Type;
      const runtimeId = isSente ? player1EngineId : player2EngineId;
      if (type === 'human') return 'You';
      return runtimeId ? (engineNames.get(runtimeId) || 'Engine') : 'Engine';
    };
    
    // Extract USI moves - based on how MoveLog component accesses them
    const moves = record.moves.map((m: any) => m.move?.usi || '').filter(Boolean);
    
    return {
      position: record.initialPosition?.sfen ?? record.first?.sfen ?? controller.getPosition().sfen,
      moves: moves,
      metadata: {
        date: gameStartedAtRef.current,
        player1Name: playerName(true),
        player2Name: playerName(false),
        result: 'ongoing',
        comments: record.moves.map(node => node.comment),
      },
      appearance: {
        boardBackground,
        pieceThemeType: pieceLabelType,
        notation: notation as 'western' | 'kifu' | 'usi' | 'csa',
      },
      clockSnapshots: clockSnapshotsRef.current.length === moves.length + 1
        ? [...clockSnapshotsRef.current]
        : undefined,
    };
  }, [controller, position?.sfen, moves, blackTime, whiteTime, boardBackground, pieceLabelType, notation, player1Type, player2Type, player1EngineId, player2EngineId, engineNames]);

  const prepareStudyImport = (branch: StudyGameBranch) => {
    setStudyImport({ ...branch, moves: [...branch.moves], comments: [...branch.comments] });
    setStudyImportError('');
    studyEnginesToStop.current = null;
    setIsCompactMenuOpen(false);
    try { void getCurrentWindow().setFocus().catch(console.error); } catch { /* Browser preview has no native window. */ }
  };
  const loadStudyImport = async () => {
    if (!studyImport || studyImportInFlight.current) return;
    studyImportInFlight.current = true;
    setStudyImportBusy(true);
    try {
      // Validate before stopping anything or changing the live game.
      createStudyGameRecord(studyImport.rootSfen, studyImport.moves, studyImport.comments);
      playingGenerationRef.current++;
      playingMessagesSuspended.current = true;
      gameplayReadyRef.current = false;
      setGameplayReady(false);
      turnSearchRef.current = null;
      const engineIds = studyEnginesToStop.current ?? activeEngineIds;
      const stopped = await Promise.allSettled(engineIds.map(engineId => invoke<CommandResponse>('stop_engine', { engineId })));
      studyEnginesToStop.current = engineIds.filter((_, index) => {
        const result = stopped[index];
        return result.status === 'rejected' || (!result.value.success && !result.value.message?.includes('Engine not found'));
      });
      if (studyEnginesToStop.current.length) {
        controller.setPlayerTypes('human', 'human');
        controller.setRecommendationsEnabled(false);
        setPlayer1Type('human'); setPlayer2Type('human'); setRecommendationsEnabled(false);
        throw new Error('A playing engine could not be stopped. The current record is unchanged and automatic engine moves are paused. Retry loading or cancel and start a new game.');
      }
      controller.setPlayerTypes('human', 'human');
      controller.setRecommendationsEnabled(false);
      controller.setDisableAutoEngineMove(true);
      controller.setTimeControls(30 * 60 * 1000, 30 * 60 * 1000, 10 * 1000);
      setPlayer1Type('human'); setPlayer2Type('human');
      setPlayer1EngineId(null); setPlayer2EngineId(null); setActiveEngineIds([]);
      setRecommendationsEnabled(false);
      setUseTauriEngine(false);
      setThinkingMovePlayer1(null); setThinkingMovePlayer2(null);
      setSelectedSquare(null); setSelectedCapturedPiece(null); setLegalMoves([]);
      setCurrentRecommendation(null); setHighlightedCapturedPiece(null);
      setWinner(null); setIsGameOverDialogDismissed(false);
      setBlackTime(30 * 60 * 1000); setWhiteTime(30 * 60 * 1000); setByoyomi(10 * 1000);
      setIsByoyomiBlack(false); setIsByoyomiWhite(false);
      setStartColor(studyImport.rootSfen.split(' ')[1] === 'w' ? 'white' : 'black');
      gameInitializedRef.current = true;
      gameStartedAtRef.current = new Date().toISOString();
      clockSnapshotsRef.current = Array.from({ length: studyImport.moves.length + 1 }, () => ({ blackTime: 30 * 60 * 1000, whiteTime: 30 * 60 * 1000, isByoyomiBlack: false, isByoyomiWhite: false }));
      lastClockSnapshotPlyRef.current = studyImport.moves.length;
      for (const search of candidateSearchRef.current.values()) if (!search.complete) thinkingHistoryStore.record(search, engineNamesRef.current.get(search.engineId) ?? search.engineId, 'game', 'stopped');
      candidateSearchRef.current.clear(); setCandidateSearches([]);
      latestEvaluationRef.current.clear(); setEvaluationPoints([]);
      controller.loadStudyBranch(studyImport.rootSfen, studyImport.moves, studyImport.comments);
      setStudyImport(null);
    } catch (error) {
      setStudyImportError(error instanceof Error ? error.message : 'Could not load this branch.');
    } finally { studyImportInFlight.current = false; setStudyImportBusy(false); }
  };

  const handleDeleteGame = (name: string) => {
    const newSavedGames = { ...savedGames };
    delete newSavedGames[name];
    setSavedGames(newSavedGames);
    localStorage.setItem('shogi-saved-games', JSON.stringify(newSavedGames));
    const newReplayMetadata = { ...savedReplayMetadata };
    delete newReplayMetadata[name];
    setSavedReplayMetadata(newReplayMetadata);
    localStorage.setItem('shogi-saved-game-replay-metadata', JSON.stringify(newReplayMetadata));
  };

  const handleCapturedPieceClick = (pieceType: TsshogiPieceType, player: 'player1' | 'player2') => {
    const isPlayer1Turn = position?.sfen.includes(' b ');
    const isPlayer2Turn = position?.sfen.includes(' w ');

    if ((isPlayer1Turn && player === 'player1') || (isPlayer2Turn && player === 'player2')) {
      setSelectedCapturedPiece(pieceType);
      setSelectedSquare(null);
      
      // Get valid drop squares for the selected piece
      const validDropSquares = controller.getValidDropSquares(pieceType);
      setLegalMoves(validDropSquares);
    }
  };

  const legacyViewAvailable = (view: SecondaryView) => view === 'usi' ? (!useTauriEngine || activeEngineIds.length > 0) : view === 'evaluation' && useTauriEngine && activeEngineIds.length > 0;
  const openLegacyView = (view: SecondaryView) => {
    if (!legacyViewAvailable(view)) return;
    if (view === 'usi' && !isUsiMonitorVisible) onToggleUsiMonitor();
    if (view === 'evaluation') setIsEvaluationVisible(true);
    focusSecondaryPanel(view === 'usi' ? 'usi-monitor' : 'evaluation');
    if (useTauriEngine) void WebviewWindow.getByLabel(view === 'usi' ? 'usi-monitor' : 'evaluation-monitor').then(async win => { if (win) { await win.show(); await win.setFocus(); } }).catch(console.error);
  };
  useSecondaryViewShortcuts(toggleSecondaryView, legacyViewAvailable);
  useEffect(() => {
    const toggle = (event: Event) => { if (!useTauriEngine && (event as CustomEvent<SecondaryView>).detail === 'usi') onToggleUsiMonitor(); };
    window.addEventListener(SECONDARY_VIEW_TOGGLE_EVENT, toggle);
    const open = (event: Event) => openLegacyView((event as CustomEvent<SecondaryView>).detail);
    window.addEventListener(SECONDARY_VIEW_OPEN_EVENT, open);
  return () => { window.removeEventListener(SECONDARY_VIEW_OPEN_EVENT, open); window.removeEventListener(SECONDARY_VIEW_TOGGLE_EVENT, toggle); };
  });

  useGameMenuShortcuts({
    menu: () => setIsCompactMenuOpen(open => !open),
    exit: handleExitGame, newGame: handleNewGame,
    save: () => setIsSaveModalOpen(true), load: () => setIsLoadModalOpen(true),
    exportGif: handleOpenGifExport, settings: () => setIsSettingsOpen(true),
    pieces: handleCyclePieceTheme, board: handleCycleBoardBackground,
    hints: controller.hasHumanPlayer() ? handleRecommendationToggle : undefined,
  }, Boolean(position));

  if (!position) {
    return <div>Loading...</div>;
  }

  const getTurnStatus = (side: 'sente' | 'gote') => {
    const isSente = side === 'sente';
    const isTurn = position?.sfen.includes(isSente ? ' b ' : ' w ');
    const type = isSente ? player1Type : player2Type;
    if (!isTurn) return '';
    return type === 'ai' ? 'Thinking…' : 'Your turn';
  };

  const getPlayerName = (side: 'sente' | 'gote') => {
    const isSente = side === 'sente';
    const type = isSente ? player1Type : player2Type;
    const runtimeId = isSente ? player1EngineId : player2EngineId;
    if (type === 'human') return 'You';
    return runtimeId ? (engineNames.get(runtimeId) || 'Engine') : 'Engine';
  };


    return (
      <div className="game-page game-page-compact">
        {/* Exit Confirmation Modal - COMPACT LAYOUT */}
        {isExitConfirmModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(2px)'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              width: '90%',
              maxWidth: '400px',
              overflow: 'hidden',
              animation: 'modalSlideIn 0.2s ease-out'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '24px 24px 16px 24px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <h2 style={{ margin: 0, color: '#333', fontSize: '1.5rem', fontWeight: 600 }}>Exit Game</h2>
              </div>
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <p style={{ margin: 0, color: '#555', fontSize: '16px', lineHeight: 1.5 }}>
                  Are you sure you want to exit? Your current game will be lost.
                </p>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
                padding: '16px 24px 24px 24px'
              }}>
                <button 
                  onClick={handleCancelExit}
                  style={{
                    padding: '12px 24px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: '#f5f5f5',
                    color: '#666',
                    minWidth: '100px'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmExit}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    minWidth: '100px'
                  }}
                >
                  Exit Game
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Compact Layout */}
        <div className="compact-layout">
          {/* Main content area */}
          <MovableGameGroup>
            {/* Left side: Gote captured pieces and move log */}
            <div className="compact-left-side">
              <div className="compact-gote-captured">
                <CapturedPieces captured={position.whiteHand as any} player={'player2'} onPieceClick={(pieceType) => handleCapturedPieceClick(pieceType, 'player2')} selectedCapturedPiece={selectedCapturedPiece} boardBackground={boardBackground} pieceThemeType={pieceLabelType as any} showTooltips={showPieceTooltips} highlightedPiece={getHighlightedPieceForPlayer('player2')} />
              </div>
              <div className="compact-move-log">
                <MoveLog 
                  moves={controller.getRecord().moves} 
                  notation={notation as 'western' | 'kifu' | 'usi' | 'csa'}
                  startColor={startColor}
                />
              </div>
            </div>

            {/* Center: Board */}
            <div className="compact-board-area" style={{ position: 'relative' }} ref={compactBoardRef}>
              <Board 
                ref={boardComponentRef}
                key={renderKey} 
                position={position} 
                onSquareClick={handleSquareClick} 
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                selectedSquare={selectedSquare} 
                legalMoves={legalMoves} 
                lastMove={lastMove}
                isSquareAttacked={showAttackedPieces ? (square) => controller.isSquareAttacked(square) : undefined}
                isInCheck={isInCheck}
                kingInCheckSquare={kingInCheckSquare}
                attackingPieces={attackingPieces}
                boardBackground={boardBackground}
                pieceThemeType={pieceLabelType as any}
                showPieceTooltips={showPieceTooltips}
                notation={notation as 'western' | 'kifu' | 'usi' | 'csa'}
                promotionTargetUsi={promotionMove?.to.usi}
                thinkingMove={showEngineThinking ? (thinkingMovePlayer1 || thinkingMovePlayer2) : null}
                promotionModalContent={promotionMove && boardComponentRef.current && <PromotionModal 
                  onPromote={handlePromotion} 
                  pieceType={promotionMove.pieceType}
                  player={promotionMove.player}
                  pieceThemeType={pieceLabelType}
                  modalWidth={PROMOTION_MODAL_WIDTH}
                  modalHeight={PROMOTION_MODAL_HEIGHT}
                  pieceSize={SQUARE_WIDTH}
                  destinationSquareUsi={promotionMove.destinationSquareUsi}
                  boardRef={boardComponentRef as React.RefObject<BoardRef>}
                  boardContainerRef={compactBoardRef}
                />}
              />
              <RecommendationOverlay 
                recommendation={currentRecommendation}
                boardRef={compactBoardRef}
                boardComponentRef={boardComponentRef}
                pieceThemeType={pieceLabelType as any}
                currentPlayer={position.sfen.includes(' b ') ? 'black' : 'white'}
                onHighlightCapturedPiece={handleHighlightCapturedPiece}
              />
            </div>

            {/* Right side: Menu and Sente captured pieces */}
            <div className="compact-right-side">
              <div className="compact-menu-area">
                <button className="compact-menu-toggle" type="button" aria-label="Game menu" aria-keyshortcuts={gameMenuShortcut('menu').aria} title={`Open or close menu (${gameMenuShortcut('menu').label})`} aria-expanded={isCompactMenuOpen} aria-controls="compact-game-menu" onClick={() => setIsCompactMenuOpen(open => !open)}>
                  <span aria-hidden="true">☰</span><span>Menu</span><kbd>{gameMenuShortcut('menu').label}</kbd>
                </button>
                {isCompactMenuOpen && <div className="compact-menu-popover" id="compact-game-menu">
                  <GameControls
                  secondaryAnalysisAvailable={availableEngines.some(engine => engine.enabled)}
                  secondaryUsiAvailable={!useTauriEngine || activeEngineIds.length > 0}
                  secondaryEngineViewsAvailable={useTauriEngine && activeEngineIds.length > 0}
                  onExitGame={handleExitGame}
                  onNewGame={handleNewGame} 
                  onOpenSettings={() => setIsSettingsOpen(true)} 
                  onOpenSaveModal={() => setIsSaveModalOpen(true)}
                  onOpenLoadModal={() => setIsLoadModalOpen(true)}
                  onExportGif={handleOpenGifExport}
                  onCyclePieceTheme={handleCyclePieceTheme}
                  onToggleRecommendations={handleRecommendationToggle}
                  recommendationsEnabled={recommendationsEnabled}
                  hasHumanPlayer={controller.hasHumanPlayer()}
                  onCycleBoardBackground={handleCycleBoardBackground}
                  />
                </div>}
              </div>
              <div className="compact-clock-area">
                <div className="clock-row">
                  <span className="clock-label">
                    <span className="clock-side">{position.sfen.includes(' w ') ? '▶ ' : ''}Gote</span>
                    <span className="clock-player-name">{getPlayerName('gote')}</span>
                  </span>
                  <small className="clock-status">{getTurnStatus('gote')}</small>
                  <Clock time={whiteTime} isByoyomi={isByoyomiWhite} />
                </div>
                <div className="clock-row">
                  <span className="clock-label">
                    <span className="clock-side">{position.sfen.includes(' b ') ? '▶ ' : ''}Sente</span>
                    <span className="clock-player-name">{getPlayerName('sente')}</span>
                  </span>
                  <small className="clock-status">{getTurnStatus('sente')}</small>
                  <Clock time={blackTime} isByoyomi={isByoyomiBlack} />
                </div>
              </div>
              <div className="compact-sente-captured">
                <CapturedPieces captured={position.blackHand as any} player={'player1'} onPieceClick={(pieceType) => handleCapturedPieceClick(pieceType, 'player1')} selectedCapturedPiece={selectedCapturedPiece} boardBackground={boardBackground} pieceThemeType={pieceLabelType as any} showTooltips={showPieceTooltips} highlightedPiece={getHighlightedPieceForPlayer('player1')} />
              </div>
            </div>
          </MovableGameGroup>
        </div>
        {studyImport && <StudyGameImportDialog branch={studyImport} currentGame={currentGameData}
          busy={studyImportBusy} error={studyImportError} onCancel={() => setStudyImport(null)} onLoad={() => void loadStudyImport()} />}
        {isSettingsOpen && <SettingsPanel 
          pieceThemeType={pieceLabelType as any}
          onPieceThemeTypeChange={handleSettingChange(setPieceLabelType, 'shogi-piece-label-type')}
          notation={notation as any}
          onNotationChange={handleSettingChange(setNotation, 'shogi-notation')}
          wallpaperList={wallpaperList}
          onSelectWallpaper={handleWallpaperChange}
          boardBackgroundList={boardBackgroundList}
          onSelectBoardBackground={handleSettingChange(setBoardBackground, 'shogi-board-background')}
          onClose={() => setIsSettingsOpen(false)}
          currentWallpaper={wallpaper}
          currentBoardBackground={boardBackground}
          showAttackedPieces={showAttackedPieces}
          onShowAttackedPiecesChange={handleSettingChange(setShowAttackedPieces, 'shogi-show-attacked-pieces')}
          showPieceTooltips={showPieceTooltips}
          onShowPieceTooltipsChange={handleSettingChange(setShowPieceTooltips, 'shogi-show-piece-tooltips')}
          showEngineThinking={showEngineThinking}
          onShowEngineThinkingChange={handleSettingChange(setShowEngineThinking, 'shogi-show-engine-thinking')}
          soundsEnabled={soundsEnabled}
          onSoundsEnabledChange={handleSettingChange(handleSoundsEnabledChange, 'shogi-sounds-enabled')}
          soundVolume={soundVolume}
          onSoundVolumeChange={handleSettingChange(handleSoundVolumeChange, 'shogi-sound-volume')}
          // Recommendation engine settings
          recommendationEngineId={recommendationEngineId}
          onRecommendationEngineChange={setRecommendationEngineId}
          recommendationEngineOptions={recommendationEngineOptions}
          onRecommendationEngineOptionsChange={setRecommendationEngineOptions}
        />}
        <SaveGameModal 
          isOpen={isSaveModalOpen} 
          onClose={() => setIsSaveModalOpen(false)} 
          onSave={handleSaveGame}
          gameData={currentGameData}
        />
        <LoadGameModal 
          isOpen={isLoadModalOpen} 
          onClose={() => setIsLoadModalOpen(false)} 
          onLoad={handleLoadGame} 
          onLoadFromText={handleLoadFromText}
          onDelete={handleDeleteGame} 
          savedGames={savedGames} 
          savedReplayMetadata={savedReplayMetadata}
          fallbackAppearance={{ boardBackground, pieceThemeType: pieceLabelType, notation: notation as 'western' | 'kifu' | 'usi' | 'csa' }}
        />
        {isGifExportOpen && <GameGifExportDialog
          gameName={currentGameData.metadata.name || 'Current Game'}
          gameData={currentGameData}
          fallbackAppearance={{ boardBackground, pieceThemeType: pieceLabelType, notation: notation as 'western' | 'kifu' | 'usi' | 'csa' }}
          onClose={() => setIsGifExportOpen(false)}
          headless
        />}
        <StartGameModal 
          isOpen={isStartGameModalOpen} 
          onClose={() => setIsStartGameModalOpen(false)} 
          onStartGame={handleStartGame} 
        />
        {winner && !isGameOverDialogDismissed && (
          <CheckmateModal 
            winner={winner}
            endgameType={endgameType}
            details={endgameDetails}
            onDismiss={handleDismiss}
            onNewGame={handleNewGame}
          />
        )}
        
        {/* USI Monitor positioned below the game content */}
        {useTauriEngine ? (
          // Only render TauriUsiMonitor when engines are properly initialized
          activeEngineIds.length > 0 ? (
            <UsiMonitorHost
              key={`${player1EngineId}-${player2EngineId}-${activeEngineIds.join(',')}`}
              session={{ engineIds: activeEngineIds, engineNames: Object.fromEntries(engineNames), player1EngineId, player2EngineId, player1Type: getPlayerTypesFromState().player1Type, player2Type: getPlayerTypesFromState().player2Type }}
              engines={availableEngines}
              isVisible={isUsiMonitorVisible}
              onToggle={onToggleUsiMonitor}
              onDismiss={onDismissUsiMonitor}
            />
          ) : null
        ) : (
          <UsiMonitor
            lastSentCommand={lastSentCommand}
            lastReceivedCommand={lastReceivedCommand}
            communicationHistory={communicationHistory}
            sessions={sessions}
            isVisible={isUsiMonitorVisible}
            onToggle={onToggleUsiMonitor}
          />
        )}
        {availableEngines.some(engine => engine.enabled) && <CandidateMovesHost
          onLoadStudyGame={prepareStudyImport}
          record={{ initialSfen: currentGameData.position, moves: currentGameData.moves }}
          engines={availableEngines}
          payload={{ searches: candidateSearches.filter(search => activeEngineIds.includes(search.engineId)), engineNames: Object.fromEntries(engineNames), currentSfen: position.sfen, pieceThemeType: pieceLabelType, boardBackground }}
          isVisible={isCandidatesVisible} onToggle={handleToggleCandidates} onDismiss={handleDismissCandidates}
        />}
        {useTauriEngine && activeEngineIds.length > 0 && <EvaluationHost
          points={evaluationPoints}
          isVisible={isEvaluationVisible}
          onToggle={handleToggleEvaluation}
          onDismiss={handleDismissEvaluation}
        />}
    </div>
    );
};

export default GamePage;
