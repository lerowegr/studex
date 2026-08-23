import { statusMeta } from "../lib/format"
import { cn } from "../lib/utils"

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta[status] ?? {
    label: status,
    tone: "text-mist bg-white/5 border-white/15",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        meta.tone,
        className
      )}
    >
      {meta.label}
    </span>
  )
}
