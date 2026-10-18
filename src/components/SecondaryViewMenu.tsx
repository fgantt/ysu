import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './SecondaryViewMenu.css';
export const secondaryViews = [
  ['candidates', 'Candidate Moves'], ['continuation', 'Continuation Board / Variation Tree'],
  ['mate', 'Mate Search'], ['comparison', 'Engine Comparison'], ['thinking', 'Engine Thinking'],
  ['review', 'Game Review'], ['usi', 'USI Monitor'], ['evaluation', 'Evaluation'],
] as const;
export const secondaryViewIcons = ['📋', '🌳', '🎯', '⚖️', '🧠', '🔎', '📡', '📈'];
export type SecondaryView = typeof secondaryViews[number][0];
export const SECONDARY_VIEW_TOGGLE_EVENT = 'secondary-view:toggle';
export const secondaryViewWindowLabels: Record<SecondaryView, string> = { candidates: 'candidate-monitor', continuation: 'continuation-monitor', mate: 'mate-monitor', comparison: 'comparison-monitor', thinking: 'thinking-monitor', review: 'review-monitor', usi: 'usi-monitor', evaluation: 'evaluation-monitor' };
export function toggleSecondaryView(view: SecondaryView) {
  window.dispatchEvent(new CustomEvent(SECONDARY_VIEW_TOGGLE_EVENT, { detail: view }));
}
export const SECONDARY_VIEW_OPEN_EVENT = 'secondary-view:open';
export function useSecondaryViewShortcuts(onOpen: (view: SecondaryView) => void, available: (view: SecondaryView) => boolean, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    const listener = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || !event.altKey || event.shiftKey || (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey)) return;
      const entry = secondaryViews[/^Digit[1-8]$/.test(event.code) ? Number(event.code.slice(-1)) - 1 : -1];
      if (entry && available(entry[0])) { event.preventDefault(); onOpen(entry[0]); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onOpen, available, enabled]);
}
export function SecondaryViewMenu({ onOpen, available, handleShortcuts = true }: { handleShortcuts?: boolean; onOpen: (view: SecondaryView) => void; available: (view: SecondaryView) => boolean }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, top: 0 });
  const container = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const close = () => setOpen(false);
  useSecondaryViewShortcuts(view => { onOpen(view); close(); }, available, handleShortcuts);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = popup.current?.getBoundingClientRect().width || Math.min(360, window.innerWidth - 16);
      const height = popup.current?.getBoundingClientRect().height || 320;
      const parent = trigger.current?.closest('.compact-menu-popover')?.getBoundingClientRect();
      // Compact game menus use a side flyout; classic toolbar View uses a dropdown.
      const preferredLeft = parent ? (parent.right + width + 8 <= window.innerWidth ? parent.right + 4 : parent.left - width - 4) : rect.left;
      setPlacement({ left: Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8)), top: Math.max(8, Math.min(parent ? rect.top : rect.bottom + 4, window.innerHeight - height - 8)) });
    };
    position();
    popup.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) { event.preventDefault(); close(); trigger.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('pointerdown', outside); };
  }, [open]);
  return <div className="secondary-view-menu" ref={container}>
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls="secondary-view-options" onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}><span aria-hidden="true">👁️</span> View <span aria-hidden="true">▸</span></button>
    {open && createPortal(<div ref={popup} id="secondary-view-options" role="menu" aria-label="View" className="secondary-view-popover" style={placement} onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'Escape') { event.preventDefault(); close(); trigger.current?.focus(); return; }
      const buttons = Array.from(popup.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      let next: number | undefined;
      if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
      if (event.key === 'Tab') close();
    }}>{secondaryViews.map(([id, label], index) => <button role="menuitem" type="button" key={id} disabled={!available(id)} aria-keyshortcuts={`${mac ? 'Meta' : 'Control'}+Alt+${index + 1}`} onClick={() => { onOpen(id); close(); trigger.current?.focus(); }}><span><span aria-hidden="true">{secondaryViewIcons[index]}</span> {label}</span><kbd>{mac ? '⌘⌥' : 'Ctrl+Alt+'}{index + 1}</kbd></button>)}</div>, document.body)}
  </div>;
}
