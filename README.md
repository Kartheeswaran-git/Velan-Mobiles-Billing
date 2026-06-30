# Velan Mobiles

React + Vite + Supabase mobile phone shop management application for billing, inventory, service jobs, cash/account ledgers, old mobile buy/sell, staff roles, and reports.

## Features

- Supabase Auth login for `admin` and `staff`
- Supabase Postgres-backed role and CRUD permission profiles in `users`
- Permission-protected admin and staff routes
- Billing flow with stock reduction and ledger updates through SQL RPC functions
- Inventory CRUD with IMEI support and low stock visibility
- Service job management with status updates
- Cash and account ledgers with manual entries
- Old mobile purchase and resale profit tracking
- Admin dashboard and reports
- Staff dashboard with own activity

## Setup

1. Install packages

```bash
npm install
```

2. Run the SQL schema in your Supabase SQL editor:

`supabase/schema.sql`

Then run `supabase/staff-permissions.sql`. For an existing database, run only this migration to add staff CRUD permissions.

3. Create your first auth user in Supabase Authentication.

4. Promote the first user to admin in the SQL editor:

```sql
update public.users
set role = 'admin'
where id = '<that-auth-user-uuid>';
```

5. Confirm `.env` or `.env.example` values are correct for your project.

6. Start the app

```bash
npm run dev
```

## Supabase tables

- `users`
- `customers`
- `inventory`
- `inventory_transactions`
- `bills`
- `service_jobs`
- `cash_ledger`
- `account_ledger`
- `old_mobile_transactions`
- `counters`

## Login flow

- Create users in Supabase Auth.
- The app auto-creates a matching `users` profile on first login with the default role `staff` and standard staff permissions.
- Promote your first real admin manually with SQL, then use the app for profile updates.

## Important security note

- Use only the Supabase `anon` key in the browser.
- Do not place the `service_role` key in frontend code or `.env` files used by Vite.
- If the service-role key was exposed anywhere beyond your private setup workflow, rotate it in Supabase.

## Important notes

- Realtime refresh is handled through Supabase `postgres_changes`.
- The SQL file includes RLS policies plus RPC functions for billing and old mobile sale flows.
- Staff restrictions are enforced in the UI and at the database layer through RLS and RPCs.
- This project expects Indian currency formatting and uses `INR`.
# Velan-Mobiles-Billing
