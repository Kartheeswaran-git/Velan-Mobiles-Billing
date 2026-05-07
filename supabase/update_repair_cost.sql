-- Add repair_cost columns
alter table public.inventory add column if not exists repair_cost numeric(12,2) default 0;
alter table public.old_mobile_transactions add column if not exists repair_cost numeric(12,2) default 0;

-- Update sell_old_mobile function to include repair_cost in profit calculation
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
  v_repair_cost numeric;
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then v_actor_id := p_created_by; end if;

  perform public.ensure_customer(p_customer_name, p_customer_phone);

  select buying_price, repair_cost into v_buy_price, v_repair_cost 
  from public.inventory where id = p_inventory_id for update;
  
  update public.inventory
  set selling_price = p_sell_price, quantity = 0, status = 'sold'
  where id = p_inventory_id;

  insert into public.cash_ledger(type, category, amount, note, created_by, created_by_name)
  values ('income', 'old_mobile_sale', p_sell_price, 'Old mobile sold to ' || p_customer_name, v_actor_id, p_created_by_name);

  -- Update history record with final sale details and profit
  update public.old_mobile_transactions
  set sell_price = p_sell_price,
      repair_cost = coalesce(v_repair_cost, 0),
      profit = p_sell_price - (v_buy_price + coalesce(v_repair_cost, 0)),
      buyer_name = p_customer_name,
      buyer_phone = p_customer_phone,
      stage = 'sold'
  where mobile_id = p_inventory_id and stage = 'purchased';
end;
$$;

notify pgrst, 'reload schema';
