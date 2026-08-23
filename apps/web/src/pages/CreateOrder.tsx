import { motion } from "motion/react"
import { ArrowLeft, CheckCircle2, UploadCloud } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { api } from "../api/client"
import { useCreateOrder, useSubjects } from "../api/hooks"
import { Button, Card, Chip, Field, Input, Page, Textarea } from "../components/ui"
import { categoryLabels } from "../lib/format"
import { haptic, notify } from "../lib/telegram"

const CATEGORIES = Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>

function defaultDeadline(): string {
  const d = new Date(Date.now() + 3 * 24 * 3_600_000)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function CreateOrder() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const createOrder = useCreateOrder()

  const [course, setCourse] = useState<number>(1)
  const [subjectId, setSubjectId] = useState<number | null>(
    params.get("subject") ? Number(params.get("subject")) : null
  )
  const [category, setCategory] = useState<string>("lab")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [uploads, setUploads] = useState<Array<{ key: string; name: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: subjects } = useSubjects()
  const courseSubjects = useMemo(
    () => subjects?.filter((s) => s.course === course) ?? [],
    [subjects, course]
  )

  const valid =
    subjectId !== null && title.trim().length >= 4 && Number(price) > 0 && deadline

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const res = await api.upload(file)
      setUploads((prev) => [...prev, { key: res.key, name: res.file_name }])
      notify("success")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setUploading(false)
    }
  }

  const submit = () => {
    if (!valid || subjectId === null) return
    setError(null)
    createOrder.mutate(
      {
        subject_id: subjectId,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        price_rub: Number(price),
        deadline: new Date(deadline).toISOString(),
      },
      {
        onSuccess: async (order) => {
          for (const f of uploads) {
            try {
              await api.addOrderFile(order.id, f.key)
            } catch {}
          }
          notify("success")
          navigate(`/orders/${order.id}`, { replace: true })
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Ошибка"),
      }
    )
  }

  return (
    <Page>
      <header className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="font-display text-xl font-bold">Новый заказ</h1>
      </header>

      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((c) => (
              <Chip key={c} active={course === c} onClick={() => { setCourse(c); setSubjectId(null) }} className="flex-1 py-2 text-sm">
                {c} курс
              </Chip>
            ))}
          </div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {courseSubjects.map((s) => (
              <Chip key={s.id} active={subjectId === s.id} onClick={() => { setSubjectId(s.id); haptic("light") }}>
                {s.emoji} {s.name}
              </Chip>
            ))}
          </div>
        </Card>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {categoryLabels[c]}
            </Chip>
          ))}
        </div>

        <Field label="Что нужно сделать">
          <Input placeholder="Лабораторная №3: SQL-запросы" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field label="Детали" hint="Формат, методичка, требования преподавателя">
          <Textarea placeholder="5 запросов + отчёт по шаблону..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Цена, ₽">
            <Input inputMode="numeric" placeholder="1500" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Дедлайн">
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.zip,.rar,.7z"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {uploads.map((f, i) => (
          <motion.div key={f.key} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
            <CheckCircle2 className="size-3.5 shrink-0 text-lime" />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <button onClick={() => setUploads((u) => u.filter((_, j) => j !== i))} className="text-mist hover:text-rose">✕</button>
          </motion.div>
        ))}
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => fileRef.current?.click()}
          className="glass flex w-full items-center gap-3 rounded-2xl p-3.5 text-left"
        >
          <UploadCloud className={`size-5 ${uploading ? "animate-pulse text-violet" : "text-mist"}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{uploading ? "Загружаю..." : "Прикрепить файлы задания"}</span>
            <span className="block text-xs text-mist">Можно несколько · PDF, DOCX, ZIP — до 20 МБ</span>
          </span>
        </motion.button>

        {error && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-rose">
            {error}
          </motion.p>
        )}

        <Button size="lg" className="w-full" disabled={!valid} loading={createOrder.isPending || uploading} onClick={submit}>
          Разместить заказ · {price ? `${Number(price).toLocaleString("ru-RU")} ₽` : "—"}
        </Button>
        <p className="pb-6 text-center text-xs text-mist">
          Деньги спишутся после оплаты. Исполнитель получит их только когда ты подтвердишь работу
        </p>
      </div>
    </Page>
  )
}
