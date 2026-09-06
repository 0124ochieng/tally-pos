import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { db, type User } from '../lib/db'
import { hashPin } from '../lib/pin'
import { clearCart } from '../lib/cartPersistence'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (pin: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  switchUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = 'hymes-pos-user-id'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function restore() {
      const savedId = sessionStorage.getItem(SESSION_KEY)
      if (savedId) {
        const savedUser = await db.users.get(savedId)
        if (savedUser && savedUser.active) setUser(savedUser)
      }
      setLoading(false)
    }
    restore()
  }, [])

  async function login(pin: string) {
    const activeUsers = (await db.users.toArray()).filter((u) => u.active)
    for (const candidate of activeUsers) {
      const hash = await hashPin(pin, candidate.pinSalt)
      if (hash === candidate.pinHash) {
        setUser(candidate)
        sessionStorage.setItem(SESSION_KEY, candidate.id)
        return { ok: true }
      }
    }
    return { ok: false, error: 'Incorrect PIN' }
  }

  function logout() {
    setUser(null)
    sessionStorage.removeItem(SESSION_KEY)
    // A sale that never got paid for shouldn't reappear for whoever logs
    // in next — clear it here so every logout path (sign-out, idle
    // timeout) behaves the same way.
    clearCart()
  }

  function switchUser(nextUser: User) {
    setUser(nextUser)
    sessionStorage.setItem(SESSION_KEY, nextUser.id)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
