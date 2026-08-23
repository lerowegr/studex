import { motion, type HTMLMotionProps } from "motion/react"
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "../lib/utils"

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn("mx-auto w-full max-w-md px-4 pt-5", className)}
    >
      {children}
    </motion.main>
  )
}

type ButtonVariant = "primary" | "ghost" | "outline" | "danger" | "success"
type ButtonSize = "sm" | "md" | "lg"

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "text-white shadow-lg shadow-violet/25 bg-gradient-to-r from-violet to-cyan bg-[length:150%_100%] bg-left hover:bg-right transition-[background-position] duration-500",
  ghost: "bg-white/5 text-fog hover:bg-white/10 border border-white/10",
  outline: "border border-white/15 text-fog hover:bg-white/5",
  danger: "bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20",
  success: "bg-lime/10 text-lime border border-lime/30 hover:bg-lime/20",
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm rounded-xl",
  md: "h-11 px-5 text-sm rounded-2xl",
  lg: "h-13 px-6 text-base rounded-2xl",
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  onClick,
  ...rest
}: Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:pointer-events-none",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      onClick={(e) => {
        if (!loading) onClick?.(e)
      }}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </motion.button>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass rounded-3xl", className)}>{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-mist">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mist">{hint}</span>}
    </label>
  )
}

const inputBase =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-fog placeholder:text-mist/60 outline-none focus:border-violet/60 focus:bg-white/[0.07] transition-colors"

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-24 resize-none", className)} {...rest} />
}

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputBase, "appearance-none pr-8", className)} {...rest} />
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-gradient-to-r from-violet to-cyan text-white shadow-md shadow-violet/30"
          : "bg-white/5 text-mist border border-white/10 hover:text-fog",
        className
      )}
    >
      {children}
    </motion.button>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/5", className)} />
}

export function EmptyState({
  emoji = "🗂",
  title,
  subtitle,
  action,
}: {
  emoji?: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-2 py-16 text-center"
    >
      <div className="text-5xl" style={{ animation: "floaty 3s ease-in-out infinite" }}>
        {emoji}
      </div>
      <p className="font-semibold">{title}</p>
      {subtitle && <p className="max-w-56 text-sm text-mist">{subtitle}</p>}
      {action}
    </motion.div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="pt-2 text-lg font-bold font-display tracking-tight">{children}</h2>
  )
}
