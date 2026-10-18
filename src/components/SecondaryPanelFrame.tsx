import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { PANEL_FOCUS_EVENT, usePanelStacking } from '../hooks/usePanelStacking';
import './SecondaryPanelFrame.css';

interface Bounds { left: number; top: number; width: number; height: number }
interface Layout extends Bounds { floating: boolean }
interface Props {
  id: string;
  active?: boolean;
  children: (floating: boolean, dock: () => void) => ReactNode;
}

export const SECONDARY_PANEL_FOCUS_EVENT = PANEL_FOCUS_EVENT;
export function focusSecondaryPanel(id: string) {
  requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(SECONDARY_PANEL_FOCUS_EVENT, { detail: id })));
}

const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;
const EDGE = 8;
const VISIBLE_HEADER_WIDTH = 120;
const VISIBLE_HEADER_HEIGHT = 32;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fit(bounds: Bounds): Bounds {
  const width = clamp(bounds.width, Math.min(MIN_WIDTH, innerWidth - 2 * EDGE), innerWidth - 2 * EDGE);
  const height = clamp(bounds.height, Math.min(MIN_HEIGHT, innerHeight - 2 * EDGE), innerHeight - 2 * EDGE);
  return {
    width, height,
    // Let the body move offscreen while keeping a strip of the header reachable.
    left: clamp(bounds.left, VISIBLE_HEADER_WIDTH - width, innerWidth - VISIBLE_HEADER_WIDTH),
    top: clamp(bounds.top, EDGE, innerHeight - VISIBLE_HEADER_HEIGHT),
  };
}

function initialLayout(id: string): Layout {
  try {
    const parsed = JSON.parse(localStorage.getItem(`secondary-panel:${id}`) || 'null');
    if (parsed && [parsed.left, parsed.top, parsed.width, parsed.height].every(Number.isFinite)) {
      return { ...fit(parsed), floating: Boolean(parsed.floating) };
    }
  } catch { /* Ignore invalid saved layout. */ }
  return { floating: false, left: EDGE, top: EDGE, width: 640, height: 500 };
}

/** A reusable docked panel that becomes a draggable, resizable in-app window. */
export function SecondaryPanelFrame({ id, active = true, children }: Props) {
  const zIndex = usePanelStacking(id);
  const [layout, setLayout] = useState<Layout>(() => initialLayout(id));
  const floating = active && layout.floating;
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect; started: boolean } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(`secondary-panel:${id}`, JSON.stringify(layout)); }
    catch { /* Storage may be unavailable; dragging still works for this session. */ }
  }, [id, layout]);

  useEffect(() => {
    if (!floating) return;
    const onResize = () => setLayout(current => ({ ...current, ...fit(current) }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [floating]);

  useEffect(() => {
    if (!floating || !frameRef.current) return;
    let observing = true;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      // Hidden frames report zero size; queued notifications can also arrive after disconnect.
      if (!observing || !rect || rect.width <= 0 || rect.height <= 0) return;
      setLayout(current => {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (current.width === width && current.height === height) return current;
        return { ...current, ...fit({ ...current, width, height }) };
      });
    });
    observer.observe(frameRef.current);
    return () => { observing = false; observer.disconnect(); };
  }, [floating]);

  useEffect(() => {
    const focus = (event: Event) => {
      const selected = (event as CustomEvent<string>).detail === id;
      if (selected && !floating) frameRef.current?.scrollIntoView?.({ block: 'nearest' });
    };
    window.addEventListener(SECONDARY_PANEL_FOCUS_EVENT, focus);
    return () => window.removeEventListener(SECONDARY_PANEL_FOCUS_EVENT, focus);
  }, [id, floating]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    window.dispatchEvent(new CustomEvent(SECONDARY_PANEL_FOCUS_EVENT, { detail: id }));
    const target = event.target as HTMLElement;
    if (!active || !target.closest('.usi-monitor-header') || target.closest('button')) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, rect, started: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.started) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
      drag.started = true;
    }
    setLayout(current => ({
      ...current,
      ...fit({
        left: event.clientX - drag.offsetX, top: event.clientY - drag.offsetY,
        width: current.floating ? current.width : drag.rect.width,
        height: current.floating ? current.height : Math.max(MIN_HEIGHT, drag.rect.height),
      }),
      floating: true,
    }));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    const restore = (event: Event) => { if ((event as CustomEvent<string>).detail === id) setLayout(current => ({ ...current, floating: false })); };
    window.addEventListener('secondary-panel:dock', restore);
    return () => window.removeEventListener('secondary-panel:dock', restore);
  }, [id]);

  const dock = () => setLayout(current => ({ ...current, floating: false }));

  return (
    <div
      ref={frameRef}
      className={`secondary-panel-frame${floating ? ' secondary-panel-frame-floating' : ''}`}
      style={floating ? { zIndex, left: layout.left, top: layout.top, width: layout.width, height: layout.height } : undefined}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      {children(floating, dock)}
    </div>
  );
}
