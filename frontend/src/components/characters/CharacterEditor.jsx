import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import Overlay from "../Overlay.jsx";
import { api } from "../../lib/api.js";

const blankForm = {
  name: "",
  description: "",
  scenario: "",
  firstMes: "",
  alternateGreetings: [],
  mesExample: "",
  systemPrompt: "",
  postHistoryInstructions: "",
  creatorNotes: "",
  tagsText: "",
  creator: "",
  characterVersion: "",
};

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-hairline">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass";
const textareaCls = inputCls + " resize-y";

export default function CharacterEditor({ character, onClose, onSaved }) {
  const [form, setForm] = useState(blankForm);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [lorebooks, setLorebooks] = useState([]);
  const [attachedIds, setAttachedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.listLorebooks().then(setLorebooks).catch(console.error);
    if (character) {
      // Description and Personality used to be separate fields (and still
      // are on imported SillyTavern-format cards) — merged here into one
      // box for editing so nothing from either gets lost. Saving writes
      // the combined text back to `description` and clears `personality`,
      // so the split doesn't linger once a character's been edited here.
      const combinedDescription = [character.description, character.personality].filter(Boolean).join("\n\n");
      setForm({
        name: character.name || "",
        description: combinedDescription,
        scenario: character.scenario || "",
        firstMes: character.firstMes || "",
        alternateGreetings: character.alternateGreetings || [],
        mesExample: character.mesExample || "",
        systemPrompt: character.systemPrompt || "",
        postHistoryInstructions: character.postHistoryInstructions || "",
        creatorNotes: character.creatorNotes || "",
        tagsText: (character.tags || []).join(", "),
        creator: character.creator || "",
        characterVersion: character.characterVersion || "",
      });
      setAvatarUrl(character.avatarUrl);
      api.lorebooksForCharacter(character.id).then((books) => setAttachedIds(new Set(books.map((b) => b.id))));
    }
  }, [character]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addGreeting = () => setForm((f) => ({ ...f, alternateGreetings: [...f.alternateGreetings, ""] }));
  const updateGreeting = (i, val) =>
    setForm((f) => {
      const next = [...f.alternateGreetings];
      next[i] = val;
      return { ...f, alternateGreetings: next };
    });
  const removeGreeting = (i) =>
    setForm((f) => ({ ...f, alternateGreetings: f.alternateGreetings.filter((_, idx) => idx !== i) }));

  const toggleLorebook = (id) =>
    setAttachedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        personality: "", // consolidated into description above — see load logic
        scenario: form.scenario,
        firstMes: form.firstMes,
        alternateGreetings: form.alternateGreetings.filter((g) => g.trim()),
        mesExample: form.mesExample,
        systemPrompt: form.systemPrompt,
        postHistoryInstructions: form.postHistoryInstructions,
        creatorNotes: form.creatorNotes,
        tags: form.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        creator: form.creator,
        characterVersion: form.characterVersion,
      };

      const saved = character
        ? await api.updateCharacter(character.id, payload)
        : await api.createCharacter(payload);

      if (avatarFile) await api.uploadAvatar(saved.id, avatarFile);

      // Reconcile lorebook attachments
      const existing = character ? await api.lorebooksForCharacter(character.id) : [];
      const existingIds = new Set(existing.map((b) => b.id));
      for (const id of attachedIds) {
        if (!existingIds.has(id)) await api.attachLorebook(id, saved.id);
      }
      for (const id of existingIds) {
        if (!attachedIds.has(id)) await api.detachLorebook(id, saved.id);
      }

      onSaved?.();
    } catch (err) {
      alert(`Failed to save character: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay
      title={character ? `Edit ${character.name}` : "New Character"}
      subtitle="Full SillyTavern-style card fields, including lorebook attachments."
      onClose={onClose}
      width="max-w-3xl"
    >
      <div className="flex gap-5">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div
            className="h-28 w-28 cursor-pointer overflow-hidden rounded-lg border border-hairline bg-panel2"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUrl || avatarFile ? (
              <img
                src={avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                <Upload size={20} />
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-muted hover:text-brass"
          >
            Upload avatar
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
          <Field label="Name">
            <input value={form.name} onChange={set("name")} className={inputCls} placeholder="Character name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Creator">
              <input value={form.creator} onChange={set("creator")} className={inputCls} />
            </Field>
            <Field label="Version">
              <input value={form.characterVersion} onChange={set("characterVersion")} className={inputCls} />
            </Field>
          </div>
          <Field label="Tags" hint="Comma-separated">
            <input value={form.tagsText} onChange={set("tagsText")} className={inputCls} placeholder="fantasy, mentor, sarcastic" />
          </Field>
        </div>
      </div>

      <Field label="Description" hint="Appearance, background, personality, voice, quirks — everything about who they are">
        <textarea value={form.description} onChange={set("description")} rows={6} className={textareaCls} />
      </Field>

      <Field label="Scenario" hint="Default setting/premise — overridden per-chat by the scenario editor">
        <textarea value={form.scenario} onChange={set("scenario")} rows={2} className={textareaCls} />
      </Field>

      <Field label="First message (greeting)">
        <textarea value={form.firstMes} onChange={set("firstMes")} rows={3} className={textareaCls} />
      </Field>

      <Field label="Alternate greetings">
        <div className="space-y-2">
          {form.alternateGreetings.map((g, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                value={g}
                onChange={(e) => updateGreeting(i, e.target.value)}
                rows={2}
                className={textareaCls}
              />
              <button onClick={() => removeGreeting(i)} className="shrink-0 self-start rounded p-1.5 text-muted hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={addGreeting}
            className="flex items-center gap-1 text-xs text-muted hover:text-brass"
          >
            <Plus size={13} /> Add alternate greeting
          </button>
        </div>
      </Field>

      <Field label="Example messages" hint="Few-shot style dialogue sample, e.g. {{user}}: ... / Name: ...">
        <textarea value={form.mesExample} onChange={set("mesExample")} rows={3} className={textareaCls} />
      </Field>

      <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
        <Field label="Prompt Injection" hint="Appended onto the Settings menu's System Prompt, if any">
          <textarea value={form.systemPrompt} onChange={set("systemPrompt")} rows={3} className={textareaCls} />
        </Field>
        <Field label="Post-History Injection" hint="Appended onto the Settings menu's Post-History Instructions, if any">
          <textarea
            value={form.postHistoryInstructions}
            onChange={set("postHistoryInstructions")}
            rows={3}
            className={textareaCls}
          />
        </Field>
      </div>

      <Field label="Creator notes" hint="Not sent to the model — just for you">
        <textarea value={form.creatorNotes} onChange={set("creatorNotes")} rows={2} className={textareaCls} />
      </Field>

      <div className="mt-2 border-t border-hairline pt-4">
        <h3 className="mb-2 text-sm font-medium text-ink">Attached lorebooks</h3>
        {lorebooks.length === 0 ? (
          <p className="text-xs text-muted">No lorebooks yet — create one from the Lorebooks menu at the top.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {lorebooks.map((lb) => (
              <button
                key={lb.id}
                onClick={() => toggleLorebook(lb.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  attachedIds.has(lb.id)
                    ? "border-brass bg-brass/15 text-brass"
                    : "border-hairline text-muted hover:text-ink"
                }`}
              >
                {lb.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-hairline pt-4">
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || !form.name.trim()}
          className="rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save character"}
        </button>
      </div>
    </Overlay>
  );
}
