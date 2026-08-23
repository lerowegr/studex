import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, type OrderCreateInput } from "./client"
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: api.me, retry: 1 })
}

export function useSubjects(course?: number) {
  return useQuery({
    queryKey: ["subjects", course ?? null],
    queryFn: () => api.subjects({ course }),
  })
}

export function useFeed(p: { subject_id?: number; category?: string }) {
  return useQuery({ queryKey: ["feed", p], queryFn: () => api.feed(p) })
}

export function useMyOrders(role: "customer" | "executor") {
  return useQuery({ queryKey: ["mine", role], queryFn: () => api.myOrders(role) })
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => api.order(id!),
    enabled: !!id,
  })
}

export function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
}

export function useUpdateMe() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: () => invalidate("me"),
  })
}

export function useApplyExecutor() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.applyExecutor,
    onSuccess: () => invalidate("me"),
  })
}

export function useCreateOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: OrderCreateInput) => api.createOrder(body),
    onSuccess: () => invalidate("feed", "mine"),
  })
}

export function useOrderAction(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (action: { kind: "take" | "complete" | "cancel"; payload?: string }) => {
      if (action.kind === "take") return api.take(id)
      if (action.kind === "complete") return api.complete(id)
      return api.cancel(id)
    },
    onSuccess: () => invalidate("order", "feed", "mine", "me"),
  })
}

export function useDeliver(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (resultFileKey?: string) => api.deliver(id, resultFileKey),
    onSuccess: () => invalidate("order", "feed", "mine"),
  })
}

export function useDispute(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (reason: string) => api.dispute(id, reason),
    onSuccess: () => invalidate("order"),
  })
}

export function useReview(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { rating: number; comment?: string }) => api.review(id, body),
    onSuccess: () => invalidate("order", "me"),
  })
}

export function useMessages(id: string) {
  return useQuery({
    queryKey: ["messages", id],
    queryFn: () => api.messages(id),
    enabled: !!id,
    refetchInterval: 4000,
  })
}

export function useSendMessage(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api.sendMessage(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", id] }),
  })
}

export function useQuiz(subjectId: number | null) {
  return useQuery({
    queryKey: ["quiz", subjectId],
    queryFn: () => api.quiz(subjectId!),
    enabled: subjectId !== null,
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    refetchInterval: 10_000,
  })
}

export function useReadAllNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.readAllNotifications,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })
}

export function useSubscriptions() {
  return useQuery({ queryKey: ["subscriptions"], queryFn: api.subscriptions })
}

export function useToggleSubscription(subjectId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (subscribe: boolean) =>
      subscribe ? api.subscribe(subjectId!) : api.unsubscribe(subjectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  })
}

export function useAdminStats() {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: api.adminStats })
}

export function useAdminDisputes() {
  return useQuery({ queryKey: ["admin", "disputes"], queryFn: api.adminDisputes })
}
