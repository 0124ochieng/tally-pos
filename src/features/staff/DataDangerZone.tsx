import { useState } from 'react'
import { AlertOctagon, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DangerWizard } from '../../components/ui/DangerWizard'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { resetSalesAndActivityData, deleteAllInventory } from '../../lib/dataLifecycle'

/** Two separate, deliberately-hard-to-reach delete actions. Kept apart on
 * purpose: resetting sales history is something an owner might do once a
 * year (new financial period); wiping the whole product catalogue is
 * something that should almost never happen, since rebuilding it from
 * nothing costs real hours — so it gets its own button and its own,
 * equally strict confirmation, never bundled into the other. */
export function DataDangerZone() {
  const { user } = useAuth()
  const { show } = useToast()
  const [openReset, setOpenReset] = useState(false)
  const [openInventory, setOpenInventory] = useState(false)

  return (
    <Card className="border-coral-200 dark:border-coral-900/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-coral-600 dark:text-coral-400">
          <AlertOctagon size={16} /> Danger Zone
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-ink-muted">
          These actions can't be undone. Only use them if you're sure — and always save a backup first
          (each button walks you through that).
        </p>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Start a fresh sales period</p>
            <p className="text-xs text-ink-muted">
              Clears sales, cash/M-Pesa history, expenses, and stock-intake history. Your product list,
              categories, and current stock counts are kept exactly as they are.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setOpenReset(true)}>
            <Trash2 size={14} /> Reset
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Delete the entire product list</p>
            <p className="text-xs text-ink-muted">
              Removes every product and category for good. This is almost never what you want — rebuilding
              a product list takes real time.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setOpenInventory(true)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </CardBody>

      <DangerWizard
        open={openReset}
        onClose={() => setOpenReset(false)}
        title="Start a fresh sales period"
        confirmButtonLabel="Delete this data"
        deletes={[
          'Every sale on record',
          'Cash-drawer and M-Pesa till history',
          'Expenses and expense categories you added (built-in ones stay)',
          'Stock-intake history (when stock was received)',
          'The activity/history log',
        ]}
        keeps={['Every product', 'Every category', 'Current stock counts', 'Staff accounts', 'Shop settings']}
        onExecute={async () => {
          const s = await resetSalesAndActivityData(user!.name)
          show('Sales and activity data cleared', 'success')
          return [
            `${s.sales} sale(s) deleted`,
            `${s.cashDrawerEntries + s.mpesaTillEntries} cash/M-Pesa record(s) deleted`,
            `${s.expenses} expense(s) deleted`,
            `${s.stockIntakes} stock-intake record(s) deleted`,
            'Your product list and stock counts were not touched.',
          ]
        }}
      />

      <DangerWizard
        open={openInventory}
        onClose={() => setOpenInventory(false)}
        title="Delete the entire product list"
        confirmButtonLabel="Delete everything"
        extraWarning={
          <p className="rounded-xl bg-coral-100 px-3 py-2 text-sm font-medium text-coral-700 dark:bg-coral-900/30 dark:text-coral-300">
            This is different from a normal reset — it deletes your products and categories too, not just
            sales history. Most shops never need this button.
          </p>
        }
        deletes={['Every product', 'Every category', 'Every tracked serial number/IMEI']}
        keeps={['Sales history', 'Staff accounts', 'Shop settings']}
        onExecute={async () => {
          const s = await deleteAllInventory(user!.name)
          show('Product list deleted', 'success')
          return [`${s.products} product(s) deleted`, `${s.categories} categorie(s) deleted`]
        }}
      />
    </Card>
  )
}
