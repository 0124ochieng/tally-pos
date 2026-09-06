import { useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, PackagePlus, History as HistoryIcon,
  BarChart3, Users, Settings as SettingsIcon, Receipt, Wallet, ShieldCheck,
  LogOut, UserCog, HandCoins,
} from 'lucide-react'
import { useAuth } from './AuthContext'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { ThemeToggle } from '../components/ThemeToggle'
import { LiveClock } from '../components/LiveClock'
import { SwitchToAdminModal } from './SwitchToAdminModal'
import { Badge } from '../components/ui/Badge'
import { getBusinessName } from '../lib/settings'
import { useInactivityLogout } from './useInactivityLogout'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

const adminNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sell', label: 'Sell', icon: ShoppingCart },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/stock-intake', label: 'Stock Intake', icon: PackagePlus },
  { to: '/expenses', label: 'Expenses', icon: HandCoins },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const staffNav: NavItem[] = [
  { to: '/sell', label: 'Sell', icon: ShoppingCart },
  { to: '/my-sales', label: 'My Sales', icon: Receipt },
  { to: '/drawer', label: 'Drawer', icon: Wallet },
]

export function AppLayout() {
  const { user, logout, loading } = useAuth()
  const location = useLocation()
  const [switching, setSwitching] = useState(false)
  useInactivityLogout()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const nav = user.role === 'admin' ? adminNav : staffNav
  const isSellPage = location.pathname === '/sell'
  const businessName = getBusinessName()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page">
      <aside className="m-3 flex w-60 flex-col rounded-3xl bg-sidebar transition-colors">
        <div className="px-5 py-6">
          <p className="truncate text-base font-bold text-white">{businessName}</p>
          <p className="text-xs text-sidebar-ink-muted">Point of Sale</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-sidebar-active text-sidebar-active-ink' : 'text-sidebar-ink hover:bg-white/5'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-5 text-xs text-sidebar-ink-muted">POS by REACH Digital Experts</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-ink">{user.name}</p>
            {user.role === 'admin' ? (
              <Badge tone="gold" className="gap-1"><ShieldCheck size={12} /> Admin</Badge>
            ) : (
              <Badge tone="cyan" className="gap-1"><UserCog size={12} /> Staff</Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <SyncStatusBadge />
            <ThemeToggle />
            {user.role === 'staff' && (
              <button
                onClick={() => setSwitching(true)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-alt"
              >
                <ShieldCheck size={14} /> Switch to Admin
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-coral-500 transition-colors hover:bg-coral-50 dark:hover:bg-coral-900/20"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </header>

        <main className={`flex-1 px-6 pb-6 ${isSellPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Outlet />
        </main>
      </div>

      {switching && <SwitchToAdminModal onClose={() => setSwitching(false)} />}
      <LiveClock />
    </div>
  )
}
