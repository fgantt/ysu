import { useEffect, useMemo, useRef, useState } from 'react';
import { Position } from 'tsshogi';
import { toCanvas } from 'html-to-image';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import Board from './Board';
import CapturedPieces from './CapturedPieces';
import MoveLog from './MoveLog';
import Clock from './Clock';
import type { GameData } from '../utils/gameFormats';
import tauriConfig from '../../src-tauri/tauri.conf.json';
import './GameGifExportDialog.css';

interface GameGifExportDialogProps {
  gameName: string;
  gameData: GameData;
  fallbackAppearance: NonNullable<GameData['appearance']>;
  onClose: () => void;
  headless?: boolean;
}

export function buildGifReplay(gameData: GameData): { positions: Position[]; moves: Array<{ move: unknown }> } {
  const position = Position.newBySFEN(gameData.position);
  if (!position) throw new Error('The saved game has an invalid initial position.');
  const positions = [position.clone()];
  const moves: Array<{ move: unknown }> = [];
  gameData.moves.forEach((usi, index) => {
    if (usi === 'resign') return;
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) {
      throw new Error(`Move ${index + 1} (${usi}) could not be replayed.`);
    }
    moves.push({ move });
    positions.push(position.clone());
  });
  return { positions, moves };
}

export const buildGifPositions = (gameData: GameData) => buildGifReplay(gameData).positions;

const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export const hasVisibleGifContent = (rgba: Uint8ClampedArray) => {
  if (rgba.length < 4) return false;
  const [red, green, blue, alpha] = rgba;
  for (let offset = 4; offset < rgba.length; offset += 64) {
    if (
      Math.abs(rgba[offset] - red) > 3 ||
      Math.abs(rgba[offset + 1] - green) > 3 ||
      Math.abs(rgba[offset + 2] - blue) > 3 ||
      Math.abs(rgba[offset + 3] - alpha) > 3
    ) return true;
  }
  return false;
};

export const formatGifPlayedDate = (date?: string) => {
  if (!date) return 'Date unavailable';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

export default function GameGifExportDialog({ gameName, gameData, fallbackAppearance, onClose, headless = false }: GameGifExportDialogProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const autoStartedRef = useRef(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [includeClock, setIncludeClock] = useState(Boolean(gameData.clockSnapshots?.length));
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const positionsResult = useMemo(() => {
    try { return { ...buildGifReplay(gameData), error: null }; }
    catch (caught) { return { positions: [], moves: [], error: caught instanceof Error ? caught.message : String(caught) }; }
  }, [gameData]);
  const appearance = gameData.appearance ?? fallbackAppearance;
  const position = positionsResult.positions[Math.min(frameIndex, positionsResult.positions.length - 1)];
  const clock = gameData.clockSnapshots?.[frameIndex];
  const senteName = gameData.metadata.player1Name ?? 'Sente';
  const goteName = gameData.metadata.player2Name ?? 'Gote';
  const gameLabel = gameName === 'Current Game' ? `${senteName} vs ${goteName}` : gameName;

  const exportGif = async () => {
    if (!stageRef.current || !positionsResult.positions.length) return;
    setIsExporting(true);
    setError(null);
    let succeeded = false;
    try {
      await document.fonts?.ready;
      const gif = GIFEncoder();
      setFrameIndex(0);
      await nextPaint();
      // Warm WebKit's image/font cache before encoding the first position.
      await toCanvas(stageRef.current, {
        backgroundColor: '#17130f', cacheBust: true, pixelRatio: 1,
        style: { position: 'relative', left: '0', top: '0', zIndex: '0', opacity: '1' },
      });
      for (let index = 0; index < positionsResult.positions.length; index++) {
        setFrameIndex(index);
        setProgress(index / positionsResult.positions.length);
        await nextPaint();
        const moveTable = stageRef.current.querySelector('.move-table-container');
        if (moveTable) moveTable.scrollTop = moveTable.scrollHeight;
        const canvas = await toCanvas(stageRef.current, {
          backgroundColor: '#17130f',
          cacheBust: true,
          pixelRatio: 1,
          // The live capture node is parked offscreen. Reset its positioning in
          // html-to-image's cloned document so WebKit does not clip its children.
          style: {
            position: 'relative',
            left: '0',
            top: '0',
            zIndex: '0',
            opacity: '1',
          },
        });
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not capture the GIF frame.');
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
        if (index === 0 && !hasVisibleGifContent(rgba)) {
          throw new Error('The board could not be rendered into the GIF. Please try again after the board images finish loading.');
        }
        const palette = quantize(rgba, 256);
        const indexed = applyPalette(rgba, palette);
        gif.writeFrame(indexed, canvas.width, canvas.height, {
          palette,
          delay: index === 0 || index === positionsResult.positions.length - 1 ? 1300 : 750,
          repeat: 0,
        });
      }
      gif.finish();
      const bytes = gif.bytes();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${gameName.replace(/[^a-z0-9-_]+/gi, '-') || 'shogi-game'}.gif`;
      anchor.click();
      succeeded = true;
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setProgress(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsExporting(false);
      if (headless && succeeded) setTimeout(onClose, 0);
    }
  };

  useEffect(() => {
    if (headless && !autoStartedRef.current && positionsResult.positions.length) {
      autoStartedRef.current = true;
      void exportGif();
    }
  }, [headless, positionsResult.positions.length]);

  const replayMoves = positionsResult.moves.slice(0, frameIndex);
  const isBlackTurn = position?.sfen.includes(' b ') ?? true;

  return (
    <div className={headless ? 'gif-export-headless' : 'gif-export-overlay'} {...(!headless ? { role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'gif-export-title' } : {})}>
      {!headless &&
      <div className="gif-export-dialog">
        <div className="gif-export-header">
          <div><h2 id="gif-export-title">Export Animated GIF</h2><p>{gameName} · {gameData.moves.length} moves</p></div>
          <button onClick={onClose} disabled={isExporting} aria-label="Close GIF export">×</button>
        </div>
        <div className="gif-export-options">
          <label><input type="checkbox" checked={includeHistory} onChange={event => setIncludeHistory(event.target.checked)} disabled={isExporting} /> Move history</label>
          <label title={gameData.clockSnapshots?.length ? '' : 'This saved game has no per-move clock snapshots.'}>
            <input type="checkbox" checked={includeClock} onChange={event => setIncludeClock(event.target.checked)} disabled={isExporting || !gameData.clockSnapshots?.length} /> Clocks
          </label>
          {!gameData.appearance && <p className="gif-export-note">This older save has no appearance metadata. Current board and piece themes will be used.</p>}
          {!gameData.clockSnapshots?.length && <p className="gif-export-note">Clocks are unavailable because this game does not contain per-move timing snapshots.</p>}
        </div>
        {(error || positionsResult.error) && <div className="gif-export-error">{error || positionsResult.error}</div>}
        {isExporting && <div className="gif-export-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
        <div className="gif-export-actions">
          <button onClick={onClose} disabled={isExporting}>Cancel</button>
          <button className="gif-export-primary" onClick={exportGif} disabled={isExporting || !positionsResult.positions.length}>
            {isExporting ? `Rendering ${Math.round(progress * 100)}%` : 'Download GIF'}
          </button>
        </div>
      </div>}

      {headless && <div className="gif-export-status" role="status">
        {error || positionsResult.error || `Creating GIF… ${Math.round(progress * 100)}%`}
        {(error || positionsResult.error) && <button onClick={onClose}>Dismiss</button>}
      </div>}

      {position && <div className="gif-export-stage game-page-compact" ref={stageRef} aria-hidden="true">
        <header className="gif-export-game-header">
          <div className="gif-export-brand-mark" aria-hidden="true">☗</div>
          <div className="gif-export-game-identity">
            <strong>Yggdrasil Shogi</strong>
            <span>{gameLabel} · {gameData.moves.length} moves</span>
          </div>
          <div className="gif-export-game-meta">
            <span>Played {formatGifPlayedDate(gameData.metadata.date)}</span>
            <b>v{tauriConfig.version}</b>
          </div>
        </header>
        <div className="gif-export-main">
          <div className="compact-left-side">
            <div className="compact-gote-captured"><CapturedPieces captured={position.whiteHand as never} player="player2" boardBackground={appearance.boardBackground} pieceThemeType={appearance.pieceThemeType} /></div>
            {includeHistory && <div className="compact-move-log"><MoveLog moves={replayMoves} notation={appearance.notation ?? 'kifu'} startColor={gameData.position.includes(' w ') ? 'white' : 'black'} /></div>}
          </div>
          <div className="compact-board-area"><Board position={position} onSquareClick={() => {}} selectedSquare={null} legalMoves={[]} lastMove={null} boardBackground={appearance.boardBackground} pieceThemeType={appearance.pieceThemeType} notation={appearance.notation ?? 'kifu'} /></div>
          <div className="compact-right-side">
            {includeClock && clock && <div className="compact-clock-area">
              <div className="clock-row"><span className="clock-label"><span className="clock-side">{!isBlackTurn ? '▶ ' : ''}Gote</span><span className="clock-player-name">{gameData.metadata.player2Name ?? 'Gote'}</span></span><small className="clock-status">{!isBlackTurn ? 'Thinking…' : ''}</small><Clock time={clock.whiteTime} isByoyomi={Boolean(clock.isByoyomiWhite)} /></div>
              <div className="clock-row"><span className="clock-label"><span className="clock-side">{isBlackTurn ? '▶ ' : ''}Sente</span><span className="clock-player-name">{gameData.metadata.player1Name ?? 'Sente'}</span></span><small className="clock-status">{isBlackTurn ? 'Thinking…' : ''}</small><Clock time={clock.blackTime} isByoyomi={Boolean(clock.isByoyomiBlack)} /></div>
            </div>}
            <div className="compact-sente-captured"><CapturedPieces captured={position.blackHand as never} player="player1" boardBackground={appearance.boardBackground} pieceThemeType={appearance.pieceThemeType} /></div>
          </div>
        </div>
      </div>}
    </div>
  );
}
