# MediaDesk

Ticket management for a media department. Staff from any department submit requests; the media team triages,
assigns and completes them. React + TypeScript + Tailwind on the front end, Supabase (Auth, Postgres, Storage,
Row Level Security) behind it, deployed on Vercel.

> **Build status:** Stages 1-2 of 4 are in this folder: database, security and admin Edge Function, plus the app shell
> (sign-in, role-aware navigation, layout). Ticket screens arrive in Stage 3, dashboard/team/reports/settings in Stage 4.

## How access control works

- **No public sign-up.** Turn off sign-ups in Supabase (Authentication -> Sign In / Providers -> disable "Allow new users to sign up"). Even if it were on, an account with no row in `profiles` can read and write nothing.
- **Roles** (`administrator`, `media_manager`, `media_member`, `requester`) live in `profiles`. Policies and triggers read the role from the database, never from anything the browser sends.
- **Row Level Security** decides which rows a user can see: managers and administrators see every ticket, team members see tickets assigned to them, requesters see their own. Comments, history and attachment files follow the ticket (`can_view_ticket`).
- **Triggers enforce column rules** that RLS cannot express: requesters cannot change priority, status or assignee (they can only cancel an unassigned ticket); team members can only move their own tickets through In Progress / On Hold / Completed; completing a ticket needs a resolution note; only managers and administrators assign work.
- **Ticket numbers** (`MD-2026-0001`) are issued by the database under a row lock, so two tickets can never share a number.
- **Admin-only account creation** runs in the `admin-users` Edge Function, the one place that holds the service-role key. It re-checks that the caller is an active administrator.

## Database setup (Stage 1)

1. Create a project at supabase.com.
2. SQL Editor -> run, in order, the contents of:
   `supabase/migrations/0001_schema.sql`, `0002_functions.sql`, `0003_rls.sql`, `0004_storage_seed.sql`.
   (Or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. Disable public sign-ups (see above).
4. Create the first administrator: follow the steps at the top of `supabase/first_admin.sql`.
5. Deploy the admin function: `supabase functions deploy admin-users` (leave JWT verification on).
6. Copy `.env.example` to `.env.local` and fill in your project URL and **anon** key.

## Known V1 trade-offs

- Any active user can read the staff directory (names and emails) so ticket pages can show requesters and assignees.
- Comments and attachments cannot be edited or deleted once posted (keeps the record trustworthy).
- Tickets are cancelled, never deleted.
- Overdue dates use the timezone stored in `app_settings` (default `UTC`; changeable in Settings in Stage 4).

## Run it locally (Stage 2)

1. Install Node.js 20 or newer (nodejs.org, LTS), then check with `node -v`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and **anon** key.
3. `npm install`, then `npm run dev`, then open the address it prints (usually http://localhost:5173).
4. Sign in with the administrator account you created. Pages other than sign-in show a "not built yet" notice until Stages 3-4.
