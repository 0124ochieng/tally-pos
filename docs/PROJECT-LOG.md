# Tally POS — Project Log & Client Setup Guide

This file is two things in one: a record of what's been built and why (so a
future fix doesn't start from zero context), and the actual checklist you
run through every time you onboard a new customer. `docs/DISTRIBUTION.md`
covers the mechanical build/ship commands in more depth — this file is the
narrative and the day-to-day operational version of the same process.

Repo: **github.com/0124ochieng/tally-pos** (branch `master`)

---

## Client setup — step by step

This is what you actually do, start to finish, for one new customer.

### 1. Decide two things
- Their exact business name (shows on receipts, sidebar, the pre-activation
  screen).
- How many devices/computers their license should cover (`--devices`,
  usually 1 for a single till).

### 2. Save their build config
```
cp customers/TEMPLATE.env customers/<slug>.env
```
Fill in `VITE_BUSINESS_NAME` with their business name. Keep
`VITE_ACTIVATION_ENDPOINT` as-is — that's your vendor server, the same for
every customer, forever. This file is gitignored (business record, not
source code) — keep it, it's how you rebuild for this exact customer later
without relying on memory. See `customers/README.md`.

### 3. Generate their license key (run this yourself, never via AI)
```
VENDOR_SUPABASE_URL=<your vendor project URL> VENDOR_SUPABASE_SERVICE_KEY=<your vendor service-role key> node vendor-tools/keygen.mjs --business "Their Business Name" --devices 1
```
This needs your vendor Supabase **service-role key** — a secret that must
never be typed into an AI chat, a Slack message, or anywhere else it could
leak. It prints a `REA-XXXXX-XXXXX-XXXXX` key and writes a permanent row to
your vendor project's `licenses` table — that row is the actual source of
truth for this customer's license, independent of anything on your laptop.

### 4. Build the installer
```
cp customers/<slug>.env .env && npm run electron:build
```
Produces `release\Tally Setup 1.0.0.exe`. Tag the commit it came from:
```
git tag <slug>-$(date +%Y-%m-%d) && git push origin <slug>-$(date +%Y-%m-%d)
```

### 5. Deliver and install
- USB drive for an in-person handoff (the installer is ~128 MB, too big for
  most email).
- Run it on their PC. **Expect a Windows SmartScreen warning** — the
  installer isn't code-signed with a paid certificate yet. Click **More
  info → Run anyway**. Tell them this in advance so it doesn't look broken.
- NSIS installer lets them choose the install folder or accept the default.

### 6. First launch — activation
- App shows a short animated splash, then **"Set Up [Business Name] POS."**
- Type the license key from step 3. This is the *only* step that needs
  internet, ever — it calls your vendor server once, gets back a signed
  offline certificate, and works fully offline after that.
- Their business name is now also auto-filled from the license itself (see
  the "license-seeds-business-name" entry below), so this works correctly
  even off a generic build.

### 7. First-login checklist (don't skip this with a real customer)
- Log in with the seeded defaults: **Admin `0000`** / **Staff `1111`**.
- **Change both PINs immediately** — Staff page → Reset PIN on each.
- **Settings → Security**: set up a PIN recovery code for the admin
  account. Without this, a forgotten PIN with only one admin means a call
  to you or a DevTools rescue — the recovery code makes it self-service.
- **Clear the demo product catalog.** A fresh install auto-seeds sample
  products (for your own demo/marketing use) — a real customer doesn't want
  fake inventory mixed into their real one. Inventory page → remove each
  seeded product.
- **Settings → Shop Details**: confirm name/address look right.
- Add their real staff accounts (Staff page), remove/disable the demo ones.
- Add their real products through **Inventory → Stock Intake**, not
  directly in Inventory — that's what links stock, cost history, and the
  purchase expense together correctly.
- **Have them sign a license agreement** — `docs/EULA-template.md` (get it
  lawyer-reviewed before real use).

---

## Build & feature history

Chronological. Newest at the bottom = current state.

- **v1.0.0 baseline** — rebrand to "Tally" (product name, fixed forever via
  `appId`/`productName` in `electron-builder.config.cjs`), custom app icon
  applied everywhere, full security/code audit (clean).
- **PIN recovery** — an admin can set a self-service recovery code
  (Settings → Security). "Forgot PIN?" on the login screen redeems it and
  lets them set a new PIN, fully offline, no vendor call needed.
- **Diagnostics logging** — crashes/unhandled errors now persist to a
  local rolling log (`electron/main.cjs`, capped at 200 entries), exportable
  from Settings → Diagnostics as a `.txt` file to send you for support.
  Never contains business data — just error text, stack trace, app version.
- **Full pre-ship audit** — went through the entire codebase: Electron/IPC
  security, licensing (client + vendor edge function + keygen), data layer,
  every money-touching path, dependency vulnerabilities, dead code. Two
  real bugs found and fixed:
  - **M-Pesa reference codes were fabricated** — the app generated a random
    fake code instead of recording the real one from the confirmation SMS,
    so every M-Pesa receipt carried a reference matching nothing in the
    shop's actual statement. Fixed: cashier now types the real code before
    the sale completes (small checkout-flow change — worth knowing about).
  - **Product SKUs could silently collide** — the blank-SKU auto-generate
    fallback had no uniqueness check. Fixed: retries until it finds one
    that isn't taken.
- **Customer build records** — `customers/<slug>.env` per customer (see
  `customers/README.md`), so a rebuild months later doesn't rely on memory.
  `docs/DISTRIBUTION.md` updated to match.
- **License seeds the business name** — the activation certificate already
  carried the customer's business name (from the `licenses` table row
  `keygen.mjs` wrote); the app just never applied it. Now a successful
  activation fills the shop's display name from the license itself (only
  if nothing's been set yet), so one generic build can correctly serve any
  customer even without a per-customer rebuild — the rebuild step is now
  cosmetic polish (pre-activation screen text), not required.
- **Startup splash screen** — Tally icon + wordmark, staggered animated
  entrance, crossfades into whatever screen loads underneath (no blank
  flash either end). ~2.3s total, respects `prefers-reduced-motion`.
- **Hussein's Electronics — first real customer.** Business name set,
  1-device license generation command handed off, installer built and
  tagged (`hussein-2026-09-07`).

---

## Known open items (deliberately not done yet)

- **Cloud-delete gap**: wiping local data doesn't enqueue matching deletes
  to the sync outbox, so a cloud-sync-enabled customer's local "delete
  everything" would leave orphaned rows in their Supabase project. Low
  urgency — cloud sync is opt-in and no real customer has it on yet — but
  cheap to fix before it becomes a real feature anyone's using. Design
  already discussed: fix now while adoption is near zero.
- **Dev Control app**: an admin panel (your own login, separate from
  clients) to manage customers/licenses via buttons instead of CLI —
  add customer, generate key, set device limit, toggle a future cloud
  add-on. Scoping deferred. Key constraint already established: the vendor
  service-role key can never reach a browser — it needs its own
  Edge-Function-mediated backend (same shape as `activate-license`), not a
  client-side app with the key baked in.
- **Demo-product seeding on real customer installs**: every fresh install
  auto-seeds a sample product catalog (meant for your own demo/testing
  use). Currently handled by manually clearing it during first-login setup
  (see checklist above). A "skip seeding for a real customer build" toggle
  would remove that manual step — not built, only flagged, since it wasn't
  requested.

---

## Quick reference

| What | Where |
|---|---|
| Per-customer build config | `customers/<slug>.env` (gitignored) |
| Build/ship mechanics (deeper detail) | `docs/DISTRIBUTION.md` |
| License key generation | `vendor-tools/keygen.mjs` (needs vendor service-role key — run locally, never paste that key anywhere else) |
| Vendor signing keypair | `vendor-tools/generate-vendor-keypair.mjs` (one-time, already done) |
| License agreement template | `docs/EULA-template.md` |
| Repo | github.com/0124ochieng/tally-pos |
