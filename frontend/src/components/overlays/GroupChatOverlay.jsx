import { useEffect, useState } from "react";
import { Users, Check, Zap, MousePointerClick, Plus } from "lucide-react";
import Overlay from "../Overlay.jsx";
import ModelSearchSelect from "../ModelSearchSelect.jsx";
import { useStore } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

const MAX_GROUP_SIZE = 4;

export default function GroupChatOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const characters = useStore((s) => s.characters);
  const setCharacters = useStore((s) => s.setCharacters);
  const activeConnectionId = useStore((s) => s.activeConnectionId);
  const availableModels = useStore((s) => s.availableModels);
  const activeModel = useStore((s) => s.activeModel);
  const activeChatId = useStore((s) => s.activeChatId);
  const activeChatMeta = useStore((s) => s.activeChatMeta);
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const setActiveChatMeta = useStore((s) => s.setActiveChatMeta);
  const updateActiveChatMeta = useStore((s) => s.updateActiveChatMeta);
  const setMessages = useStore((s) => s.setMessages);

  const [mode, setMode] = useState(activeChatMeta?.kind === "group" ? "manage" : "setup");
  const [selectedIds, setSelectedIds] = useState([]);
  const [responseMode, setResponseMode] = useState("auto");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.listCharacters().then(setCharacters).catch(console.error);
  }, []);

  const characterMap = new Map(characters.map((c) => [c.id, c]));
  const ready = !!activeConnectionId && availableModels.length > 0;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_GROUP_SIZE) return prev;
      return [...prev, id];
    });
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
      });
      setActiveChatId(chat.id);
      setActiveChatMeta({
        kind: "group",
        characterIds: chat.characterIds,
        scenario: null,
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

  const updateModelFor = async (characterId, model) => {
    const nextMap = { ...activeChatMeta.modelMap, [characterId]: model };
    updateActiveChatMeta({ modelMap: nextMap });
    await api.updateChat(activeChatId, { modelMap: nextMap });
  };

  const updateResponseMode = async (nextMode) => {
    updateActiveChatMeta({ responseMode: nextMode });
    await api.updateChat(activeChatId, { responseMode: nextMode });
  };

  if (mode === "manage" && activeChatMeta?.kind === "group") {
    const groupCharacters = (activeChatMeta.characterIds || []).map((id) => characterMap.get(id)).filter(Boolean);
    return (
      <Overlay title="Group Chat" subtitle="Shared connection, one model per character." onClose={closeOverlay}>
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

        <div className="grid grid-cols-2 gap-3">
          {groupCharacters.map((c) => (
            <div key={c.id} className="rounded-lg border border-hairline bg-panel2 p-3">
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

        <button
          onClick={() => setMode("setup")}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline py-2.5 text-sm text-muted hover:border-brass/50 hover:text-brass"
        >
          <Plus size={14} /> Start a different group chat
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
