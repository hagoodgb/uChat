import { ScrollText } from "lucide-react";

// Shows the active scenario (a chat's custom override, or the character's
// own default) at the top of the conversation — visually distinct from real
// messages since it isn't one: no avatar, no hover actions, can't be
// edited/deleted/rerolled. Just a quiet reminder of the premise, useful
// after stepping away from a chat for a while.
export default function ScenarioBanner({ text }) {
  if (!text) return null;
  return (
    <div className="mb-5 rounded-xl border border-dashed border-hairline bg-panel/50 px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        <ScrollText size={12} /> Scenario
      </div>
      <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-muted">{text}</p>
    </div>
  );
}
