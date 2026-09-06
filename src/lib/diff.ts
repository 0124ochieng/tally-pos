import type { FieldChange } from './db'

export interface FieldDef<T> {
  key: keyof T
  label: string
  format?: (value: T[keyof T]) => string
}

/** Compares two objects on a fixed set of fields and returns only what changed. */
export function diffFields<T extends object>(before: T, after: T, fields: FieldDef<T>[]): FieldChange[] {
  const changes: FieldChange[] = []
  for (const f of fields) {
    const b = before[f.key]
    const a = after[f.key]
    if (b !== a) {
      changes.push({
        field: String(f.key),
        label: f.label,
        before: f.format ? f.format(b as T[keyof T]) : String(b),
        after: f.format ? f.format(a as T[keyof T]) : String(a),
      })
    }
  }
  return changes
}

export const money = (v: unknown) => `KES ${Number(v ?? 0).toLocaleString()}`
export const yesNo = (v: unknown) => (v ? 'Yes' : 'No')
