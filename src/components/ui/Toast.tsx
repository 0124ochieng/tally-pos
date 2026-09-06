import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { playSound } from '../../lib/soundService'

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

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, text, tone }])
    playSound(tone)
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-24 right-4 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <div key={t.id} className={`elevation-2 flex items-center gap-2 rounded-xl py-2.5 pl-4 pr-2 text-sm font-medium ${toneClasses[t.tone]}`}>
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{t.text}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-lg p-1 opacity-70 hover:opacity-100"
              >
                <X size={14} />
              </button>
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
