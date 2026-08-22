import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, Check, UserRound } from "lucide-react";
import Overlay from "../Overlay.jsx";
import { useStore } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

const blankForm = { name: "", description: "" };

export default function PersonasOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const personas = useStore((s) => s.personas);
  const setPersonas = useStore((s) => s.setPersonas);
  const activePersonaId = useStore((s) => s.activePersonaId);
  const setActivePersonaId = useStore((s) => s.setActivePersonaId);

  const [editingId, setEditingId] = useState(undefined); // undefined = list view, null = new, id = editing
  const [form, setForm] = useState(blankForm);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const refresh = () => api.listPersonas().then(setPersonas).catch(console.error);
  useEffect(() => {
    refresh();
  }, []);

  const startNew = () => {
    setForm(blankForm);
    setAvatarFile(null);
    setEditingId(null);
  };

  const startEdit = (p) => {
    setForm({ name: p.name, description: p.description || "" });
    setAvatarFile(null);
    setEditingId(p.id);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const saved =
        editingId != null
          ? await api.updatePersona(editingId, form)
          : await api.createPersona(form);
      if (avatarFile) await api.uploadPersonaAvatar(saved.id, avatarFile);
      // First persona created becomes the active one automatically.
      if (!activePersonaId) setActivePersonaId(saved.id);
      setEditingId(undefined);
      refresh();
    } catch (err) {
      alert(`Failed to save persona: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this persona?")) return;
    if (activePersonaId === id) setActivePersonaId(null);
    await api.deletePersona(id);
    refresh();
  };

  const editingPersona = editingId != null ? personas.find((p) => p.id === editingId) : null;

  if (editingId !== undefined) {
    return (
      <Overlay
        title={editingPersona ? `Edit ${editingPersona.name}` : "New Persona"}
        subtitle="Who you play as — shown alongside your messages in chat."
        onClose={() => setEditingId(undefined)}
        width="max-w-lg"
      >
        <div className="flex gap-5">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div
              className="h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-hairline bg-panel2"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarFile || editingPersona?.avatarUrl ? (
                <img
                  src={avatarFile ? URL.createObjectURL(avatarFile) : editingPersona.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  <Upload size={18} />
                </div>
              )}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-muted hover:text-brass">
              Upload photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your persona's name"
                className="w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={6}
                placeholder="Who you are in this story — appearance, background, anything characters should know about you."
                className="w-full resize-y rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-hairline pt-4">
          <button onClick={() => setEditingId(undefined)} className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save persona"}
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay title="Personas" subtitle="Who you play as. Pick one to use it across all chats." onClose={closeOverlay}>
      <div
        className={`mb-2 flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
          !activePersonaId ? "border-brass bg-brass/5" : "border-hairline bg-panel2"
        }`}
      >
        <button onClick={() => setActivePersonaId(null)} className="flex flex-1 items-center gap-3 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-panel text-muted">
            <UserRound size={16} />
          </div>
          <div>
            <div className="text-sm font-medium text-ink">None</div>
            <div className="text-xs text-muted">Just "You" — no persona applied</div>
          </div>
        </button>
        {!activePersonaId && <Check size={15} className="shrink-0 text-brass" />}
      </div>

      {personas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No personas yet — create one to represent yourself in chat.</p>
      ) : (
        <div className="space-y-2">
          {personas.map((p) => {
            const active = activePersonaId === p.id;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  active ? "border-brass bg-brass/5" : "border-hairline bg-panel2"
                }`}
              >
                <button onClick={() => setActivePersonaId(p.id)} className="shrink-0">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-hairline">
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-panel text-muted">
                        <UserRound size={16} />
                      </div>
                    )}
                  </div>
                </button>
                <button onClick={() => setActivePersonaId(p.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                  {p.description && <div className="truncate text-xs text-muted">{p.description}</div>}
                </button>
                {active && <Check size={15} className="shrink-0 text-brass" />}
                <button onClick={() => startEdit(p)} className="shrink-0 rounded p-1.5 text-muted hover:text-ink">
                  <Pencil size={13} />
                </button>
                <button onClick={() => remove(p.id)} className="shrink-0 rounded p-1.5 text-muted hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={startNew}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline py-3 text-sm text-muted hover:border-brass/50 hover:text-brass"
      >
        <Plus size={15} /> New persona
      </button>
    </Overlay>
  );
}
