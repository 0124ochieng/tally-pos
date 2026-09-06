import { db, newId, type Expense, type PaidVia, type ExpenseSource } from './db'
import { enqueueSync } from './sync/outbox'

interface RecordExpenseInput {
  categoryId: string
  amount: number
  description: string
  paidVia: PaidVia
  source: ExpenseSource
  relatedStockIntakeId: string | null
  recordedBy: string
}

/** Records an expense and, if paid immediately, reflects it in the cash
 * drawer or M-Pesa till balance. "Credit" expenses don't touch either —
 * they're money owed, not money that has left the till yet. */
export async function recordExpense(input: RecordExpenseInput): Promise<Expense> {
  const now = Date.now()
  const expense: Expense = { id: newId(), ...input, createdAt: now }
  await db.expenses.add(expense)
  await enqueueSync('expenses', 'upsert', expense)

  if (input.paidVia === 'cash') {
    const entry = { id: newId(), type: 'cash_out' as const, amount: input.amount, recordedBy: input.recordedBy, note: input.description, createdAt: now }
    await db.cashDrawerEntries.add(entry)
    await enqueueSync('cashDrawerEntries', 'upsert', entry)
  } else if (input.paidVia === 'mpesa') {
    const entry = { id: newId(), type: 'expense' as const, amount: input.amount, ref: input.description, createdAt: now }
    await db.mpesaTillEntries.add(entry)
    await enqueueSync('mpesaTillEntries', 'upsert', entry)
  }

  return expense
}
