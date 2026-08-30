import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Matches Tailwind's max-w-3xl (48rem = 768px), the chat column's own width
// — used to compute how much room each side actually has, both for capping
// a card's max size and for clamping drag/resize within that side only.
const CHAT_COLUMN_WIDTH = 768;
const MIN_CARD_SIZE = 160;
const MAX_CARD_WIDTH = 720; // "quite large", per the brief — well short of a full side on most screens

function zoneWidth() {
  if (typeof window === "undefined") return MAX_CARD_WIDTH;
  return Math.max(0, (window.innerWidth - CHAT_COLUMN_WIDTH) / 2);
}

function PinnedImageCard({ item, onToggle, onUpdate }) {
  const [ratio, setRatio] = useState(3 / 4);
  const [loaded, setLoaded] = useState(false);
  const [dragPos, setDragPos] = useState(null); // {x,y} while actively dragging, else null
  const cardRef = useRef(null);
  // Always holds the latest item so the ResizeObserver callback below can
  // read current width/height without needing to reconnect the observer
  // every time they change.
  const itemRef = useRef(item);
  itemRef.current = item;

  // Observe manual resizes (the native corner drag handle) and persist the
  // final size. Deferred until after the image has actually loaded, so the
  // very first observed size reflects the real aspect ratio rather than the
  // 3:4 fallback used before onLoad fires.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !loaded) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const w = Math.round(width);
      const h = Math.round(height);
      const current = itemRef.current;
      // Ignore anything under ~2px — sub-pixel/rounding noise, not a real
      // resize — so this can never nudge itself in a loop.
      if (Math.abs(w - current.width) < 2 && Math.abs(h - (current.height ?? h)) < 2) return;
      onUpdate(current.key, { width: w, height: h });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.key, loaded, onUpdate]);

  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = item.x;
    const originY = item.y;
    const zw = zoneWidth();
    const cardW = cardRef.current?.offsetWidth || item.width;
    const cardH = cardRef.current?.offsetHeight || item.width;
    const maxY = Math.max(0, window.innerHeight - 56 - cardH);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // Right-side cards are positioned via `right`, so moving the mouse
      // right should INCREASE distance-from-right-edge's negative delta —
      // i.e. dragging right still moves the card right on screen.
      const rawX = originX + (item.side === "left" ? dx : -dx);
      const nextX = Math.max(0, Math.min(rawX, Math.max(0, zw - cardW)));
      const nextY = Math.max(0, Math.min(originY + dy, maxY));
      setDragPos({ x: nextX, y: nextY });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDragPos((pos) => {
        if (pos) onUpdate(item.key, pos);
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const x = dragPos ? dragPos.x : item.x;
  const y = dragPos ? dragPos.y : item.y;
  const maxWidth = Math.min(MAX_CARD_WIDTH, zoneWidth());

  const style = {
    position: "absolute",
    top: y,
    [item.side === "left" ? "left" : "right"]: x,
    width: item.width,
    height: item.height || undefined,
    aspectRatio: item.height ? undefined : ratio,
    minWidth: MIN_CARD_SIZE,
    minHeight: MIN_CARD_SIZE,
    maxWidth,
    maxHeight: "85vh",
    // The base stylesheet sets border-box everywhere, but ResizeObserver's
    // contentRect always measures the content box regardless — with a
    // border-box element that's a couple of pixels smaller than `width`,
    // so every observation would report a slightly smaller size than what
    // was actually set. Feed that back into storage and it compounds every
    // render, shrinking the card a little more each time until it hits the
    // minimum. content-box makes `width`/`height` mean the same thing here
    // as what the observer measures, so there's nothing left to drift.
    boxSizing: "content-box",
  };

  return (
    <div
      ref={cardRef}
      style={style}
      className="group pointer-events-auto resize overflow-hidden rounded-xl border border-hairline bg-panel shadow-panel"
    >
      <img
        src={item.avatarUrl}
        alt={item.name}
        draggable={false}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight);
          setLoaded(true);
        }}
        className="h-full w-full object-contain"
      />
      <div
        onMouseDown={startDrag}
        className="absolute inset-x-0 top-0 flex cursor-grab items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-1.5 active:cursor-grabbing"
      >
        <span className="truncate text-xs font-display font-medium text-ink">{item.name}</span>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onToggle(item.key)}
          title="Hide"
          className="shrink-0 rounded p-0.5 text-ink/80 opacity-0 transition hover:text-ink group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// Renders one side (left or right) of pinned large images in the empty
// margin space beside the chat column. Each card is freely draggable
// (via its title bar) and resizable (native corner handle, both width and
// height) within that side only — it can't cross into the chat column.
export default function PinnedImageRail({ side, items, onToggle, onUpdate }) {
  if (items.length === 0) return null;

  return (
    <div
      className={`pointer-events-none fixed top-14 bottom-0 z-10 hidden xl:block ${side === "left" ? "left-0" : "right-0"}`}
      style={{ width: `max(0px, calc(50% - ${CHAT_COLUMN_WIDTH / 2}px))` }}
    >
      {items.map((item) => (
        <PinnedImageCard key={item.key} item={item} onToggle={onToggle} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
