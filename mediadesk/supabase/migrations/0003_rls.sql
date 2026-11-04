-- MediaDesk V1 — 0003: Row Level Security.
-- Model: every table has RLS on. Policies call helper functions that return NULL/false for anyone without an
-- ACTIVE profile, so a stray Supabase Auth account (or a deactivated user) can read and write nothing.
-- Column-level rules (who may change priority, status, assignee ...) are enforced by triggers in 0002.

alter table public.departments         enable row level security;
alter table public.ticket_categories   enable row level security;
alter table public.app_settings        enable row level security;
alter table public.profiles            enable row level security;
alter table public.ticket_counters     enable row level security;
alter table public.tickets             enable row level security;
alter table public.ticket_assignments  enable row level security;
alter table public.ticket_comments     enable row level security;
alter table public.ticket_activity     enable row level security;
alter table public.ticket_attachments  enable row level security;

-- Anonymous (signed-out) visitors get nothing. Signed-in users get table privileges that RLS then narrows.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
revoke all on public.ticket_counters from authenticated;   -- only the numbering function touches it
revoke insert, update, delete on public.ticket_activity, public.ticket_assignments from authenticated;
revoke insert, delete on public.profiles from authenticated;

-- ---------------------------------------------------------------- reference data (read: any active user)
create policy departments_select on public.departments
  for select to authenticated using (public.auth_role() is not null);
create policy departments_insert on public.departments
  for insert to authenticated with check (public.is_admin());
create policy departments_update on public.departments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy categories_select on public.ticket_categories
  for select to authenticated using (public.auth_role() is not null);
create policy categories_insert on public.ticket_categories
  for insert to authenticated with check (public.is_admin());
create policy categories_update on public.ticket_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy settings_select on public.app_settings
  for select to authenticated using (public.auth_role() is not null);
create policy settings_insert on public.app_settings
  for insert to authenticated with check (public.is_admin());
create policy settings_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- profiles
-- Everyone can read their own row (so a deactivated user can be told why they are locked out).
-- Active users can read the directory (names are needed to show requesters and assignees).
-- Creating profiles happens only through the admin-users Edge Function / SQL (no INSERT policy).
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.auth_role() is not null);

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- tickets
create policy tickets_select on public.tickets
  for select to authenticated
  using (
    public.auth_role() is not null
    and (public.is_manager_or_admin() or requester_id = auth.uid() or assigned_to = auth.uid())
  );

create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (public.auth_role() is not null and requester_id = auth.uid());

create policy tickets_update on public.tickets
  for update to authenticated
  using (
    public.auth_role() is not null
    and (public.is_manager_or_admin() or requester_id = auth.uid() or assigned_to = auth.uid())
  )
  with check (
    public.auth_role() is not null
    and (public.is_manager_or_admin() or requester_id = auth.uid() or assigned_to = auth.uid())
  );
-- No DELETE policy: tickets are cancelled, never deleted, so history stays intact.

-- ---------------------------------------------------------------- ticket children
create policy assignments_select on public.ticket_assignments
  for select to authenticated using (public.can_view_ticket(ticket_id));

create policy activity_select on public.ticket_activity
  for select to authenticated using (public.can_view_ticket(ticket_id));

create policy comments_select on public.ticket_comments
  for select to authenticated using (public.can_view_ticket(ticket_id));
create policy comments_insert on public.ticket_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_ticket(ticket_id));
-- Comments are append-only (no UPDATE / DELETE) so the record stays trustworthy.

create policy attachments_select on public.ticket_attachments
  for select to authenticated using (public.can_view_ticket(ticket_id));
create policy attachments_insert on public.ticket_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_view_ticket(ticket_id)
    and storage_path like ticket_id::text || '/%'
  );

-- ticket_counters: RLS on, no policies, no grants -> unreachable except through next_ticket_number().
grant select on public.ticket_queue to authenticated;
revoke all on public.ticket_queue from anon;
