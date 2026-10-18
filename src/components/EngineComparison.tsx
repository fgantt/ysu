import { validSearchBudget, searchBudgetLabel, type SearchBudget } from '../usi/searchBudget';
import { useState } from 'react';
import type { ComparisonAction, ComparisonState } from '../usi/engineComparison';
import { candidateScore } from '../utils/candidateAnalysis';
import type { ContinuationState } from './ContinuationBoard';
import './EngineComparison.css';

export interface ComparisonEngine { id: string; name: string; maxCandidates: number }
interface Props { state: ComparisonState; engines: ComparisonEngine[]; currentSfen: string; onAction: (action: ComparisonAction) => void; onPreview: (value: ContinuationState) => void }
export function EngineComparison({ state, engines, currentSfen, onAction, onPreview }: Props) {
  const [leftId, setLeftId] = useState(state.engines?.[0]?.id ?? '');
  const [rightId, setRightId] = useState(state.engines?.[1]?.id ?? '');
  const [seconds, setSeconds] = useState(state.budget?.kind === 'time' ? state.budget.value : state.seconds ?? 5);
  const [budgetKind, setBudgetKind] = useState<SearchBudget['kind']>(state.budget?.kind ?? 'time');
  const [depth, setDepth] = useState(state.budget?.kind === 'depth' ? state.budget.value : 12);
  const [nodes, setNodes] = useState(state.budget?.kind === 'nodes' ? state.budget.value : 1_000_000);
  const budget: SearchBudget = { kind: budgetKind, value: budgetKind === 'time' ? seconds : budgetKind === 'depth' ? depth : nodes };
  const [candidates, setCandidates] = useState(state.candidates ?? 1);
  const left = engines.find(engine => engine.id === leftId) ?? engines[0];
  const right = engines.find(engine => engine.id === rightId) ?? engines.find(engine => engine.id !== left?.id);
  const limit = Math.min(left?.maxCandidates ?? 1, right?.maxCandidates ?? 1);
  const best = state.sides.map(side => side.search?.lines.find(line => line.rank === 1));
  const comparable = best.every(line => line && line.score !== undefined && line.mate === undefined && !line.bound);
  const difference = comparable && state.rootSfen ? (best[0]!.score! - best[1]!.score!) * (state.rootSfen.split(' ')[1] === 'w' ? -1 : 1) : null;
  const finished = state.sides.every(side => side.status === 'complete');
  return <section aria-label="Engine Comparison">
    <p>Two independent engines search the same captured position with equal time, depth or node budgets and the same candidate count. Scores favor Sente when positive.</p>
    <p>Temporary settings target 2 threads / 128 MB per engine where advertised, adjusted to its supported limits; other saved settings remain engine-specific. Equal budgets do not imply equal strength; depth and node counts can differ in meaning between engines.</p>
    <div className="comparison-controls">
      {(['Left', 'Right'] as const).map((label, index) => <label key={label}>{label} engine<select aria-label={`${label} comparison engine`} disabled={state.busy} value={(index === 0 ? left : right)?.id ?? ''} onChange={event => (index === 0 ? setLeftId : setRightId)(event.target.value)}>{engines.map(engine => <option key={engine.id} value={engine.id}>{engine.name}</option>)}</select></label>)}
      <label>Search budget<select value={budgetKind} disabled={state.busy} onChange={event => setBudgetKind(event.target.value as SearchBudget['kind'])}><option value="time">Time</option><option value="depth">Depth</option><option value="nodes">Nodes</option></select></label>
      {budgetKind === 'time' ? <label>Time per engine<select value={seconds} disabled={state.busy} onChange={event => setSeconds(Number(event.target.value))}>{Array.from(new Set([1, 5, 10, 30, 60, seconds])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>
        : budgetKind === 'depth' ? <label>Depth per engine<input type="number" min="1" max="100" step="1" value={depth} disabled={state.busy} onChange={event => setDepth(Number(event.target.value))} /></label>
        : <label>Nodes per engine<input type="number" min="1" max="1000000000" step="1" value={nodes} disabled={state.busy} onChange={event => setNodes(Number(event.target.value))} /></label>}
      <label>Candidates per engine<select value={Math.min(candidates, limit)} disabled={state.busy} onChange={event => setCandidates(Number(event.target.value))}>{Array.from({ length: limit }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
    </div>
    <button disabled={!validSearchBudget(budget) || state.busy || !currentSfen || !left || !right || left.id === right.id} onClick={() => left && right && onAction({ type: 'comparison-start', engineIds: [left.id, right.id], seconds: budgetKind === 'time' ? seconds : 60, ...(budgetKind !== 'time' ? { budget } : {}), candidates: Math.min(candidates, limit) })}>Compare position</button>
    <button disabled={!state.busy} onClick={() => onAction({ type: 'comparison-stop' })}>Stop both engines</button>
    {budgetKind !== 'time' && <p>Depth/node searches have a 60-second safety limit. A timeout retains partial results and is reported as an error. Engine support varies.</p>}
    {engines.length < 2 && <p>Enable at least two engine configurations to compare.</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {state.rootSfen && <>
      <p role="status">{state.busy ? 'Comparison in progress' : finished ? 'Comparison complete' : 'Comparison finished with partial results'}{state.restored ? ' · Saved comparison restored' : ''} · {searchBudgetLabel(state.budget ?? { kind: 'time', value: state.seconds ?? 5 })} and {state.candidates} candidate(s) per engine{state.rootSfen !== currentSfen ? ' · Earlier captured position' : ''}</p>
      {best.every(Boolean) && <p>{best[0]!.moves[0] === best[1]!.moves[0] ? 'Both engines prefer the same first move.' : 'The engines prefer different first moves.'}{difference !== null ? ` ${finished ? 'Final' : 'Current'} left minus right score: ${difference > 0 ? '+' : ''}${difference} cp (Sente perspective).` : ' Numeric score difference unavailable for mate, bounded or missing scores.'}</p>}
      <div className="comparison-results">{state.sides.map((side, index) => <section key={index} aria-label={`${index === 0 ? 'Left' : 'Right'} comparison results`}>
        <h4>{state.engines?.[index].name ?? 'Engine'}</h4><p>{side.status}</p>
        {side.error && <p role="alert">{side.error}</p>}{side.diagnostic && <p>{side.diagnostic}</p>}
        <p>Depth {side.search?.metrics?.depth ?? '—'} · Nodes {side.search?.metrics?.nodes?.toLocaleString() ?? '—'} · Time {side.search?.metrics?.time !== undefined ? `${(side.search.metrics.time / 1000).toFixed(2)} s` : '—'}</p>
        {side.search?.lines.map(line => <button className="comparison-line" key={line.rank} onClick={() => onPreview({ rootSfen: state.rootSfen!, moves: [...line.moves], step: 0, pinned: true, source: `${state.engines?.[index].name ?? 'Comparison engine'} candidate ${line.rank}` })}><strong>#{line.rank} {candidateScore(line, state.rootSfen!)}</strong><span>{line.moves.join(' ')}</span><small>Preview continuation</small></button>)}
        {!side.search?.lines.length && <p>No continuation reported.</p>}
      </section>)}</div>
      <a download="shogi-engine-comparison.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state))}`}>Download comparison results and settings</a>
    </>}
  </section>;
}
