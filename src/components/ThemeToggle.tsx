import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../app/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="relative flex h-9 w-16 items-center rounded-full border border-border bg-surface-alt px-1 transition-colors"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-sm transition-transform duration-300 ease-out ${
          isDark ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon size={14} className="text-cyan-400" /> : <Sun size={14} className="text-gold-500" />}
      </span>
    </button>
  )
}
