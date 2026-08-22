import { useRef, useState } from "react";
import { Pencil, Trash2, RotateCcw, ChevronsRight, ChevronLeft, ChevronRight, Check, X, UserRound } from "lucide-react";
import { formatMessage } from "../../lib/formatText.jsx";

function Avatar({ url, size = 22, onClick, pinned }) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      title={clickable ? (pinned ? "Hide larger image" : "Show larger image") : undefined}
      className={`shrink-0 overflow-hidden rounded-full border bg-panel2 transition ${
        pinned ? "border-brass ring-2 ring-brass/40" : "border-hairline"
      } ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <UserRound size={size * 0.6} />
        </div>
      )}
    </button>
  );
}

function ActionButton({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md bg-panel/90 p-1 text-muted backdrop-blur-sm transition hover:bg-panel2 hover:text-ink"
    >
      {children}
    </button>
  );
}

export default function MessageBubble({
  role,
  content,
  speakerName,
  speakerAvatarUrl,
  streaming,
  isLast,
  disabled,
  onEdit,
  onDelete,
  onContinue,
  onReroll,
  onAvatarClick,
  avatarPinned,
  variantIndex = 0,
  variantCount = 1,
  onSwipeLeft,
  onSwipeRight,
}) {
  const isUser = role === "user";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [editSize, setEditSize] = useState(null);
  const bubbleRef = useRef(null);

  const startEdit = () => {
    // Measure the rendered bubble so the edit box opens at roughly the same
    // footprint as the message it's replacing, instead of a small default box.
    if (bubbleRef.current) {
      setEditSize({ width: bubbleRef.current.offsetWidth, height: bubbleRef.current.offsetHeight });
    }
    setDraft(content);
    setEditing(true);
  };
  const saveEdit = () => {
    if (draft.trim() && draft !== content) onEdit?.(draft);
    setEditing(false);
  };

  const showActions = !streaming && !editing && !disabled;
  const showContinueReroll = !isUser;
  const showSwipe = !isUser && variantCount > 1;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {speakerName && (
          <div className="flex items-center gap-1.5 px-1">
            <Avatar url={speakerAvatarUrl} onClick={onAvatarClick} pinned={avatarPinned} />
            <span className={`text-xs font-display font-medium ${isUser ? "text-teal" : "text-brass"}`}>
              {speakerName}
            </span>
          </div>
        )}

        <div className="group relative">
          {editing ? (
            <div
              className="rounded-2xl border border-brass bg-panel2 p-2"
              style={editSize ? { width: editSize.width } : { minWidth: "20rem" }}
            >
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={editSize ? { minHeight: Math.max(editSize.height - 8, 60) } : { minHeight: 100 }}
                className="w-full resize-y bg-transparent text-[15px] leading-relaxed text-ink outline-none"
              />
              <div className="mt-1 flex justify-end gap-1.5">
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1 rounded-md bg-brass px-2 py-1 text-xs font-medium text-base hover:bg-brass/90"
                >
                  <Check size={12} /> Save
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={bubbleRef}
              className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                isUser
                  ? "rounded-br-sm bg-teal/15 text-ink"
                  : "rounded-bl-sm bg-panel2 text-ink border border-hairline"
              }`}
            >
              {formatMessage(content)}
              {streaming && (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse-soft bg-brass align-middle" />
              )}
            </div>
          )}

          {showActions && showContinueReroll && (
            <div className="absolute -bottom-3 left-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
              <ActionButton onClick={onContinue} title="Continue this response">
                <ChevronsRight size={13} />
              </ActionButton>
              <ActionButton onClick={onReroll} title="Regenerate this response">
                <RotateCcw size={13} />
              </ActionButton>
              <ActionButton onClick={startEdit} title="Edit">
                <Pencil size={13} />
              </ActionButton>
              <ActionButton onClick={onDelete} title="Delete">
                <Trash2 size={13} />
              </ActionButton>
            </div>
          )}
          {showActions && !showContinueReroll && (
            <div className="absolute -bottom-3 right-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
              <ActionButton onClick={startEdit} title="Edit">
                <Pencil size={13} />
              </ActionButton>
              <ActionButton onClick={onDelete} title="Delete">
                <Trash2 size={13} />
              </ActionButton>
            </div>
          )}

          {/* Swipe between alternate greetings / earlier rerolls — kept
              separate from the hover-only action row above so it's always
              visible whenever more than one version exists. Arrows appear
              only in the direction there's actually somewhere to go. */}
          {showActions && showSwipe && (
            <div className="absolute -bottom-3 right-1 flex items-center gap-0.5 rounded-md bg-panel/90 px-1 py-0.5 text-muted backdrop-blur-sm">
              {variantIndex > 0 ? (
                <button onClick={onSwipeLeft} title="Previous version" className="rounded p-0.5 hover:text-ink">
                  <ChevronLeft size={13} />
                </button>
              ) : (
                <span className="w-[13px]" />
              )}
              <span className="font-mono text-[11px]">
                {variantIndex + 1}/{variantCount}
              </span>
              {variantIndex < variantCount - 1 ? (
                <button onClick={onSwipeRight} title="Next version" className="rounded p-0.5 hover:text-ink">
                  <ChevronRight size={13} />
                </button>
              ) : (
                <span className="w-[13px]" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
