import AnalysisInstructions from './AnalysisInstructions';
import { SecondaryWindowControls } from './SecondaryWindowControls';
import type { MateSearchState, MateCapability } from '../usi/mateSearchSession';
import type { MateEngine } from './MateSearch';
import type { ComparisonState } from '../usi/engineComparison';
import type { ComparisonEngine } from './EngineComparison';
import type { VariationStudy } from '../utils/variationTree';
import { useEffect, useState } from 'react';
import { ContinuationBoard, continuationKey, type ContinuationState } from './ContinuationBoard';
import { candidateScore, type CandidateSearch } from '../utils/candidateAnalysis';
import './CandidateMoves.css';
import { analysisMoveLabels } from '../utils/analysisNotation';
import type { ReviewRecord, ReviewState } from '../usi/gameReview';
import type { ReviewEngineChoice } from './GameReview';
import type { AnalysisAction, AnalysisState } from '../usi/analysisSession';

export interface CandidatePayload {
  canLoadStudyGame?: boolean;
  thinkingHistory?: import('../utils/thinkingHistory').ThinkingHistoryEntry[];
  searches: CandidateSearch[];
  engineNames: Record<string, string>;
  currentSfen: string;
  pieceThemeType?: string;
  boardBackground?: string;
  review?: { state: ReviewState; record: ReviewRecord; branch?: ReviewRecord; engines: ReviewEngineChoice[] };
  continuation?: ContinuationState | null;
  continuationDetached?: boolean;
  mate?: { state: MateSearchState; engines: MateEngine[]; capabilities: Record<string, MateCapability> };
  comparison?: { state: ComparisonState; engines: ComparisonEngine[] };
  variationStudy?: VariationStudy;
  variationError?: string;
  variationCanUndo?: boolean;
  analysis?: AnalysisState;
  analysisEngines?: Array<{ id: string; name: string; maxCandidates: number }>;
}
interface Props { payload: CandidatePayload; isVisible: boolean; onToggle: () => void; onDock?: () => void; onPopOut?: () => void; externalWindow?: boolean; onAnalysisAction?: (action: AnalysisAction) => void; onContinuationChange?: (value: ContinuationState) => void; onDetachContinuation?: () => void; onEmbedContinuation?: () => void }

function AnalysisControls({ payload, onAction }: { payload: CandidatePayload; onAction: (action: AnalysisAction) => void }) {
  const engines = payload.analysisEngines ?? [];
  const [engineId, setEngineId] = useState('');
  const [count, setCount] = useState(3);
  const [seconds, setSeconds] = useState(5);
  const engine = engines.find(item => item.id === engineId) ?? engines.find(item => item.maxCandidates > 1) ?? engines[0];
  const status = payload.analysis?.status ?? 'idle';
  const busy = ['starting', 'running', 'stopping'].includes(status);
  const labels = { idle: 'Ready to analyze', starting: 'Starting analysis engine…', running: 'Analyzing the selected position…', stopping: 'Closing analysis engine…', complete: 'Analysis complete', stopped: 'Analysis stopped', error: 'Analysis failed' };
  return <section className="analysis-controls" aria-label="Dedicated analysis">
    <h4>Analyze this position</h4>
    <p>Runs a separate engine on the position currently selected on the main board.</p>
    <div className="analysis-fields">
      <label>Analysis engine<select aria-label="Analysis engine" value={engine?.id ?? ''} disabled={busy} onChange={event => setEngineId(event.target.value)}>{engines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Candidates<select aria-label="Analysis candidates" value={Math.min(count, engine?.maxCandidates ?? 1)} disabled={busy || !engine || engine.maxCandidates === 1} onChange={event => setCount(Number(event.target.value))}>{Array.from({ length: engine?.maxCandidates ?? 1 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
      <label>Search time<select aria-label="Analysis search time" value={seconds} disabled={busy} onChange={event => setSeconds(Number(event.target.value))}>{[1, 5, 10, 30, 60].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>
    </div>
    {engine?.maxCandidates === 1 && <p>This engine does not advertise multiple candidates; analysis will request one line.</p>}
    <label className="analysis-reuse"><input type="checkbox" checked={payload.analysis?.reuseEnabled ?? false} disabled={busy} onChange={event => onAction({ type: 'reuse', enabled: event.target.checked })} />Keep analysis engine ready between searches</label>
    {payload.analysis?.reuseEnabled && <p>Matching settings reuse the engine. Settings changes restart it; Stop and errors close it. Idle engines close after two minutes.</p>}
    {payload.analysis?.engineReady && <p role="status">Analysis engine ready for the next position.</p>}
    {payload.analysis?.reused && <p>This search reused the analysis engine.</p>}
    <div className="analysis-buttons">
      <button disabled={busy || !engine || !payload.currentSfen} onClick={() => engine && onAction({ type: 'start', engineId: engine.id, rootSfen: payload.currentSfen, candidates: Math.min(count, engine.maxCandidates), seconds })}>Analyze position</button>
      {payload.analysis?.engineRetained && <button disabled={busy} onClick={() => onAction({ type: 'release' })}>Close analysis engine</button>}
      <button disabled={!busy || status === 'stopping'} onClick={() => onAction({ type: 'stop' })}>Stop analysis</button>
      {payload.analysis?.search && <button disabled={busy} onClick={() => onAction({ type: 'clear' })}>Show game searches</button>}
    </div>
    <p role="status">{labels[status]}{payload.analysis?.engineName ? ` · ${payload.analysis.engineName}` : ''}</p>
    {payload.analysis?.diagnostic && <p className="candidate-history">Engine message: {payload.analysis.diagnostic}</p>}
    {payload.analysis?.error && <p role="alert">{payload.analysis.error}</p>}
  </section>;
}

export function CandidateMoves({ payload, isVisible, onToggle, onDock, onPopOut, externalWindow = false, onAnalysisAction, onContinuationChange, onDetachContinuation, onEmbedContinuation }: Props) {
  const [localContinuation, setLocalContinuation] = useState<ContinuationState | null>(null);
  const continuation = onContinuationChange ? payload.continuation : localContinuation;
  const setContinuation = onContinuationChange ?? setLocalContinuation;
  const [selection, setSelection] = useState<{ engineId: string; rank: number } | null>(null);
  const selectedSearch = payload.searches.find(search => search.engineId === selection?.engineId) ?? payload.searches.find(search => search.lines.length > 0);
  const selectedLine = selectedSearch?.lines.find(line => line.rank === selection?.rank) ?? selectedSearch?.lines[0];
  const selectedKey = selectedSearch && selectedLine ? continuationKey({ rootSfen: selectedSearch.rootSfen, moves: selectedLine.moves }) : '';
  useEffect(() => {
    if (!selectedSearch || !selectedLine || continuation?.pinned) return;
    if (!continuation || continuationKey(continuation) !== selectedKey) setContinuation({ rootSfen: selectedSearch.rootSfen, moves: [...selectedLine.moves], step: 0, pinned: false, source: `${payload.engineNames[selectedSearch.engineId] ?? 'Engine'} candidate ${selectedLine.rank}` });
  }, [selectedKey, continuation?.pinned]);
  if (!isVisible) return null;
  return <div className="usi-monitor candidate-panel">
    <div className="usi-monitor-header"><h3>Candidate Moves</h3><SecondaryWindowControls title="Candidate Moves" onDock={onDock} onPopOut={onPopOut} onHide={onToggle} externalWindow={externalWindow} /></div>
    <div className="candidate-content"><AnalysisInstructions guide="candidates" />
      {onAnalysisAction && <AnalysisControls payload={payload} onAction={onAnalysisAction} />}
      <p>Positive scores favor Sente; negative scores favor Gote. Japanese notation is shown alongside USI. Select a line to preview it.</p>
      {!payload.searches.some(search => search.lines.length) && <p role="status">{payload.analysis?.status === 'complete' ? 'The engine completed without reporting a continuation. Try another engine or position.' : 'Waiting for an engine to report a continuation. More candidates appear when the engine’s MultiPV setting is enabled.'}</p>}
      {payload.searches.map(search => <section key={search.engineId} aria-label={`${payload.engineNames[search.engineId] ?? 'Engine'} candidates`}>
        <h4>{payload.engineNames[search.engineId] ?? search.engineId} · {search.complete ? 'Last search' : 'Searching'}</h4>
        {search.rootSfen !== payload.currentSfen && <p className="candidate-history">These lines describe an earlier searched position.</p>}
        {search.lines.slice(0, 5).map(line => <button key={line.rank} className="candidate-line" aria-pressed={search === selectedSearch && line === selectedLine} onClick={() => setSelection({ engineId: search.engineId, rank: line.rank })}>
          <strong>#{line.rank} {line.moves[0]} · {candidateScore(line, search.rootSfen)}</strong>
          <span>{analysisMoveLabels(search.rootSfen, line.moves).join(' ')}</span><span>{line.moves.join(' ')}</span>
          <small>{line.depth !== undefined && `Depth ${line.depth} · `}{line.time !== undefined && `${(line.time / 1000).toFixed(1)} s · `}{line.nodes !== undefined && `${line.nodes.toLocaleString()} nodes`}</small>
        </button>)}
        {search.lines.length === 1 && <p className="candidate-history">The engine has reported one candidate. Enable MultiPV in its options for more, if supported.</p>}
      </section>)}
      {continuation && <>
        <button className="continuation-pin" onClick={() => setContinuation({ ...continuation, pinned: !continuation.pinned })}>{continuation.pinned ? 'Unpin continuation' : 'Pin continuation'}</button>
        {continuation.pinned && <p role="status">Continuation pinned. Candidate results can update while you explore this line.</p>}
        {payload.continuationDetached ? <button onClick={onEmbedContinuation}>Reattach Continuation Board</button> : <>
          {onDetachContinuation && <button onClick={onDetachContinuation}>Separate Continuation Board</button>}
          <ContinuationBoard value={continuation} onStep={step => setContinuation({ ...continuation, step })} pieceThemeType={payload.pieceThemeType} boardBackground={payload.boardBackground} />
        </>}
      </>}
    </div>
  </div>;
}
