import { motion } from "motion/react"
import { ArrowUpRight, Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { categoryLabels, deadlineLabel, rubFromKop } from "../lib/format"
import { cn } from "../lib/utils"
import type { OrderCard as OrderCardType } from "../api/types"

export function OrderCard({ order, index = 0 }: { order: OrderCardType; index?: number }) {
  const navigate = useNavigate()
  const dl = deadlineLabel(order.deadline)

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), type: "spring", stiffness: 320, damping: 28 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(`/orders/${order.id}`)}
      className="glass w-full rounded-3xl p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-mist">
            <span className="text-sm">{order.subject.emoji}</span>
            <span className="truncate">{order.subject.name}</span>
          </div>
          <p className="truncate font-semibold leading-snug">{order.title}</p>
        </div>
        <ArrowUpRight className="mt-1 size-4 shrink-0 text-mist" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              dl.urgent ? "border-rose/30 bg-rose/10 text-rose" : "border-white/10 bg-white/5 text-mist"
            )}
          >
            <Clock className="size-3" />
            {dl.text}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-mist">
            {categoryLabels[order.category]}
          </span>
        </div>
        <span className="text-gradient font-display text-lg font-bold whitespace-nowrap">
          {rubFromKop(order.price_kop)}
        </span>
      </div>
    </motion.button>
  )
}

export function OrderCardList({ orders }: { orders: OrderCardType[] }) {
  return (
    <motion.div layout className="space-y-3">
      {orders.map((o, i) => (
        <OrderCard key={o.id} order={o} index={i} />
      ))}
    </motion.div>
  )
}
