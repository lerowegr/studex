import { animate } from "motion/react"
import { useEffect, useRef } from "react"

export function CountUp({
  to,
  decimals = 0,
  className,
}: {
  to: number
  decimals?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(0, to, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals)
      },
    })
    return () => controls.stop()
  }, [to, decimals])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}
