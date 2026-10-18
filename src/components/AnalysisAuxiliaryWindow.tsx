import { emitTo } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useDynamicTheme } from '../hooks/useDynamicTheme';
import { returnSecondaryWindow, readSecondaryWindowPayload, useSecondaryWindow } from '../hooks/useSecondaryWindow';
import { AnalysisPanel, AUXILIARY_ACTION_EVENT, CONTINUATION_CONFIG, THINKING_CONFIG, REVIEW_CONFIG, COMPARISON_CONFIG, MATE_CONFIG } from './AnalysisPanel';
import { emptyStudy } from '../utils/variationTree';
import { VariationTree } from './VariationTree';
import { ContinuationBoard } from './ContinuationBoard';
import { MateSearch } from './MateSearch';
import { EngineComparison } from './EngineComparison';
import { reviewSnapshotKey } from '../usi/gameReview';
import { GameReview } from './GameReview';
import { EngineThinking } from './EngineThinking';
import type { CandidatePayload } from './CandidateMoves';
import './UsiMonitor.css';
import '../styles/themes.css';

export function AnalysisAuxiliaryWindow({ kind }: { kind: 'thinking' | 'continuation' | 'review' | 'comparison' | 'mate' }) {
  useDynamicTheme();
  const config = kind === 'mate' ? MATE_CONFIG : kind === 'comparison' ? COMPARISON_CONFIG : kind === 'thinking' ? THINKING_CONFIG : kind === 'review' ? REVIEW_CONFIG : CONTINUATION_CONFIG;
  const payload = useSecondaryWindow(config, readSecondaryWindowPayload<CandidatePayload>('state', { searches: [], engineNames: {}, currentSfen: '' }));
  const reviewSnapshot = payload.review ? reviewSnapshotKey(payload.review.state) : '';
  const close = () => { void getCurrentWindow().close(); };
  return <main className="usi-monitor-window"><AnalysisPanel title={config.title} externalWindow onDock={() => void returnSecondaryWindow(config).catch(console.error)} onClose={close}>
    {kind === 'mate' ? payload.mate ? <MateSearch state={payload.mate.state} engines={payload.mate.engines} capabilities={payload.mate.capabilities} currentSfen={payload.currentSfen}
      onAction={action => void emitTo('main', AUXILIARY_ACTION_EVENT, action).catch(console.error)}
      onPreview={value => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-change', value }).then(() => emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-detach' })).catch(console.error)}
    /> : <p>Waiting for mate search state.</p> : kind === 'comparison' ? payload.comparison ? <EngineComparison state={payload.comparison.state} engines={payload.comparison.engines} currentSfen={payload.currentSfen}
      onAction={action => void emitTo('main', AUXILIARY_ACTION_EVENT, action).catch(console.error)}
      onPreview={value => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-change', value }).then(() => emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-detach' })).catch(console.error)}
    /> : <p>Waiting for comparison state.</p> : kind === 'thinking' ? <EngineThinking payload={payload} onHistoryAction={action => void emitTo('main', AUXILIARY_ACTION_EVENT, action).catch(console.error)} /> : kind === 'review' ? payload.review ? <GameReview
      state={payload.review.state} record={payload.review.record} branch={payload.review.branch} engines={payload.review.engines}
      onStart={(engineId, seconds, scope) => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'review-start', engineId, seconds, scope }).catch(console.error)}
      onStop={() => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'review-stop' }).catch(console.error)}
      onPreview={(row, best) => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'review-preview', ply: row.ply, best, rootSfen: row.rootSfen, snapshot: reviewSnapshot }).catch(console.error)}
    /> : <p>Waiting for the game snapshot.</p> : <>
      <button onClick={() => { void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-embed' }).then(close).catch(console.error); }}>Reattach to Candidate Moves</button>
      {payload.continuation && <ContinuationBoard onAddMove={move => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'variation-board-add', ...move }).catch(console.error)} value={payload.continuation} pieceThemeType={payload.pieceThemeType} boardBackground={payload.boardBackground} onStep={step => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-step', step }).catch(console.error)} />}
      <VariationTree canLoadGame={payload.canLoadStudyGame} study={payload.variationStudy ?? emptyStudy()} continuation={payload.continuation} error={payload.variationError} canUndo={payload.variationCanUndo} onAction={action => void emitTo('main', AUXILIARY_ACTION_EVENT, action).catch(console.error)} />
    </>}
  </AnalysisPanel></main>;
}
