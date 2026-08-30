import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import Overlay from "../Overlay.jsx";
import Slider from "../Slider.jsx";
import { useStore, DEFAULT_CONTEXT_LIMIT } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

export default function SettingsOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const activeConnectionId = useStore((s) => s.activeConnectionId);
  const activeModel = useStore((s) => s.activeModel);
  const modelContextLengths = useStore((s) => s.modelContextLengths);
  const settingsSchema = useStore((s) => s.settingsSchema);
  const settingsValues = useStore((s) => s.settingsValues);
  const setSettingValue = useStore((s) => s.setSettingValue);
  const setContextLimitForModel = useStore((s) => s.setContextLimitForModel);
  const settingsProfiles = useStore((s) => s.settingsProfiles);
  const setSettingsProfiles = useStore((s) => s.setSettingsProfiles);
  const applySettingsProfile = useStore((s) => s.applySettingsProfile);

  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    api.listSettingsProfiles().then(setSettingsProfiles).catch(console.error);
  }, []);

  const saveProfile = async () => {
    if (!profileName.trim()) return;
    await api.createSettingsProfile({ name: profileName.trim(), settings: settingsValues });
    setProfileName("");
    api.listSettingsProfiles().then(setSettingsProfiles);
  };

  const deleteProfile = async (id) => {
    await api.deleteSettingsProfile(id);
    api.listSettingsProfiles().then(setSettingsProfiles);
  };

  // Defaults to the model's actual max context window when the provider
  // exposes one (OpenRouter does; OpenAI/Anthropic generally don't), else a
  // safe fallback — but the slider's own ceiling stays generous regardless,
  // so raising it past a guessed/outdated max is never blocked.
  const detectedMax = modelContextLengths[activeModel] || DEFAULT_CONTEXT_LIMIT;
  const contextLimitMax = Math.max(detectedMax, 200000, settingsValues.contextLimit || 0);

  return (
    <Overlay
      title="Generation Settings"
      subtitle="System Prompt and Post-History Instructions apply everywhere; sliders below match whatever your connected provider supports."
      onClose={closeOverlay}
    >
      <div className="mb-5 space-y-4 border-b border-hairline pb-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">System Prompt</label>
          <p className="mb-1.5 text-[11px] text-hairline">
            The base prompt for every chat. A character's own "Prompt Injection" field appends onto this — use
            either, both, or neither.
          </p>
          <textarea
            value={settingsValues.systemPrompt || ""}
            onChange={(e) => setSettingValue("systemPrompt", e.target.value)}
            rows={4}
            placeholder="e.g. This is a collaborative fiction-writing exercise. Be vivid and descriptive..."
            className="w-full resize-y rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Post-History Instructions</label>
          <p className="mb-1.5 text-[11px] text-hairline">
            Injected right after the chat history, closest to generation — a character's "Post-History Injection"
            field appends onto this.
          </p>
          <textarea
            value={settingsValues.postHistoryInstructions || ""}
            onChange={(e) => setSettingValue("postHistoryInstructions", e.target.value)}
            rows={3}
            placeholder="e.g. Keep replies under 4 sentences. Never speak for the user."
            className="w-full resize-y rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
          />
        </div>
        <div>
          <Slider
            label="Context Limit"
            description={
              modelContextLengths[activeModel]
                ? `Caps how much chat history gets sent per request. Defaults to ${activeModel}'s real max (${detectedMax.toLocaleString()} tokens) the first time it's used — lower it to control token usage/cost.`
                : "Caps how much chat history gets sent per request — lower it to control token usage/cost. This provider doesn't report a model max, so this starts at a safe generic default."
            }
            min={512}
            max={contextLimitMax}
            step={256}
            value={settingsValues.contextLimit || DEFAULT_CONTEXT_LIMIT}
            onChange={(v) => setContextLimitForModel(activeModel, v)}
          />
        </div>
      </div>

      {!activeConnectionId ? (
        <p className="text-sm text-muted">Connect to a provider (Connections menu) to see its tunable parameters.</p>
      ) : (
        <div className="space-y-1 divide-y divide-hairline">
          {settingsSchema.map((s) => (
            <Slider
              key={s.key}
              label={s.label}
              description={s.description}
              min={s.min}
              max={s.max}
              step={s.step}
              value={settingsValues[s.key] ?? s.default}
              onChange={(v) => setSettingValue(s.key, v)}
            />
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-hairline pt-4">
        <h3 className="mb-2 text-sm font-medium text-ink">Settings profiles</h3>
        <div className="space-y-2">
          {settingsProfiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md border border-hairline bg-panel2 px-3 py-2"
            >
              <button
                onClick={() => applySettingsProfile(p)}
                className="text-left text-sm text-ink hover:text-brass"
              >
                {p.name}
              </button>
              <button
                onClick={() => deleteProfile(p.id)}
                className="rounded p-1 text-muted hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Profile name, e.g. 'Creative'"
            className="flex-1 rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
          />
          <button
            onClick={saveProfile}
            className="flex items-center gap-1.5 rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass/90"
          >
            <Save size={14} /> Save current
          </button>
        </div>
      </div>
    </Overlay>
  );
}
