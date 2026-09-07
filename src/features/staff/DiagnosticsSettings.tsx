import { useState } from 'react'
import { FileWarning } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { exportDiagnostics } from '../../lib/diagnostics'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

/** Exports the local crash/error log written by electron/main.cjs's
 * append-diagnostic-log handler — see src/lib/diagnostics.ts. There's no
 * "status" to show here beyond the export itself: unlike PIN recovery,
 * there's nothing to configure ahead of time, just something to hand over
 * when asked. */
export function DiagnosticsSettings() {
  const { show } = useToast()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    const result = await exportDiagnostics()
    setExporting(false)
    if (!result.ok) {
      show("Diagnostics aren't available in this environment", 'error')
    } else if (result.empty) {
      show('No diagnostic entries recorded yet — nothing to export')
    } else {
      show('Diagnostics exported')
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Diagnostics</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-secondary">
          If something goes wrong — a crash, a confusing error, a blank screen — this exports a
          technical log of what happened, so support can look into the actual cause. It never
          includes sales, customer, or staff data — just error messages, a stack trace, and the app
          version.
        </p>
        <Button variant="secondary" onClick={handleExport} disabled={exporting}>
          <FileWarning size={14} /> Export Diagnostics
        </Button>
      </CardBody>
    </Card>
  )
}
