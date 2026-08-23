import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useMe, useUpdateMe } from "../api/hooks"
import { tgFirstName } from "../lib/telegram"
import { Button, Card, Chip, Field, Input, Page, Select } from "../components/ui"

const COURSES = [1, 2, 3, 4]
const PROGRAMS = ["БИ", "ИТиАБД", "ПИ", "МО"]
const STEPS = ["Знакомство", "Учёба", "Направление"]

export function Onboarding() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isEdit = params.get("edit") === "1"
  const { data: me } = useMe()
  const updateMe = useUpdateMe()

  const [step, setStep] = useState(0)
  const [fullName, setFullName] = useState(
    me?.full_name ?? (tgFirstName() ? `${tgFirstName()}` : "")
  )
  const [course, setCourse] = useState<number | null>(me?.course ?? null)
  const [group, setGroup] = useState(me?.group_name ?? "")
  const [program, setProgram] = useState(me?.program ?? "БИ")

  useEffect(() => {
    if (isEdit && me) {
      setFullName((v) => v || me.full_name || "")
      setCourse((c) => c ?? me.course ?? null)
      setGroup((g) => g || me.group_name || "")
      setProgram(me.program ?? "БИ")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, me])

  const canNext =
    (step === 0 && fullName.trim().length >= 2) ||
    (step === 1 && course !== null) ||
    step === 2

  const submit = () => {
    updateMe.mutate(
      { full_name: fullName.trim(), course: course ?? undefined, group_name: group || undefined, program },
      {
        onSuccess: () => {
          navigate(isEdit ? "/profile" : "/catalog", { replace: true })
        },
      }
    )
  }

  return (
    <Page className="flex min-h-dvh flex-col">
      <div className="mb-8 flex items-center gap-3 pt-6">
        <GraduationCap className="size-7 text-violet" />
        <span className="font-display text-xl font-bold text-gradient">StudEx</span>
      </div>

      <div className="mb-8 flex gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet to-cyan"
              initial={false}
              animate={{ width: i <= step ? "100%" : "0%" }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 space-y-5"
        >
          {step === 0 && (
            <>
              <h1 className="font-display text-2xl font-bold leading-tight">
                Привет! 👋<br />Как тебя зовут?
              </h1>
              <Field label="ФИО" hint="Нужно для сделок и рейтинга">
                <Input
                  autoFocus
                  placeholder="Иванов Иван"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-display text-2xl font-bold leading-tight">
                На каком ты курсе?
              </h1>
              <div className="flex gap-2">
                {COURSES.map((c) => (
                  <Chip key={c} active={course === c} onClick={() => setCourse(c)} className="flex-1 py-2.5 text-sm">
                    {c}
                  </Chip>
                ))}
              </div>
              <Field label="Группа">
                <Input
                  placeholder="БИ23-5"
                  value={group}
                  onChange={(e) => setGroup(e.target.value.toUpperCase())}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-2xl font-bold leading-tight">
                Твоё направление
              </h1>
              <Card className="divide-y divide-white/5 overflow-hidden">
                {PROGRAMS.map((p) => (
                  <motion.button
                    key={p}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setProgram(p)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <span className="text-sm font-semibold">{p}</span>
                    <motion.span
                      animate={{ scale: program === p ? 1 : 0, opacity: program === p ? 1 : 0 }}
                      className="grid size-5 place-items-center rounded-full bg-gradient-to-r from-violet to-cyan text-[11px] font-bold text-white"
                    >
                      ✓
                    </motion.span>
                  </motion.button>
                ))}
              </Card>
              <Field label="Группа" hint="Можно указать ещё раз, если пропустил">
                <Select value="" disabled>
                  <option value="">—</option>
                </Select>
              </Field>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-auto flex gap-2 pb-10 pt-6">
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        {step < 2 ? (
          <Button size="lg" className="flex-1" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Далее <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" loading={updateMe.isPending} onClick={submit}>
            {isEdit ? "Сохранить" : "Начать"} 🚀
          </Button>
        )}
      </div>
    </Page>
  )
}
