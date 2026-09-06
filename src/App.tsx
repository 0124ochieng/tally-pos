import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './app/AuthContext'
import { AppLayout } from './app/AppLayout'
import { Login } from './app/Login'
import { SellPage } from './features/pos/SellPage'
import { MySalesPage } from './features/pos/MySalesPage'
import { AllSalesPage } from './features/pos/AllSalesPage'
import { DrawerPage } from './features/drawer/DrawerPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { StockIntakePage } from './features/inventory/StockIntakePage'
import { HistoryPage } from './features/history/HistoryPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { DashboardPage } from './features/reports/DashboardPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { StaffPage } from './features/staff/StaffPage'
import { SettingsPage } from './features/staff/SettingsPage'

// NOTE: Dashboard/Reports were previously lazy-loaded (React.lazy) to keep
// recharts out of the main bundle for staff sessions. Reverted: dynamic
// import() of a code-split chunk doesn't reliably resolve under Electron's
// file:// protocol once packaged (confirmed live — admin's default landing
// page, /dashboard, crashed with "Failed to construct 'URL': Invalid URL"
// on every launch, while the identical dev-server/http:// build never
// reproduced it). Correctness beats the bundle-size win here — don't
// reintroduce lazy() for these without testing an actual packaged
// (file://) build, not just `npm run dev`.

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/sell" replace />
  return <>{children}</>
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'admin' ? '/dashboard' : '/sell'} replace />
}

function App() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/my-sales" element={<MySalesPage />} />
        <Route path="/sales" element={<RequireAdmin><AllSalesPage /></RequireAdmin>} />
        <Route path="/drawer" element={<DrawerPage />} />
        <Route path="/dashboard" element={<RequireAdmin><DashboardPage /></RequireAdmin>} />
        <Route path="/inventory" element={<RequireAdmin><InventoryPage /></RequireAdmin>} />
        <Route path="/stock-intake" element={<RequireAdmin><StockIntakePage /></RequireAdmin>} />
        <Route path="/expenses" element={<RequireAdmin><ExpensesPage /></RequireAdmin>} />
        <Route path="/history" element={<RequireAdmin><HistoryPage /></RequireAdmin>} />
        <Route path="/reports" element={<RequireAdmin><ReportsPage /></RequireAdmin>} />
        <Route path="/staff" element={<RequireAdmin><StaffPage /></RequireAdmin>} />
        <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
      </Route>
    </Routes>
  )
}

export default App
