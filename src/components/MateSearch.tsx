import { useState } from 'react';
import type { MateSearchAction, MateSearchState, MateCapability } from '../usi/mateSearchSession';
import type { ContinuationState } from './ContinuationBoard';
import './MateSearch.css';
export interface MateEngine { id: string; name: string }
interface Props { state: MateSearchState; engines: MateEngine[]; capabilities: Record<string, MateCapability>; currentSfen: string; onAction: (action: MateSearchAction) => void; onPreview: (value: ContinuationState) => void }
const labels = { idle: 'Ready for mate search', starting: 'Starting mate-search engine', running: 'Searching for a forced checking mate', stopping: 'Closing mate-search engine', stopped: 'Mate search stopped', found: 'Engine reported mate; principal line validated', nomate: 'Engine reported no checking mate', timeout: 'Search inconclusive: timed out', unsupported: 'Dedicated mate search is unsupported by this engine response', error: 'Mate search failed or returned an invalid line' };
export function MateSearch({ state, engines, capabilities, currentSfen, onAction, onPreview }: Props) {
  const [engineId, setEngineId] = useState('');
  const [customSfen, setCustomSfen] = useState('');
  const [seconds, setSeconds] = useState(5);
  const engine = engines.find(item => item.id === engineId) ?? engines.find(item => capabilities[item.id] === 'responded') ?? engines[0];
  const busy = ['starting', 'running', 'stopping'].includes(state.status);
  return <section aria-label="Mate Search">
    <p>Searches for a checking mate for the side to move on the captured main-board position, using a separate engine. This does not play moves in your game.</p>
    <div className="mate-controls"><label>Mate engine<select value={engine?.id ?? ''} disabled={busy} onChange={event => setEngineId(event.target.value)}>{engines.map(item => <option key={item.id} value={item.id}>{item.name} · {capabilities[item.id] === 'responded' ? 'Mate reply observed' : capabilities[item.id] === 'unsupported' ? 'Unsupported response observed' : 'Support unverified'}</option>)}</select></label>
      <label>Mate search time<select value={seconds} disabled={busy} onChange={event => setSeconds(Number(event.target.value))}>{[1, 5, 10, 30, 60].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>
    </div>
    <button disabled={busy || !engine || !currentSfen} onClick={() => engine && onAction({ type: 'mate-start', engineId: engine.id, seconds })}>Search for mate</button>
    <button disabled={!busy || state.status === 'stopping'} onClick={() => onAction({ type: 'mate-stop' })}>Stop mate search</button>
    <details><summary>Search a custom SFEN</summary><label>Custom mate position<textarea disabled={busy} value={customSfen} onChange={event => setCustomSfen(event.target.value)} placeholder="Paste a shogi position in SFEN" /></label>
      <button disabled={busy || !engine || !customSfen.trim()} onClick={() => engine && onAction({ type: 'mate-start', engineId: engine.id, seconds, rootSfen: customSfen.trim() })}>Search custom position</button><p>The custom position is used only for this search.</p>
    </details>
    <p>Support is learned from dedicated mate replies during this session. A normal search's mate score does not establish solver support; silence is inconclusive.</p>
    <p role="status">{labels[state.status]}{state.engineName ? ` · ${state.engineName}` : ''}{state.rootSfen && state.rootSfen !== currentSfen ? ' · Different from the current main-board position' : ''}</p>
    {state.seconds && <p>Requested budget: {state.seconds} seconds; engine startup is additional.</p>}
    {state.metrics && <p>Depth {state.metrics.depth ?? '—'} · Nodes {state.metrics.nodes?.toLocaleString() ?? '—'} · Time {state.metrics.time !== undefined ? `${(state.metrics.time / 1000).toFixed(2)} s` : '—'}</p>}
    {state.error && <p role="alert">{state.error}</p>}{state.diagnostic && <p>Engine message: {state.diagnostic}</p>}
    {state.status === 'found' && state.moves && state.rootSfen && <div>
      <p>{state.moves.length} plies · {state.moves.join(' ')}</p>
      <p>The line replays legally, checks on every attacking move and ends in checkmate. Alternative defenses rely on the engine's search.</p>
      <button onClick={() => onPreview({ rootSfen: state.rootSfen!, moves: [...state.moves!], step: 0, pinned: true, source: `${state.engineName ?? 'Engine'} mate line` })}>Preview mate line</button>
    </div>}
    {state.response && <details><summary>Engine mate reply</summary><code>{state.response}</code></details>}
    {state.rootSfen && !busy && <a download="shogi-mate-search.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state))}`}>Download mate result and settings</a>}
  </section>;
}
