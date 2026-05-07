alter table public.customers add column if not exists aadhar_no text default '';

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

create index if not exists money_transfers_created_at_idx
on public.money_transfers (created_at desc);

alter table public.money_transfers enable row level security;

drop policy if exists "money transfers admin" on public.money_transfers;

create policy "money transfers admin" on public.money_transfers
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.money_transfers;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
