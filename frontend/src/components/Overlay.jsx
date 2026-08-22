import { X } from "lucide-react";

export default function Overlay({ title, subtitle, onClose, children, width = "max-w-2xl" }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${width} mt-[6vh] mb-10 rounded-xl border border-hairline bg-panel shadow-panel font-display`}
      >
        <div className="flex items-start justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition hover:bg-panel2 hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
