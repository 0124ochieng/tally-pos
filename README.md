# Hymes Gadgets POS

A white-label point-of-sale desktop app for retail shops — sell, track inventory,
manage stock intake, run reports, and handle staff PINs and cash/M-Pesa drawers.
Built with Electron, React 19, Vite, Tailwind CSS v4, and Dexie (IndexedDB).

**Local-first by design:** all shop data (sales, inventory, staff, reports) lives
only on the till's own computer — there's no cloud dependency for day-to-day use.
Supabase is used only for one-time license activation. See
[`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) for how a build gets sold and set
up for a new business, and [`docs/EULA-template.md`](docs/EULA-template.md) for
the license agreement template.

## System requirements

- Windows 10 or later (64-bit). Electron's underlying Chromium engine no longer
  supports older versions of Windows.
- No internet connection needed for normal use — only the one-time activation
  step and (if configured) checking for app updates need it.

## Development

```bash
npm install
npm run dev            # Vite dev server (browser, for UI work)
npm run electron:dev   # Electron shell pointed at the dev server
```

Local dev skips license activation via `VITE_SKIP_ACTIVATION=true` in `.env`
(see `.env.example`) — never set that in a real customer build.

```bash
npm run build   # tsc + vite build
npm run lint    # oxlint
```

## Producing a customer installer

```bash
npm run electron:build
```

Runs a release-config sanity check, builds, obfuscates the app's own bundled
code, and packages a Windows NSIS installer into `release/`. See
[`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) for the full per-customer
workflow (restructuring `.env`, issuing a license key, and what to hand the
customer).

## Project layout

- `src/app/` — auth/session, license/activation gating, theming, top-level layout
- `src/features/` — one folder per screen (POS, inventory, stock intake,
  reports, expenses, drawer, staff, settings)
- `src/lib/` — the local database (Dexie), business logic, sync/backup
  infrastructure, and shared services
- `src/components/` — shared UI primitives and cross-cutting widgets (toasts,
  the onboarding tour, the update banner)
- `electron/` — the Electron main process and preload bridge
- `supabase/` — schema for the *optional* per-customer cloud-sync add-on
  (off by default — see `docs/DISTRIBUTION.md`)
- `vendor-supabase/` + `vendor-tools/` — the vendor's own license-activation
  service and key-generation script (not shipped to customers)
