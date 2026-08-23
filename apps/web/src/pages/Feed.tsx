import { AnimatePresence, motion } from "motion/react"
import { Bell, BellOff, Plus } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import {
  useFeed,
  useSubjects,
  useSubscriptions,
  useToggleSubscription,
} from "../api/hooks"
import { OrderCardList } from "../components/OrderCard"
import { Chip, EmptyState, Page, Skeleton } from "../components/ui"
import { haptic, notify } from "../lib/telegram"

const CATEGORY_TABS: Array<{ value?: string; label: string }> = [
  { label: "Все" },
  { value: "lab", label: "Лабы" },
  { value: "coursework", label: "Курсовые" },
  { value: "test_prep", label: "Контрольные" },
  { value: "presentation", label: "Презентации" },
  { value: "online_consult", label: "Консультации" },
  { value: "urgent", label: "🔥 Срочно" },
]

export function Feed() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const subjectId = params.get("subject") ? Number(params.get("subject")) : undefined
  const category = params.get("category") ?? undefined

  const { data: subjects } = useSubjects()
  const subject = subjects?.find((s) => s.id === subjectId)
  const { data: orders, isLoading } = useFeed({ subject_id: subjectId, category })
  const { data: subs } = useSubscriptions()
  const toggleSub = useToggleSubscription(subjectId ?? null)
  const subscribed = !!subs?.some((s) => s.id === subjectId)

  const toggleSubscribe = () => {
    if (subjectId === null) return
    haptic("medium")
    toggleSub.mutate(!subscribed, {
      onSuccess: () => notify(subscribed ? "warning" : "success"),
    })
  }

  const setFilter = (key: string, value?: string) => {
    haptic("light")
    const next = new URLSearchParams(params)
    if (value === undefined) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <Page>
      <header className="mb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Лен<span className="text-gradient">та</span>
        </h1>
        <p className="mt-0.5 text-xs text-mist">Открытые заказы — деньги уже в эскроу</p>
      </header>

      {subject && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-3 flex items-center gap-2 overflow-hidden"
        >
          <button
            onClick={() => setFilter("subject")}
            className="glass inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
          >
            {subject.emoji} {subject.name}
            <span className="text-mist">✕</span>
          </button>
          <Chip active={subscribed} onClick={toggleSubscribe}>
            <span className="inline-flex items-center gap-1">
              {subscribed ? <BellOff className="size-3" /> : <Bell className="size-3" />}
              {subscribed ? "Отписаться" : "Уведомлять"}
            </span>
          </Chip>
        </motion.div>
      )}

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CATEGORY_TABS.map((t) => (
          <Chip
            key={t.label}
            active={(t.value ?? undefined) === category}
            onClick={() => setFilter("category", t.value)}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : orders && orders.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <OrderCardList orders={orders} />
        </AnimatePresence>
      ) : (
        <EmptyState
          emoji="🛸"
          title="Пока пусто"
          subtitle="По этим фильтрам заказов нет. Загляни позже или создай свой."
        />
      )}

      <motion.button
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          haptic("medium")
          navigate(subjectId ? `/orders/new?subject=${subjectId}` : "/orders/new")
        }}
        className="fixed bottom-28 right-5 z-40 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet to-cyan text-white shadow-xl shadow-violet/40"
      >
        <Plus className="size-6" />
      </motion.button>
    </Page>
  )
}
