import { useState } from 'react';
import { candidateScore, type CandidateSearch } from '../utils/candidateAnalysis';
import { thinkingSourceName, THINKING_HISTORY_LIMIT, type ThinkingAction, type ThinkingHistoryEntry } from '../utils/thinkingHistory';
import type { CandidatePayload } from './CandidateMoves';
import './AnalysisPanel.css';
import './EngineThinking.css';

const statusLabel = { searching: 'Searching', complete: 'Search finished', stopped: 'Search stopped', error: 'Search failed', interrupted: 'Search replaced before completion' };
function SearchDetails({ search, name, currentSfen, entry, onHistoryAction }: {
  search: CandidateSearch; name: string; currentSfen: string; entry?: ThinkingHistoryEntry; onHistoryAction?: (action: ThinkingAction) => void;
}) {
  const metrics = search.metrics ?? {};
  const line = search.lines.find(item => item.rank === 1);
  const values = [
    ['Depth', metrics.depth], ['Selective depth', metrics.seldepth], ['Nodes', metrics.nodes?.toLocaleString()], ['Nodes / second', metrics.nps?.toLocaleString()],
    ['Search time', metrics.time !== undefined ? `${(metrics.time / 1000).toFixed(2)} s` : undefined],
    ['Hash used', metrics.hashfull !== undefined ? `${(metrics.hashfull / 10).toFixed(1)}%` : undefined], ['Current move', metrics.currentMove],
  ];
  return <section aria-label={`${name} thinking`}>
    <h4>{name}</h4>
    {entry && <p>{thinkingSourceName[entry.source]} · Started {new Date(entry.startedAt).toLocaleTimeString()}{entry.finishedAt !== undefined ? ` · Finished ${new Date(entry.finishedAt).toLocaleTimeString()}` : ''}</p>}
    <p>{entry ? statusLabel[entry.status] : search.complete ? 'Search finished' : 'Searching'}{search.rootSfen !== currentSfen ? ' · Earlier position' : ''}</p>
    <dl className="thinking-metrics">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Unavailable'}</dd></div>)}</dl>
    {line && !entry && <><strong>{candidateScore(line, search.rootSfen)}</strong><p className="thinking-line">{line.moves.join(' ')}</p></>}
    {entry && <>
      <details className="thinking-position"><summary>Captured position (SFEN)</summary><code>{search.rootSfen}</code></details>
      {search.lines.map(candidate => <div className="thinking-history-line" key={candidate.rank}>
        <p>#{candidate.rank} · {candidateScore(candidate, search.rootSfen)} · {candidate.moves.join(' ')}</p>
        {onHistoryAction && <button onClick={() => onHistoryAction({ type: 'thinking-preview', id: entry.id, rank: candidate.rank })}>Preview candidate {candidate.rank}</button>}
      </div>)}
      {!search.lines.length && <p>No continuation reported for this search.</p>}
    </>}
  </section>;
}

export function EngineThinking({ payload, onHistoryAction }: { payload: CandidatePayload; onHistoryAction?: (action: ThinkingAction) => void }) {
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const history = (payload.thinkingHistory ?? []).filter(entry => entry.status !== 'searching');
  const selected = history.find(entry => entry.id === selectedId) ?? history[0];
  return <div className="thinking-details" aria-label="Engine thinking details">
    <div className="thinking-history-controls">
      <button aria-pressed={!historyVisible} onClick={() => setHistoryVisible(false)}>Live searches</button>
      <button aria-pressed={historyVisible} onClick={() => { setSelectedId(selected?.id ?? ''); setHistoryVisible(true); }}>Search history ({history.length})</button>
      {onHistoryAction && <button disabled={!history.length} onClick={() => onHistoryAction({ type: 'thinking-clear' })}>Clear finished history</button>}
    </div>
    {historyVisible ? <>
      <p>The latest {THINKING_HISTORY_LIMIT} finished searches are kept for this app session. Clearing history leaves active searches running.</p>
      {!history.length ? <p role="status">No finished searches in history yet.</p> : <>
        <label className="thinking-history-select">Saved search<select value={selected?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>
          {history.map(entry => <option key={entry.id} value={entry.id}>{new Date(entry.startedAt).toLocaleTimeString()} · {thinkingSourceName[entry.source]} · {entry.engineName} · {statusLabel[entry.status]} · Depth {entry.search.metrics?.depth ?? '—'} · Position {entry.search.rootSfen.split(' ')[3] ?? '—'}</option>)}
        </select></label>
        {selected && <SearchDetails search={selected.search} name={selected.engineName} currentSfen={payload.currentSfen} entry={selected} onHistoryAction={onHistoryAction} />}
      </>}
    </> : <>
      <p>Search metrics reported by the engines. Missing fields are shown as unavailable.</p>
      {!payload.searches.length && <p role="status">Start analysis or wait for a game engine to search.</p>}
      {payload.searches.map(search => <SearchDetails key={search.engineId} search={search} name={payload.engineNames[search.engineId] ?? search.engineId} currentSfen={payload.currentSfen} />)}
      {payload.analysis?.diagnostic && <p>Engine message: {payload.analysis.diagnostic}</p>}
    </>}
  </div>;
}
