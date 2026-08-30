import { useEffect, useState } from "react";
import { MessageSquare, Trash2, Pencil, Check, Users } from "lucide-react";
import Overlay from "../Overlay.jsx";
import { useStore } from "../../store/useStore.js";
import { api } from "../../lib/api.js";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HistoryOverlay() {
  const closeOverlay = useStore((s) => s.closeOverlay);
  const chats = useStore((s) => s.chats);
  const setChats = useStore((s) => s.setChats);
  const characters = useStore((s) => s.characters);
  const setActiveChatId = useStore((s) => s.setActiveChatId);
  const setActiveChatMeta = useStore((s) => s.setActiveChatMeta);
  const setMessages = useStore((s) => s.setMessages);
  const setActiveConnection = useStore((s) => s.setActiveConnection);
  const setAvailableModels = useStore((s) => s.setAvailableModels);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const connections = useStore((s) => s.connections);

  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const refresh = () => api.listChats().then(setChats).catch(console.error);
  useEffect(() => {
    refresh();
  }, []);

  const characterMap = new Map(characters.map((c) => [c.id, c]));

  const loadChat = async (chat) => {
    const msgs = await api.getMessages(chat.id);
    setActiveChatId(chat.id);
    setActiveChatMeta({
      kind: chat.kind,
      characterIds: chat.characterIds,
      scenario: chat.scenario?.text || null,
      modelMap: chat.modelMap || {},
      responseMode: chat.responseMode || "auto",
    });
    setMessages(
      msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        characterId: m.characterId,
        personaId: m.personaId,
        variantIndex: m.variantIndex,
        variantCount: m.variantCount,
      }))
    );

    // Reconnect the provider this chat was using, if we have it saved and
    // aren't already connected to it — keeps model/settings schema in sync.
    if (chat.connectionId) {
      const conn = connections.find((c) => c.id === chat.connectionId);
      if (conn) {
        try {
          const result = await api.connectTo(chat.connectionId);
          if (result.ok) {
            setActiveConnection(chat.connectionId, result.protocol);
            setAvailableModels(result.models);
            setActiveModel(result.models[0] || null);
          }
        } catch {
          // provider might be offline — chat still loads, just not live
        }
      }
    }
    closeOverlay();
  };

  const deleteChat = async (id) => {
    if (!confirm("Delete this chat and all its messages?")) return;
    await api.deleteChat(id);
    refresh();
  };

  const commitRename = async (id) => {
    if (renameValue.trim()) await api.updateChat(id, { title: renameValue.trim() });
    setRenamingId(null);
    refresh();
  };

  // Group by primary character, blank chats last under their own heading.
  const groups = new Map();
  for (const chat of chats) {
    const key = chat.characterIds?.[0] || "__blank__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(chat);
  }

  return (
    <Overlay title="Chat History" subtitle="Load a previous chat or clean up old ones." onClose={closeOverlay}>
      {chats.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No saved chats yet.</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([key, groupChats]) => {
            const character = key !== "__blank__" ? characterMap.get(key) : null;
            return (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                  {character ? (
                    <>
                      <img src={character.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                      {character.name}
                    </>
                  ) : (
                    <>
                      <Users size={12} /> Blank chats
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  {groupChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center gap-2 rounded-md border border-hairline bg-panel2 px-3 py-2"
                    >
                      <MessageSquare size={14} className="shrink-0 text-muted" />
                      {renamingId === chat.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitRename(chat.id)}
                          onBlur={() => commitRename(chat.id)}
                          className="flex-1 rounded border border-brass bg-panel px-1.5 py-0.5 text-sm text-ink outline-none"
                        />
                      ) : (
                        <button onClick={() => loadChat(chat)} className="group min-w-0 flex-1 text-left">
                          <div className="truncate text-sm text-ink group-hover:text-brass">{chat.title}</div>
                          {chat.lastMessagePreview && (
                            <div className="truncate text-xs text-muted">
                              {chat.lastMessageRole === "user" ? "You: " : ""}
                              {chat.lastMessagePreview}
                            </div>
                          )}
                        </button>
                      )}
                      <span className="shrink-0 font-mono text-[11px] text-muted">{timeAgo(chat.updatedAt)}</span>
                      {renamingId === chat.id ? (
                        <button onClick={() => commitRename(chat.id)} className="rounded p-1 text-muted hover:text-brass">
                          <Check size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setRenamingId(chat.id);
                            setRenameValue(chat.title);
                          }}
                          className="rounded p-1 text-muted hover:text-ink"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      <button onClick={() => deleteChat(chat.id)} className="rounded p-1 text-muted hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}
