create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  uid uuid generated always as (id) stored,
  name text not null,
  phone text default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  aadhar_no text default '',
  address text default '',
  created_at timestamptz not null default now()
);

alter table public.customers add column if not exists aadhar_no text default '';
alter table public.customers alter column address drop not null;
alter table public.customers alter column address set default '';

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  item_id text generated always as (id::text) stored,
  category text not null check (category in ('new_mobile', 'accessory', 'spare_part', 'old_mobile')),
  type text default '',
  brand text default '',
  model text default '',
  item_name text not null,
  imei text default '',
  serial_number text default '',
  buying_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  quantity integer not null default 0,
  min_stock integer not null default 0,
  supplier text default '',
  status text not null default 'available' check (status in ('available', 'sold', 'damaged', 'returned')),
  condition text default '',
  note text default '',
  created_by uuid references public.users (id),
  created_by_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory (id) on delete cascade,
  action text not null check (action in ('stock_in', 'stock_out', 'sold', 'damaged', 'returned')),
  quantity integer not null default 0,
  note text default '',
  staff_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_no text not null unique,
  customer_id uuid references public.customers (id),
  customer_name text not null,
  customer_phone text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  cash_amount numeric(12,2) not null default 0,
  account_amount numeric(12,2) not null default 0,
  payment_type text not null default 'cash',
  created_by uuid references public.users (id),
  created_by_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text not null unique,
  box_no text default '',
  customer_name text not null,
  customer_phone text not null,
  brand text default '',
  model text default '',
  imei text default '',
  problem text not null,
  estimate numeric(12,2) not null default 0,
  advance numeric(12,2) not null default 0,
  status text not null default 'received' check (status in ('received', 'checking', 'waiting_approval', 'repairing', 'ready', 'delivered')),
  received_by uuid references public.users (id),
  received_by_name text default '',
  received_at timestamptz not null default now(),
  delivered_at timestamptz
);

-- Migration for new status names
update public.service_jobs set status = 'repairing' where status = 'waiting_parts';
update public.service_jobs set status = 'ready' where status = 'repaired';

alter table public.service_jobs add column if not exists box_no text default '';
alter table public.service_jobs drop constraint if exists service_jobs_status_check;
alter table public.service_jobs add constraint service_jobs_status_check check (status in ('received', 'checking', 'waiting_approval', 'repairing', 'ready', 'delivered'));

create table if not exists public.cash_ledger (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(12,2) not null default 0,
  note text default '',
  created_by uuid references public.users (id),
  created_by_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.account_ledger (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(12,2) not null default 0,
  note text default '',
  created_by uuid references public.users (id),
  created_by_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.money_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null unique,
  customer_name text default '',
  customer_phone text default '',
  aadhar_no text default '',
  transfer_type text not null default 'cash_to_bank' check (transfer_type in ('cash_to_bank', 'bank_to_cash')),
  transfer_amount numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  total_received numeric(12,2) not null default 0,
  received_source text not null default 'cash' check (received_source in ('cash', 'account')),
  payout_source text not null default 'account' check (payout_source in ('cash', 'account')),
  note text default '',
  created_by uuid references public.users (id),
  created_by_name text default '',
  created_at timestamptz not null default now()
);

alter table public.money_transfers add column if not exists aadhar_no text default '';

create table if not exists public.old_mobile_transactions (
  id uuid primary key default gen_random_uuid(),
  mobile_id uuid not null references public.inventory (id) on delete cascade,
  buy_price numeric(12,2) not null default 0,
  sell_price numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  customer_name text not null,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  stage text not null default 'purchased'
);

create table if not exists public.counters (
  name text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_entries (
  id uuid primary key default gen_random_uuid(),
  purchase_no text not null unique,
  supplier_name text not null,
  supplier_phone text default '',
  category text not null,
  type text default '',
  brand text default '',
  model text default '',
  item_name text not null,
  quantity integer not null default 1,
  buying_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_source text not null default 'cash',
  note text default '',
  created_by uuid references public.users (id),
  created_by_name text default '',
  created_at timestamptz not null default now()
);

alter table public.purchase_entries add column if not exists type text default '';

create table if not exists public.automated_bills (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text default '',
  item_name text not null,
  amount numeric(12,2) not null default 0,
  frequency text not null default 'monthly',
  next_bill_date date,
  status text not null default 'active',
  note text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.users (id),
  staff_name text not null,
  attendance_date date not null default current_date,
  status text not null default 'present' check (status in ('present', 'absent', 'half_day', 'leave')),
  salary_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  note text default '',
  created_at timestamptz not null default now(),
  unique(staff_id, attendance_date)
);

-- Migration for existing tables
do $$
begin
  alter table public.staff_attendance add column if not exists staff_id uuid references public.users (id);
exception when others then null;
end $$;

do $$
begin
  alter table public.staff_attendance add constraint staff_attendance_user_date_unique unique (staff_id, attendance_date);
exception when others then null;
end $$;

create or replace function public.check_in_staff()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_name text;
  v_today date;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  select name into v_user_name from public.users where id = v_user_id;
  v_today := current_date;

  if v_user_name is null then
    return;
  end if;

  insert into public.staff_attendance (staff_id, staff_name, attendance_date, status)
  values (v_user_id, v_user_name, v_today, 'present')
  on conflict on constraint staff_attendance_user_date_unique do nothing;
end;
$$;

create table if not exists public.online_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_name text not null,
  customer_phone text not null,
  platform text not null default 'whatsapp',
  item_name text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'new',
  note text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience text not null default 'all_customers',
  message text not null,
  status text not null default 'draft',
  sent_count integer not null default 0,
  created_by uuid references public.users (id),
  created_by_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  shop_name text default '',
  shop_phone text default '',
  address text default '',
  gstin text default '',
  invoice_prefix text default 'BILL',
  footer_note text default 'Thank you for shopping with us.',
  created_at timestamptz not null default now()
);

create index if not exists inventory_category_idx on public.inventory (category);
create index if not exists inventory_status_idx on public.inventory (status);
create index if not exists inventory_imei_idx on public.inventory (imei);
create index if not exists bills_created_by_idx on public.bills (created_by, created_at desc);
create index if not exists service_jobs_received_by_idx on public.service_jobs (received_by, received_at desc);
create index if not exists cash_ledger_created_at_idx on public.cash_ledger (created_at desc);
create index if not exists account_ledger_created_at_idx on public.account_ledger (created_at desc);
create index if not exists money_transfers_created_at_idx on public.money_transfers (created_at desc);

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.users where id = auth.uid()), false);
$$;

create or replace function public.next_document_number(counter_name text, prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
begin
  insert into public.counters(name, value)
  values (counter_name, 1)
  on conflict (name)
  do update set value = public.counters.value + 1, updated_at = now()
  returning value into next_value;

  return prefix || '-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(next_value::text, 4, '0');
end;
$$;

create or replace function public.ensure_customer(
  p_name text,
  p_phone text,
  p_address text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_name is null or p_name = '' then
    return null;
  end if;

  -- Try to find by phone first
  if p_phone is not null and p_phone <> '' then
    select id into v_id from public.customers where phone = p_phone limit 1;
  end if;

  -- If not found by phone, try by name
  if v_id is null then
    select id into v_id from public.customers where lower(trim(name)) = lower(trim(p_name)) limit 1;
  end if;

  if v_id is null then
    insert into public.customers(name, phone, address)
    values (p_name, p_phone, coalesce(p_address, ''))
    returning id into v_id;
  else
    -- Update existing record with latest details
    update public.customers
    set 
      name = coalesce(p_name, name),
      phone = coalesce(p_phone, phone),
      address = case when p_address <> '' then p_address else address end
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.create_bill(
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_items jsonb,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_cash_amount numeric,
  p_account_amount numeric,
  p_payment_type text,
  p_created_by uuid,
  p_created_by_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_no text;
  v_customer_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  item jsonb;
  current_qty integer;
  current_category text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select name into v_actor_name from public.users where id = v_actor_id;
  v_bill_no := public.next_document_number('bill_no', 'BILL');
  v_customer_id := public.ensure_customer(p_customer_name, p_customer_phone, p_customer_address);

  for item in select * from jsonb_array_elements(p_items)
  loop
    select quantity, category into current_qty, current_category
    from public.inventory
    where id = (item->>'inventory_id')::uuid
    for update;

    if current_qty is null then
      raise exception 'Inventory item not found';
    end if;

    if current_qty < (item->>'quantity')::integer then
      raise exception 'Insufficient stock for %', coalesce(item->>'item_name', 'item');
    end if;

    update public.inventory
    set
      quantity = quantity - (item->>'quantity')::integer,
      status = case
        when quantity - (item->>'quantity')::integer <= 0 and category <> 'accessory' then 'sold'
        else status
      end
    where id = (item->>'inventory_id')::uuid;

    insert into public.inventory_transactions(item_id, action, quantity, note, staff_id)
    values (
      (item->>'inventory_id')::uuid,
      'sold',
      (item->>'quantity')::integer,
      'Sold via bill ' || v_bill_no,
      v_actor_id
    );
  end loop;

  insert into public.bills(
    bill_no, customer_id, customer_name, customer_phone, items,
    subtotal, discount, total, cash_amount, account_amount, payment_type,
    created_by, created_by_name
  )
  values (
    v_bill_no, v_customer_id, p_customer_name, p_customer_phone, p_items,
    p_subtotal, p_discount, p_total, p_cash_amount, p_account_amount, p_payment_type,
    v_actor_id, coalesce(v_actor_name, p_created_by_name, '')
  );

  if p_cash_amount > 0 then
    insert into public.cash_ledger(type, category, amount, note, created_by, created_by_name)
    values ('income', 'bill_payment', p_cash_amount, 'Bill ' || v_bill_no, v_actor_id, coalesce(v_actor_name, p_created_by_name, ''));
  end if;

  if p_account_amount > 0 then
    insert into public.account_ledger(type, category, amount, note, created_by, created_by_name)
    values ('income', 'bill_payment', p_account_amount, 'Bill ' || v_bill_no, v_actor_id, coalesce(v_actor_name, p_created_by_name, ''));
  end if;

  return v_bill_no;
end;
$$;

create or replace function public.create_service_job(
  p_customer_name text,
  p_customer_phone text,
  p_brand text,
  p_model text,
  p_imei text,
  p_problem text,
  p_estimate numeric,
  p_advance numeric,
  p_status text,
  p_received_by uuid,
  p_received_by_name text,
  p_box_no text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_no text;
  v_box_no text;
  v_id uuid;
  v_actor_id uuid;
  v_actor_name text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select name into v_actor_name from public.users where id = v_actor_id;
  v_job_no := public.next_document_number('job_no', 'JOB');
  perform public.ensure_customer(p_customer_name, p_customer_phone);
  
  if p_box_no is null or p_box_no = '' then
    v_box_no := public.next_document_number('box_no', 'BX');
  else
    v_box_no := p_box_no;
  end if;

  insert into public.service_jobs(
    job_no, box_no, customer_name, customer_phone, brand, model, imei, problem,
    estimate, advance, status, received_by, received_by_name, delivered_at
  )
  values (
    v_job_no, v_box_no, p_customer_name, p_customer_phone, coalesce(p_brand, ''), coalesce(p_model, ''), coalesce(p_imei, ''),
    p_problem, p_estimate, p_advance, p_status, v_actor_id, coalesce(v_actor_name, p_received_by_name, ''),
    case when p_status = 'delivered' then now() else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_old_mobile_purchase(
  p_customer_name text,
  p_brand text,
  p_model text,
  p_imei text,
  p_serial_number text,
  p_buy_price numeric,
  p_expected_sell_price numeric,
  p_condition text,
  p_note text,
  p_created_by uuid,
  p_created_by_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory_id uuid;
  v_actor_id uuid;
  v_actor_name text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select name into v_actor_name from public.users where id = v_actor_id;
  insert into public.inventory(
    category, type, brand, model, item_name, imei, serial_number,
    buying_price, selling_price, quantity, min_stock, supplier, status,
    condition, note, created_by, created_by_name
  )
  values (
    'old_mobile', 'used_phone', coalesce(p_brand, ''), coalesce(p_model, ''),
    trim(coalesce(p_brand, '') || ' ' || coalesce(p_model, '')),
    p_imei, coalesce(p_serial_number, ''), p_buy_price, p_expected_sell_price, 1, 0,
    p_customer_name, 'available', coalesce(p_condition, ''), coalesce(p_note, ''),
    v_actor_id, coalesce(v_actor_name, p_created_by_name, '')
  )
  returning id into v_inventory_id;

  insert into public.cash_ledger(type, category, amount, note, created_by, created_by_name)
  values ('expense', 'old_mobile_purchase', p_buy_price, 'Old mobile bought from ' || p_customer_name, v_actor_id, coalesce(v_actor_name, p_created_by_name, ''));

  insert into public.old_mobile_transactions(mobile_id, buy_price, sell_price, profit, customer_name, created_by, stage)
  values (v_inventory_id, p_buy_price, 0, 0, p_customer_name, v_actor_id, 'purchased');

  insert into public.inventory_transactions(item_id, action, quantity, note, staff_id)
  values (v_inventory_id, 'stock_in', 1, 'Old mobile purchase', v_actor_id);

  return v_inventory_id;
end;
$$;

create or replace function public.sell_old_mobile(
  p_inventory_id uuid,
  p_sell_price numeric,
  p_customer_name text,
  p_created_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buy_price numeric;
  v_actor_id uuid;
  v_created_by_name text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select buying_price into v_buy_price from public.inventory where id = p_inventory_id for update;
  if v_buy_price is null then
    raise exception 'Old mobile not found';
  end if;

  select name into v_created_by_name from public.users where id = v_actor_id;

  update public.inventory
  set selling_price = p_sell_price, quantity = 0, status = 'sold'
  where id = p_inventory_id;

  insert into public.old_mobile_transactions(mobile_id, buy_price, sell_price, profit, customer_name, created_by, stage)
  values (p_inventory_id, v_buy_price, p_sell_price, p_sell_price - v_buy_price, p_customer_name, v_actor_id, 'sold');

  insert into public.cash_ledger(type, category, amount, note, created_by, created_by_name)
  values ('income', 'old_mobile_sale', p_sell_price, 'Old mobile sold to ' || p_customer_name, v_actor_id, coalesce(v_created_by_name, ''));

  insert into public.inventory_transactions(item_id, action, quantity, note, staff_id)
  values (p_inventory_id, 'sold', 1, 'Old mobile sale', v_actor_id);
end;
$$;

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.bills enable row level security;
alter table public.service_jobs enable row level security;
alter table public.cash_ledger enable row level security;
alter table public.account_ledger enable row level security;
alter table public.money_transfers enable row level security;
alter table public.old_mobile_transactions enable row level security;
alter table public.counters enable row level security;
alter table public.purchase_entries enable row level security;
alter table public.automated_bills enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.online_orders enable row level security;
alter table public.sms_campaigns enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "users self read" on public.users;
drop policy if exists "users self insert" on public.users;
drop policy if exists "users admin update" on public.users;
drop policy if exists "customers active select" on public.customers;
drop policy if exists "customers active insert" on public.customers;
drop policy if exists "customers admin update" on public.customers;
drop policy if exists "customers active update" on public.customers;
drop policy if exists "customers admin delete" on public.customers;
drop policy if exists "inventory active select" on public.inventory;
drop policy if exists "inventory admin write" on public.inventory;
drop policy if exists "inventory_tx active select" on public.inventory_transactions;
drop policy if exists "inventory_tx admin write" on public.inventory_transactions;
drop policy if exists "bills active select" on public.bills;
drop policy if exists "bills active insert" on public.bills;
drop policy if exists "bills admin select" on public.bills;
drop policy if exists "bills admin update" on public.bills;
drop policy if exists "service jobs active select" on public.service_jobs;
drop policy if exists "service jobs update" on public.service_jobs;
drop policy if exists "cash ledger select" on public.cash_ledger;
drop policy if exists "cash ledger admin write" on public.cash_ledger;
drop policy if exists "cash ledger staff insert" on public.cash_ledger;
drop policy if exists "account ledger select" on public.account_ledger;
drop policy if exists "account ledger admin write" on public.account_ledger;
drop policy if exists "account ledger staff insert" on public.account_ledger;
drop policy if exists "money transfers admin" on public.money_transfers;
drop policy if exists "money transfers active user" on public.money_transfers;
drop policy if exists "old mobile tx select" on public.old_mobile_transactions;
drop policy if exists "counters admin only" on public.counters;
drop policy if exists "purchase entries admin" on public.purchase_entries;
drop policy if exists "automated bills admin" on public.automated_bills;
drop policy if exists "staff attendance admin" on public.staff_attendance;
drop policy if exists "staff attendance self select" on public.staff_attendance;
drop policy if exists "staff attendance self handle" on public.staff_attendance;
drop policy if exists "online orders admin" on public.online_orders;
drop policy if exists "sms campaigns admin" on public.sms_campaigns;
drop policy if exists "app settings admin" on public.app_settings;


create policy "users self read" on public.users
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "users self insert" on public.users
for insert to authenticated
with check ((id = auth.uid() and role = 'staff') or public.is_admin());

create policy "users admin update" on public.users
for update to authenticated
using (public.is_admin() or id = auth.uid())
with check (public.is_admin() or id = auth.uid());

create policy "customers active select" on public.customers
for select to authenticated
using (public.is_active_user());

create policy "customers active insert" on public.customers
for insert to authenticated
with check (public.is_active_user());

create policy "customers admin update" on public.customers
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "customers admin delete" on public.customers
for delete to authenticated
using (public.is_admin());

create policy "inventory active select" on public.inventory
for select to authenticated
using (public.is_active_user());

create policy "inventory admin write" on public.inventory
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "inventory_tx active select" on public.inventory_transactions
for select to authenticated
using (public.is_active_user());

create policy "inventory_tx admin write" on public.inventory_transactions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "bills active select" on public.bills
for select to authenticated
using (public.is_active_user());

create policy "bills admin update" on public.bills
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "service jobs active select" on public.service_jobs
for select to authenticated
using (public.is_active_user());

create policy "service jobs update" on public.service_jobs
for update to authenticated
using (public.is_active_user())
with check (public.is_active_user());

create policy "cash ledger select" on public.cash_ledger
for select to authenticated
using (public.is_active_user());

create policy "cash ledger admin write" on public.cash_ledger
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "cash ledger staff insert" on public.cash_ledger
for insert to authenticated
with check (public.is_active_user() and created_by = auth.uid());

create policy "account ledger select" on public.account_ledger
for select to authenticated
using (public.is_active_user());

create policy "account ledger admin write" on public.account_ledger
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "account ledger staff insert" on public.account_ledger
for insert to authenticated
with check (public.is_active_user() and created_by = auth.uid());

create policy "money transfers active user" on public.money_transfers
for all to authenticated
using (public.is_active_user())
with check (public.is_active_user());

create policy "old mobile tx select" on public.old_mobile_transactions
for select to authenticated
using (public.is_admin() or created_by = auth.uid());

create policy "counters admin only" on public.counters
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "purchase entries admin" on public.purchase_entries
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "automated bills admin" on public.automated_bills
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "staff attendance admin" on public.staff_attendance
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "staff attendance self select" on public.staff_attendance
for select to authenticated
using (staff_id = auth.uid());

create policy "staff attendance self handle" on public.staff_attendance
for all to authenticated
using (staff_id = auth.uid())
with check (staff_id = auth.uid());

create policy "online orders admin" on public.online_orders
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "sms campaigns admin" on public.sms_campaigns
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "app settings admin" on public.app_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant execute on function public.create_bill(uuid, text, text, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, uuid, text) to authenticated;
grant execute on function public.create_service_job(text, text, text, text, text, text, numeric, numeric, text, uuid, text) to authenticated;
grant execute on function public.create_old_mobile_purchase(text, text, text, text, text, numeric, numeric, text, text, uuid, text) to authenticated;
grant execute on function public.sell_old_mobile(uuid, numeric, text, uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.users;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.customers;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.inventory;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.inventory_transactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bills;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.service_jobs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.cash_ledger;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.account_ledger;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.money_transfers;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.old_mobile_transactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.purchase_entries;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.automated_bills;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.staff_attendance;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.online_orders;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sms_campaigns;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_settings;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

comment on table public.users is 'Set the first admin manually after creating the auth user: update public.users set role = ''admin'' where id = ''<auth-user-uuid>'';';
