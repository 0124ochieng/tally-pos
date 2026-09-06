import { useEffect, useRef, useState } from 'react'
import { Delete, Grid3x3 } from 'lucide-react'

interface PinEntryProps {
  value: string
  onChange: (next: string) => void
  onComplete: (pin: string) => void
  disabled?: boolean
  length?: number
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

/** PIN entry built keyboard-first: a real, focusable input sits behind the
 * dot indicators so typing digits on a keyboard always works — that's the
 * fast, accessible path. An on-screen keypad is available too, off by
 * default, toggled by a small button so it doesn't take up space for
 * anyone who's typing. Used by both the sign-in screen and "Switch to
 * Admin" so PIN entry behaves the same way everywhere in the app. */
export function PinEntry({ value, onChange, onComplete, disabled, length = 4 }: PinEntryProps) {
  const [showKeypad, setShowKeypad] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  function applyDigit(next: string) {
    onChange(next)
    if (next.length === length) onComplete(next)
  }

  function handleKeypadPress(key: string) {
    if (disabled) return
    if (key === 'back') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '' || value.length >= length) return
    applyDigit(value + key)
  }

  return (
    <div>
      <div className="relative mx-auto flex w-fit justify-center gap-3 py-1">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={length}
          value={value}
          disabled={disabled}
          onChange={(e) => applyDigit(e.target.value.replace(/\D/g, '').slice(0, length))}
          aria-label="PIN"
          className="absolute inset-0 h-full w-full cursor-default opacity-0"
        />
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border transition-colors ${i < value.length ? 'border-gold-400 bg-gold-400' : 'border-border'}`}
          />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowKeypad((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink-secondary"
        >
          <Grid3x3 size={13} /> {showKeypad ? 'Hide keypad' : 'Use the mouse instead'}
        </button>
      </div>

      {showKeypad && (
        <div className="mt-2 grid grid-cols-3 gap-3">
          {KEYS.map((key, i) =>
            key === '' ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => handleKeypadPress(key)}
                aria-label={key === 'back' ? 'Delete last digit' : `Digit ${key}`}
                className="flex h-14 items-center justify-center rounded-2xl bg-surface-alt text-lg font-semibold text-ink transition-colors hover:bg-gold-100 active:bg-gold-200 disabled:opacity-50"
              >
                {key === 'back' ? <Delete size={20} /> : key}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
