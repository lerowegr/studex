import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"

const COLORS = ["#7C5CFF", "#22D3EE", "#34D399", "#FBBF24", "#FB7185"]

export function Confetti({ fire }: { fire: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 320,
        y: -(80 + Math.random() * 220),
        rotate: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        delay: Math.random() * 0.15,
        round: Math.random() > 0.5,
      })),
    []
  )

  return (
    <AnimatePresence>
      {fire && (
        <div className="pointer-events-none fixed inset-x-0 top-1/2 z-50 flex justify-center">
          <div className="relative">
            {pieces.map((p) => (
              <motion.span
                key={p.id}
                initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                animate={{
                  opacity: [1, 1, 0],
                  x: p.x,
                  y: [0, p.y, p.y + 160],
                  rotate: p.rotate,
                }}
                transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
                className="absolute block"
                style={{
                  width: p.size,
                  height: p.round ? p.size : p.size * 0.45,
                  background: p.color,
                  borderRadius: p.round ? "9999px" : "2px",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
