-- Vendor-side schema — run this in YOUR OWN Supabase project (separate from
-- any customer's project). Holds the license registry that
-- vendor-tools/keygen.mjs writes to and the activate-license Edge Function
-- reads/updates. Never expose this project's anon key to a customer build.

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text not null unique,
  business_name text not null,
  customer_supabase_url text not null,
  customer_supabase_anon_key text not null,
  device_limit integer not null default 2,
  activated_device_ids text[] not null default '{}',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Deny-all by default: only code holding the service-role key (the Edge
-- Function, and your keygen script) can read or write this table. The
-- anon key — even if it leaked — grants no access to it at all.
alter table licenses enable row level security;

-- Rate-limits the activate-license function (see its source): without this,
-- nothing stops scripted hammering of the endpoint or scraping it for which
-- keys are valid/revoked/device-limited.
create table if not exists activation_attempts (
  id uuid primary key default gen_random_uuid(),
  license_key text not null,
  device_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists activation_attempts_license_key_created_at_idx
  on activation_attempts (license_key, created_at);

alter table activation_attempts enable row level security;
