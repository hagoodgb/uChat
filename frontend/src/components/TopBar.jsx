import { Plug, SlidersHorizontal, Users, UsersRound, History, Sparkles, UserRound } from "lucide-react";
import { useStore } from "../store/useStore.js";

const ICONS = [
  { key: "connections", icon: Plug, label: "Connections" },
  { key: "settings", icon: SlidersHorizontal, label: "Settings" },
  { key: "characters", icon: Users, label: "Characters" },
  { key: "personas", icon: UserRound, label: "Personas" },
  { key: "group", icon: UsersRound, label: "Group Chat" },
  { key: "history", icon: History, label: "Chat History" },
];

export default function TopBar() {
  const activeOverlay = useStore((s) => s.activeOverlay);
  const openOverlay = useStore((s) => s.openOverlay);
  const activeConnectionId = useStore((s) => s.activeConnectionId);
  const activeModel = useStore((s) => s.activeModel);
  const connections = useStore((s) => s.connections);

  const activeConn = connections.find((c) => c.id === activeConnectionId);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-panel px-4 font-display">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-brass" />
        <span className="text-sm font-semibold tracking-tight text-ink">uChat</span>
      </div>

      <div className="flex items-center gap-1">
        {ICONS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => openOverlay(key)}
            title={label}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
              activeOverlay === key
                ? "bg-brass/15 text-brass"
                : "text-muted hover:bg-panel2 hover:text-ink"
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs font-mono text-muted">
        {activeConn ? (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
            <span className="text-ink">{activeConn.name}</span>
            <span className="text-hairline">/</span>
            <span className="text-brass">{activeModel || "no model"}</span>
          </>
        ) : (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted" />
            <span>not connected</span>
          </>
        )}
      </div>
    </div>
  );
}
