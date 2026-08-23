import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AnimatePresence } from "motion/react"
import { useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"

import { Layout } from "./components/Layout"
import { Admin } from "./pages/Admin"
import { Catalog } from "./pages/Catalog"
import { CreateOrder } from "./pages/CreateOrder"
import { Executor } from "./pages/Executor"
import { Feed } from "./pages/Feed"
import { MyOrders } from "./pages/MyOrders"
import { Notifications } from "./pages/Notifications"
import { Onboarding } from "./pages/Onboarding"
import { OrderDetail } from "./pages/OrderDetail"
import { Profile } from "./pages/Profile"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route element={<Layout />}>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/orders/new" element={<CreateOrder />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/my" element={<MyOrders />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/executor" element={<Executor />} />
        <Route element={<Layout />}>
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <AnimatedRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
