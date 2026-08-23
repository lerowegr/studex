type HapticStyle = "light" | "medium" | "heavy" | "soft" | "rigid"
type NotifyType = "error" | "success" | "warning"

interface TgWebApp {
  initData: string
  initDataUnsafe?: {
    user?: { id: number; first_name?: string; last_name?: string; username?: string }
  }
  ready: () => void
  expand: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void
    notificationOccurred: (type: NotifyType) => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

export const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined

export const isTelegram = Boolean(tg && tg.initData)

export function initTelegram() {
  tg?.ready()
  tg?.expand()
  tg?.setHeaderColor?.("#07090f")
  tg?.setBackgroundColor?.("#07090f")
}

export function rawInitData(): string {
  return tg?.initData ?? ""
}

export function devUserId(): number {
  const stored = Number(localStorage.getItem("studex_dev_uid"))
  return Number.isFinite(stored) && stored > 0 ? stored : 900001
}

export function tgFirstName(): string {
  return tg?.initDataUnsafe?.user?.first_name ?? ""
}

export function haptic(style: HapticStyle = "light") {
  try {
    tg?.HapticFeedback?.impactOccurred(style)
  } catch {}
}

export function notify(type: NotifyType) {
  try {
    tg?.HapticFeedback?.notificationOccurred(type)
  } catch {}
}
