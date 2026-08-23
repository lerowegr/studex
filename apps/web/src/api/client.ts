import { devUserId, isTelegram, rawInitData } from "../lib/telegram"
import type {
  ChatMessage,
  NotificationItem,
  OrderCard,
  OrderDetail,
  QuizQuestion,
  Subject,
  UploadOut,
  User,
} from "./types"

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`
const FILES_ORIGIN = import.meta.env.VITE_API_URL ?? ""

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json")
  if (isTelegram) headers.set("Authorization", `tma ${rawInitData()}`)
  else headers.set("Authorization", `dev ${devUserId()}`)

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail =
        typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail) ?? detail
    } catch {}
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as T
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export function fileUrl(key: string): string {
  return `${FILES_ORIGIN}/files/${key}`
}

export interface OrderCreateInput {
  subject_id: number
  category: string
  title: string
  description?: string | null
  price_rub: number
  deadline: string
  task_file_key?: string | null
}

export const api = {
  me: () => request<User>("/me"),
  updateMe: (body: Partial<User>) =>
    request<User>("/me", { method: "PATCH", body: JSON.stringify(body) }),
  applyExecutor: () => request<{ status: string }>("/me/executor-apply", { method: "POST" }),

  subjects: (p: { course?: number; program?: string; q?: string }) =>
    request<Subject[]>(`/subjects${qs(p)}`),

  feed: (p: { subject_id?: number; category?: string }) =>
    request<OrderCard[]>(`/orders/feed${qs(p)}`),
  myOrders: (role: "customer" | "executor") =>
    request<OrderCard[]>(`/orders/mine${qs({ role })}`),
  order: (id: string) => request<OrderDetail>(`/orders/${id}`),
  createOrder: (body: OrderCreateInput) =>
    request<OrderDetail>("/orders", { method: "POST", body: JSON.stringify(body) }),
  take: (id: string) => request<OrderDetail>(`/orders/${id}/take`, { method: "POST" }),
  deliver: (id: string, result_file_key?: string) =>
    request<OrderDetail>(`/orders/${id}/deliver${qs({ result_file_key })}`, { method: "POST" }),
  complete: (id: string) => request<OrderDetail>(`/orders/${id}/complete`, { method: "POST" }),
  dispute: (id: string, reason: string) =>
    request<OrderDetail>(`/orders/${id}/dispute${qs({ reason })}`, { method: "POST" }),
  cancel: (id: string) => request<OrderDetail>(`/orders/${id}/cancel`, { method: "POST" }),
  review: (id: string, body: { rating: number; comment?: string }) =>
    request<unknown>(`/orders/${id}/review`, { method: "POST", body: JSON.stringify(body) }),

  messages: (id: string) => request<ChatMessage[]>(`/orders/${id}/messages`),
  sendMessage: (id: string, body: string) =>
    request<ChatMessage>(`/orders/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  subscribe: (subjectId: number) =>
    request<{ ok: boolean }>(`/subscriptions/${subjectId}`, { method: "POST" }),
  unsubscribe: (subjectId: number) =>
    request<{ ok: boolean }>(`/subscriptions/${subjectId}`, { method: "DELETE" }),

  quiz: (subjectId: number) =>
    request<{ questions: QuizQuestion[] }>(`/quiz/${subjectId}`),
  submitQuiz: (subjectId: number, body: { answers: number[]; questions: QuizQuestion[] }) =>
    request<{ score: number; total: number; passed: boolean }>(`/quiz/${subjectId}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  notifications: () =>
    request<{ unread: number; items: NotificationItem[] }>("/me/notifications"),
  readAllNotifications: () =>
    request<{ ok: boolean }>("/me/notifications/read-all", { method: "POST" }),

  subscriptions: () => request<Subject[]>("/subscriptions"),

  updateOrder: (id: string, body: Partial<OrderCreateInput>) =>
    request<OrderDetail>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  addOrderFile: (id: string, key: string) =>
    request<{ id: string; file_name: string }>(`/orders/${id}/files`, {
      method: "POST",
      body: JSON.stringify({ key }),
    }),
  removeOrderFile: (id: string, fileId: string) =>
    request<{ ok: boolean }>(`/orders/${id}/files/${fileId}`, { method: "DELETE" }),

  chatState: (id: string) => request<{ unread: number }>(`/orders/${id}/chat/state`),
  chatMarkRead: (id: string) =>
    request<{ ok: boolean }>(`/orders/${id}/chat/read`, { method: "POST" }),

  adminStats: () => request<Record<string, number>>("/admin/stats"),
  adminDisputes: () =>
    request<
      Array<{
        id: string
        order_id: string
        opened_by: string
        reason: string
        status: string
        resolution_note: string | null
      }>
    >("/admin/disputes"),
  adminResolve: (id: string, outcome: string, note?: string) =>
    request<{ ok: boolean; status: string }>(`/admin/disputes/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcome, note }),
    }),
  adminBan: (userId: string, reason: string) =>
    request<{ ok: boolean }>(`/admin/users/${userId}/ban${qs({ reason })}`, {
      method: "POST",
    }),

  adminCreateSubject: (body: { name: string; course: number; program: string; emoji?: string }) =>
    request<{ id: number }>("/admin/subjects", { method: "POST", body: JSON.stringify(body) }),
  adminUpdateSubject: (id: number, body: { name: string; course: number; program: string; emoji?: string }) =>
    request<{ ok: boolean }>(`/admin/subjects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminDeleteSubject: (id: number) =>
    request<{ ok: boolean }>(`/admin/subjects/${id}`, { method: "DELETE" }),

  upload: async (file: File): Promise<UploadOut> => {
    const fd = new FormData()
    fd.append("file", file)
    return request<UploadOut>("/uploads", { method: "POST", body: fd })
  },
}
