import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { FileText, Paperclip, SendHorizontal } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { api, fileUrl } from "../api/client"
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
  const [peerTyping, setPeerTyping] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const typingSentAt = useRef(0)
  const attachRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ws = new WebSocket(wsUrl(orderId))
    wsRef.current = ws
    ws.onopen = () => setWsOpen(true)
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ChatMessage & { type?: string; from?: string; name?: string }
        if (parsed.type === "typing") {
          if (parsed.from && parsed.name) {
            setPeerTyping(parsed.name.split(" ")[0])
            setTimeout(() => setPeerTyping(null), 2500)
          }
          return
        }
        const msg = parsed as ChatMessage
        if (!msg || msg.id === undefined) return
        setLive((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        setPeerTyping(null)
      } catch {}
    }
    ws.onclose = () => setWsOpen(false)
    return () => ws.close()
  }, [orderId])

  const sendTyping = () => {
    const now = Date.now()
    if (wsRef.current?.readyState === WebSocket.OPEN && now - typingSentAt.current > 1800) {
      typingSentAt.current = now
      wsRef.current.send(JSON.stringify({ type: "typing" }))
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [serverMessages?.length, live.length, peerTyping])

  const messages: ChatMessage[] = [...(serverMessages ?? []), ...live].filter(
    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
  )

  useEffect(() => {
    if (serverMessages && serverMessages.length >= 0) {
      api.chatMarkRead(orderId).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, serverMessages !== undefined])

  const onAttach = async (file: File | undefined) => {
    if (!file) return
    setAttaching(true)
    try {
      const res = await api.upload(file)
      await api.sendMessage(orderId, res.key)
      await qc.invalidateQueries({ queryKey: ["messages", orderId] })
    } catch {
    } finally {
      setAttaching(false)
    }
  }

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
        {peerTyping ? (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-[10px] text-cyan">
            печатает
            {[0, 1, 2].map((i) => (
              <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}>
                •
              </motion.span>
            ))}
          </motion.span>
        ) : (
          <span className={`size-1.5 rounded-full ${wsOpen ? "bg-lime" : "bg-amber"}`} />
        )}
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
                {m.sender_id === null ? (
                  <div className="mx-auto rounded-full bg-white/5 border border-white/10 px-3 py-1 text-center text-[11px] text-mist">
                    {m.body}
                  </div>
                ) : (
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
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.file_key && (
                    <a href={fileUrl(m.file_key)} download className="mt-1 flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1 text-xs underline">
                      <FileText className="size-3" /> Вложение
                    </a>
                  )}
                  <p className="mt-0.5 text-right text-[9px] opacity-60">
                    {dateTimeFull(m.created_at)}
                  </p>
                </div>
                )}
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
        <input ref={attachRef} type="file" className="hidden" onChange={(e) => onAttach(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => attachRef.current?.click()}
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 border border-white/10 text-mist hover:text-fog"
        >
          <Paperclip className={`size-4 ${attaching ? "animate-pulse text-violet" : ""}`} />
        </button>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            sendTyping()
          }}
          placeholder="Сообщение..."
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-mist/60 focus:border-violet/60"
        />
        <Button size="sm" type="submit" loading={send.isPending} disabled={!text.trim()} className="w-11 px-0">
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </div>
  )
}
