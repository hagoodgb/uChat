import { useEffect, useRef, useState } from "react";
import { Plus, Upload, Link2, Trash2, ChevronLeft, BookOpen } from "lucide-react";
import Overlay from "../Overlay.jsx";
import { useStore } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

const inputCls =
  "w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass";
const textareaCls = inputCls + " resize-y";

function EntryEditor({ entry, onChange, onDelete }) {
  return (
    <div className="rounded-lg border border-hairline bg-panel2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <input
          value={entry.keys?.join(", ") || ""}
          onChange={(e) => onChange({ ...entry, keys: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
          placeholder="Trigger keywords, comma-separated"
          className={`${inputCls} font-mono text-xs`}
        />
        <button onClick={onDelete} className="shrink-0 rounded p-1.5 text-muted hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
      <textarea
        value={entry.content || ""}
        onChange={(e) => onChange({ ...entry, content: e.target.value })}
        rows={2}
        placeholder="What gets inserted into the prompt when a keyword matches..."
        className={textareaCls}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={entry.enabled !== false}
            onChange={(e) => onChange({ ...entry, enabled: e.target.checked })}
          />
          Enabled
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!entry.constant}
            onChange={(e) => onChange({ ...entry, constant: e.target.checked })}
          />
          Always include
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!entry.case_sensitive}
            onChange={(e) => onChange({ ...entry, case_sensitive: e.target.checked })}
          />
          Case-sensitive
        </label>
        <label className="ml-auto flex items-center gap-1.5">
          Priority
          <input
            type="number"
            value={entry.priority ?? 0}
            onChange={(e) => onChange({ ...entry, priority: Number(e.target.value) })}
            className="w-14 rounded border border-hairline bg-panel px-1.5 py-0.5 font-mono text-ink outline-none"
          />
        </label>
      </div>
    </div>
  );
}

function LorebookEditor({ lorebook, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(lorebook.name);
  const [description, setDescription] = useState(lorebook.description || "");
  const [tokenBudget, setTokenBudget] = useState(lorebook.token_budget ?? 500);
  const [entries, setEntries] = useState(lorebook.entries || []);
  const [saving, setSaving] = useState(false);

  const addEntry = () =>
    setEntries((es) => [...es, { keys: [], content: "", enabled: true, priority: 0, insertion_order: es.length }]);
  const updateEntry = (i, next) => setEntries((es) => es.map((e, idx) => (idx === i ? next : e)));
  const removeEntry = (i) => setEntries((es) => es.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateLorebook(lorebook.id, { name, description, token_budget: Number(tokenBudget) || 500, entries });
      onSaved?.();
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${lorebook.name}"? This can't be undone.`)) return;
    await api.deleteLorebook(lorebook.id);
    onDeleted?.();
  };

  return (
    <Overlay title={`Edit ${lorebook.name}`} subtitle="Entries trigger when their keywords appear in recent chat." onClose={onClose} width="max-w-2xl">
      <button onClick={onClose} className="mb-3 flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ChevronLeft size={13} /> Back to lorebooks
      </button>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Token budget</label>
          <input
            type="number"
            value={tokenBudget}
            onChange={(e) => setTokenBudget(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-muted">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={textareaCls} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">Entries ({entries.length})</h3>
        <button onClick={addEntry} className="flex items-center gap-1 text-xs text-muted hover:text-brass">
          <Plus size={13} /> Add entry
        </button>
      </div>
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">No entries yet — add one above.</p>
        ) : (
          entries.map((entry, i) => (
            <EntryEditor key={i} entry={entry} onChange={(next) => updateEntry(i, next)} onDelete={() => removeEntry(i)} />
          ))
        )}
      </div>

      <div className="mt-5 flex justify-between border-t border-hairline pt-4">
        <button onClick={remove} className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300">
          <Trash2 size={14} /> Delete lorebook
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </Overlay>
  );
}

export default function LorebooksOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const lorebooks = useStore((s) => s.lorebooks);
  const setLorebooks = useStore((s) => s.setLorebooks);

  const [editingId, setEditingId] = useState(undefined); // undefined = list view
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const refresh = () => api.listLorebooks().then(setLorebooks).catch(console.error);
  useEffect(() => {
    refresh();
  }, []);

  const createNew = async () => {
    const name = prompt("Name for the new lorebook:");
    if (!name?.trim()) return;
    const created = await api.createLorebook({ name: name.trim() });
    refresh();
    setEditingId(created.id);
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const book = JSON.parse(text);
      await api.importLorebookJson(book.name || file.name.replace(/\.json$/i, ""), book);
      refresh();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleUrlImport = async () => {
    if (!urlValue.trim()) return;
    setBusy(true);
    try {
      await api.importLorebookUrl(urlValue.trim());
      setUrlValue("");
      setShowUrlImport(false);
      refresh();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const editingLorebook = editingId != null ? lorebooks.find((l) => l.id === editingId) : null;
  if (editingLorebook) {
    return (
      <LorebookEditor
        lorebook={editingLorebook}
        onClose={() => setEditingId(undefined)}
        onSaved={() => {
          setEditingId(undefined);
          refresh();
        }}
        onDeleted={() => {
          setEditingId(undefined);
          refresh();
        }}
      />
    );
  }

  return (
    <Overlay title="Lorebooks" subtitle="World info that gets injected when keywords appear in chat." onClose={closeOverlay}>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={createNew}
          className="flex items-center gap-1.5 rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass/90"
        >
          <Plus size={14} /> New lorebook
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-50"
        >
          <Upload size={14} /> Import file
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileImport} />
        <button
          onClick={() => setShowUrlImport((v) => !v)}
          className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          <Link2 size={14} /> Import from URL
        </button>
      </div>

      {showUrlImport && (
        <div className="mb-4 flex gap-2">
          <input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://... (lorebook/world-info JSON)"
            className={`flex-1 font-mono ${inputCls}`}
          />
          <button
            onClick={handleUrlImport}
            disabled={busy}
            className="rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50"
          >
            Import
          </button>
        </div>
      )}

      {lorebooks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No lorebooks yet. Create one, import a file, or import one embedded in a character card via Characters →
          Import.
        </p>
      ) : (
        <div className="space-y-2">
          {lorebooks.map((lb) => (
            <button
              key={lb.id}
              onClick={() => setEditingId(lb.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-panel2 px-3 py-2.5 text-left hover:border-brass/50"
            >
              <BookOpen size={16} className="shrink-0 text-brass" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{lb.name}</div>
                <div className="truncate text-xs text-muted">
                  {lb.entries?.length || 0} {lb.entries?.length === 1 ? "entry" : "entries"}
                  {lb.description ? ` · ${lb.description}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Overlay>
  );
}
