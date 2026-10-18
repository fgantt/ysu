import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { PANEL_FOCUS_EVENT, usePanelStacking } from '../hooks/usePanelStacking';
import './MovableGameGroup.css';
export const GAME_GROUP_SIZE_KEY = 'shogi-game-group-size';
export type GroupCorner = 'nw' | 'ne' | 'sw' | 'se';
const corners: GroupCorner[] = ['nw', 'ne', 'sw', 'se'];
const MIN_SIZE = 0.5, MAX_SIZE = 1.5;
export interface GroupResizeStart { width: number; height: number; size: number; outerZoom: number; offset: { x: number; y: number }; corner: GroupCorner; visible?: { left: number; top: number; boardLeft: number; boardRight: number; boardTop: number; viewportWidth: number; viewportHeight: number } }
export function resizeGameGroup(start: GroupResizeStart, dx: number, dy: number) {
  const west = start.corner.includes('w'), north = start.corner.includes('n');
  const projection = (dx * (west ? -1 : 1) * start.width + dy * (north ? -1 : 1) * start.height) / (start.width ** 2 + start.height ** 2);
  let low = MIN_SIZE / start.size, high = MAX_SIZE / start.size;
  const visible = start.visible;
  if (visible) {
    const restrict = (base: number, coefficient: number, minimum: number, maximum: number) => {
      if (Math.abs(coefficient) < .001) return;
      const first = 1 + (minimum - base) / coefficient, second = 1 + (maximum - base) / coefficient;
      low = Math.max(low, Math.min(first, second)); high = Math.min(high, Math.max(first, second));
    };
    restrict(visible.boardRight, visible.boardRight - visible.left - (west ? start.width : 0), 80, Infinity);
    restrict(visible.boardLeft, visible.boardLeft - visible.left - (west ? start.width : 0), -Infinity, visible.viewportWidth - 80);
    restrict(visible.boardTop, visible.boardTop - visible.top - (north ? start.height : 0), 8, visible.viewportHeight - 40);
  }
  const ratio = low <= high ? Math.max(low, Math.min(high, 1 + projection)) : 1;
  const size = start.size * ratio;
  return { size, offset: { x: start.offset.x + (west ? start.width * (1 - ratio) / start.outerZoom : 0), y: start.offset.y + (north ? start.height * (1 - ratio) / start.outerZoom : 0) } };
}
function savedSize() {
  try { const size = Number(localStorage.getItem(GAME_GROUP_SIZE_KEY) ?? 1); if (Number.isFinite(size)) return Math.max(MIN_SIZE, Math.min(MAX_SIZE, size)); } catch { /* Default scale. */ }
  return 1;
}
export const GAME_GROUP_POSITION_KEY = 'shogi-game-group-position';
interface Offset { x: number; y: number }
const headings = '.column-numbers, .captured-pieces h3, .move-log h3';
function savedOffset(): Offset {
  try {
    const value = JSON.parse(localStorage.getItem(GAME_GROUP_POSITION_KEY) ?? 'null');
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return value;
  } catch { /* Use the normal position if the cache is unavailable. */ }
  return { x: 0, y: 0 };
}
/** Move the compact playing workspace without intercepting board/piece interactions. */
export function MovableGameGroup({ children }: { children: ReactNode }) {
  const zIndex = usePanelStacking('game-workspace');
  const [size, setSize] = useState(savedSize);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const [offset, setOffset] = useState(savedOffset);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; offset: Offset; scale: number; moved: boolean; resize?: GroupResizeStart } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number; corner?: GroupCorner } | null>(null);
  const limit = (next: Offset, current: Offset): Offset => {
    const element = frame.current;
    if (!element) return next;
    const rect = element.getBoundingClientRect();
    const scale = element.offsetWidth ? rect.width / element.offsetWidth / sizeRef.current || 1 : 1;
    const anchor = element.querySelector('.column-numbers')?.getBoundingClientRect() ?? rect;
    const left = anchor.left - current.x * scale;
    const top = anchor.top - current.y * scale;
    const right = anchor.right - current.x * scale;
    return {
      x: Math.max((80 - right) / scale, Math.min(next.x, (window.innerWidth - 80 - left) / scale)),
      y: Math.max((8 - top) / scale, Math.min(next.y, (window.innerHeight - 40 - top) / scale)),
    };
  };
  useEffect(() => {
    try { localStorage.setItem(GAME_GROUP_SIZE_KEY, String(size)); } catch { /* Scaling remains available. */ }
  }, [size]);
  useEffect(() => {
    try { localStorage.setItem(GAME_GROUP_POSITION_KEY, JSON.stringify(offset)); } catch { /* Movement remains available. */ }
  }, [offset]);
  useEffect(() => {
    const resize = () => setOffset(current => limit(current, current));
    resize();
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    if (frame.current) observer.observe(frame.current);
    return () => { window.removeEventListener('resize', resize); observer.disconnect(); };
  }, []);
  const visibleBounds = (rect: DOMRect) => {
    const anchor = frame.current?.querySelector('.column-numbers')?.getBoundingClientRect() ?? rect;
    return { left: rect.left, top: rect.top, boardLeft: anchor.left, boardRight: anchor.right, boardTop: anchor.top, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const corner = target.closest<HTMLElement>('[data-group-corner]')?.dataset.groupCorner as GroupCorner | undefined;
    if (event.button !== 0 || (!corner && (!target.closest(headings) || target.closest('button, input, textarea, select, a')))) return;
    const rect = frame.current!.getBoundingClientRect();
    const outerZoom = frame.current!.offsetWidth ? rect.width / frame.current!.offsetWidth / size || 1 : 1;
    drag.current = { resize: corner ? { width: rect.width, height: rect.height, size, outerZoom, offset, corner, visible: visibleBounds(rect) } : undefined, pointer: event.pointerId, x: event.clientX, y: event.clientY, offset, moved: false, scale: outerZoom };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
    start.moved = true;
    if (start.resize) {
      const next = resizeGameGroup(start.resize, event.clientX - start.x, event.clientY - start.y);
      setSize(next.size); setOffset(next.offset); return;
    }
    const next = { x: start.offset.x + (event.clientX - start.x) / start.scale, y: start.offset.y + (event.clientY - start.y) / start.scale };
    setOffset(current => limit(next, current));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    const start = drag.current;
    if (event.type === 'pointerup' && !start.moved) {
      const previous = lastTap.current;
      const time = Date.now();
      if (previous && previous.corner === start.resize?.corner && time - previous.time < 500 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 8) {
        if (start.resize) setSize(1); else setOffset({ x: 0, y: 0 });
        lastTap.current = null;
      } else lastTap.current = { time, x: event.clientX, y: event.clientY, corner: start.resize?.corner };
    } else lastTap.current = null;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div ref={frame} className="compact-main-content movable-game-group" style={{ zIndex, transform: `translate(${offset.x}px, ${offset.y}px)${size === 1 ? '' : ` scale(${size})`}`, transformOrigin: '0 0' }} onPointerDownCapture={event => { if (event.button === 0) window.dispatchEvent(new CustomEvent(PANEL_FOCUS_EVENT, { detail: 'game-workspace' })); }} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { drag.current = null; }} onDoubleClick={event => { if ((event.target as HTMLElement).closest(headings)) setOffset({ x: 0, y: 0 }); }}>{children}{corners.map(corner => <div key={corner} data-group-corner={corner} className={`game-group-corner game-group-corner-${corner}`} role="button" tabIndex={0} aria-label={`Resize game group ${corner}`} title="Drag to resize proportionally; double-click to reset size" onDoubleClick={event => { event.stopPropagation(); setSize(1); }} onKeyDown={event => {
    if (event.key === 'Home') { event.preventDefault(); setSize(1); }
    else if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      const rect = frame.current!.getBoundingClientRect();
      const outerZoom = frame.current!.offsetWidth ? rect.width / frame.current!.offsetWidth / size || 1 : 1;
      const change = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 0.05 : -0.05;
      const ratio = change / size;
      const next = resizeGameGroup({ width: rect.width, height: rect.height, size, outerZoom, offset, corner, visible: visibleBounds(rect) }, rect.width * ratio * (corner.includes('w') ? -1 : 1), rect.height * ratio * (corner.includes('n') ? -1 : 1));
      setSize(next.size); setOffset(next.offset);
    }
  }} />)}</div>;
}
