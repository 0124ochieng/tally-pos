import { forwardRef, type FocusEvent, type InputHTMLAttributes, type SelectHTMLAttributes, type LabelHTMLAttributes } from 'react'

export const Label = ({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={`mb-1 block text-sm font-medium text-ink-secondary ${className}`} {...props} />
)

/** Shown right under a field when it fails validation — paired with the
 * `invalid` prop on Input/Select so the red border and the message that
 * explains it always travel together. */
export const FieldError = ({ children }: { children?: string }) => {
  if (!children) return null
  return <p className="mt-1 text-xs text-coral-500">{children}</p>
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Swaps the border to coral — pair with <FieldError> below the field. */
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type, onFocus, invalid, ...props }, ref) => {
    // A number field that defaults to 0 and just appends new digits after
    // it (typing "500" into a "0" field gives you "0500") reads as
    // "broken" to anyone who doesn't think to select-all first. Selecting
    // the current value on focus means the very next keystroke always
    // replaces it, for every number field in the app, without every call
    // site needing to remember to wire this up itself.
    function handleFocus(e: FocusEvent<HTMLInputElement>) {
      if (type === 'number') e.currentTarget.select()
      onFocus?.(e)
    }
    const borderClass = invalid ? 'border-coral-400 focus:border-coral-500 focus:ring-coral-400/30' : 'border-border-strong focus:border-gold-500 focus:ring-gold-400/30'
    return (
      <input
        ref={ref}
        type={type}
        onFocus={handleFocus}
        aria-invalid={invalid || undefined}
        className={`h-10 w-full rounded-xl border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 ${borderClass} ${className}`}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', invalid, ...props }, ref) => {
    const borderClass = invalid ? 'border-coral-400 focus:border-coral-500 focus:ring-coral-400/30' : 'border-border-strong focus:border-gold-500 focus:ring-gold-400/30'
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`h-10 w-full rounded-xl border bg-surface px-3 text-sm text-ink transition-colors focus:outline-none focus:ring-2 ${borderClass} ${className}`}
        {...props}
      />
    )
  },
)
Select.displayName = 'Select'
