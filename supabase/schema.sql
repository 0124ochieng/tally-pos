-- POS Supabase schema (single-shop, dynamic categories, expense tracking,
-- and change-history support) — built by REACH Digital Experts.
-- Run once per customer's own Supabase project (see vendor-tools/keygen.mjs).
--
-- Run this in the Supabase SQL editor once you've created a project. Column
-- names are quoted camelCase to match the JS objects the app's sync outbox
-- upserts directly (src/lib/sync/syncService.ts) — no field-name mapping layer.
--
-- After running this, copy your project URL + anon key into .env (see
-- .env.example) and the app will start syncing automatically.
--
-- This project is now optional infrastructure, not the default: the app
-- is local-first (see docs/DISTRIBUTION.md) and most installs never have
-- a cloud project configured at all. Only relevant if a business
-- separately opts into a future cloud-sync/backup add-on.
--
-- Note on access control: this phase uses local PIN login on each device
-- (works offline, appropriate for a shared shop terminal) rather than
-- per-user Supabase Auth, so RLS below is permissive for the anon key and
-- access control (admin vs staff, cost price visibility) is enforced in
-- the app UI. Tighten this once Supabase Auth is wired up for the phone app.
--
-- Known accepted trade-off: `users.pinHash`/`pinSalt` MUST be readable via
-- the anon key so a replacement/new device can pull them down and log in
-- offline afterwards (see hydrateFromCloudIfAvailable() in
-- src/lib/sync/syncService.ts) — there's no per-user Supabase Auth to
-- authenticate that read instead. Whoever holds this project's anon key
-- (extracted from one specific customer's installed app, e.g. via
-- DevTools with REACH_POS_DEBUG=1) could pull every PIN hash and offline-
-- brute-force it — a 4-digit PIN's keyspace is only 10,000 guesses, so no
-- realistic hashing cost protects it once the hash is exfiltrated. This
-- is exactly why cloud sync now defaults to off for every install: keep
-- it that way unless a business has a real need for multi-device sync,
-- and treat that business's anon key as sensitive if it's ever enabled.

create table if not exists users (
  id text primary key,
  name text not null,
  "pinHash" text not null,
  "pinSalt" text not null,
  role text not null check (role in ('admin', 'staff')),
  active boolean not null default true,
  -- Optional self-service PIN-recovery code, set by an admin in
  -- Settings → Security. Same accepted trade-off as pinHash/pinSalt above
  -- (readable via anon key, offline-bruteforceable if exfiltrated) — a
  -- 6-digit code is still a strict improvement over the 4-digit PIN it
  -- protects, and this table already carries that risk today.
  "recoveryCodeHash" text,
  "recoveryCodeSalt" text
);

create table if not exists categories (
  id text primary key,
  name text not null,
  icon text not null,
  "createdAt" bigint not null,
  "updatedAt" bigint not null
);

create table if not exists products (
  id text primary key,
  name text not null,
  brand text not null,
  description text not null,
  "categoryId" text not null references categories(id),
  sku text not null,
  "sellingPrice" numeric not null,
  "costPrice" numeric not null,
  unit text not null,
  "isSerialized" boolean not null default false,
  "lowStockThreshold" integer not null default 5,
  stock integer not null default 0,
  active boolean not null default true,
  "createdAt" bigint not null,
  "updatedAt" bigint not null
);

create table if not exists serials (
  id text primary key,
  "productId" text not null references products(id),
  imei text not null,
  status text not null check (status in ('in_stock', 'sold')),
  "soldInSaleId" text,
  "createdAt" bigint not null
);

create table if not exists "stockIntakes" (
  id text primary key,
  "productId" text not null references products(id),
  quantity integer not null,
  "costPrice" numeric not null,
  "paidVia" text not null check ("paidVia" in ('cash', 'mpesa', 'credit')),
  "receivedAt" bigint not null,
  "receivedBy" text not null,
  note text
);

create table if not exists sales (
  id text primary key,
  "cashierId" text not null references users(id),
  items jsonb not null,
  subtotal numeric not null,
  discount numeric not null default 0,
  total numeric not null,
  "paymentMethod" text not null check ("paymentMethod" in ('cash', 'mpesa')),
  "mpesaRef" text,
  "amountTendered" numeric,
  "changeGiven" numeric,
  status text not null check (status in ('completed', 'voided')),
  "voidedAt" bigint,
  "voidedBy" text,
  "voidReason" text,
  "createdAt" bigint not null
);

create table if not exists "cashDrawerEntries" (
  id text primary key,
  type text not null check (type in ('opening_float', 'cash_sale', 'cash_in', 'cash_out', 'closing_count')),
  amount numeric not null,
  "recordedBy" text not null,
  note text,
  "createdAt" bigint not null
);

create table if not exists "mpesaTillEntries" (
  id text primary key,
  type text not null check (type in ('sale', 'expense', 'reconciliation_adjustment')),
  amount numeric not null,
  ref text,
  "createdAt" bigint not null
);

create table if not exists "expenseCategories" (
  id text primary key,
  name text not null,
  icon text not null,
  protected boolean not null default false,
  "createdAt" bigint not null,
  "updatedAt" bigint not null
);

create table if not exists expenses (
  id text primary key,
  "categoryId" text not null references "expenseCategories"(id),
  amount numeric not null,
  description text not null,
  "paidVia" text not null check ("paidVia" in ('cash', 'mpesa', 'credit')),
  source text not null check (source in ('manual', 'stock_intake')),
  "relatedStockIntakeId" text,
  "recordedBy" text not null,
  "createdAt" bigint not null
);

create table if not exists "auditLog" (
  id text primary key,
  "actorId" text not null,
  "actorName" text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  "entityType" text not null check ("entityType" in ('category', 'product', 'expenseCategory')),
  "entityId" text not null,
  "entityName" text not null,
  summary text not null,
  changes jsonb,
  "snapshotBefore" jsonb,
  "snapshotAfter" jsonb,
  restored boolean not null default false,
  "createdAt" bigint not null
);

alter table users enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table serials enable row level security;
alter table "stockIntakes" enable row level security;
alter table sales enable row level security;
alter table "cashDrawerEntries" enable row level security;
alter table "mpesaTillEntries" enable row level security;
alter table "expenseCategories" enable row level security;
alter table expenses enable row level security;
alter table "auditLog" enable row level security;

create policy "allow all to anon" on users for all using (true) with check (true);
create policy "allow all to anon" on categories for all using (true) with check (true);
create policy "allow all to anon" on products for all using (true) with check (true);
create policy "allow all to anon" on serials for all using (true) with check (true);
create policy "allow all to anon" on "stockIntakes" for all using (true) with check (true);
create policy "allow all to anon" on sales for all using (true) with check (true);
create policy "allow all to anon" on "cashDrawerEntries" for all using (true) with check (true);
create policy "allow all to anon" on "mpesaTillEntries" for all using (true) with check (true);
create policy "allow all to anon" on "expenseCategories" for all using (true) with check (true);
create policy "allow all to anon" on expenses for all using (true) with check (true);
create policy "allow all to anon" on "auditLog" for all using (true) with check (true);

-- Realtime — lets multiple tills/devices see each other's changes live.
alter publication supabase_realtime add table
  users, categories, products, serials, "stockIntakes", sales,
  "cashDrawerEntries", "mpesaTillEntries", "expenseCategories", expenses, "auditLog";
