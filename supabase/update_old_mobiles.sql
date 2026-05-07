-- Add aadhar_no to inventory
alter table public.inventory add column if not exists aadhar_no text;

-- Enhance old_mobile_transactions table
alter table public.old_mobile_transactions add column if not exists customer_phone text;
alter table public.old_mobile_transactions add column if not exists aadhar_no text;
alter table public.old_mobile_transactions add column if not exists seller_name text;
alter table public.old_mobile_transactions add column if not exists seller_phone text;
alter table public.old_mobile_transactions add column if not exists buyer_name text;
alter table public.old_mobile_transactions add column if not exists buyer_phone text;

-- Update create_old_mobile_purchase function
create or replace function public.create_old_mobile_purchase(
  p_customer_name text,
  p_customer_phone text,
  p_brand text,
  p_model text,
  p_imei text,
  p_serial_number text,
  p_buy_price numeric,
  p_expected_sell_price numeric,
  p_condition text,
  p_note text,
  p_created_by uuid,
  p_created_by_name text,
  p_aadhar_no text default ''
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
  if v_actor_id is null then v_actor_id := p_created_by; end if;

  select name into v_actor_name from public.users where id = v_actor_id;
  perform public.ensure_customer(p_customer_name, p_customer_phone);
  
  insert into public.inventory(
    category, type, brand, model, item_name, imei, serial_number,
    buying_price, selling_price, quantity, min_stock, supplier, status,
    condition, note, created_by, created_by_name, aadhar_no
  )
  values (
    'old_mobile', 'used_phone', coalesce(p_brand, ''), coalesce(p_model, ''),
    trim(coalesce(p_brand, '') || ' ' || coalesce(p_model, '')),
    p_imei, coalesce(p_serial_number, ''), p_buy_price, p_expected_sell_price, 1, 0,
    p_customer_name, 'available', coalesce(p_condition, ''), coalesce(p_note, ''),
    v_actor_id, coalesce(v_actor_name, p_created_by_name, ''), p_aadhar_no
  )
  returning id into v_inventory_id;

  insert into public.cash_ledger(type, category, amount, note, created_by, created_by_name)
  values ('expense', 'old_mobile_purchase', p_buy_price, 'Old mobile bought from ' || p_customer_name || ' (Aadhar: ' || p_aadhar_no || ')', v_actor_id, coalesce(v_actor_name, p_created_by_name, ''));

  insert into public.old_mobile_transactions(mobile_id, buy_price, sell_price, profit, seller_name, seller_phone, aadhar_no, created_by, stage)
  values (v_inventory_id, p_buy_price, 0, 0, p_customer_name, p_customer_phone, p_aadhar_no, v_actor_id, 'purchased');

  return v_inventory_id;
end;
$$;

-- Update sell_old_mobile function
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
  v_actor_id uuid;
  v_actor_name text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then v_actor_id := p_created_by; end if;

  select name into v_actor_name from public.users where id = v_actor_id;
  perform public.ensure_customer(p_customer_name, p_customer_phone);

  select buying_price into v_buy_price from public.inventory where id = p_inventory_id for update;
  
  update public.inventory
  set selling_price = p_sell_price, quantity = 0, status = 'sold'
  where id = p_inventory_id;

  insert into public.cash_ledger(type, category, amount, note, created_by, created_by_name)
  values ('income', 'old_mobile_sale', p_sell_price, 'Old mobile sold to ' || p_customer_name, v_actor_id, coalesce(v_actor_name, p_created_by_name, ''));

  -- Update the EXISTING purchased record to show it is now sold
  update public.old_mobile_transactions
  set sell_price = p_sell_price,
      profit = p_sell_price - v_buy_price,
      buyer_name = p_customer_name,
      buyer_phone = p_customer_phone,
      stage = 'sold'
  where mobile_id = p_inventory_id and stage = 'purchased';

  -- If no purchased record found (maybe legacy data), insert a new one
  if not found then
    insert into public.old_mobile_transactions(mobile_id, buy_price, sell_price, profit, buyer_name, buyer_phone, created_by, stage)
    values (p_inventory_id, v_buy_price, p_sell_price, p_sell_price - v_buy_price, p_customer_name, p_customer_phone, v_actor_id, 'sold');
  end if;
end;
$$;

grant execute on function public.create_old_mobile_purchase(text, text, text, text, text, text, numeric, numeric, text, text, uuid, text, text) to authenticated;
grant execute on function public.sell_old_mobile(uuid, numeric, text, text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
