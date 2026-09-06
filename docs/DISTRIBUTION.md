# Distributing this POS to a new customer

This is the step-by-step for you (REACH Digital Experts), not for a customer.
It matches the "one computer at a time, restructured per business" workflow.

## One-time setup (do this once, ever)

1. **Generate your vendor signing keypair:**
   ```
   node vendor-tools/generate-vendor-keypair.mjs
   ```
   - Paste the printed **public key** into `src/lib/license.ts` as
     `EMBEDDED_PUBLIC_KEY_B64`. This ships inside every customer build.
   - Keep the printed **private key** somewhere safe — you'll set it as a
     secret on your vendor Supabase project below. Never commit it, never
     put it in a customer build.

2. **Create your vendor Supabase project** (separate from any customer's
   project — this one holds your license registry, not business data).
   - Run `vendor-supabase/schema.sql` in its SQL editor.
   - Deploy the activation function:
     ```
     supabase functions deploy activate-license --project-ref <vendor-project-ref> --workdir vendor-supabase
     supabase secrets set VENDOR_PRIVATE_KEY_JWK='<paste private key JWK>' --project-ref <vendor-project-ref>
     ```
     (`--workdir vendor-supabase` is required — the Supabase CLI always looks
     for `<workdir>/supabase/functions/<name>`, hence the nested
     `vendor-supabase/supabase/functions/activate-license/` path in this repo.)
   - Note the function's URL — you'll use it as `VITE_ACTIVATION_ENDPOINT`
     for every customer build.

## Per customer (repeat this for each new business)

This product is **local-first**: a customer's sales, inventory, and
everything else live only on their own till PC (in a local database), never
in the cloud. There is no per-customer Supabase project to create or pay
for — the only cloud project involved anywhere in this process is your own
vendor project from the one-time setup above, and it only ever sees a tiny
license-activation request, never any business data.

1. **Restructure the build for their business** — edit `.env`:
   ```
   VITE_BUSINESS_NAME=Their Business Name
   VITE_ACTIVATION_ENDPOINT=<your vendor activate-license function URL>
   ```
   Remove/leave unset: `VITE_SKIP_ACTIVATION`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (these are dev-only; a real customer build never
   needs them).
   Adjust anything else specific to them (seed categories in
   `src/data/seedProducts.ts` if you want a different starting catalogue —
   optional, since they can edit categories/products from Inventory anyway).

2. **Issue their license key:**
   ```
   VENDOR_SUPABASE_URL=<vendor project URL> \
   VENDOR_SUPABASE_SERVICE_KEY=<vendor project service-role key> \
     node vendor-tools/keygen.mjs \
       --business "Their Business Name" \
       --devices 2
   ```
   This prints a `REA-XXXXX-XXXXX-XXXXX` key — that's what you hand to the
   customer (write it on their invoice/agreement, don't just text it insecurely
   if you can avoid it).

3. **Build the installer:**
   ```
   npm run electron:build
   ```
   Produces a Windows installer under `release/`. This is the ONLY thing
   you hand the customer — never the source folder, never a `.env` file,
   never a Supabase service-role key.

4. **Install on their computer**, launch it, enter the license key on the
   Activation screen. That's the only step requiring internet — everything
   after works fully offline, forever, since there's no cloud data
   dependency in normal use.

5. **Have them sign a license agreement** — see `docs/EULA-template.md`
   (get it reviewed by a lawyer before real use).

### Keeping your vendor project awake

Supabase's free tier pauses a project after 7 days with no API activity. If
you go a week without a single new activation, the next one will fail until
you un-pause it from the Supabase dashboard (a few seconds, but avoid the
surprise). Set up a free weekly scheduled ping (e.g. a GitHub Actions cron
hitting your `activate-license` function's health, or Supabase's own
`pg_cron`) once you're relying on this for real sales — cheap insurance
against an activation failing on a client's install day.

### Cloud backup (not available yet)

`customer_supabase_url`/`customer_supabase_anon_key` on a `licenses` row,
and `keygen.mjs`'s `--customer-url`/`--customer-anon-key` flags, exist only
as infrastructure for a possible future cloud-backup add-on. Leave them
unset for every normal sale.

## If you need to move an install to a new computer

Their license key still works up to its device limit (default 2). If
they've hit the limit (e.g. replacing an old till), you can raise
`device_limit` for their row in the vendor `licenses` table, or issue a new
key.

## Notes

- `src/lib/license.ts`'s `EMBEDDED_PUBLIC_KEY_B64` placeholder MUST be
  replaced before any real customer build — until then, activation will
  always fail closed (safe, but not usable).
- Icon: `electron-builder.config.cjs` currently ships with electron-builder's
  default icon. Add a real `build/icon.ico` (256×256) and point `win.icon`
  at it before a real release.
- Code signing isn't configured — an unsigned installer will trigger a
  Windows SmartScreen warning. A code-signing certificate is a real
  (paid) step outside what can be automated here.
