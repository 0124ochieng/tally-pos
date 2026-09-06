import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

interface ToastMessage {
  id: string
  text: string
  tone: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  show: (text: string, tone?: ToastMessage['tone']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneClasses: Record<ToastMessage['tone'], string> = {
  success: 'bg-neutral-900 text-gold-400 dark:bg-surface dark:border dark:border-gold-500/40',
  error: 'bg-coral-500 text-white',
  info: 'bg-neutral-900 text-cyan-300 dark:bg-surface dark:border dark:border-cyan-500/40',
}

const icons: Record<ToastMessage['tone'], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const show = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, text, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <div key={t.id} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${toneClasses[t.tone]}`}>
              <Icon size={16} />
              {t.text}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
