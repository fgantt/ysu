import { emitTo } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AUXILIARY_ACTION_EVENT } from './AnalysisPanel';
import { CandidateMoves, type CandidatePayload } from './CandidateMoves';
import { ANALYSIS_ACTION_EVENT, CANDIDATE_WINDOW_CONFIG } from './CandidateMovesHost';
import { useDynamicTheme } from '../hooks/useDynamicTheme';
import { returnSecondaryWindow, readSecondaryWindowPayload, useSecondaryWindow } from '../hooks/useSecondaryWindow';
import '../styles/themes.css';
import './UsiMonitor.css';

export function CandidateMovesWindow() {
  useDynamicTheme();
  const payload = useSecondaryWindow(CANDIDATE_WINDOW_CONFIG, readSecondaryWindowPayload<CandidatePayload>('analysis', { searches: [], engineNames: {}, currentSfen: '' }));
  return <main className="usi-monitor-window"><CandidateMoves payload={payload}
    onContinuationChange={value => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-change', value }).catch(console.error)}
    onDetachContinuation={() => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-detach' }).catch(console.error)}
    onEmbedContinuation={() => void emitTo('main', AUXILIARY_ACTION_EVENT, { type: 'continuation-embed' }).catch(console.error)}
    onAnalysisAction={action => void emitTo('main', ANALYSIS_ACTION_EVENT, action).catch(console.error)} isVisible externalWindow onDock={() => void returnSecondaryWindow(CANDIDATE_WINDOW_CONFIG).catch(console.error)} onToggle={() => void getCurrentWindow().close()} /></main>;
}
