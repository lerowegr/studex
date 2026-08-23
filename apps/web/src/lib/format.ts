export function rubFromKop(kop: number): string {
  return `${(kop / 100).toLocaleString("ru-RU")} ₽`
}

export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

export function dateTimeFull(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function deadlineLabel(iso: string): { text: string; urgent: boolean } {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return { text: "просрочен", urgent: true }
  const hours = diffMs / 3_600_000
  if (hours < 1) return { text: `${Math.max(1, Math.round(diffMs / 60_000))} мин`, urgent: true }
  if (hours < 24) return { text: `${Math.round(hours)} ч`, urgent: true }
  return { text: `${Math.round(hours / 24)} дн`, urgent: false }
}

export const categoryLabels: Record<string, string> = {
  lab: "Лабораторная",
  coursework: "Курсовая",
  test_prep: "Подготовка к контрольной",
  presentation: "Презентация",
  online_consult: "Онлайн-консультация",
  urgent: "Срочно",
}

export const statusMeta: Record<string, { label: string; tone: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", tone: "text-amber bg-amber/10 border-amber/30" },
  paid: { label: "Открыт", tone: "text-cyan bg-cyan/10 border-cyan/30" },
  in_work: { label: "В работе", tone: "text-violet bg-violet/10 border-violet/30" },
  delivered: { label: "На проверке", tone: "text-sky-300 bg-sky-400/10 border-sky-400/30" },
  completed: { label: "Выполнен", tone: "text-lime bg-lime/10 border-lime/30" },
  disputed: { label: "Спор", tone: "text-rose bg-rose/10 border-rose/30" },
  refunded: { label: "Возврат", tone: "text-mist bg-white/5 border-white/15" },
  cancelled: { label: "Отменён", tone: "text-mist bg-white/5 border-white/15" },
}

export function initials(name: string | null | undefined): string {
  if (!name) return "??"
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}
