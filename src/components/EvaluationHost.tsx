import { EvaluationGraph, type EvaluationPoint } from './EvaluationGraph';
import { SecondaryPanelFrame } from './SecondaryPanelFrame';
import { useSecondaryWindowHost, type SecondaryWindowConfig } from '../hooks/useSecondaryWindow';

export const EVALUATION_WINDOW_LABEL = 'evaluation-monitor';
export const EVALUATION_WINDOW_BOUNDS_KEY = 'shogi-evaluation-window-bounds';
export const EVALUATION_WINDOW_CONFIG: SecondaryWindowConfig = {
  label: EVALUATION_WINDOW_LABEL, panelId: 'evaluation', route: '/monitor/evaluation', queryKey: 'points',
  updateEvent: 'evaluation-monitor:points', closeEvent: 'evaluation-monitor:closed',
  boundsKey: EVALUATION_WINDOW_BOUNDS_KEY, title: 'Evaluation', errorNoun: 'evaluation',
  defaultWidth: 560, defaultHeight: 320, minWidth: 360, minHeight: 256,
};

interface Props { points: EvaluationPoint[]; isVisible: boolean; onToggle: () => void; onDismiss: () => void; }

export function EvaluationHost({ points, isVisible, onToggle, onDismiss }: Props) {
  const { poppedOut, error, popOut } = useSecondaryWindowHost(EVALUATION_WINDOW_CONFIG, points, onDismiss, () => { if (!isVisible) onToggle(); }, { visible: isVisible, onShow: onToggle });

  return <section hidden={poppedOut || !isVisible} className="secondary-panel-dock" aria-label="Evaluation panel">
      <SecondaryPanelFrame id="evaluation" active={isVisible && !poppedOut}>
        {(floating, dock) => <EvaluationGraph points={points} isVisible onToggle={onToggle} onPopOut={() => void popOut()} onDock={floating ? dock : undefined} />}
      </SecondaryPanelFrame>
    {error && <p role="alert">{error}</p>}
  </section>;
}
