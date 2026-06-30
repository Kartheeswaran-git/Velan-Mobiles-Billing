-- Run this once in the Supabase SQL editor for an existing Velan Mobiles database.

alter table public.users
add column if not exists permissions jsonb not null default '{
  "today":{"read":true,"update":true},
  "inventory":{"read":true},
  "sales":{"read":true},
  "billing":{"create":true,"read":true},
  "money_transfer":{"create":true,"read":true},
  "service_jobs":{"create":true,"read":true,"update":true},
  "old_mobiles":{"create":true,"read":true,"update":true}
}'::jsonb;

create or replace function public.has_permission(p_module text, p_operation text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select active and (
      role = 'admin'
      or coalesce((permissions -> p_module ->> p_operation)::boolean, false)
    )
    from public.users
    where id = auth.uid()
  ), false);
$$;

grant execute on function public.has_permission(text, text) to authenticated;

-- Make this migration safe to run again after future edits.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (policyname like '%permitted%' or policyname = 'users admin insert')
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end $$;

-- User profiles remain admin-managed. Staff may only read their own profile.
drop policy if exists "users self read" on public.users;
drop policy if exists "users self insert" on public.users;
drop policy if exists "users admin update" on public.users;
drop policy if exists "users admin delete" on public.users;
create policy "users self read" on public.users for select to authenticated
using (id = auth.uid() or public.is_admin() or public.has_permission('attendance','read'));
create policy "users admin insert" on public.users for insert to authenticated
with check (public.is_admin());
create policy "users admin update" on public.users for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "users admin delete" on public.users for delete to authenticated
using (public.is_admin() and id <> auth.uid());

-- Customers / parties.
drop policy if exists "customers active select" on public.customers;
drop policy if exists "customers active insert" on public.customers;
drop policy if exists "customers admin update" on public.customers;
drop policy if exists "customers active update" on public.customers;
drop policy if exists "customers admin delete" on public.customers;
create policy "customers permitted select" on public.customers for select to authenticated
using (public.has_permission('parties','read') or public.has_permission('billing','read') or public.has_permission('service_jobs','read') or public.has_permission('money_transfer','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "customers permitted insert" on public.customers for insert to authenticated
with check (public.has_permission('parties','create'));
create policy "customers permitted update" on public.customers for update to authenticated
using (public.has_permission('parties','update')) with check (public.has_permission('parties','update'));
create policy "customers permitted delete" on public.customers for delete to authenticated
using (public.has_permission('parties','delete'));

-- Inventory and item catalog.
drop policy if exists "inventory active select" on public.inventory;
drop policy if exists "inventory admin write" on public.inventory;
drop policy if exists "inventory_tx active select" on public.inventory_transactions;
drop policy if exists "inventory_tx admin write" on public.inventory_transactions;
drop policy if exists "product master select" on public.product_master;
drop policy if exists "product master admin" on public.product_master;
create policy "inventory permitted select" on public.inventory for select to authenticated
using (public.has_permission('inventory','read') or public.has_permission('billing','read') or public.has_permission('old_mobiles','read') or public.has_permission('purchases','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "inventory permitted insert" on public.inventory for insert to authenticated with check (public.has_permission('inventory','create'));
create policy "inventory permitted update" on public.inventory for update to authenticated using (public.has_permission('inventory','update')) with check (public.has_permission('inventory','update'));
create policy "inventory permitted delete" on public.inventory for delete to authenticated using (public.has_permission('inventory','delete'));
create policy "inventory tx permitted select" on public.inventory_transactions for select to authenticated
using (public.has_permission('inventory','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "inventory tx permitted insert" on public.inventory_transactions for insert to authenticated with check (public.has_permission('inventory','create'));
create policy "inventory tx permitted update" on public.inventory_transactions for update to authenticated using (public.has_permission('inventory','update')) with check (public.has_permission('inventory','update'));
create policy "inventory tx permitted delete" on public.inventory_transactions for delete to authenticated using (public.has_permission('inventory','delete'));
create policy "product master permitted select" on public.product_master for select to authenticated
using (public.has_permission('inventory','read') or public.has_permission('billing','read') or public.has_permission('purchases','read'));
create policy "product master permitted insert" on public.product_master for insert to authenticated with check (public.has_permission('inventory','create'));
create policy "product master permitted update" on public.product_master for update to authenticated using (public.has_permission('inventory','update')) with check (public.has_permission('inventory','update'));
create policy "product master permitted delete" on public.product_master for delete to authenticated using (public.has_permission('inventory','delete'));

-- Sales and service jobs.
drop policy if exists "bills active select" on public.bills;
drop policy if exists "bills active insert" on public.bills;
drop policy if exists "bills admin select" on public.bills;
drop policy if exists "bills admin update" on public.bills;
drop policy if exists "service jobs active select" on public.service_jobs;
drop policy if exists "service jobs update" on public.service_jobs;
create policy "bills permitted select" on public.bills for select to authenticated
using (public.has_permission('sales','read') or public.has_permission('billing','read') or public.has_permission('today','read') or public.has_permission('parties','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "bills permitted insert" on public.bills for insert to authenticated with check (public.has_permission('billing','create'));
create policy "bills permitted update" on public.bills for update to authenticated
using (public.has_permission('sales','update') or public.has_permission('billing','update'))
with check (public.has_permission('sales','update') or public.has_permission('billing','update'));
create policy "bills permitted delete" on public.bills for delete to authenticated using (public.has_permission('sales','delete'));
create policy "service jobs permitted select" on public.service_jobs for select to authenticated
using (public.has_permission('service_jobs','read') or public.has_permission('today','read') or public.has_permission('parties','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "service jobs permitted insert" on public.service_jobs for insert to authenticated with check (public.has_permission('service_jobs','create'));
create policy "service jobs permitted update" on public.service_jobs for update to authenticated using (public.has_permission('service_jobs','update')) with check (public.has_permission('service_jobs','update'));
create policy "service jobs permitted delete" on public.service_jobs for delete to authenticated using (public.has_permission('service_jobs','delete'));

-- Accounting tables.
drop policy if exists "cash ledger select" on public.cash_ledger;
drop policy if exists "cash ledger admin write" on public.cash_ledger;
drop policy if exists "cash ledger staff insert" on public.cash_ledger;
drop policy if exists "account ledger select" on public.account_ledger;
drop policy if exists "account ledger admin write" on public.account_ledger;
drop policy if exists "account ledger staff insert" on public.account_ledger;
create policy "cash ledger permitted select" on public.cash_ledger for select to authenticated
using (public.has_permission('cash_bank','read') or public.has_permission('expenses','read') or public.has_permission('today','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "cash ledger permitted insert" on public.cash_ledger for insert to authenticated
with check (public.has_permission('cash_bank','create') or public.has_permission('expenses','create') or public.has_permission('money_transfer','create') or public.has_permission('billing','create') or public.has_permission('billing','update'));
create policy "cash ledger permitted update" on public.cash_ledger for update to authenticated
using (public.has_permission('cash_bank','update') or public.has_permission('billing','update') or public.has_permission('money_transfer','update'))
with check (public.has_permission('cash_bank','update') or public.has_permission('billing','update') or public.has_permission('money_transfer','update'));
create policy "cash ledger permitted delete" on public.cash_ledger for delete to authenticated using (public.has_permission('cash_bank','delete') or public.has_permission('money_transfer','delete'));
create policy "account ledger permitted select" on public.account_ledger for select to authenticated
using (public.has_permission('cash_bank','read') or public.has_permission('expenses','read') or public.has_permission('today','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "account ledger permitted insert" on public.account_ledger for insert to authenticated
with check (public.has_permission('cash_bank','create') or public.has_permission('expenses','create') or public.has_permission('money_transfer','create') or public.has_permission('billing','create') or public.has_permission('billing','update'));
create policy "account ledger permitted update" on public.account_ledger for update to authenticated
using (public.has_permission('cash_bank','update') or public.has_permission('billing','update') or public.has_permission('money_transfer','update'))
with check (public.has_permission('cash_bank','update') or public.has_permission('billing','update') or public.has_permission('money_transfer','update'));
create policy "account ledger permitted delete" on public.account_ledger for delete to authenticated using (public.has_permission('cash_bank','delete') or public.has_permission('money_transfer','delete'));

-- Remaining operational modules.
drop policy if exists "money transfers active select" on public.money_transfers;
drop policy if exists "money transfers active insert" on public.money_transfers;
drop policy if exists "money transfers admin update" on public.money_transfers;
drop policy if exists "money transfers admin delete" on public.money_transfers;
create policy "money transfers permitted select" on public.money_transfers for select to authenticated using (public.has_permission('money_transfer','read') or public.has_permission('parties','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "money transfers permitted insert" on public.money_transfers for insert to authenticated with check (public.has_permission('money_transfer','create'));
create policy "money transfers permitted update" on public.money_transfers for update to authenticated using (public.has_permission('money_transfer','update')) with check (public.has_permission('money_transfer','update'));
create policy "money transfers permitted delete" on public.money_transfers for delete to authenticated using (public.has_permission('money_transfer','delete'));

drop policy if exists "old mobile tx select" on public.old_mobile_transactions;
drop policy if exists "old mobile tx permitted insert" on public.old_mobile_transactions;
drop policy if exists "old mobile tx permitted update" on public.old_mobile_transactions;
drop policy if exists "old mobile tx permitted delete" on public.old_mobile_transactions;
drop policy if exists "old mobile repairs active select" on public.old_mobile_repairs;
drop policy if exists "old mobile repairs admin insert" on public.old_mobile_repairs;
create policy "old mobile tx permitted select" on public.old_mobile_transactions for select to authenticated using (public.has_permission('old_mobiles','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "old mobile tx permitted insert" on public.old_mobile_transactions for insert to authenticated with check (public.has_permission('old_mobiles','create'));
create policy "old mobile tx permitted update" on public.old_mobile_transactions for update to authenticated using (public.has_permission('old_mobiles','update')) with check (public.has_permission('old_mobiles','update'));
create policy "old mobile tx permitted delete" on public.old_mobile_transactions for delete to authenticated using (public.has_permission('old_mobiles','delete'));
create policy "old mobile repairs permitted select" on public.old_mobile_repairs for select to authenticated using (public.has_permission('old_mobiles','read') or public.has_permission('reports','read'));
create policy "old mobile repairs permitted insert" on public.old_mobile_repairs for insert to authenticated with check (public.has_permission('old_mobiles','create'));
create policy "old mobile repairs permitted update" on public.old_mobile_repairs for update to authenticated using (public.has_permission('old_mobiles','update')) with check (public.has_permission('old_mobiles','update'));
create policy "old mobile repairs permitted delete" on public.old_mobile_repairs for delete to authenticated using (public.has_permission('old_mobiles','delete'));

drop policy if exists "purchase entries admin" on public.purchase_entries;
create policy "purchases permitted select" on public.purchase_entries for select to authenticated using (public.has_permission('purchases','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "purchases permitted insert" on public.purchase_entries for insert to authenticated with check (public.has_permission('purchases','create'));
create policy "purchases permitted update" on public.purchase_entries for update to authenticated using (public.has_permission('purchases','update')) with check (public.has_permission('purchases','update'));
create policy "purchases permitted delete" on public.purchase_entries for delete to authenticated using (public.has_permission('purchases','delete'));

drop policy if exists "staff attendance admin" on public.staff_attendance;
drop policy if exists "staff attendance self select" on public.staff_attendance;
drop policy if exists "staff attendance self handle" on public.staff_attendance;
create policy "attendance permitted select" on public.staff_attendance for select to authenticated
using (public.has_permission('attendance','read') or public.has_permission('data_export','read') or staff_id = auth.uid());
create policy "attendance permitted insert" on public.staff_attendance for insert to authenticated
with check (public.has_permission('attendance','create') or staff_id = auth.uid());
create policy "attendance permitted update" on public.staff_attendance for update to authenticated
using (public.has_permission('attendance','update') or staff_id = auth.uid())
with check (public.has_permission('attendance','update') or staff_id = auth.uid());
create policy "attendance permitted delete" on public.staff_attendance for delete to authenticated
using (public.has_permission('attendance','delete'));

drop policy if exists "automated bills admin" on public.automated_bills;
create policy "automated bills permitted select" on public.automated_bills for select to authenticated using (public.has_permission('automated_bills','read') or public.has_permission('data_export','read'));
create policy "automated bills permitted insert" on public.automated_bills for insert to authenticated with check (public.has_permission('automated_bills','create'));
create policy "automated bills permitted update" on public.automated_bills for update to authenticated using (public.has_permission('automated_bills','update')) with check (public.has_permission('automated_bills','update'));
create policy "automated bills permitted delete" on public.automated_bills for delete to authenticated using (public.has_permission('automated_bills','delete'));

drop policy if exists "online orders admin" on public.online_orders;
create policy "online orders permitted select" on public.online_orders for select to authenticated using (public.has_permission('online_orders','read'));
create policy "online orders permitted insert" on public.online_orders for insert to authenticated with check (public.has_permission('online_orders','create'));
create policy "online orders permitted update" on public.online_orders for update to authenticated using (public.has_permission('online_orders','update')) with check (public.has_permission('online_orders','update'));
create policy "online orders permitted delete" on public.online_orders for delete to authenticated using (public.has_permission('online_orders','delete'));

drop policy if exists "sms campaigns admin" on public.sms_campaigns;
create policy "sms campaigns permitted select" on public.sms_campaigns for select to authenticated using (public.has_permission('sms_marketing','read'));
create policy "sms campaigns permitted insert" on public.sms_campaigns for insert to authenticated with check (public.has_permission('sms_marketing','create'));
create policy "sms campaigns permitted update" on public.sms_campaigns for update to authenticated using (public.has_permission('sms_marketing','update')) with check (public.has_permission('sms_marketing','update'));
create policy "sms campaigns permitted delete" on public.sms_campaigns for delete to authenticated using (public.has_permission('sms_marketing','delete'));

drop policy if exists "app settings admin" on public.app_settings;
create policy "settings permitted select" on public.app_settings for select to authenticated using (public.is_active_user());
create policy "settings permitted insert" on public.app_settings for insert to authenticated with check (public.has_permission('settings','create'));
create policy "settings permitted update" on public.app_settings for update to authenticated using (public.has_permission('settings','update')) with check (public.has_permission('settings','update'));
create policy "settings permitted delete" on public.app_settings for delete to authenticated using (public.has_permission('settings','delete'));

drop policy if exists "daily closings active select" on public.daily_closings;
drop policy if exists "daily closings admin write" on public.daily_closings;
create policy "daily closings permitted select" on public.daily_closings for select to authenticated using (public.has_permission('today','read') or public.has_permission('reports','read') or public.has_permission('data_export','read'));
create policy "daily closings permitted insert" on public.daily_closings for insert to authenticated with check (public.has_permission('today','update'));
create policy "daily closings permitted update" on public.daily_closings for update to authenticated using (public.has_permission('today','update')) with check (public.has_permission('today','update'));
create policy "daily closings permitted delete" on public.daily_closings for delete to authenticated using (public.has_permission('today','delete'));

-- Transactional RPCs are security-definer functions, so check their main write here.
create or replace function public.enforce_staff_write_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if public.is_admin() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  allowed := case tg_table_name
    when 'bills' then public.has_permission('billing', case when tg_op = 'INSERT' then 'create' else 'update' end)
    when 'service_jobs' then public.has_permission('service_jobs', case when tg_op = 'INSERT' then 'create' else 'update' end)
    when 'old_mobile_transactions' then public.has_permission('old_mobiles', case when tg_op = 'DELETE' then 'delete' when tg_op = 'INSERT' then 'create' else 'update' end)
    when 'old_mobile_repairs' then public.has_permission('old_mobiles', case when tg_op = 'DELETE' then 'delete' when tg_op = 'INSERT' then 'create' else 'update' end)
    when 'product_master' then public.has_permission('inventory', case when tg_op = 'DELETE' then 'delete' when tg_op = 'INSERT' then 'create' else 'update' end)
    when 'purchase_entries' then public.has_permission('purchases', case when tg_op = 'DELETE' then 'delete' when tg_op = 'INSERT' then 'create' else 'update' end)
    else true
  end;

  if not allowed then raise exception 'You do not have permission for this operation'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists enforce_staff_write_permission on public.bills;
create trigger enforce_staff_write_permission before insert or update or delete on public.bills for each row execute function public.enforce_staff_write_permission();
drop trigger if exists enforce_staff_write_permission on public.service_jobs;
create trigger enforce_staff_write_permission before insert or update or delete on public.service_jobs for each row execute function public.enforce_staff_write_permission();
drop trigger if exists enforce_staff_write_permission on public.old_mobile_transactions;
create trigger enforce_staff_write_permission before insert or update or delete on public.old_mobile_transactions for each row execute function public.enforce_staff_write_permission();
drop trigger if exists enforce_staff_write_permission on public.old_mobile_repairs;
create trigger enforce_staff_write_permission before insert or update or delete on public.old_mobile_repairs for each row execute function public.enforce_staff_write_permission();
drop trigger if exists enforce_staff_write_permission on public.product_master;
create trigger enforce_staff_write_permission before insert or update or delete on public.product_master for each row execute function public.enforce_staff_write_permission();
drop trigger if exists enforce_staff_write_permission on public.purchase_entries;
create trigger enforce_staff_write_permission before insert or update or delete on public.purchase_entries for each row execute function public.enforce_staff_write_permission();

notify pgrst, 'reload schema';
