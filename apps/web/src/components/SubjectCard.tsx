import { motion } from "motion/react"
import { useNavigate } from "react-router-dom"

import type { Subject } from "../api/types"

export function SubjectCard({ subject, index = 0 }: { subject: Subject; index?: number }) {
  const navigate = useNavigate()
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        delay: Math.min(index * 0.03, 0.4),
        type: "spring",
        stiffness: 300,
        damping: 24,
      }}
      whileTap={{ scale: 0.94 }}
      onClick={() => navigate(`/feed?subject=${subject.id}`)}
      className="glass group flex aspect-[5/4] flex-col items-start justify-between rounded-3xl p-3.5 text-left"
    >
      <span className="text-3xl transition-transform duration-300 group-hover:scale-110">
        {subject.emoji ?? "📘"}
      </span>
      <span>
        <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
          {subject.name}
        </span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-mist">
          {subject.course} курс
        </span>
      </span>
    </motion.button>
  )
}
