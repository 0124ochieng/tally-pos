// Local-only crash/error logging — see electron/main.cjs's
// append-diagnostic-log handler for where this actually lands (a plain-text
// file outside the app's own database, same reasoning as dataLifecycle.ts's
// deletion log). No network call happens anywhere in this file: nothing
// leaves the machine unless the shop owner clicks "Export Diagnostics" in
// Settings and sends the file themselves.

import { downloadText } from './exportService'

// A pathological stack trace (e.g. infinite recursion) could otherwise blow
// up a single log entry disproportionately.
const MAX_STACK_CHARS = 4000

export async function logDiagnostic(message: string, stack?: string) {
  const trimmedStack = stack?.slice(0, MAX_STACK_CHARS)
  if (typeof window !== 'undefined' && window.electronAPI?.appendDiagnosticLog) {
    await window.electronAPI.appendDiagnosticLog(message, trimmedStack)
  } else {
    // Browser dev fallback — there's no local filesystem to write to.
    console.warn('[diagnostic-log]', message, trimmedStack)
  }
}

export interface ExportDiagnosticsResult {
  ok: boolean
  /** True when export succeeded but the log had nothing in it yet. */
  empty?: boolean
}

export async function exportDiagnostics(): Promise<ExportDiagnosticsResult> {
  if (typeof window === 'undefined' || !window.electronAPI?.readDiagnosticLog) {
    return { ok: false }
  }
  const content = await window.electronAPI.readDiagnosticLog()
  if (!content) return { ok: true, empty: true }
  downloadText(`diagnostics-${new Date().toISOString().slice(0, 10)}.txt`, content)
  return { ok: true }
}
