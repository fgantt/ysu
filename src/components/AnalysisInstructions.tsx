import { analysisGuides, secondaryWindowInstructions } from '../help/guides';
import './AnalysisInstructions.css';

export default function AnalysisInstructions({ guide, windowControls = true }: { guide: keyof typeof analysisGuides; windowControls?: boolean }) {
  const content = analysisGuides[guide];
  return (
    <details className="analysis-instructions">
      <summary>{content.title}</summary>
      <ol>{content.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {windowControls && <><h4>Window controls</h4><ul>{secondaryWindowInstructions.map(step => <li key={step}>{step}</li>)}</ul></>}
    </details>
  );
}
