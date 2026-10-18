import { panelGuideByTitle } from '../help/guides';
import AnalysisInstructions from './AnalysisInstructions';
import { SecondaryWindowControls } from './SecondaryWindowControls';
import type { MateSearchAction } from '../usi/mateSearchSession';
import type { ComparisonAction } from '../usi/engineComparison';
import type { VariationAction } from './VariationTree';
import type { ContinuationState } from './ContinuationBoard';
import type { ReactNode } from 'react';
import { SecondaryPanelFrame } from './SecondaryPanelFrame';
import { useSecondaryWindowHost, type SecondaryWindowConfig } from '../hooks/useSecondaryWindow';
import './AnalysisPanel.css';

export const AUXILIARY_ACTION_EVENT = 'analysis-panels:action';
export type AuxiliaryAction = import('../utils/thinkingHistory').ThinkingAction | MateSearchAction | ComparisonAction | VariationAction | { type: 'continuation-step'; step: number } | { type: 'continuation-embed' } | { type: 'continuation-change'; value: ContinuationState } | { type: 'continuation-detach' } | { type: 'review-start'; engineId: string; seconds: number; scope?: 'game' | 'branch' } | { type: 'review-stop' } | { type: 'review-preview'; ply: number; best: boolean; rootSfen: string; snapshot: string };
export const THINKING_CONFIG: SecondaryWindowConfig = {
  label: 'thinking-monitor', route: '/monitor/thinking', queryKey: 'state', updateEvent: 'thinking-monitor:state', closeEvent: 'thinking-monitor:closed', boundsKey: 'shogi-thinking-window-bounds', title: 'Engine Thinking', errorNoun: 'engine thinking', defaultWidth: 700, defaultHeight: 460, minWidth: 420, minHeight: 300,
};
export const CONTINUATION_CONFIG: SecondaryWindowConfig = {
  label: 'continuation-monitor', route: '/monitor/continuation', queryKey: 'state', updateEvent: 'continuation-monitor:state', closeEvent: 'continuation-monitor:closed', boundsKey: 'shogi-continuation-window-bounds', title: 'Continuation Board', errorNoun: 'continuation board', defaultWidth: 580, defaultHeight: 660, minWidth: 420, minHeight: 300,
};
export const REVIEW_CONFIG: SecondaryWindowConfig = {
  label: 'review-monitor', route: '/monitor/review', queryKey: 'state', updateEvent: 'review-monitor:state', closeEvent: 'review-monitor:closed', boundsKey: 'shogi-review-window-bounds', title: 'Game Review', errorNoun: 'game review', defaultWidth: 760, defaultHeight: 700, minWidth: 420, minHeight: 300,
};
export const COMPARISON_CONFIG: SecondaryWindowConfig = {
  label: 'comparison-monitor', route: '/monitor/comparison', queryKey: 'state', updateEvent: 'comparison-monitor:state', closeEvent: 'comparison-monitor:closed', boundsKey: 'shogi-comparison-window-bounds', title: 'Engine Comparison', errorNoun: 'engine comparison', defaultWidth: 850, defaultHeight: 700, minWidth: 420, minHeight: 300,
};
export const MATE_CONFIG: SecondaryWindowConfig = {
  label: 'mate-monitor', route: '/monitor/mate', queryKey: 'state', updateEvent: 'mate-monitor:state', closeEvent: 'mate-monitor:closed', boundsKey: 'shogi-mate-window-bounds', title: 'Mate Search', errorNoun: 'mate search', defaultWidth: 700, defaultHeight: 560, minWidth: 420, minHeight: 300,
};
export function AnalysisPanel({ title, children, onClose, onDock, onPopOut, externalWindow }: { externalWindow?: boolean; title: string; children: ReactNode; onClose: () => void; onDock?: () => void; onPopOut?: () => void }) {
  return <div className="usi-monitor analysis-panel"><div className="usi-monitor-header"><h3>{title}</h3><SecondaryWindowControls title={title} onDock={onDock} onPopOut={onPopOut} onHide={onClose} externalWindow={externalWindow} /></div><div className="analysis-panel-content">{panelGuideByTitle[title as keyof typeof panelGuideByTitle] && <AnalysisInstructions guide={panelGuideByTitle[title as keyof typeof panelGuideByTitle]} />}{children}</div></div>;
}
export function AnalysisPanelHost<T>({ config, payload, onDismiss, onReturn, visible = true, children }: { visible?: boolean; onReturn?: () => void; config: SecondaryWindowConfig; payload: T; onDismiss: () => void; children: ReactNode }) {
  const { poppedOut, error, popOut } = useSecondaryWindowHost(config, payload, onDismiss, onReturn, onReturn ? { visible, onShow: onReturn } : undefined);
  return <section hidden={!visible || poppedOut} className="secondary-panel-dock" aria-label={`${config.title} panel`}>
    <SecondaryPanelFrame id={config.label} active={visible && !poppedOut}>
      {(floating, dock) => <AnalysisPanel title={config.title} onClose={onDismiss} onDock={floating ? dock : undefined} onPopOut={() => void popOut()}>{children}</AnalysisPanel>}
    </SecondaryPanelFrame>
    {error && <p role="alert">{error}</p>}
  </section>;
}
