import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './app/AuthContext'
import { AppLayout } from './app/AppLayout'
import { Login } from './app/Login'
import { SellPage } from './features/pos/SellPage'
import { MySalesPage } from './features/pos/MySalesPage'
import { DrawerPage } from './features/drawer/DrawerPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { StockIntakePage } from './features/inventory/StockIntakePage'
import { HistoryPage } from './features/history/HistoryPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { StaffPage } from './features/staff/StaffPage'
import { SettingsPage } from './features/staff/SettingsPage'

// Split out of the main bundle: these two pull in the charting library
// (recharts, a genuinely large dependency), and staff/cashier accounts —
// the majority of day-to-day sessions on a shared till — never route to
// either one at all (they're admin-only). No reason to make every launch
// parse that code just because an owner might check Reports later.
const DashboardPage = lazy(() => import('./features/reports/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))

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
        <Route path="/drawer" element={<DrawerPage />} />
        <Route path="/dashboard" element={<RequireAdmin><Suspense fallback={null}><DashboardPage /></Suspense></RequireAdmin>} />
        <Route path="/inventory" element={<RequireAdmin><InventoryPage /></RequireAdmin>} />
        <Route path="/stock-intake" element={<RequireAdmin><StockIntakePage /></RequireAdmin>} />
        <Route path="/expenses" element={<RequireAdmin><ExpensesPage /></RequireAdmin>} />
        <Route path="/history" element={<RequireAdmin><HistoryPage /></RequireAdmin>} />
        <Route path="/reports" element={<RequireAdmin><Suspense fallback={null}><ReportsPage /></Suspense></RequireAdmin>} />
        <Route path="/staff" element={<RequireAdmin><StaffPage /></RequireAdmin>} />
        <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
      </Route>
    </Routes>
  )
}

export default App
