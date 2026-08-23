import { motion } from "motion/react"
import { ClipboardList, Store, UserRound } from "lucide-react"
import { NavLink, Outlet, useLocation, Navigate } from "react-router-dom"

import { useMe } from "../api/hooks"
import { cn } from "../lib/utils"

const tabs = [
  { to: "/catalog", label: "Каталог", icon: Store },
  { to: "/my", label: "Заказы", icon: ClipboardList },
  { to: "/profile", label: "Профиль", icon: UserRound },
]

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
      <div className="glass mx-4 flex w-full max-w-sm items-center justify-around rounded-3xl p-1.5 shadow-2xl shadow-black/50">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="relative flex-1">
            {({ isActive }) => (
              <span
                className={cn(
                  "relative z-10 flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold transition-colors",
                  isActive ? "text-fog" : "text-mist hover:text-fog/80"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-2xl bg-white/10 border border-white/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="z-10 size-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="z-10">{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Layout() {
  const location = useLocation()
  const { data: me } = useMe()

  if (me && !me.full_name) return <Navigate to="/onboarding" replace />

  return (
    <div className="min-h-dvh">
      <Outlet />
      <TabBar />
      <motion.div
        key={`bg-${location.pathname}`}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
      />
    </div>
  )
}
