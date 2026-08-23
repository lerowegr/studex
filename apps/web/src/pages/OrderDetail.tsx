import { AnimatePresence, motion } from "motion/react"
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Download,
  FileText,
  Flag,
  HandCoins,
  ShieldCheck,
  Star,
  Timer,
} from "lucide-react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import {
  api,
} from "../api/client"
import {
  useDeliver,
  useDispute,
  useInvalidate,
  useMe,
  useOrder,
  useOrderAction,
  useReview,
} from "../api/hooks"
import type { OrderStatus } from "../api/types"
import { fileUrl } from "../api/client"
import { Chat } from "../components/Chat"
import { Confetti } from "../components/Confetti"
import { StatusBadge } from "../components/StatusBadge"
import { Button, Card, EmptyState, Field, Input, Page, Skeleton, Textarea } from "../components/ui"
import { categoryLabels, dateTimeFull, deadlineLabel, rubFromKop } from "../lib/format"
import { haptic, notify } from "../lib/telegram"
import { cn } from "../lib/utils"

const FLOW: OrderStatus[] = ["awaiting_payment", "paid", "in_work", "delivered", "completed"]

function Timeline({ status }: { status: OrderStatus }) {
  if (["disputed", "refunded", "cancelled"].includes(status)) return null
  const currentIdx = FLOW.indexOf(status)
  return (
    <Card className="p-4">
      <div className="flex items-center">
        {FLOW.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={s} className="relative flex flex-1 flex-col items-center last:flex-none">
              {i > 0 && (
                <div
                  className={cn(
                    "absolute -left-1/2 right-1/2 top-4 h-0.5",
                    done || active ? "bg-gradient-to-r from-violet to-cyan" : "bg-white/10"
                  )}
                />
              )}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
                className={cn(
                  "z-10 grid size-8 place-items-center rounded-full border text-[10px] font-bold",
                  done && "border-transparent bg-gradient-to-br from-violet to-cyan text-white",
                  active &&
                    "border-violet bg-ink text-violet shadow-lg shadow-violet/40 ring-2 ring-violet/30",
                  !done && !active && "border-white/15 bg-white/5 text-mist"
                )}
              >
                {done ? "✓" : i + 1}
              </motion.div>
              <span
                className={cn(
                  "mt-1.5 hidden text-[9px] font-semibold sm:block",
                  active ? "text-fog" : "text-mist"
                )}
              >
                {["Оплата", "Открыт", "В работе", "Сдача", "Готово"][i]}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: order, isLoading } = useOrder(id)

  const action = useOrderAction(id!)
  const deliver = useDeliver(id!)
  const dispute = useDispute(id!)
  const review = useReview(id!)

  const [celebrate, setCelebrate] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", deadline: "" })
  const [rating, setRating] = useState(0)
  const [reviewComment, setReviewComment] = useState("")
  const [reviewed, setReviewed] = useState(false)

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="mb-4 h-10 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="mt-3 h-40" />
      </Page>
    )
  }

  if (!order) {
    return (
      <Page>
        <EmptyState emoji="🕳" title="Заказ не найден" subtitle="Возможно, он удалён или это чужая сделка" />
      </Page>
    )
  }

  const isCustomer = order.customer_is_me
  const isExecutor = order.executor_is_me
  const dl = deadlineLabel(order.deadline)
  const payout = Math.round(order.price_kop * (1 - order.commission_rate))

  const onComplete = () => {
    haptic("heavy")
    action.mutate(
      { kind: "complete" },
      {
        onSuccess: () => {
          setCelebrate(true)
          notify("success")
          setTimeout(() => setCelebrate(false), 1600)
        },
        onError: () => notify("error"),
      }
    )
  }

  return (
    <Page>
      <Confetti fire={celebrate} />

      <header className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
          Назад
        </Button>
        <StatusBadge status={order.status} />
      </header>

      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-mist">
              {order.subject.emoji} {order.subject.name} · {categoryLabels[order.category]}
            </p>
            <h1 className="mt-1 font-display text-lg font-bold leading-snug">{order.title}</h1>
          </div>
          <span className="text-gradient whitespace-nowrap font-display text-xl font-bold">
            {rubFromKop(order.price_kop)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold",
            dl.urgent ? "border-rose/30 bg-rose/10 text-rose" : "border-white/10 bg-white/5 text-mist"
          )}>
            <Timer className="size-3" /> дедлайн: {dateTimeFull(order.deadline)} ({dl.text})
          </span>
          {isCustomer && order.status === "delivered" && order.auto_confirm_at && (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 font-semibold text-cyan">
              авто-подтверждение {dateTimeFull(order.auto_confirm_at)}
            </span>
          )}
        </div>

        {order.description && (
          <p className="whitespace-pre-wrap rounded-2xl bg-white/5 p-3 text-sm leading-relaxed text-fog/90">
            {order.description}
          </p>
        )}
      </Card>

      <div className="mt-3 space-y-3">
        <Timeline status={order.status} />

        {order.status === "disputed" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-rose/25 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose">
                <Flag className="size-4" /> Открыт спор — решение за администрацией
              </p>
            </Card>
          </motion.div>
        )}

        {isCustomer && order.status === "awaiting_payment" && (
          <Card className="space-y-3 border-amber/25 p-4">
            <p className="text-sm text-amber">
              💳 Оплата подключается в спринте 3 (ЮKassa). Сейчас заказ виден только тебе.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(!editing)
                  setEditForm({
                    title: order.title,
                    description: order.description ?? "",
                    price: String(order.price_kop / 100),
                    deadline: new Date(order.deadline).toISOString().slice(0, 16),
                  })
                }}
              >
                {editing ? "Свернуть" : "Редактировать"}
              </Button>
              <Button variant="danger" size="sm" loading={action.isPending} onClick={() => action.mutate({ kind: "cancel" })}>
                Отменить заказ
              </Button>
            </div>
          </Card>
        )}

        <AnimatePresence>
          {editing && isCustomer && order.status === "awaiting_payment" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="space-y-3 p-4">
                <Field label="Название">
                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                </Field>
                <Field label="Детали">
                  <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Цена, ₽">
                    <Input inputMode="numeric" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value.replace(/\D/g, "") })} />
                  </Field>
                  <Field label="Дедлайн">
                    <Input type="datetime-local" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} />
                  </Field>
                </div>
                <SaveEdits order={order} form={editForm} onDone={() => setEditing(false)} />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {!isCustomer && !isExecutor && order.status === "paid" && (
          <Button
            size="lg"
            className="w-full"
            loading={action.isPending}
            onClick={() => {
              haptic("medium")
              action.mutate({ kind: "take" }, { onError: () => notify("error") })
            }}
          >
            <HandCoins className="size-5" /> Взять заказ · {rubFromKop(payout)} на руки
          </Button>
        )}

        {isExecutor && order.status === "in_work" && (
          <Card className="space-y-3 p-4">
            <p className="text-sm text-mist">Выполнил? Пришли результат — у заказчика будет 72 часа на проверку.</p>
            <Button
              size="lg"
              className="w-full"
              loading={deliver.isPending}
              onClick={() => deliver.mutate(undefined, { onError: () => notify("error") })}
            >
              <CheckCircle2 className="size-5" /> Сдать работу
            </Button>
          </Card>
        )}

        {isCustomer && order.status === "delivered" && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="success" size="lg" loading={action.isPending} onClick={onComplete}>
              Принять ✓
            </Button>
            <Button variant="danger" size="lg" onClick={() => setDisputeOpen(true)}>
              Спор
            </Button>
          </div>
        )}

        <AnimatePresence>
          {disputeOpen && isCustomer && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="space-y-3 p-4">
                <Textarea placeholder="Что не так с работой?" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={reason.trim().length < 5}
                  loading={dispute.isPending}
                  onClick={() =>
                    dispute.mutate(reason.trim(), { onSuccess: () => setDisputeOpen(false) })
                  }
                >
                  Открыть спор
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {order.files.length > 0 && (
          <Card className="divide-y divide-white/5 overflow-hidden">
            {order.files.map((f) => (
              <a
                key={f.id}
                href={fileUrl(f.s3_key)}
                download={f.file_name}
                className="flex items-center gap-3 p-4 hover:bg-white/5"
              >
                <FileText className={cn("size-5", f.kind === "result" ? "text-lime" : "text-violet")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.file_name}</span>
                  <span className="block text-xs text-mist">{f.kind === "task" ? "Задание" : "Результат"}</span>
                </span>
                <Download className="size-4 text-mist" />
              </a>
            ))}
          </Card>
        )}

        {(isCustomer || isExecutor) && <Chat orderId={order.id} />}

        {order.status === "completed" && (isCustomer || isExecutor) && !reviewed && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="space-y-3 p-4">
              <p className="text-sm font-semibold">Оцени {isCustomer ? "исполнителя" : "заказчика"}</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.8 }}
                    whileHover={{ scale: 1.15, rotate: n <= rating ? 12 : 0 }}
                    onClick={() => { setRating(n); haptic("light") }}
                  >
                    <Star className={cn("size-8", n <= rating ? "fill-amber text-amber" : "text-mist")} />
                  </motion.button>
                ))}
              </div>
              <Textarea
                placeholder="Комментарий (необязательно)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={rating === 0}
                loading={review.isPending}
                onClick={() =>
                  review.mutate(
                    { rating, comment: reviewComment.trim() || undefined },
                    { onSuccess: () => { setReviewed(true); notify("success") } }
                  )
                }
              >
                Отправить отзыв
              </Button>
            </Card>
          </motion.div>
        )}

        {me?.is_admin && (
          <Card className="p-4 text-xs text-mist">
            <ShieldCheck className="mr-1 inline size-4 text-cyan" />
            Арбитраж: чат и леджер сделки подключаются в спринте 3–4.
          </Card>
        )}

        {order.status === "cancelled" && (
          <Card className="p-4">
            <p className="flex items-center gap-2 text-sm text-mist">
              <Ban className="size-4" /> Заказ отменён
            </p>
          </Card>
        )}
      </div>

      <div className="pb-28" />
    </Page>
  )
}

function SaveEdits({
  order,
  form,
  onDone,
}: {
  order: { id: string }
  form: { title: string; description: string; price: string; deadline: string }
  onDone: () => void
}) {
  const invalidate = useInvalidate()
  const [saving, setSaving] = useState(false)

  return (
    <Button
      className="w-full"
      loading={saving}
      disabled={form.title.trim().length < 4 || !form.price}
      onClick={async () => {
        setSaving(true)
        try {
          await api.updateOrder(order.id, {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            price_rub: Number(form.price),
            deadline: new Date(form.deadline).toISOString(),
          })
          invalidate("order", "feed", "mine")
          onDone()
          notify("success")
        } catch {
          notify("error")
        } finally {
          setSaving(false)
        }
      }}
    >
      Сохранить изменения
    </Button>
  )
}
