alter table public.customers add column if not exists address text default '';
alter table public.customers alter column address drop not null;
alter table public.customers alter column address set default '';

notify pgrst, 'reload schema';
