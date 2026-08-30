import { useEffect, useState } from "react";
import { Users, Check, Zap, MousePointerClick, Plus, PenLine, BookOpen, X } from "lucide-react";
import Overlay from "../Overlay.jsx";
import ModelSearchSelect from "../ModelSearchSelect.jsx";
import { useStore } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

const MAX_GROUP_SIZE = 4;

export default function GroupChatOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const characters = useStore((s) => s.characters);
  const setCharacters = useStore((s) => s.setCharacters);
  const lorebooks = useStore((s) => s.lorebooks);
  const activeConnectionId = useStore((s) => s.activeConnectionId);
  const availableModels = useStore((s) => s.availableModels);
  const activeModel = useStore((s) => s.activeModel);
  const activeChatId = useStore((s) => s.activeChatId);
  const activeChatMeta = useStore((s) => s.activeChatMeta);
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const setActiveChatMeta = useStore((s) => s.setActiveChatMeta);
  const updateActiveChatMeta = useStore((s) => s.updateActiveChatMeta);
  const setMessages = useStore((s) => s.setMessages);

  const [mode, setMode] = useState(
    activeChatMeta?.kind === "group" || activeChatMeta?.kind === "character" ? "manage" : "setup"
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [responseMode, setResponseMode] = useState("auto");
  const [scenarioText, setScenarioText] = useState("");
  const [selectedLorebookIds, setSelectedLorebookIds] = useState([]);
  const [attachedLorebookIds, setAttachedLorebookIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [scenarioDraft, setScenarioDraft] = useState(activeChatMeta?.scenario || "");
  const [savingScenario, setSavingScenario] = useState(false);

  useEffect(() => {
    api.listCharacters().then(setCharacters).catch(console.error);
    if (mode === "manage" && activeChatId) {
      api
        .lorebooksForChat(activeChatId)
        .then((books) => setAttachedLorebookIds(books.map((b) => b.id)))
        .catch(console.error);
    }
  }, [mode, activeChatId]);

  const characterMap = new Map(characters.map((c) => [c.id, c]));
  const ready = !!activeConnectionId && availableModels.length > 0;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_GROUP_SIZE) return prev;
      return [...prev, id];
    });
  };

  const toggleSelectedLorebook = (id) =>
    setSelectedLorebookIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAttachedLorebook = async (id) => {
    const isAttached = attachedLorebookIds.includes(id);
    setAttachedLorebookIds((prev) => (isAttached ? prev.filter((x) => x !== id) : [...prev, id]));
    try {
      if (isAttached) await api.detachLorebookFromChat(id, activeChatId);
      else await api.attachLorebookToChat(id, activeChatId);
    } catch (err) {
      alert(`Failed to update lorebook: ${err.message}`);
    }
  };

  const createGroup = async () => {
    if (selectedIds.length < 2 || !ready) return;
    setCreating(true);
    try {
      const modelMap = Object.fromEntries(selectedIds.map((id) => [id, activeModel]));
      const chat = await api.createChat({
        title: selectedIds.map((id) => characterMap.get(id)?.name).join(" & "),
        kind: "group",
        characterIds: selectedIds,
        connectionId: activeConnectionId,
        modelMap,
        responseMode,
        scenario: scenarioText.trim() ? { text: scenarioText.trim() } : null,
      });
      for (const lorebookId of selectedLorebookIds) {
        api.attachLorebookToChat(lorebookId, chat.id).catch(() => {});
      }
      setActiveChatId(chat.id);
      setActiveChatMeta({
        kind: "group",
        characterIds: chat.characterIds,
        scenario: chat.scenario?.text || null,
        modelMap: chat.modelMap,
        responseMode: chat.responseMode,
      });
      setMessages([]);
      closeOverlay();
    } catch (err) {
      alert(`Failed to create group chat: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const saveScenario = async () => {
    setSavingScenario(true);
    try {
      const trimmed = scenarioDraft.trim();
      const updated = await api.updateChat(activeChatId, { scenario: trimmed ? { text: trimmed } : { text: "" } });
      updateActiveChatMeta({ scenario: updated.scenario?.text || null });
    } catch (err) {
      alert(`Failed to update scenario: ${err.message}`);
    } finally {
      setSavingScenario(false);
    }
  };

  const updateModelFor = async (characterId, model) => {
    const nextMap = { ...activeChatMeta.modelMap, [characterId]: model };
    updateActiveChatMeta({ modelMap: nextMap });
    await api.updateChat(activeChatId, { modelMap: nextMap });
  };

  const updateResponseMode = async (nextMode) => {
    updateActiveChatMeta({ responseMode: nextMode });
    await api.updateChat(activeChatId, { responseMode: nextMode });
  };

  // Adds/removes a character from the CURRENTLY ACTIVE chat without losing
  // any history — the chat row (and its messages) stay exactly as they are,
  // only its characterIds/kind/modelMap change. A newly added character
  // sees the full prior conversation the same way any group member does;
  // dropping down to 1 character flips it back to a plain single-character
  // chat, which is also what makes the force-response avatar chips
  // disappear again (they're gated on kind === 'group').
  const currentCharacterIds = activeChatMeta?.characterIds || [];

  const addCharacterToChat = async (id) => {
    if (currentCharacterIds.length >= MAX_GROUP_SIZE || currentCharacterIds.includes(id)) return;
    const nextIds = [...currentCharacterIds, id];
    const nextMap = { ...activeChatMeta.modelMap, [id]: activeChatMeta.modelMap?.[id] || activeModel };
    const nextKind = nextIds.length >= 2 ? "group" : "character";
    try {
      await api.updateChat(activeChatId, { characterIds: nextIds, kind: nextKind, modelMap: nextMap });
      updateActiveChatMeta({ characterIds: nextIds, kind: nextKind, modelMap: nextMap });
    } catch (err) {
      alert(`Failed to add character: ${err.message}`);
    }
  };

  const removeCharacterFromChat = async (id) => {
    if (currentCharacterIds.length <= 1) return; // always keep at least one
    const nextIds = currentCharacterIds.filter((x) => x !== id);
    const nextMap = { ...activeChatMeta.modelMap };
    delete nextMap[id];
    const nextKind = nextIds.length >= 2 ? "group" : "character";
    try {
      await api.updateChat(activeChatId, { characterIds: nextIds, kind: nextKind, modelMap: nextMap });
      updateActiveChatMeta({ characterIds: nextIds, kind: nextKind, modelMap: nextMap });
    } catch (err) {
      alert(`Failed to remove character: ${err.message}`);
    }
  };

  const canManage = activeChatMeta?.kind === "group" || activeChatMeta?.kind === "character";

  if (mode === "manage" && canManage) {
    const chatCharacters = currentCharacterIds.map((id) => characterMap.get(id)).filter(Boolean);
    const addableCharacters = characters.filter((c) => !currentCharacterIds.includes(c.id));
    const atCapacity = currentCharacterIds.length >= MAX_GROUP_SIZE;
    return (
      <Overlay
        title={activeChatMeta.kind === "group" ? "Group Chat" : "Chat Participants"}
        subtitle="Shared connection, one model per character. Add or remove characters without losing history."
        onClose={closeOverlay}
      >
        {chatCharacters.length >= 2 && (
          <>
            <div className="mb-4 flex items-center justify-between rounded-md border border-hairline bg-panel2 p-1">
              {[
                { key: "auto", label: "Automatic", icon: Zap },
                { key: "manual", label: "Manual", icon: MousePointerClick },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => updateResponseMode(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                    activeChatMeta.responseMode === key ? "bg-brass text-base" : "text-muted hover:text-ink"
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <p className="mb-4 text-xs text-muted">
              {activeChatMeta.responseMode === "auto"
                ? "Characters respond automatically based on context. Click an avatar in chat to force a specific reply."
                : "Nothing responds automatically — click a character's avatar in chat to get their reply."}
            </p>
          </>
        )}

        <div className="mb-4 border-b border-hairline pb-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <PenLine size={12} /> Scenario
          </label>
          <textarea
            value={scenarioDraft}
            onChange={(e) => setScenarioDraft(e.target.value)}
            rows={2}
            placeholder="Optional — overrides each character's own scenario for this chat."
            className="w-full resize-y rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
          />
          {scenarioDraft !== (activeChatMeta.scenario || "") && (
            <button
              onClick={saveScenario}
              disabled={savingScenario}
              className="mt-1.5 rounded-md bg-brass px-3 py-1 text-xs font-medium text-base hover:bg-brass/90 disabled:opacity-50"
            >
              {savingScenario ? "Saving..." : "Save scenario"}
            </button>
          )}
        </div>

        <h3 className="mb-2 text-sm font-medium text-ink">In this chat</h3>
        <div className="grid grid-cols-2 gap-3">
          {chatCharacters.map((c) => (
            <div key={c.id} className="relative rounded-lg border border-hairline bg-panel2 p-3">
              {chatCharacters.length > 1 && (
                <button
                  onClick={() => removeCharacterFromChat(c.id)}
                  title="Remove from this chat"
                  className="absolute right-1.5 top-1.5 rounded p-1 text-muted hover:bg-red-500/10 hover:text-red-400"
                >
                  <X size={13} />
                </button>
              )}
              <div className="flex items-center gap-2">
                <img src={c.avatarUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                <span className="truncate text-sm font-medium text-ink">{c.name}</span>
              </div>
              <label className="mt-2 block text-[11px] text-muted">Model</label>
              <ModelSearchSelect
                models={availableModels}
                value={activeChatMeta.modelMap?.[c.id]}
                onChange={(m) => updateModelFor(c.id, m)}
              />
            </div>
          ))}
        </div>

        {addableCharacters.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-4">
            <h3 className="mb-2 text-sm font-medium text-ink">
              Add a character {atCapacity && <span className="text-muted">(max {MAX_GROUP_SIZE} reached)</span>}
            </h3>
            <div className="flex flex-wrap gap-2">
              {addableCharacters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addCharacterToChat(c.id)}
                  disabled={atCapacity}
                  className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs text-muted transition hover:border-brass/50 hover:text-brass disabled:opacity-40"
                >
                  <Plus size={12} /> {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {lorebooks.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <BookOpen size={12} /> Lorebooks attached to this chat
            </label>
            <div className="flex flex-wrap gap-2">
              {lorebooks.map((lb) => (
                <button
                  key={lb.id}
                  onClick={() => toggleAttachedLorebook(lb.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    attachedLorebookIds.includes(lb.id)
                      ? "border-brass bg-brass/15 text-brass"
                      : "border-hairline text-muted hover:text-ink"
                  }`}
                >
                  {lb.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setMode("setup")}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline py-2.5 text-sm text-muted hover:border-brass/50 hover:text-brass"
        >
          <Plus size={14} /> Start a brand new group chat instead
        </button>
      </Overlay>
    );
  }

  return (
    <Overlay
      title="New Group Chat"
      subtitle={`Pick 2\u2013${MAX_GROUP_SIZE} characters. Each keeps only its own card in context.`}
      onClose={closeOverlay}
    >
      {!ready && (
        <p className="mb-4 rounded-md border border-hairline bg-panel2 px-3 py-2 text-xs text-muted">
          Connect to a provider first (Connections menu).
        </p>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {characters.map((c) => {
          const selected = selectedIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleSelect(c.id)}
              className={`relative overflow-hidden rounded-lg border text-left transition ${
                selected ? "border-brass" : "border-hairline hover:border-hairline/70"
              }`}
            >
              <div className="aspect-square w-full bg-panel2">
                {c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              {selected && (
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brass text-base">
                  <Check size={12} />
                </div>
              )}
              <div className="truncate px-1.5 py-1 text-[11px] text-ink">{c.name}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
          <PenLine size={12} /> Scenario (optional)
        </label>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value)}
          rows={3}
          placeholder="e.g. All three of you are stranded in an elevator that's just stopped between floors..."
          className="w-full resize-y rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brass"
        />
        <p className="mt-1 text-[11px] text-hairline">
          Overrides each character's own scenario for this chat. Leave blank to use each character's card as-is.
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-muted">Response mode</label>
        <div className="flex items-center gap-2 rounded-md border border-hairline bg-panel2 p-1">
          {[
            { key: "auto", label: "Automatic", icon: Zap },
            { key: "manual", label: "Manual", icon: MousePointerClick },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setResponseMode(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                responseMode === key ? "bg-brass text-base" : "text-muted hover:text-ink"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {lorebooks.length > 0 && (
        <div className="mb-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <BookOpen size={12} /> Lorebooks for this chat (optional)
          </label>
          <div className="flex flex-wrap gap-2">
            {lorebooks.map((lb) => (
              <button
                key={lb.id}
                onClick={() => toggleSelectedLorebook(lb.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  selectedLorebookIds.includes(lb.id)
                    ? "border-brass bg-brass/15 text-brass"
                    : "border-hairline text-muted hover:text-ink"
                }`}
              >
                {lb.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-hairline">
            In addition to whatever lorebooks each character already has attached.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Users size={13} /> {selectedIds.length}/{MAX_GROUP_SIZE} selected
        </span>
        <button
          onClick={createGroup}
          disabled={selectedIds.length < 2 || !ready || creating}
          className="rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50"
        >
          {creating ? "Starting..." : "Start group chat"}
        </button>
      </div>
    </Overlay>
  );
}
