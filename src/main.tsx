import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SecondaryTransparencyStyle } from './hooks/useSecondaryTransparency';
import './styles/secondaryTransparency.css';
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { UsiMonitorWindow } from './components/UsiMonitorWindow.tsx'
import { AnalysisAuxiliaryWindow } from './components/AnalysisAuxiliaryWindow.tsx'
import { CandidateMovesWindow } from './components/CandidateMovesWindow.tsx'
import { EvaluationWindow } from './components/EvaluationWindow.tsx'

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <SecondaryTransparencyStyle />
        <BrowserRouter>
          {window.location.pathname === '/monitor/usi' ? <UsiMonitorWindow /> :
            window.location.pathname === '/monitor/evaluation' ? <EvaluationWindow /> :
            window.location.pathname === '/monitor/candidates' ? <CandidateMovesWindow /> :
            window.location.pathname === '/monitor/thinking' ? <AnalysisAuxiliaryWindow kind="thinking" /> :
            window.location.pathname === '/monitor/mate' ? <AnalysisAuxiliaryWindow kind="mate" /> :
            window.location.pathname === '/monitor/comparison' ? <AnalysisAuxiliaryWindow kind="comparison" /> :
            window.location.pathname === '/monitor/review' ? <AnalysisAuxiliaryWindow kind="review" /> :
            window.location.pathname === '/monitor/continuation' ? <AnalysisAuxiliaryWindow kind="continuation" /> : <App />}
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  console.error('Root element not found!');
}
