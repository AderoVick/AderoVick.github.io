-- AderoVick Digital Hub database schema
-- Run in a new Supabase project SQL editor.

create extension if not exists pgcrypto;

create type public.user_role as enum ('client', 'admin');
create type public.order_status as enum ('Submitted', 'Under review', 'Quoted', 'In progress', 'Review', 'Completed', 'Cancelled');
create type public.payment_status as enum ('Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_phone text,
  country text,
  organisation text,
  service_id text not null,
  service_name text not null,
  project_title text not null,
  description text not null,
  deliverables text,
  complexity text not null default 'standard',
  urgency text not null default 'normal',
  deadline date,
  budget numeric(12,2),
  currency char(3) not null default 'USD',
  estimate_low_usd numeric(12,2),
  estimate_high_usd numeric(12,2),
  quoted_amount numeric(12,2),
  quoted_currency char(3),
  quoted_at timestamptz,
  status public.order_status not null default 'Submitted',
  admin_notes text,
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_tracking_email_idx on public.orders (tracking_code, lower(client_email));
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  object_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('mpesa','paypal','stripe','crypto')),
  provider_reference text not null,
  secondary_reference text,
  amount numeric(12,2) not null,
  currency char(3) not null,
  status public.payment_status not null default 'Pending',
  checkout_url text,
  receipt_number text,
  payer_phone text,
  paid_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_reference)
);
create index payments_order_idx on public.payments (order_id, created_at desc);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  link text,
  platforms text[] not null default '{}',
  status text not null default 'Draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  provider_results jsonb,
  provider_errors jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_posts_schedule_idx on public.social_posts (status, scheduled_for);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  source text not null default 'web',
  status text not null default 'New',
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger social_posts_updated_at before update on public.social_posts for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_files enable row level security;
alter table public.payments enable row level security;
alter table public.social_posts enable row level security;
alter table public.contact_messages enable row level security;

create policy "profiles read own" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "orders read own or admin" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders admin update" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "order files read own or admin" on public.order_files for select using (
  exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "payments read own or admin" on public.payments for select using (
  exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "social posts admin only" on public.social_posts for all using (public.is_admin()) with check (public.is_admin());
create policy "contact messages admin only" on public.contact_messages for select using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-files', 'client-files', false, 8388608, array[
  'text/csv','text/plain','application/pdf','application/zip',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
]) on conflict (id) do nothing;

-- After creating your own account, promote it manually with its UUID:
-- update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL';
