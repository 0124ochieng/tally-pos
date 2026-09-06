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

1. **Create a Supabase project for that customer** (their own data lives
   here, isolated from every other customer). Run `supabase/schema.sql` in
   it. Copy its project URL and anon key.

2. **Restructure the build for their business** — edit `.env`:
   ```
   VITE_BUSINESS_NAME=Their Business Name
   VITE_ACTIVATION_ENDPOINT=<your vendor activate-license function URL>
   ```
   Remove/leave unset: `VITE_SKIP_ACTIVATION`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (a real activated install gets its Supabase
   credentials from the license, not from `.env`).
   Adjust anything else specific to them (seed categories in
   `src/data/seedProducts.ts` if you want a different starting catalogue —
   optional, since they can edit categories/products from Inventory anyway).

3. **Issue their license key:**
   ```
   VENDOR_SUPABASE_URL=<vendor project URL> \
   VENDOR_SUPABASE_SERVICE_KEY=<vendor project service-role key> \
     node vendor-tools/keygen.mjs \
       --business "Their Business Name" \
       --customer-url "<their Supabase project URL>" \
       --customer-anon-key "<their Supabase anon key>" \
       --devices 2
   ```
   This prints a `REA-XXXXX-XXXXX-XXXXX` key — that's what you hand to the
   customer (write it on their invoice/agreement, don't just text it insecurely
   if you can avoid it).

4. **Build the installer:**
   ```
   npm run electron:build
   ```
   Produces a Windows installer under `release/`. This is the ONLY thing
   you hand the customer — never the source folder, never a `.env` file,
   never a Supabase service-role key.

5. **Install on their computer**, launch it, enter the license key on the
   Activation screen. That's the only step requiring internet — everything
   after works fully offline.

6. **Have them sign a license agreement** — see `docs/EULA-template.md`
   (get it reviewed by a lawyer before real use).

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
