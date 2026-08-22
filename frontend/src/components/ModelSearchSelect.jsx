import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export default function ModelSearchSelect({ models, value, onChange, placeholder = "Select a model..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Focus the filter input as soon as the panel opens, so typing
      // immediately filters without an extra click into a search box.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onEscape = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const filtered = query.trim()
    ? models.filter((m) => m.toLowerCase().includes(query.toLowerCase()))
    : models;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-hairline bg-panel px-2.5 py-1.5 font-mono text-sm text-ink outline-none focus:border-brass"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-hairline bg-panel shadow-panel">
          <div className="flex items-center gap-1.5 border-b border-hairline px-2 py-1.5">
            <Search size={13} className="shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter models..."
              className="w-full bg-transparent font-mono text-xs text-ink outline-none placeholder:text-muted"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2 text-xs text-muted">No matching models.</div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                  className={`block w-full truncate px-2.5 py-1.5 text-left font-mono text-xs transition ${
                    m === value ? "bg-brass/15 text-brass" : "text-ink hover:bg-panel2"
                  }`}
                >
                  {m}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
