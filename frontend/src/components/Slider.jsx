import { useRef, useState, useCallback, useEffect } from "react";

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function roundToStep(v, min, step) {
  const n = Math.round((v - min) / step) * step + min;
  // avoid floating point noise like 0.30000000000000004
  const decimals = (String(step).split(".")[1] || "").length;
  return Number(n.toFixed(decimals));
}

export default function Slider({ label, description, min, max, step, value, onChange }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const pct = ((clamp(value, min, max) - min) / (max - min)) * 100;

  const valueFromClientX = useCallback(
    (clientX) => {
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return clamp(roundToStep(min + ratio * (max - min), min, step), min, max);
    },
    [min, max, step]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => onChange(valueFromClientX(e.clientX));
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, onChange, valueFromClientX]);

  const commitEdit = () => {
    const parsed = parseFloat(editValue);
    if (!Number.isNaN(parsed)) onChange(clamp(roundToStep(parsed, min, step), min, max));
    setEditing(false);
  };

  return (
    <div className="py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">{label}</div>
          {description && <div className="text-xs text-muted">{description}</div>}
        </div>
        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-16 rounded border border-brass bg-panel2 px-1.5 py-0.5 text-right font-mono text-sm text-ink outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => {
              setEditValue(String(value));
              setEditing(true);
            }}
            title="Double-click to type a value"
            className="w-16 cursor-text select-none rounded px-1.5 py-0.5 text-right font-mono text-sm text-brass hover:bg-panel2"
          >
            {value}
          </span>
        )}
      </div>
      <div
        ref={trackRef}
        className="fader-track cursor-pointer"
        onMouseDown={(e) => {
          setDragging(true);
          onChange(valueFromClientX(e.clientX));
        }}
      >
        <div className="fader-fill" style={{ width: `${pct}%` }} />
        <div className="fader-thumb" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}
