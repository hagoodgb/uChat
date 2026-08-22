export default function CharacterChips({ characters, onTrigger, disabled, respondingId }) {
  if (characters.length === 0) return null;
  return (
    <div className="flex items-center gap-2 border-t border-hairline bg-panel px-4 pt-2.5">
      {characters.map((c) => (
        <button
          key={c.id}
          onClick={() => onTrigger(c.id)}
          disabled={disabled}
          title={`Get a reply from ${c.name}`}
          className="group flex flex-col items-center gap-1 disabled:opacity-40"
        >
          <div
            className={`h-9 w-9 overflow-hidden rounded-full border-2 transition ${
              respondingId === c.id ? "border-brass animate-pulse-soft" : "border-hairline group-hover:border-brass/60"
            }`}
          >
            {c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />}
          </div>
          <span className="max-w-[3.5rem] truncate text-[10px] text-muted group-hover:text-ink">{c.name}</span>
        </button>
      ))}
    </div>
  );
}
