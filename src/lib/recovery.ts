import { db, type User } from './db'
import { hashPin, generateSalt } from './pin'
import { enqueueSync } from './sync/outbox'

export function hasRecoveryCode(user: User | null | undefined): boolean {
  return !!user?.recoveryCodeHash
}

/** Hashes and saves a recovery code against one user's account — always an
 * admin in practice, since the only entry point (Settings → Security) is
 * admin-gated. Overwrites any existing code, which is the intended way to
 * invalidate an old one. */
export async function setRecoveryCode(userId: string, code: string) {
  const recoveryCodeSalt = generateSalt()
  const recoveryCodeHash = await hashPin(code, recoveryCodeSalt)
  await db.users.update(userId, { recoveryCodeHash, recoveryCodeSalt })
  const updated = await db.users.get(userId)
  if (updated) await enqueueSync('users', 'upsert', updated)
}

/** Finds the active user a recovery code belongs to, by checking it against
 * every account that has one set. There's no "which account?" prompt on the
 * login screen (it never asks for a name, only a PIN) — this mirrors that
 * same all-active-users check that AuthContext.login already does. */
export async function findUserByRecoveryCode(code: string): Promise<User | null> {
  const candidates = (await db.users.toArray()).filter(
    (u) => u.active && u.recoveryCodeHash && u.recoveryCodeSalt,
  )
  for (const u of candidates) {
    const hash = await hashPin(code, u.recoveryCodeSalt!)
    if (hash === u.recoveryCodeHash) return u
  }
  return null
}

/** Sets a brand-new PIN for a user identified via a validated recovery
 * code. Same duplicate-PIN guard as the Staff-page reset flow, so recovery
 * can't leave two accounts sharing a PIN. */
export async function resetPinWithRecovery(userId: string, newPin: string): Promise<{ ok: boolean; error?: string }> {
  const users = await db.users.toArray()
  const target = users.find((u) => u.id === userId)
  if (!target) return { ok: false, error: 'Account not found' }

  const others = users.filter((u) => u.id !== userId)
  const matches = await Promise.all(others.map((u) => hashPin(newPin, u.pinSalt).then((h) => h === u.pinHash)))
  if (matches.some(Boolean)) return { ok: false, error: 'That PIN is already in use — pick a different one' }

  const pinSalt = generateSalt()
  const pinHash = await hashPin(newPin, pinSalt)
  await db.users.update(userId, { pinHash, pinSalt })
  const updated = await db.users.get(userId)
  if (updated) await enqueueSync('users', 'upsert', updated)
  return { ok: true }
}
