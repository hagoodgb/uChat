import { useEffect, useRef, useState } from "react";
import { Plus, Upload, Link2, Pencil, Trash2, Download, MessageSquarePlus } from "lucide-react";
import Overlay from "../Overlay.jsx";
import CharacterEditor from "../characters/CharacterEditor.jsx";
import NewChatWizard from "../newchat/NewChatWizard.jsx";
import { useStore } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

export default function CharactersOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const characters = useStore((s) => s.characters);
  const setCharacters = useStore((s) => s.setCharacters);

  const [editingCharacter, setEditingCharacter] = useState(undefined); // undefined = closed, null = new, obj = edit
  const [wizardCharacter, setWizardCharacter] = useState(undefined); // undefined = closed, null = blank, obj = character
  const [urlImportValue, setUrlImportValue] = useState("");
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const refresh = () => api.listCharacters().then(setCharacters).catch(console.error);
  useEffect(() => {
    refresh();
  }, []);

  const handlePngUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await api.importCharacterPng(file);
      refresh();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleUrlImport = async () => {
    if (!urlImportValue.trim()) return;
    setBusy(true);
    try {
      await api.importCharacterUrl(urlImportValue.trim());
      setUrlImportValue("");
      setShowUrlImport(false);
      refresh();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteCharacter = async (id) => {
    if (!confirm("Delete this character? This can't be undone.")) return;
    await api.deleteCharacter(id);
    refresh();
  };

  const exportPng = (id) => {
    window.open(`/api/characters/${id}/export-png`, "_blank");
  };

  // Nested overlays render on top and take over the view.
  if (editingCharacter !== undefined) {
    return (
      <CharacterEditor
        character={editingCharacter}
        onClose={() => setEditingCharacter(undefined)}
        onSaved={() => {
          setEditingCharacter(undefined);
          refresh();
        }}
      />
    );
  }
  if (wizardCharacter !== undefined) {
    return <NewChatWizard character={wizardCharacter} onClose={() => setWizardCharacter(undefined)} />;
  }

  return (
    <Overlay title="Characters" subtitle="Create, import, and manage character cards." onClose={closeOverlay} width="max-w-3xl">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setEditingCharacter(null)}
          className="flex items-center gap-1.5 rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass/90"
        >
          <Plus size={14} /> New character
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-50"
        >
          <Upload size={14} /> Import PNG
        </button>
        <input ref={fileInputRef} type="file" accept="image/png" className="hidden" onChange={handlePngUpload} />
        <button
          onClick={() => setShowUrlImport((v) => !v)}
          className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          <Link2 size={14} /> Import from URL
        </button>
        <button
          onClick={() => setWizardCharacter(null)}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          <MessageSquarePlus size={14} /> Blank chat
        </button>
      </div>

      {showUrlImport && (
        <div className="mb-4 flex gap-2">
          <input
            value={urlImportValue}
            onChange={(e) => setUrlImportValue(e.target.value)}
            placeholder="https://... (PNG card or JSON card)"
            className="flex-1 rounded-md border border-hairline bg-panel px-2.5 py-1.5 font-mono text-sm text-ink outline-none focus:border-brass"
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

      {characters.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No characters yet — create one or import a card.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {characters.map((c) => (
            <div key={c.id} className="group relative overflow-hidden rounded-lg border border-hairline bg-panel2">
              <div className="aspect-square w-full overflow-hidden bg-panel">
                {c.avatarUrl && <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />}
              </div>
              <div className="p-2.5">
                <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                {c.tags?.length > 0 && (
                  <div className="mt-1 truncate text-[11px] text-muted">{c.tags.join(" · ")}</div>
                )}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-base/90 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                <button
                  onClick={() => setWizardCharacter(c)}
                  className="flex items-center gap-1 rounded-md bg-brass px-2.5 py-1 text-xs font-medium text-base hover:bg-brass/90"
                >
                  <MessageSquarePlus size={12} /> Start chat
                </button>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditingCharacter(c)}
                    className="rounded p-1.5 text-muted hover:bg-panel2 hover:text-ink"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => exportPng(c.id)}
                    className="rounded p-1.5 text-muted hover:bg-panel2 hover:text-ink"
                    title="Export PNG card"
                  >
                    <Download size={13} />
                  </button>
                  <button
                    onClick={() => deleteCharacter(c.id)}
                    className="rounded p-1.5 text-muted hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Overlay>
  );
}
