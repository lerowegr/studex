export interface User {
  id: string
  telegram_id: number
  username: string | null
  full_name: string | null
  course: number | null
  group_name: string | null
  program: string | null
  rating_num: number
  rating_count: number
  completed_orders: number
  is_admin: boolean
  executor_status: string
  created_at: string
}

export interface Subject {
  id: number
  name: string
  course: number
  program: string
  emoji: string | null
}

export type OrderCategory =
  | "lab"
  | "coursework"
  | "test_prep"
  | "presentation"
  | "online_consult"
  | "urgent"

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "in_work"
  | "delivered"
  | "completed"
  | "disputed"
  | "refunded"
  | "cancelled"

export interface OrderFile {
  id: string
  kind: "task" | "result"
  s3_key: string
  file_name: string
  size_bytes: number
}

export interface OrderCard {
  id: string
  title: string
  category: OrderCategory
  price_kop: number
  deadline: string
  status: OrderStatus
  created_at: string
  subject: Subject
}

export interface OrderDetail extends OrderCard {
  customer_is_me: boolean
  executor_is_me: boolean
  executor_id: string | null
  description: string | null
  commission_rate: number
  auto_confirm_at: string | null
  taken_at: string | null
  delivered_at: string | null
  completed_at: string | null
  files: OrderFile[]
}

export interface UploadOut {
  key: string
  url: string
  file_name: string
  size_bytes: number
}

export interface ChatMessage {
  id: number | string
  sender_id: string | null
  sender_name: string | null
  body: string | null
  created_at: string
  mine: boolean
}

export interface QuizQuestion {
  id: number
  q: string
  options: string[]
}

export interface NotificationItem {
  id: number
  type: string
  text: string | null
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}
