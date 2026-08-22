import { useEffect, useState } from "react";
import { Plug, CheckCircle2, XCircle, Loader2, Trash2, Plus } from "lucide-react";
import Overlay from "../Overlay.jsx";
import ModelSearchSelect from "../ModelSearchSelect.jsx";
import { useStore } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "groq", label: "Groq" },
  { value: "local", label: "Local server" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "custom", label: "Custom / manual" },
];

const emptyForm = { name: "", providerType: "openai", baseUrl: "", apiKey: "", extraHeadersText: "" };

export default function ConnectionsOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const connections = useStore((s) => s.connections);
  const setConnections = useStore((s) => s.setConnections);
  const activeConnectionId = useStore((s) => s.activeConnectionId);
  const setActiveConnection = useStore((s) => s.setActiveConnection);
  const setAvailableModels = useStore((s) => s.setAvailableModels);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const availableModels = useStore((s) => s.availableModels);
  const activeModel = useStore((s) => s.activeModel);
  const setSettingsSchema = useStore((s) => s.setSettingsSchema);

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState({}); // id -> { state: 'testing'|'ok'|'error', message }
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    api.listConnections().then(setConnections).catch(console.error);
  }, []);

  const refresh = () => api.listConnections().then(setConnections);

  const submitForm = async (e) => {
    e.preventDefault();
    let extraHeaders = null;
    if (form.extraHeadersText.trim()) {
      try {
        extraHeaders = JSON.parse(form.extraHeadersText);
      } catch {
        alert("Extra headers must be valid JSON, e.g. {\"X-Custom\": \"value\"}");
        return;
      }
    }
    await api.createConnection({
      name: form.name || PROVIDER_OPTIONS.find((p) => p.value === form.providerType)?.label,
      providerType: form.providerType,
      baseUrl: form.baseUrl || undefined,
      apiKey: form.apiKey || undefined,
      extraHeaders,
    });
    setForm(emptyForm);
    setShowForm(false);
    refresh();
  };

  const testConnection = async (id) => {
    setStatus((s) => ({ ...s, [id]: { state: "testing" } }));
    try {
      const result = await api.testConnection(id);
      setStatus((s) => ({ ...s, [id]: { state: result.ok ? "ok" : "error", message: result.message } }));
    } catch (err) {
      setStatus((s) => ({ ...s, [id]: { state: "error", message: err.message } }));
    }
  };

  const connectTo = async (conn) => {
    setConnecting(conn.id);
    try {
      const result = await api.connectTo(conn.id);
      if (!result.ok) throw new Error(result.message || "Connection failed");
      setActiveConnection(conn.id, result.protocol);
      setAvailableModels(result.models);
      // Prefer whichever model was last used on this connection, if it's
      // still in the live model list, rather than always defaulting to the
      // first one alphabetically.
      const preferred =
        result.lastConnectedModel && result.models.includes(result.lastConnectedModel)
          ? result.lastConnectedModel
          : result.models[0] || null;
      setActiveModel(preferred);
      const schemaRes = await api.getSettingsSchema(conn.id);
      setSettingsSchema(schemaRes.schema);
      setStatus((s) => ({ ...s, [conn.id]: { state: "ok", message: `${result.models.length} models loaded` } }));
    } catch (err) {
      setStatus((s) => ({ ...s, [conn.id]: { state: "error", message: err.message } }));
    } finally {
      setConnecting(null);
    }
  };

  const changeActiveModel = async (connId, model) => {
    setActiveModel(model);
    try {
      await api.updateConnection(connId, { lastConnectedModel: model });
    } catch {
      // non-critical — worst case it just won't be remembered next time
    }
  };

  const removeConnection = async (id) => {
    if (activeConnectionId === id) {
      setActiveConnection(null, null);
      setAvailableModels([]);
      setActiveModel(null);
    }
    await api.deleteConnection(id);
    refresh();
  };

  return (
    <Overlay
      title="Connections"
      subtitle="Save provider profiles, test them, then connect to activate a model."
      onClose={closeOverlay}
    >
      <div className="space-y-3">
        {connections.length === 0 && !showForm && (
          <p className="text-sm text-muted">No saved connections yet.</p>
        )}

        {connections.map((conn) => {
          const st = status[conn.id];
          const isActive = activeConnectionId === conn.id;
          return (
            <div
              key={conn.id}
              className={`rounded-lg border px-4 py-3 ${
                isActive ? "border-brass/60 bg-brass/5" : "border-hairline bg-panel2"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    {conn.name}
                    <span className="rounded bg-hairline px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {conn.providerType}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted">
                    {conn.baseUrl} {conn.apiKeyMasked && `· key ${conn.apiKeyMasked}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testConnection(conn.id)}
                    className="rounded-md border border-hairline px-2.5 py-1 text-xs text-muted hover:text-ink"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => connectTo(conn)}
                    disabled={connecting === conn.id}
                    className="flex items-center gap-1 rounded-md bg-brass/90 px-2.5 py-1 text-xs font-medium text-base hover:bg-brass disabled:opacity-50"
                  >
                    {connecting === conn.id ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                    {isActive ? "Reconnect" : "Connect"}
                  </button>
                  <button
                    onClick={() => removeConnection(conn.id)}
                    className="rounded-md p-1.5 text-muted hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {st && (
                <div
                  className={`mt-2 flex items-center gap-1.5 text-xs ${
                    st.state === "ok" ? "text-teal" : st.state === "error" ? "text-red-400" : "text-muted"
                  }`}
                >
                  {st.state === "testing" && <Loader2 size={12} className="animate-spin" />}
                  {st.state === "ok" && <CheckCircle2 size={12} />}
                  {st.state === "error" && <XCircle size={12} />}
                  {st.message || "Testing..."}
                </div>
              )}

              {isActive && availableModels.length > 0 && (
                <div className="mt-3 border-t border-hairline pt-3">
                  <label className="mb-1 block text-xs text-muted">Active model</label>
                  <ModelSearchSelect
                    models={availableModels}
                    value={activeModel}
                    onChange={(m) => changeActiveModel(conn.id, m)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {showForm ? (
          <form onSubmit={submitForm} className="space-y-3 rounded-lg border border-hairline bg-panel2 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Provider</label>
                <select
                  value={form.providerType}
                  onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value }))}
                  className="w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
                >
                  {PROVIDER_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Profile name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. My OpenAI key"
                  className="w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                Base URL <span className="text-hairline">(leave blank for provider default)</span>
              </label>
              <input
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 font-mono text-sm text-ink outline-none focus:border-brass"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">API key</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="Stored encrypted — never shown again in plain text"
                className="w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 font-mono text-sm text-ink outline-none focus:border-brass"
              />
            </div>
            {form.providerType === "custom" && (
              <div>
                <label className="mb-1 block text-xs text-muted">Extra headers (JSON, optional)</label>
                <textarea
                  value={form.extraHeadersText}
                  onChange={(e) => setForm((f) => ({ ...f, extraHeadersText: e.target.value }))}
                  placeholder='{"X-Custom-Header": "value"}'
                  rows={2}
                  className="w-full rounded-md border border-hairline bg-panel px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-brass"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass/90"
              >
                Save connection
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline py-3 text-sm text-muted hover:border-brass/50 hover:text-brass"
          >
            <Plus size={15} /> Add connection
          </button>
        )}
      </div>
    </Overlay>
  );
}
