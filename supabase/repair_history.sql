-- Create repair history table
create table if not exists public.old_mobile_repairs (
  id uuid primary key default gen_random_uuid(),
  mobile_id uuid not null references public.inventory(id) on delete cascade,
  amount numeric(12,2) not null,
  note text default '',
  created_at timestamptz default now(),
  created_by uuid references public.users(id)
);

-- Function to get total repair cost for a mobile
create or replace function public.get_total_repair_cost(p_mobile_id uuid)
returns numeric language sql stable as $$
  select coalesce(sum(amount), 0) from public.old_mobile_repairs where mobile_id = p_mobile_id;
$$;

-- Update sell_old_mobile to use the repair history table
create or replace function public.sell_old_mobile(
  p_inventory_id uuid,
  p_sell_price numeric,
  p_customer_name text,
  p_customer_phone text,
  p_created_by uuid,
  p_created_by_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buy_price numeric;
  v_total_repair numeric;
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then v_actor_id := p_created_by; end if;

  perform public.ensure_customer(p_customer_name, p_customer_phone);

  select buying_price into v_buy_price from public.inventory where id = p_inventory_id for update;
  select public.get_total_repair_cost(p_inventory_id) into v_total_repair;
  
  update public.inventory
  set selling_price = p_sell_price, 
      quantity = 0, 
      status = 'sold',
      repair_cost = v_total_repair -- for legacy/denormalized cache
  where id = p_inventory_id;

  update public.old_mobile_transactions
  set sell_price = p_sell_price,
      repair_cost = v_total_repair,
      profit = p_sell_price - (v_buy_price + v_total_repair),
      buyer_name = p_customer_name,
      buyer_phone = p_customer_phone,
      stage = 'sold'
  where mobile_id = p_inventory_id and stage = 'purchased';
end;
$$;

grant select, insert, delete on public.old_mobile_repairs to authenticated;
notify pgrst, 'reload schema';
