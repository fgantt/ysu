interface Props { title: string; onDock?: () => void; onPopOut?: () => void; onHide: () => void; externalWindow?: boolean }
export function SecondaryWindowControls({ title, onDock, onPopOut, onHide, externalWindow = false }: Props) {
  return <div className="usi-monitor-actions">
    {onDock && <button className="usi-monitor-action" onClick={onDock} aria-label={externalWindow ? `Return ${title} to main window` : `Dock ${title}`} title={externalWindow ? 'Return to main window' : 'Dock in original location'}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16M17 10h2M17 14h2"/></svg></button>}
    {onPopOut && <button className="usi-monitor-action" onClick={onPopOut} aria-label={`Pop out ${title}`} title="Pop out window"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="2"/><path d="M13 3h8v8M21 3l-9 9"/></svg></button>}
    <button className="usi-monitor-action" onClick={onHide} aria-label={externalWindow ? `Close ${title} window` : `Minimize ${title}`} title={externalWindow ? 'Close window (reopen through View)' : 'Hide panel (reopen through View)'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={externalWindow ? 'M6 6l12 12M18 6L6 18' : 'M5 12h14'}/></svg></button>
  </div>;
}
