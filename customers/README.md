# Per-customer build records

One `.env` file per customer, named `<slug>.env` (e.g. `hussein.env`). These
are gitignored — they're business records (who has what), not source code —
but keep them somewhere durable (this folder is fine; back the whole repo
up, or keep a copy elsewhere too).

## Why this exists

The build only varies per customer in one cosmetic way: `VITE_BUSINESS_NAME`,
the starting shop name shown before anyone's touched Settings. Everything
that actually matters — the license key, the device limit, whether it's
still valid — lives permanently in the vendor Supabase `licenses` table,
completely independent of any file on this computer.

Without a saved copy of what each customer's `.env` looked like, a rebuild
six months from now (a bugfix, a feature they asked for) relies on memory.
With it, it's one command.

## Adding a new customer

1. `cp customers/TEMPLATE.env customers/<slug>.env` and fill in their
   business name.
2. Issue their license key separately — see `docs/DISTRIBUTION.md`. The key
   is never stored in this folder.
3. Build: `cp customers/<slug>.env .env && npm run electron:build`
4. Tag the commit you built from, so you have an exact record of what they
   received: `git tag <slug>-$(date +%Y-%m-%d)`

## Rebuilding for an existing customer (e.g. a bugfix)

Same as step 3 above — you almost always want the *current* source (with
the fix applied), not whatever commit their original build came from. The
git tag from their first build is there if you ever need to compare, not to
rebuild from.
