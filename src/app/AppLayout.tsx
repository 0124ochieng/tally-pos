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
import { TourGuide } from '../components/TourGuide'
import { UpdateBanner } from '../components/UpdateBanner'
import { SwitchToAdminModal } from './SwitchToAdminModal'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { getBusinessName } from '../lib/settings'
import { loadCart } from '../lib/cartPersistence'
import { useInactivityLogout } from './useInactivityLogout'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Grouped by what an owner is actually trying to do, not alphabetically —
// so the sidebar reads as "here's how the shop runs" instead of a flat
// list of nine equally-weighted links.
const adminNavGroups: NavGroup[] = [
  { label: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Sell',
    items: [
      { to: '/sell', label: 'Sell', icon: ShoppingCart },
      { to: '/sales', label: 'Sales', icon: Receipt },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory', label: 'Products', icon: Package },
      { to: '/stock-intake', label: 'Stock Intake', icon: PackagePlus },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/expenses', label: 'Expenses', icon: HandCoins },
      { to: '/history', label: 'History', icon: HistoryIcon },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/staff', label: 'Staff', icon: Users },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
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
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  useInactivityLogout()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const isAdmin = user.role === 'admin'
  const isSellPage = location.pathname === '/sell'
  const businessName = getBusinessName()

  function handleSignOutClick() {
    if (loadCart().length > 0) {
      setConfirmSignOut(true)
    } else {
      logout()
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-xl focus:bg-gold-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-neutral-900"
      >
        Skip to main content
      </a>
      <aside className="m-3 flex w-60 flex-col rounded-3xl bg-sidebar transition-colors">
        <div className="px-5 py-6">
          <p className="truncate text-base font-bold text-white">{businessName}</p>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto px-3">
          {isAdmin ? (
            adminNavGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-ink-muted">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      data-tour={`nav-${item.to.replace('/', '')}`}
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
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1">
              {staffNav.map((item) => (
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
            </div>
          )}
        </nav>
        <div className="px-5 py-5 text-xs text-sidebar-ink-muted">Built by REACH</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header aria-label="Account" className="flex items-center justify-between border-b border-border px-6 py-4">
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
              onClick={handleSignOutClick}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-coral-500 transition-colors hover:bg-coral-50 dark:hover:bg-coral-900/20"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className={`flex-1 px-6 pb-6 outline-none ${isSellPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Outlet />
        </main>
      </div>

      {switching && <SwitchToAdminModal onClose={() => setSwitching(false)} />}
      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out with items still in the cart?"
        message="There's a sale in progress that hasn't been paid for yet. Signing out will clear it — the next person to sign in will start with an empty cart. Sign out anyway, or go back and finish the sale?"
        confirmLabel="Sign out anyway"
        destructive
        onConfirm={() => {
          setConfirmSignOut(false)
          logout()
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
      <LiveClock />
      <UpdateBanner />
      <TourGuide />
    </div>
  )
}
