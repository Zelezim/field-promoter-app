-- Rota Clara / Vale Verde Dairy
-- Fictional schema for the public portfolio. Apply on Supabase (Postgres 15).
-- The nightly ETL uses the service role, which bypasses RLS.
-- Promoters, managers, and sellers sign in with Supabase Auth.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Dimensions
-- ---------------------------------------------------------------------------

create table public.promoters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  route_name text not null,
  active boolean not null default true
);

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  email text not null
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'promoter' check (role in ('promoter', 'manager', 'seller')),
  promoter_id uuid references public.promoters (id),
  seller_id uuid references public.sellers (id),
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text not null,
  address text,
  abc_curve text not null check (abc_curve in ('A', 'B', 'C')),
  abc_calculated text check (abc_calculated in ('A', 'B', 'C')),
  key_account boolean not null default false,
  seller_id uuid not null references public.sellers (id),
  latitude double precision,
  longitude double precision,
  channel text
);

create table public.products (
  sku text primary key,
  name text not null,
  category text not null,
  shelf_life_days integer not null check (shelf_life_days > 0),
  abc_curve text not null check (abc_curve in ('A', 'B', 'C')),
  planogram_facings integer not null check (planogram_facings > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  weight_kg numeric(8, 3) not null
);

-- Fixed weekly route. The score does not reorder these rows.
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  weekday smallint not null check (weekday between 1 and 7),
  shift text not null check (shift in ('morning', 'afternoon')),
  visit_order smallint not null check (visit_order > 0),
  frequency text not null check (frequency in ('weekly', 'biweekly')),
  week_parity smallint not null default 0 check (week_parity in (0, 1)),
  unique (promoter_id, store_id, weekday, shift)
);

create table public.shipments (
  id text primary key,
  issued_on date not null,
  store_id uuid not null references public.stores (id),
  seller_id uuid not null references public.sellers (id),
  loaded_at timestamptz not null default now()
);

create table public.shipment_lines (
  id bigint generated always as identity primary key,
  shipment_id text not null references public.shipments (id) on delete cascade,
  sku text not null references public.products (sku),
  qty numeric(12, 3) not null check (qty > 0),
  unit_price_cents integer not null,
  revenue_cents bigint not null,
  estimated_expiry date not null
);

create index shipments_store_date_idx on public.shipments (store_id, issued_on);
create index shipment_lines_shipment_idx on public.shipment_lines (shipment_id);

create table public.agenda_stops (
  id text primary key,
  visit_date date not null,
  promoter_id uuid not null references public.promoters (id),
  store_id uuid not null references public.stores (id),
  shift text not null check (shift in ('morning', 'afternoon')),
  visit_order smallint not null,
  frequency text not null,
  score numeric(5, 1) not null,
  volume_cents bigint not null,
  days_since_visit integer,
  stockout_events_14d integer not null,
  days_to_expiry integer,
  parts jsonb not null,
  built_at timestamptz not null default now(),
  unique (visit_date, promoter_id, store_id)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  stop_id text not null references public.agenda_stops (id),
  promoter_id uuid not null references public.promoters (id),
  store_id uuid not null references public.stores (id),
  status text not null check (status in ('checked_in', 'completed', 'skipped')),
  checked_in_at timestamptz,
  latitude double precision,
  longitude double precision,
  distance_m numeric(10, 1),
  completed_at timestamptz,
  unique (stop_id)
);

create table public.stock_counts (
  id bigint generated always as identity primary key,
  visit_id uuid not null references public.visits (id) on delete cascade,
  sku text not null references public.products (sku),
  on_hand integer not null check (on_hand >= 0),
  facings integer not null check (facings >= 0),
  unique (visit_id, sku)
);

create table public.stockouts (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id),
  visit_id uuid references public.visits (id) on delete cascade,
  sku text not null references public.products (sku),
  reason text not null check (reason in (
    'supplier', 'shelf', 'phantom', 'price', 'expiry', 'space', 'no_order'
  )),
  observed_on date not null
);

create table public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  kind text not null check (kind in ('before', 'after')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Written by the audit function (service role), not by the browser.
create table public.ai_audits (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  promoter_id uuid not null references public.promoters (id),
  store_id uuid not null references public.stores (id),
  seller_id uuid not null references public.sellers (id),
  source text not null check (source in ('mock', 'openai')),
  model text not null,
  execution_score numeric(5, 1) not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_day date not null,
  calls integer not null default 0 check (calls >= 0),
  primary key (user_id, usage_day)
);

-- ---------------------------------------------------------------------------
-- Identity helpers. security definer so policies can read profiles
-- without recursing through RLS.
-- ---------------------------------------------------------------------------

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  )
$$;

create or replace function public.my_promoter_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select promoter_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_seller_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select seller_id from public.profiles where id = auth.uid()
$$;

-- New accounts start as promoters. A manager changes the role with the service role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'promoter');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Returns the new call count, or raises quota_exceeded. Service role only.
create or replace function public.consume_ai_quota(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_calls integer;
begin
  insert into public.ai_usage (user_id, usage_day, calls)
  values (p_user, current_date, 1)
  on conflict (user_id, usage_day)
  do update set calls = public.ai_usage.calls + 1
  where public.ai_usage.calls < p_limit
  returning calls into next_calls;

  if next_calls is null then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;
  return next_calls;
end;
$$;

revoke all on function public.is_manager() from public;
revoke all on function public.my_promoter_id() from public;
revoke all on function public.my_seller_id() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.consume_ai_quota(uuid, integer) from public;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.my_promoter_id() to authenticated;
grant execute on function public.my_seller_id() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.promoters enable row level security;
alter table public.sellers enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.routes enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_lines enable row level security;
alter table public.agenda_stops enable row level security;
alter table public.visits enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stockouts enable row level security;
alter table public.visit_photos enable row level security;
alter table public.ai_audits enable row level security;
alter table public.ai_usage enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_manager());

create policy promoters_read on public.promoters
  for select to authenticated using (true);

create policy sellers_read on public.sellers
  for select to authenticated using (true);

create policy products_read on public.products
  for select to authenticated using (true);

create policy stores_read on public.stores
  for select to authenticated
  using (
    public.is_manager()
    or seller_id = public.my_seller_id()
    or exists (
      select 1 from public.routes r
      where r.store_id = stores.id and r.promoter_id = public.my_promoter_id()
    )
  );

create policy routes_read on public.routes
  for select to authenticated
  using (public.is_manager() or promoter_id = public.my_promoter_id());

create policy shipments_read on public.shipments
  for select to authenticated
  using (
    public.is_manager()
    or seller_id = public.my_seller_id()
    or exists (
      select 1 from public.routes r
      where r.store_id = shipments.store_id and r.promoter_id = public.my_promoter_id()
    )
  );

create policy shipment_lines_read on public.shipment_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_lines.shipment_id
        and (
          public.is_manager()
          or s.seller_id = public.my_seller_id()
          or exists (
            select 1 from public.routes r
            where r.store_id = s.store_id and r.promoter_id = public.my_promoter_id()
          )
        )
    )
  );

create policy agenda_read on public.agenda_stops
  for select to authenticated
  using (
    public.is_manager()
    or promoter_id = public.my_promoter_id()
    or exists (
      select 1 from public.stores st
      where st.id = agenda_stops.store_id and st.seller_id = public.my_seller_id()
    )
  );

create policy visits_select on public.visits
  for select to authenticated
  using (
    public.is_manager()
    or promoter_id = public.my_promoter_id()
    or exists (
      select 1 from public.stores st
      where st.id = visits.store_id and st.seller_id = public.my_seller_id()
    )
  );

create policy visits_insert on public.visits
  for insert to authenticated
  with check (
    promoter_id = public.my_promoter_id()
    and exists (
      select 1 from public.agenda_stops a
      where a.id = stop_id
        and a.promoter_id = public.my_promoter_id()
        and a.store_id = visits.store_id
    )
  );

create policy visits_update on public.visits
  for update to authenticated
  using (promoter_id = public.my_promoter_id())
  with check (promoter_id = public.my_promoter_id());

create policy stock_counts_rw on public.stock_counts
  for all to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = stock_counts.visit_id
        and (
          public.is_manager()
          or v.promoter_id = public.my_promoter_id()
          or exists (
            select 1 from public.stores st
            where st.id = v.store_id and st.seller_id = public.my_seller_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = stock_counts.visit_id and v.promoter_id = public.my_promoter_id()
    )
  );

create policy stockouts_rw on public.stockouts
  for all to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.stores st
      where st.id = stockouts.store_id and st.seller_id = public.my_seller_id()
    )
    or exists (
      select 1 from public.routes r
      where r.store_id = stockouts.store_id and r.promoter_id = public.my_promoter_id()
    )
  )
  with check (
    exists (
      select 1 from public.routes r
      where r.store_id = stockouts.store_id and r.promoter_id = public.my_promoter_id()
    )
  );

create policy photos_rw on public.visit_photos
  for all to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = visit_photos.visit_id
        and (
          public.is_manager()
          or v.promoter_id = public.my_promoter_id()
          or exists (
            select 1 from public.stores st
            where st.id = v.store_id and st.seller_id = public.my_seller_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_photos.visit_id and v.promoter_id = public.my_promoter_id()
    )
  );

-- Clients can read an audit. They cannot insert one; the function does.
create policy ai_audits_select on public.ai_audits
  for select to authenticated
  using (
    public.is_manager()
    or promoter_id = public.my_promoter_id()
    or seller_id = public.my_seller_id()
  );

create policy ai_usage_select on public.ai_usage
  for select to authenticated
  using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select on
  public.profiles, public.promoters, public.sellers, public.products, public.stores,
  public.routes, public.shipments, public.shipment_lines, public.agenda_stops,
  public.ai_audits, public.ai_usage
  to authenticated;
grant select, insert, update on public.visits to authenticated;
grant select, insert, update, delete on public.stock_counts, public.stockouts, public.visit_photos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
  end if;
end $$;
