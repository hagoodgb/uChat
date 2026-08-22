import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Square } from "lucide-react";

const MIN_HEIGHT = 44; // px — roughly one line + padding
const MAX_HEIGHT = 240; // px — generous but bounded, so it never crowds out the chat above it

export default function MessageInput({ onSend, disabled, isStreaming, onStop, placeholder }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto"; // reset first so shrinking (e.g. after clearing) also works
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  useEffect(autoGrow, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(autoGrow);
  };

  return (
    <div className="flex items-end gap-2 border-t border-hairline bg-panel px-4 py-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder={placeholder || "Type a message... (*actions* and \"speech\" get styled automatically)"}
        style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
        className="flex-1 resize-none overflow-y-auto rounded-lg border border-hairline bg-panel2 px-3 py-2 text-[15px] text-ink outline-none placeholder:text-muted focus:border-brass"
      />
      <button
        onClick={submit}
        disabled={disabled}
        title="Send"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brass text-base transition hover:bg-brass/90 disabled:opacity-40"
      >
        <SendHorizontal size={17} />
      </button>
      <button
        onClick={onStop}
        disabled={!isStreaming}
        title="Stop generating"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline text-muted transition hover:border-red-400/60 hover:text-red-400 disabled:opacity-30 disabled:hover:border-hairline disabled:hover:text-muted"
      >
        <Square size={14} fill="currentColor" />
      </button>
    </div>
  );
}
