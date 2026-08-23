import { motion } from "motion/react"
import { useState } from "react"

import { useMyOrders } from "../api/hooks"
import { OrderCardList } from "../components/OrderCard"
import { EmptyState, Page, Skeleton } from "../components/ui"
import { haptic } from "../lib/telegram"
import { cn } from "../lib/utils"

type Role = "customer" | "executor"

const ROLES: Array<{ value: Role; label: string }> = [
  { value: "customer", label: "Мои заказы" },
  { value: "executor", label: "Взятые" },
]

export function MyOrders() {
  const [role, setRole] = useState<Role>("customer")
  const { data: orders, isLoading } = useMyOrders(role)

  return (
    <Page>
      <header className="mb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          За<span className="text-gradient">казы</span>
        </h1>
      </header>

      <div className="glass relative mb-5 grid grid-cols-2 rounded-2xl p-1">
        {ROLES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => {
              setRole(value)
              haptic("light")
            }}
            className={cn(
              "relative z-10 rounded-xl py-2.5 text-sm font-semibold transition-colors",
              role === value ? "text-white" : "text-mist hover:text-fog"
            )}
          >
            {role === value && (
              <motion.span
                layoutId="role-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-violet to-cyan shadow-lg shadow-violet/30"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : orders && orders.length > 0 ? (
        <OrderCardList orders={orders} />
      ) : role === "customer" ? (
        <EmptyState
          emoji="📦"
          title="Ты ничего не заказывал"
          subtitle="Найди нужный предмет в каталоге и создай заказ"
        />
      ) : (
        <EmptyState
          emoji="💼"
          title="Нет взятых заказов"
          subtitle="Загляни в ленту — там открытые заказы с деньгами в эскроу"
        />
      )}

      <div className="pb-28" />
    </Page>
  )
}
