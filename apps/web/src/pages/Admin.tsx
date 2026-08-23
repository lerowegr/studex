import { motion } from "motion/react"
import { BookOpen, Gavel, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react"
import { useState } from "react"

import {
  useAdminDisputes,
  useAdminStats,
  useDeleteSubject,
  useInvalidate,
  useMe,
  useSaveSubject,
  useSubjects,
} from "../api/hooks"
import { api } from "../api/client"
import type { Subject } from "../api/types"
import { Button, Card, EmptyState, Input, Page, Skeleton } from "../components/ui"
import { rubFromKop } from "../lib/format"
import { notify } from "../lib/telegram"

const OUTCOMES: Array<{ value: string; label: string; variant: "success" | "danger" | "ghost" }> = [
  { value: "executor", label: "Исполнителю", variant: "success" },
  { value: "customer", label: "Заказчику", variant: "danger" },
  { value: "split", label: "50/50", variant: "ghost" },
]

interface Draft {
  id?: number
  emoji: string
  name: string
  course: number
  program: string
}

const EMPTY_DRAFT: Draft = { emoji: "", name: "", course: 1, program: "БИ" }

function SubjectsManager() {
  const { data: subjects } = useSubjects()
  const save = useSaveSubject()
  const del = useDeleteSubject()
  const [draft, setDraft] = useState<Draft | null>(null)

  const startEdit = (s: Subject) =>
    setDraft({ id: s.id, emoji: s.emoji ?? "", name: s.name, course: s.course, program: s.program })

  const submit = () => {
    if (!draft || draft.name.trim().length < 2) return
    save.mutate(
      {
        id: draft.id,
        name: draft.name.trim(),
        course: draft.course,
        program: draft.program,
        emoji: draft.emoji || undefined,
      },
      {
        onSuccess: () => {
          notify("success")
          setDraft(null)
        },
        onError: () => notify("error"),
      }
    )
  }

  return (
    <Card className="mb-4 space-y-3 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <BookOpen className="size-4 text-cyan" /> Предметы
        <span className="ml-auto text-xs font-normal text-mist">{subjects?.length ?? 0} шт.</span>
      </p>

      {!draft && (
        <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          <Plus className="size-3.5" /> Добавить предмет
        </Button>
      )}

      {draft && (
        <div className="space-y-2 rounded-2xl border border-violet/30 bg-violet/5 p-3">
          <div className="flex gap-2">
            <Input
              value={draft.emoji}
              onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
              placeholder="📐"
              className="w-14 text-center"
            />
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Название предмета"
            />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((c) => (
              <button
                key={c}
                onClick={() => setDraft({ ...draft, course: c })}
                className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                  draft.course === c
                    ? "border-violet bg-violet/20 text-fog"
                    : "border-white/10 bg-white/5 text-mist"
                }`}
              >
                {c} к.
              </button>
            ))}
            <Input
              value={draft.program}
              onChange={(e) => setDraft({ ...draft, program: e.target.value.toUpperCase() })}
              placeholder="БИ"
              className="w-16 text-center"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" loading={save.isPending} disabled={draft.name.trim().length < 2} onClick={submit}>
              Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              <X className="size-3.5" /> Отмена
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {subjects?.map((s) => (
          <motion.div key={s.id} layout className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
            <span className="text-lg">{s.emoji ?? "📘"}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
            <span className="shrink-0 text-[10px] text-mist">{s.course}к · {s.program}</span>
            <button onClick={() => startEdit(s)} className="text-mist hover:text-fog">
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Удалить «${s.name}»?`))
                  del.mutate(s.id, {
                    onError: (e) => alert(e instanceof Error ? e.message : "Ошибка"),
                  })
              }}
              className="text-mist hover:text-rose"
            >
              <Trash2 className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}

export function Admin() {
  const { data: me } = useMe()
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: disputes, isLoading: disputesLoading } = useAdminDisputes()
  const invalidate = useInvalidate()
  const [note, setNote] = useState<Record<string, string>>({})
  const [resolving, setResolving] = useState<string | null>(null)
  const [banId, setBanId] = useState("")

  if (me && !me.is_admin) {
    return (
      <Page>
        <EmptyState emoji="⛔️" title="Только для админов" />
      </Page>
    )
  }

  const resolve = async (id: string, outcome: string) => {
    setResolving(id)
    try {
      await api.adminResolve(id, outcome, note[id])
      notify("success")
      invalidate("admin")
    } catch {
      notify("error")
    } finally {
      setResolving(null)
    }
  }

  return (
    <Page>
      <header className="mb-4 flex items-center gap-2">
        <ShieldCheck className="size-6 text-cyan" />
        <h1 className="font-display text-2xl font-bold tracking-tight">Админка</h1>
      </header>

      {statsLoading || !stats ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: "users", label: "Юзеров" },
            { k: "orders_completed", label: "Сделок" },
            { k: "disputes_open", label: "Споров" },
          ].map(({ k, label }, i) => (
            <motion.div
              key={k}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className="p-3 text-center">
                <p className="font-display text-xl font-bold text-gradient">{stats[k] ?? 0}</p>
                <p className="mt-0.5 text-[10px] text-mist">{label}</p>
              </Card>
            </motion.div>
          ))}
          <Card className="col-span-3 p-3 text-center">
            <p className="text-xs text-mist">Оборот завершённых сделок</p>
            <p className="font-display text-lg font-bold text-gradient">
              {rubFromKop(stats.gmv_kop ?? 0)}
            </p>
          </Card>
        </div>
      )}

      <h2 className="mb-2 mt-5 flex items-center gap-1.5 font-display text-base font-bold">
        <Gavel className="size-4 text-violet" /> Споры
      </h2>

      <SubjectsManager />

      {disputesLoading ? (
        <Skeleton className="h-32" />
      ) : disputes && disputes.length > 0 ? (
        <div className="space-y-3 pb-4">
          {disputes.map((d) => (
            <Card key={d.id} className={`space-y-2.5 p-4 ${d.status === "open" ? "border-rose/30" : ""}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-mist">#{d.order_id.slice(0, 8)}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-semibold ${
                    d.status === "open"
                      ? "border-rose/30 bg-rose/10 text-rose"
                      : "border-lime/30 bg-lime/10 text-lime"
                  }`}
                >
                  {d.status === "open" ? "открыт" : d.status.replace("resolved_", "")}
                </span>
              </div>
              <p className="text-sm leading-snug">{d.reason}</p>
              {d.status === "open" && (
                <>
                  <input
                    value={note[d.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [d.id]: e.target.value }))}
                    placeholder="Комментарий к решению (необязательно)"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none placeholder:text-mist/60 focus:border-violet/60"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {OUTCOMES.map((o) => (
                      <Button
                        key={o.value}
                        size="sm"
                        variant={o.variant}
                        loading={resolving === d.id}
                        onClick={() => resolve(d.id, o.value)}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {d.resolution_note && (
                <p className="rounded-xl bg-white/5 p-2 text-xs text-mist">💬 {d.resolution_note}</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState emoji="🕊" title="Споров нет" subtitle="Все довольны" />
      )}

      <Card className="mb-28 mt-2 space-y-2 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Trash2 className="size-4 text-rose" /> Блокировка пользователя
        </p>
        <div className="flex gap-2">
          <input
            value={banId}
            onChange={(e) => setBanId(e.target.value)}
            placeholder="UUID пользователя"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs outline-none placeholder:text-mist/60 focus:border-rose/60"
          />
          <Button
            size="sm"
            variant="danger"
            disabled={banId.length < 10}
            onClick={() =>
              api
                .adminBan(banId.trim(), "Заблокирован админом")
                .then(() => {
                  notify("success")
                  setBanId("")
                })
                .catch(() => notify("error"))
            }
          >
            Бан
          </Button>
        </div>
      </Card>
    </Page>
  )
}
