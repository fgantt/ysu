import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HelpPage from './HelpPage';
import AnalysisInstructions from './AnalysisInstructions';

vi.mock('./SvgPiece', () => ({ default: () => <span>Piece</span> }));
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Help guide', () => {
  it('opens with game instructions and makes all feature topics reachable', () => {
    render(<MemoryRouter><HelpPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Start and play a game' })).toBeTruthy();
    for (const [topic, heading] of [
      ['Save & Load', 'Save, export, load, and import'],
      ['Engines', 'Install and configure engines'],
      ['Settings & Practice', 'Customize and practice'],
      ['Analysis Tools', 'Analysis tools'],
      ['Rules', 'Basic Rules'],
      ['Piece Movements', 'Piece Movements'],
      ['Kifu Notation', 'Kifu Notation Explained'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: topic }));
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    }
  });
  it('explains the limits of search results and live manual commands', () => {
    const { rerender } = render(<AnalysisInstructions guide="search" />);
    expect(screen.getByText(/retain earlier search reports/)).toBeTruthy();
    expect(screen.getByText(/Mate scores are not displayed/)).toBeTruthy();
    rerender(<AnalysisInstructions guide="engine" />);
    expect(screen.getByText(/can interrupt the game/)).toBeTruthy();
    rerender(<AnalysisInstructions guide="history" />);
    expect(screen.getByText(/Select a Session/)).toBeTruthy();
  });
});

import { AnalysisPanel } from './AnalysisPanel';
import { CandidateMoves } from './CandidateMoves';
import { EvaluationGraph } from './EvaluationGraph';
import { analysisGuides, panelGuideByTitle } from '../help/guides';
import { secondaryViews } from './SecondaryViewMenu';

describe('Analysis window help', () => {
  it.each(Object.entries(analysisGuides))('provides expandable usage instructions for %s', (guide, content) => {
    render(<AnalysisInstructions guide={guide as keyof typeof analysisGuides} />);
    const summary = screen.getByText(content.title);
    expect(summary.closest('details')?.open).toBe(false);
    fireEvent.click(summary);
    expect(summary.closest('details')?.open).toBe(true);
    expect(screen.getByText(content.steps[0])).toBeTruthy();
  });

  it.each(Object.entries(panelGuideByTitle))('includes instructions in docked and native %s', (title, guide) => {
    const { rerender } = render(<AnalysisPanel title={title} onClose={() => {}}>Content</AnalysisPanel>);
    expect(screen.getByText(analysisGuides[guide].title)).toBeTruthy();
    rerender(<AnalysisPanel title={title} onClose={() => {}} externalWindow>Content</AnalysisPanel>);
    expect(screen.getByText(analysisGuides[guide].title)).toBeTruthy();
  });

  it('includes instructions in Candidate Moves and Evaluation', () => {
    const { unmount } = render(<CandidateMoves payload={{ searches: [], engineNames: {}, currentSfen: '' }} isVisible onToggle={() => {}} />);
    expect(screen.getByText('Using Candidate Moves')).toBeTruthy();
    unmount();
    render(<EvaluationGraph points={[]} isVisible onToggle={() => {}} />);
    expect(screen.getByText('Using Evaluation')).toBeTruthy();
  });

  it('documents every View entry in the main help guide', () => {
    render(<MemoryRouter><HelpPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Analysis Tools' }));
    for (const [id] of secondaryViews) {
      expect(screen.getByRole('heading', { name: analysisGuides[id === 'usi' ? 'engine' : id].title })).toBeTruthy();
    }
    expect(screen.getByRole('heading', { name: 'Using Variation Tree' })).toBeTruthy();
  });
});
