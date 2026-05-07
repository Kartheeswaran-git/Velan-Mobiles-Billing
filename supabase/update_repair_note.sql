-- Add repair_note columns
alter table public.inventory add column if not exists repair_note text default '';
alter table public.old_mobile_transactions add column if not exists repair_note text default '';

notify pgrst, 'reload schema';
