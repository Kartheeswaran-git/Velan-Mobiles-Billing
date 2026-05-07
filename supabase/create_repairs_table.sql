-- Create repairs history table
create table if not exists public.old_mobile_repairs (
  id uuid primary key default gen_random_uuid(),
  mobile_id uuid not null references public.inventory(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  note text default '',
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz default now()
);

-- Trigger to update inventory total repair cost and notes automatically
create or replace function public.sync_mobile_repair_totals()
returns trigger as $$
declare
  v_mobile_id uuid;
begin
  v_mobile_id := coalesce(new.mobile_id, old.mobile_id);

  update public.inventory
  set 
    repair_cost = (select coalesce(sum(amount), 0) from public.old_mobile_repairs where mobile_id = v_mobile_id),
    repair_note = (select string_agg(note, ' | ') from public.old_mobile_repairs where mobile_id = v_mobile_id)
  where id = v_mobile_id;
  
  -- Also update transaction record
  update public.old_mobile_transactions
  set 
    repair_cost = (select coalesce(sum(amount), 0) from public.old_mobile_repairs where mobile_id = v_mobile_id),
    repair_note = (select string_agg(note, ' | ') from public.old_mobile_repairs where mobile_id = v_mobile_id),
    profit = sell_price - (buy_price + (select coalesce(sum(amount), 0) from public.old_mobile_repairs where mobile_id = v_mobile_id))
  where mobile_id = v_mobile_id and stage = 'purchased';
  
  return null;
end;
$$ language plpgsql;

drop trigger if exists tr_sync_mobile_repair on public.old_mobile_repairs;
create trigger tr_sync_mobile_repair 
after insert or update or delete on public.old_mobile_repairs
for each row execute function public.sync_mobile_repair_totals();

-- Permissions
alter table public.old_mobile_repairs enable row level security;
create policy "allow all for repairs" on public.old_mobile_repairs for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
