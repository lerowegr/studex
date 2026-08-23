import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, CheckCircle2, ShieldCheck, XCircle } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { api } from "../api/client"
import type { QuizQuestion } from "../api/types"
import { useSubjects } from "../api/hooks"
import { Confetti } from "../components/Confetti"
import { Button, Card, Chip, EmptyState, Page, Skeleton } from "../components/ui"
import { haptic, notify } from "../lib/telegram"
import { cn } from "../lib/utils"

type Result = { score: number; total: number; passed: boolean } | null

export function Executor() {
  const navigate = useNavigate()
  const { data: subjects } = useSubjects()
  const [course, setCourse] = useState(1)
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [phase, setPhase] = useState<"pick" | "test">("pick")
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result>(null)

  const startTest = async (id: number) => {
    setSubjectId(id)
    setLoading(true)
    try {
      const res = await api.quiz(id)
      setQuestions(res.questions)
      setAnswers({})
      setResult(null)
      setPhase("test")
      haptic("medium")
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (subjectId === null) return
    setSubmitting(true)
    try {
      const res = await api.submitQuiz(subjectId, {
        answers: questions.map((q) => answers[q.id] ?? -1),
        questions,
      })
      setResult(res)
      notify(res.passed ? "success" : "warning")
    } finally {
      setSubmitting(false)
    }
  }

  const courseSubjects = subjects?.filter((s) => s.course === course) ?? []
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined)

  return (
    <Page>
      <Confetti fire={result?.passed ?? false} />

      <header className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="font-display text-xl font-bold">Допуск исполнителя</h1>
      </header>

      <AnimatePresence mode="wait">
        {phase === "pick" && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <Card className="mb-4 p-4">
              <p className="flex items-start gap-2 text-sm text-mist">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan" />
                Выбери предмет и пройди короткий тест (8 вопросов). Порог — 7 правильных.
                После допуска откроется лента заказов по этому предмету.
              </p>
            </Card>

            <div className="mb-3 flex gap-2">
              {[1, 2, 3, 4].map((c) => (
                <Chip key={c} active={course === c} onClick={() => setCourse(c)} className="flex-1 py-2 text-sm">
                  {c} курс
                </Chip>
              ))}
            </div>

            <div className="space-y-2 pb-28">
              {courseSubjects.map((s, i) => (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startTest(s.id)}
                  className="glass flex w-full items-center gap-3 rounded-2xl p-3.5 text-left"
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                  <span className="text-xs font-semibold text-violet">тест →</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "test" && (
          <motion.div
            key="test"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="space-y-3 pb-28"
          >
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            ) : result ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <Card className={`space-y-3 p-6 text-center ${result.passed ? "border-lime/30" : "border-rose/30"}`}>
                  {result.passed ? (
                    <CheckCircle2 className="mx-auto size-14 text-lime" />
                  ) : (
                    <XCircle className="mx-auto size-14 text-rose" />
                  )}
                  <h2 className="font-display text-xl font-bold">
                    {result.score} / {result.total}
                  </h2>
                  <p className="text-sm text-mist">
                    {result.passed
                      ? "Допуск получен! Лента заказов открыта 🎉"
                      : "Не хватило до порога. Можно перепройти тест."}
                  </p>
                  <div className="flex gap-2 pt-2">
                    {!result.passed && (
                      <Button variant="outline" className="flex-1" onClick={() => subjectId !== null && startTest(subjectId)}>
                        Ещё раз
                      </Button>
                    )}
                    <Button
                      className="flex-1"
                      onClick={() => navigate(result.passed ? "/feed" : "/profile")}
                    >
                      {result.passed ? "К заказам" : "В профиль"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <>
                {questions.map((q, qi) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: qi * 0.05 }}
                  >
                    <Card className="space-y-2.5 p-4">
                      <p className="text-sm font-semibold leading-snug">
                        {qi + 1}. {q.q}
                      </p>
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => {
                          const active = answers[q.id] === oi
                          return (
                            <button
                              key={oi}
                              onClick={() => {
                                setAnswers((a) => ({ ...a, [q.id]: oi }))
                                haptic("light")
                              }}
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                                active
                                  ? "border-violet bg-violet/15 font-semibold"
                                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                              )}
                            >
                              <span
                                className={cn(
                                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                                  active ? "border-violet bg-violet text-white" : "border-white/20 text-mist"
                                )}
                              >
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </Card>
                  </motion.div>
                ))}
                <Button size="lg" className="w-full" disabled={!allAnswered} loading={submitting} onClick={submit}>
                  Завершить тест
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {subjects?.length === 0 && <EmptyState emoji="📚" title="Нет предметов" />}
    </Page>
  )
}
