import { motion } from "motion/react"
import { Bell, CheckCheck, FileWarning, HandCoins, ShieldAlert, UserPlus } from "lucide-react"
import { useEffect } from "react"

import { useNotifications, useReadAllNotifications } from "../api/hooks"
import { EmptyState, Page, Skeleton } from "../components/ui"

const ICONS: Record<string, typeof Bell> = {
  new_order: Bell,
  order_taken: UserPlus,
  order_delivered: CheckCheck,
  payout_pending: HandCoins,
  dispute_opened: ShieldAlert,
  dispute_resolved: ShieldAlert,
  dispute_admin: FileWarning,
}

export function Notifications() {
  const { data, isLoading } = useNotifications()
  const readAll = useReadAllNotifications()

  useEffect(() => {
    if (data && data.unread > 0) readAll.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.unread])

  return (
    <Page>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Со<span className="text-gradient">бытия</span>
        </h1>
        {data && data.unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="rounded-full bg-gradient-to-r from-violet to-cyan px-2.5 py-0.5 text-xs font-bold text-white"
          >
            {data.unread} новых
          </motion.span>
        )}
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="space-y-2 pb-28">
          {data.items.map((n, i) => {
            const Icon = ICONS[n.type] ?? Bell
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className={`glass flex items-start gap-3 rounded-2xl p-3.5 ${!n.read ? "border-violet/40" : ""}`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5">
                  <Icon className="size-4 text-cyan" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm leading-snug ${!n.read ? "font-semibold" : "text-fog/85"}`}>
                    {n.text}
                  </span>
                  <span className="mt-1 block text-[10px] text-mist">
                    {new Date(n.created_at).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-violet" />}
              </motion.div>
            )
          })}
        </div>
      ) : (
        <EmptyState emoji="🔕" title="Тишина" subtitle="Здесь появятся события по твоим заказам" />
      )}
      <div className="pb-28" />
    </Page>
  )
}
