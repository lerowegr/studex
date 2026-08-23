import { AnimatePresence, motion } from "motion/react"
import { SendHorizontal } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useMessages, useSendMessage } from "../api/hooks"
import type { ChatMessage } from "../api/types"
import { Button } from "./ui"
import { dateTimeFull } from "../lib/format"
import { devUserId, isTelegram, rawInitData } from "../lib/telegram"

function wsUrl(orderId: string): string {
  const proto = location.protocol === "https:" ? "wss" : "ws"
  const token = isTelegram ? `tma ${rawInitData()}` : `dev ${devUserId()}`
  return `${proto}://${location.host}/api/ws/orders/${orderId}?token=${encodeURIComponent(token)}`
}

export function Chat({ orderId }: { orderId: string }) {
  const { data: serverMessages, isLoading } = useMessages(orderId)
  const send = useSendMessage(orderId)
  const [live, setLive] = useState<ChatMessage[]>([])
  const [wsOpen, setWsOpen] = useState(false)
  const [text, setText] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ws = new WebSocket(wsUrl(orderId))
    ws.onopen = () => setWsOpen(true)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ChatMessage
        if (!msg || msg.id === undefined) return
        setLive((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      } catch {}
    }
    ws.onclose = () => setWsOpen(false)
    return () => ws.close()
  }, [orderId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [serverMessages?.length, live.length])

  const messages: ChatMessage[] = [...(serverMessages ?? []), ...live].filter(
    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
  )

  const submit = () => {
    const body = text.trim()
    if (!body) return
    setText("")
    send.mutate(body)
  }

  return (
    <div className="glass flex flex-col rounded-3xl p-3">
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-mist">
          Чат сделки · анонимно
        </p>
        <span className={`size-1.5 rounded-full ${wsOpen ? "bg-lime" : "bg-amber"}`} />
      </div>

      <div className="max-h-72 min-h-24 space-y-2 overflow-y-auto px-1">
        {isLoading ? (
          <p className="py-6 text-center text-xs text-mist">Загрузка...</p>
        ) : messages && messages.length > 0 ? (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.mine
                      ? "bg-gradient-to-br from-violet to-cyan text-white"
                      : "bg-white/8 border border-white/10"
                  }`}
                >
                  {!m.mine && (
                    <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                      {m.sender_name}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-0.5 text-right text-[9px] opacity-60">
                    {dateTimeFull(m.created_at)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <p className="py-6 text-center text-xs text-mist">
            Сообщений нет — напиши первым 👋
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение..."
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-mist/60 focus:border-violet/60"
        />
        <Button size="sm" type="submit" loading={send.isPending} disabled={!text.trim()} className="w-11 px-0">
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </div>
  )
}
