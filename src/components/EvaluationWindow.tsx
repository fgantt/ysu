import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EvaluationGraph, type EvaluationPoint } from './EvaluationGraph';
import { EVALUATION_WINDOW_CONFIG } from './EvaluationHost';
import { useDynamicTheme } from '../hooks/useDynamicTheme';
import { returnSecondaryWindow, readSecondaryWindowPayload, useSecondaryWindow } from '../hooks/useSecondaryWindow';
import '../styles/themes.css';
import './UsiMonitor.css';

export function EvaluationWindow() {
  useDynamicTheme();
  const points = useSecondaryWindow(EVALUATION_WINDOW_CONFIG, readSecondaryWindowPayload<EvaluationPoint[]>('points', []));
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('shogiVibeTheme') || 'light');
  }, []);
  return <main className="usi-monitor-window"><EvaluationGraph
    points={points} isVisible externalWindow onDock={() => void returnSecondaryWindow(EVALUATION_WINDOW_CONFIG).catch(console.error)}
    onToggle={() => void getCurrentWindow().close()}
  /></main>;
}
