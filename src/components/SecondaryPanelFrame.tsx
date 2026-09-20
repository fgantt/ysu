import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import './SecondaryPanelFrame.css';

interface Bounds { left: number; top: number; width: number; height: number }
interface Layout extends Bounds { floating: boolean }
interface Props {
  id: string;
  active?: boolean;
  children: (floating: boolean, dock: () => void) => ReactNode;
}

const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;
const EDGE = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fit(bounds: Bounds): Bounds {
  const width = clamp(bounds.width, Math.min(MIN_WIDTH, innerWidth - 2 * EDGE), innerWidth - 2 * EDGE);
  const height = clamp(bounds.height, Math.min(MIN_HEIGHT, innerHeight - 2 * EDGE), innerHeight - 2 * EDGE);
  return {
    width, height,
    left: clamp(bounds.left, EDGE, innerWidth - width - EDGE),
    top: clamp(bounds.top, EDGE, innerHeight - height - EDGE),
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
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setLayout(current => {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (current.width === width && current.height === height) return current;
        return { ...current, ...fit({ ...current, width, height }) };
      });
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [floating]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
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

  const dock = () => setLayout(current => ({ ...current, floating: false }));

  return (
    <div
      ref={frameRef}
      className={`secondary-panel-frame${floating ? ' secondary-panel-frame-floating' : ''}`}
      style={floating ? { left: layout.left, top: layout.top, width: layout.width, height: layout.height } : undefined}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      {children(floating, dock)}
    </div>
  );
}
