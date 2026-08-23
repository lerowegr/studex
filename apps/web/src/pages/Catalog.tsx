import { AnimatePresence, motion } from "motion/react"
import { Bell } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import { useMe, useNotifications, useSubjects } from "../api/hooks"
import { SubjectCard } from "../components/SubjectCard"
import { Chip, Page, Skeleton } from "../components/ui"
import { initials } from "../lib/format"

const COURSE_TABS = [null, 1, 2, 3, 4] as const

export function Catalog() {
  const { data: me } = useMe()
  const { data: notif } = useNotifications()
  const [course, setCourse] = useState<number | null>(null)
  const { data: subjects, isLoading } = useSubjects(course ?? undefined)

  return (
    <Page>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Ка<span className="text-gradient">талог</span>
          </h1>
          <p className="mt-0.5 text-xs text-mist">
            Привет, {me?.full_name?.split(" ")[0] ?? "студент"}! Выбери предмет
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="relative grid size-11 place-items-center rounded-2xl glass">
            <Bell className="size-5 text-fog" />
            {!!notif && notif.unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-gradient-to-r from-violet to-cyan px-1 text-[10px] font-bold text-white"
              >
                {notif.unread > 9 ? "9+" : notif.unread}
              </motion.span>
            )}
          </Link>
          <Link to="/profile" className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet to-cyan font-display text-sm font-bold text-white shadow-lg shadow-violet/30">
            {initials(me?.full_name)}
          </Link>
        </div>
      </header>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {COURSE_TABS.map((c) => (
          <Chip key={String(c)} active={course === c} onClick={() => setCourse(c)}>
            {c === null ? "Все" : `${c} курс`}
          </Chip>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[5/4]" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div layout className="grid grid-cols-2 gap-3">
            {subjects?.map((s, i) => (
              <SubjectCard key={s.id} subject={s} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </Page>
  )
}
