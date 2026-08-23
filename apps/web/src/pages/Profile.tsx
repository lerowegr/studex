import { motion } from "motion/react"
import { BriefcaseBusiness, Pencil, ShieldCheck, Star } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useMe } from "../api/hooks"
import { CountUp } from "../components/CountUp"
import { Button, Card, Page, Skeleton } from "../components/ui"
import { initials } from "../lib/format"

const EXECUTOR_LABELS: Record<string, { text: string; tone: string }> = {
  none: { text: "Не исполнитель", tone: "text-mist bg-white/5 border-white/15" },
  pending: { text: "На модерации", tone: "text-amber bg-amber/10 border-amber/30" },
  approved: { text: "Исполнитель ✓", tone: "text-lime bg-lime/10 border-lime/30" },
  rejected: { text: "Отклонён", tone: "text-rose bg-rose/10 border-rose/30" },
  blocked: { text: "Заблокирован", tone: "text-rose bg-rose/10 border-rose/30" },
}

export function Profile() {
  const { data: me, isLoading } = useMe()
  const navigate = useNavigate()

  if (isLoading || !me) {
    return (
      <Page>
        <Skeleton className="mx-auto mt-4 size-24 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-6 w-48" />
        <Skeleton className="mt-6 h-32" />
      </Page>
    )
  }

  const executorStatus: string = me.executor_status ?? "none"

  return (
    <Page>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Про<span className="text-gradient">филь</span>
        </h1>
        <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding?edit=1")}>
          <Pencil className="size-3.5" /> Изменить
        </Button>
      </header>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="mx-auto grid size-24 place-items-center rounded-full bg-gradient-to-br from-violet via-fuchsia-500 to-cyan font-display text-2xl font-bold text-white shadow-xl shadow-violet/40"
      >
        {initials(me.full_name)}
      </motion.div>

      <div className="mt-4 text-center">
        <h2 className="font-display text-lg font-bold">{me.full_name}</h2>
        <p className="mt-0.5 text-sm text-mist">
          {me.program} · {me.course} курс · {me.group_name}
        </p>
      </div>

      <Card className="mt-5 flex items-center justify-around p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold text-gradient">
            <Star className="size-5 fill-amber text-amber" />
            <CountUp to={me.rating_num} decimals={me.rating_num % 1 ? 2 : 0} />
          </div>
          <p className="mt-1 text-[11px] text-mist">{me.rating_count} отзывов</p>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div className="text-center">
          <div className="font-display text-2xl font-bold text-gradient">
            <CountUp to={me.completed_orders} />
          </div>
          <p className="mt-1 text-[11px] text-mist">выполнено</p>
        </div>
      </Card>

      <Card className="mt-3 space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <BriefcaseBusiness className="size-4 text-violet" />
            Статус исполнителя
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${EXECUTOR_LABELS[executorStatus].tone}`}
          >
            {EXECUTOR_LABELS[executorStatus].text}
          </span>
        </div>

        {executorStatus === "none" && (
          <>
            <p className="text-xs leading-relaxed text-mist">
              Пройди короткий тест по предмету и получи доступ к ленте заказов. Комиссия платформы —
              всего 10%, деньги держатся в эскроу до подтверждения.
            </p>
            <Button className="w-full" onClick={() => navigate("/executor")}>
              Стать исполнителем 🚀
            </Button>
          </>
        )}
        {(executorStatus === "pending" || executorStatus === "rejected") && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/executor")}>
            Пройти тест заново
          </Button>
        )}
      </Card>

      {me.is_admin && (
        <Button variant="outline" className="mt-3 w-full" onClick={() => navigate("/admin")}>
          <ShieldCheck className="size-4 text-cyan" /> Админ-панель
        </Button>
      )}

      <p className="pb-28 pt-4 text-center text-[11px] text-mist">
        TG ID: {me.telegram_id} · в системе с{" "}
        {new Date(me.created_at).toLocaleDateString("ru-RU")}
      </p>
    </Page>
  )
}
