import AnalysisInstructions from './AnalysisInstructions';
import { useEffect, useRef, useState } from 'react';
import { SecondaryWindowControls } from './SecondaryWindowControls';
import './EvaluationGraph.css';

export interface EvaluationPoint {
  ply: number;
  score: number;
  engineId: string;
}

interface Props {
  points: EvaluationPoint[];
  isVisible: boolean;
  onToggle: () => void;
  onPopOut?: () => void;
  onDock?: () => void;
  externalWindow?: boolean;
}

const SCORE_LIMIT = 2000;

export function describeEvaluation(points: EvaluationPoint[]): { headline: string; detail: string } {
  const latest = points.at(-1);
  if (!latest) {
    return {
      headline: 'No evaluation yet',
      detail: 'The explanation will appear after an engine completes its first search.',
    };
  }
  const absolute = Math.abs(latest.score);
  const side = latest.score >= 0 ? 'Sente' : 'Gote';
  let strength: string;
  if (absolute < 100) strength = 'approximately even';
  else if (absolute < 300) strength = `a slight ${side} advantage`;
  else if (absolute < 700) strength = `a clear ${side} advantage`;
  else if (absolute < 1400) strength = `a strong ${side} advantage`;
  else strength = `a potentially decisive ${side} advantage`;

  const previous = points.at(-2);
  let trend = 'There is not enough history to describe a trend yet.';
  if (previous) {
    const change = latest.score - previous.score;
    if (Math.abs(change) < 50) trend = 'The position is broadly stable since the previous analyzed move.';
    else {
      const improvingSide = change > 0 ? 'Sente' : 'Gote';
      trend = `The evaluation shifted ${Math.abs(change)} cp toward ${improvingSide} since the previous analyzed move.`;
    }
  }
  return {
    headline: absolute < 100 ? 'The engine sees an approximately even position.' : `The engine sees ${strength}.`,
    detail: `${trend} Positive scores favor Sente; negative scores favor Gote.`,
  };
}

export function EvaluationGraph({ points, isVisible, onToggle, onPopOut, onDock, externalWindow = false }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 180 });
  useEffect(() => {
    if (!isVisible || !chartRef.current) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [isVisible]);
  if (!isVisible) return null;

  const WIDTH = size.width;
  const HEIGHT = size.height;
  const MARGIN = { left: WIDTH < 460 ? 36 : 48, right: 16, top: 14, bottom: 28 };
  const plotWidth = Math.max(1, WIDTH - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(1, HEIGHT - MARGIN.top - MARGIN.bottom);
  const scoreTicks = HEIGHT < 150 ? [-2000, 0, 2000] : [-2000, -1000, 0, 1000, 2000];
  const moveIntervals = WIDTH < 460 ? 2 : 5;
  const maxPly = Math.max(10, ...points.map(point => point.ply));
  const x = (ply: number) => MARGIN.left + (ply / maxPly) * plotWidth;
  const y = (score: number) => MARGIN.top + ((SCORE_LIMIT - Math.max(-SCORE_LIMIT, Math.min(SCORE_LIMIT, score))) / (SCORE_LIMIT * 2)) * plotHeight;
  const line = points.map(point => `${x(point.ply)},${y(point.score)}`).join(' ');
  const latest = points.at(-1);
  const explanation = describeEvaluation(points);

  return (
    <div className="usi-monitor evaluation-panel">
      <div className="usi-monitor-header" title={onPopOut ? 'Drag to move within the app' : undefined}>
        <h3>Evaluation</h3>
        <div className="evaluation-summary" aria-live="polite">
          {latest ? `${latest.score > 0 ? '+' : ''}${latest.score} cp` : 'Waiting for engine analysis'}
        </div>
        <SecondaryWindowControls title="Evaluation" onDock={onDock} onPopOut={onPopOut} onHide={onToggle} externalWindow={externalWindow} />
      </div>
      <div className="evaluation-content">
        <div className="evaluation-legend"><span><i className="sente-key" />Sente advantage</span><span><i className="gote-key" />Gote advantage</span></div>
        <div className="evaluation-chart-area" ref={chartRef}>
        <svg className="evaluation-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Engine evaluation by move">
          <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight / 2} className="evaluation-sente-zone" />
          <rect x={MARGIN.left} y={MARGIN.top + plotHeight / 2} width={plotWidth} height={plotHeight / 2} className="evaluation-gote-zone" />
          {scoreTicks.map(score => <g key={score}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(score)} y2={y(score)} className={score === 0 ? 'evaluation-zero' : 'evaluation-grid'} />
            <text x={MARGIN.left - 8} y={y(score) + 4} textAnchor="end">{score === 0 ? '0' : score / 1000}</text>
          </g>)}
          {Array.from({ length: moveIntervals + 1 }, (_, index) => Math.round((maxPly * index) / moveIntervals)).map(ply => <g key={ply}>
            <line x1={x(ply)} x2={x(ply)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="evaluation-grid" />
            <text x={x(ply)} y={HEIGHT - 10} textAnchor="middle">{ply}</text>
          </g>)}
          {points.length > 1 && <polyline points={line} className="evaluation-line" />}
          {points.map((point, index) => <circle key={`${point.ply}-${index}`} cx={x(point.ply)} cy={y(point.score)} r="4" className="evaluation-point"><title>Move {point.ply}: {point.score > 0 ? '+' : ''}{point.score} cp</title></circle>)}
          {latest && <line x1={x(latest.ply)} x2={x(latest.ply)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="evaluation-current" />}
          {points.length === 0 && <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" className="evaluation-empty"><tspan x={WIDTH / 2} dy="-6">Evaluations appear after</tspan><tspan x={WIDTH / 2} dy="18">an engine completes a search</tspan></text>}
          <text x={WIDTH / 2} y={HEIGHT - 1} textAnchor="middle" className="evaluation-axis-label">Move</text>
        </svg>
        </div>
        <aside className="evaluation-explanation" aria-label="Evaluation interpretation">
          <strong>{explanation.headline}</strong>
          <details><summary>Evaluation details</summary>
          <p>{explanation.detail}</p><AnalysisInstructions guide="evaluation" />
          {latest && <small>Current engine score: {latest.score > 0 ? '+' : ''}{latest.score} centipawns at move {latest.ply}. Scores are estimates, not guaranteed outcomes.</small>}
          </details>
        </aside>
      </div>
    </div>
  );
}
