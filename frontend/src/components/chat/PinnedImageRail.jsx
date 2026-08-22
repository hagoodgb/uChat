import { useState } from "react";
import { X } from "lucide-react";

// One pinned image card. Its box is sized to the image's own aspect ratio
// (captured on load) rather than stretched to fill whatever space is
// available — that stretching was the bug: a single image in a tall column
// got force-fit into a narrow, very-tall box and cropped down to a sliver.
// object-contain is a second safety net: even if the box's rendered shape
// ever ends up different from the image's ratio (e.g. after a manual
// resize), the full image still always fits inside it, letterboxed rather
// than cropped.
function PinnedImageCard({ item, onToggle }) {
  const [ratio, setRatio] = useState(3 / 4); // reasonable default before the image loads

  return (
    <div
      className="group relative w-full shrink-0 resize-y overflow-hidden rounded-xl border border-hairline bg-panel pointer-events-auto shadow-panel"
      style={{ aspectRatio: ratio, maxHeight: "70vh" }}
    >
      <img
        src={item.avatarUrl}
        alt={item.name}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight);
        }}
        className="h-full w-full object-contain"
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-1.5">
        <span className="truncate text-xs font-display font-medium text-ink">{item.name}</span>
        <button
          onClick={() => onToggle(item.key)}
          title="Hide"
          className="shrink-0 rounded p-0.5 text-ink/80 opacity-0 transition hover:text-ink group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// Renders one side (left or right) of pinned large images in the empty
// margin space beside the chat column. Each card sizes itself to its own
// image's aspect ratio and the column simply stacks them; if that ever
// exceeds the available height (many images, or a manual resize), the
// column scrolls rather than letting cards overlap.
export default function PinnedImageRail({ side, items, onToggle }) {
  if (items.length === 0) return null;

  return (
    <div
      className={`pointer-events-none fixed top-14 bottom-0 z-10 hidden w-64 p-4 xl:block ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto">
        {items.map((item) => (
          <PinnedImageCard key={item.key} item={item} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
