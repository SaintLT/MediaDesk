-- MediaDesk V1 — 0002: helper functions, ticket numbering, rule-enforcing triggers, activity log, queue view.
-- RLS cannot restrict individual columns, so the triggers below are the column-level rulebook.
-- They run for every writer that has a signed-in user (auth.uid() not null). Direct SQL / service-role
-- maintenance (auth.uid() is null) skips the role checks but never the protected-field and workflow rules.

-- ---------------------------------------------------------------- small utilities
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.safe_uuid(v text)
returns uuid language plpgsql immutable as $$
begin
  return v::uuid;
exception when others then
  return null;
end $$;

-- "Today" in the organisation's timezone (Settings -> app_settings.timezone, default UTC).
create or replace function public.app_today()
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select value from public.app_settings where key = 'timezone'), 'UTC'))::date
$$;

create or replace function public.validate_app_setting()
returns trigger language plpgsql as $$
begin
  if new.key = 'timezone' and not exists (select 1 from pg_timezone_names where name = new.value) then
    raise exception 'Unknown timezone: %', new.value;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger app_settings_validate before insert or update on public.app_settings
  for each row execute function public.validate_app_setting();
create trigger departments_updated before update on public.departments
  for each row execute function public.set_updated_at();
create trigger ticket_categories_updated before update on public.ticket_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- identity / role helpers
-- Return NULL for anyone without an ACTIVE profile, so every policy fails closed.
create or replace function public.auth_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'administrator', false)
$$;

create or replace function public.is_manager_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('administrator', 'media_manager'), false)
$$;

-- Single source of truth for "may this user see this ticket (and its comments, history, files)?"
create or replace function public.can_view_ticket(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_role() is not null
     and exists (
       select 1 from public.tickets t
       where t.id = tid
         and (public.is_manager_or_admin() or t.requester_id = auth.uid() or t.assigned_to = auth.uid())
     )
$$;

-- ---------------------------------------------------------------- ticket numbers (MD-YYYY-0001)
-- The upsert takes a row lock on the year's counter, so concurrent inserts are serialised and can never
-- receive the same number. The counter bump rolls back together with a failed insert (no gaps).
-- tickets.ticket_number UNIQUE is the final backstop.
create or replace function public.next_ticket_number()
returns text language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from public.app_today())::int;
  n int;
begin
  insert into public.ticket_counters as c (year, last_value) values (y, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning c.last_value into n;
  return 'MD-' || y::text || '-' || lpad(n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------- tickets: before insert
-- The client only supplies title, description, category, suggested priority and due date.
-- Everything else is decided here, so a crafted request cannot self-assign, self-prioritise or skip review.
create or replace function public.tickets_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dept uuid;
begin
  select p.department_id into dept from public.profiles p where p.id = new.requester_id;
  if dept is null then
    raise exception 'Requester has no profile.';
  end if;
  new.ticket_number            := public.next_ticket_number();
  new.requester_department_id  := dept;
  new.priority                 := new.suggested_priority;
  new.status                   := 'submitted';
  new.assigned_to              := null;
  new.assigned_at              := null;
  new.started_at               := null;
  new.completed_at             := null;
  new.resolution_note          := null;
  new.submitted_at             := now();
  new.updated_at               := now();
  return new;
end $$;

create trigger tickets_before_insert before insert on public.tickets
  for each row execute function public.tickets_before_insert();

-- ---------------------------------------------------------------- tickets: before update (rulebook)
create or replace function public.tickets_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   public.user_role;
begin
  -- 1. Fields nobody may change after creation.
  if new.id <> old.id
     or new.ticket_number <> old.ticket_number
     or new.requester_id <> old.requester_id
     or new.requester_department_id <> old.requester_department_id
     or new.submitted_at <> old.submitted_at
     or new.suggested_priority <> old.suggested_priority then
    raise exception 'Protected ticket fields cannot be changed.';
  end if;

  -- 2. Role rules (only when a signed-in user is making the change).
  if uid is not null then
    r := public.auth_role();
    if r is null then
      raise exception 'Your account is not active.';
    end if;

    if r in ('administrator', 'media_manager') then
      null;  -- full workflow control

    elsif r = 'media_member' and old.assigned_to = uid then
      if new.title is distinct from old.title
         or new.description is distinct from old.description
         or new.category_id is distinct from old.category_id
         or new.priority is distinct from old.priority
         or new.due_date is distinct from old.due_date
         or new.assigned_to is distinct from old.assigned_to then
        raise exception 'Assigned team members can only update the status and resolution note.';
      end if;
      if new.status is distinct from old.status
         and (old.status not in ('assigned', 'in_progress', 'on_hold')
              or new.status not in ('in_progress', 'on_hold', 'completed')) then
        raise exception 'You cannot move a ticket from % to %.', old.status, new.status;
      end if;

    elsif old.requester_id = uid then
      if new.title is distinct from old.title
         or new.description is distinct from old.description
         or new.category_id is distinct from old.category_id
         or new.priority is distinct from old.priority
         or new.due_date is distinct from old.due_date
         or new.assigned_to is distinct from old.assigned_to
         or new.resolution_note is distinct from old.resolution_note then
        raise exception 'Requesters cannot edit ticket details. Add a comment instead.';
      end if;
      if new.status is distinct from old.status
         and not (new.status = 'cancelled' and old.status in ('submitted', 'under_review')) then
        raise exception 'You can only cancel a ticket that has not been assigned yet.';
      end if;

    else
      raise exception 'You are not allowed to update this ticket.';
    end if;
  end if;

  -- 3. Assignment rules.
  if new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null then
      if not exists (select 1 from public.profiles p
                     where p.id = new.assigned_to and p.is_active
                       and p.role in ('media_manager', 'media_member')) then
        raise exception 'Tickets can only be assigned to active media team members.';
      end if;
      new.assigned_at := now();
      if new.status = old.status and old.status in ('submitted', 'under_review') then
        new.status := 'assigned';
      end if;
    else
      new.assigned_at := null;
      if new.status = old.status and old.status in ('assigned', 'in_progress', 'on_hold') then
        new.status := 'under_review';
      end if;
    end if;
  end if;

  -- 4. Workflow rules.
  if new.status in ('assigned', 'in_progress') and new.assigned_to is null then
    raise exception 'Assign the ticket to a team member before setting it to %.', replace(new.status::text, '_', ' ');
  end if;
  if new.status = 'completed' and char_length(trim(coalesce(new.resolution_note, ''))) < 5 then
    raise exception 'A resolution note is required to complete a ticket.';
  end if;

  -- 5. Timestamps.
  if new.status is distinct from old.status then
    if new.status = 'in_progress' and new.started_at is null then
      new.started_at := now();
    end if;
    if new.status = 'completed' then
      new.completed_at := now();
    elsif old.status = 'completed' then
      new.completed_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger tickets_before_update before update on public.tickets
  for each row execute function public.tickets_before_update();

-- ---------------------------------------------------------------- tickets: activity log + assignment history
create or replace function public.tickets_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ticket_activity (ticket_id, actor_id, type, new_value, note)
  values (new.id, new.requester_id, 'created', new.ticket_number, new.title);
  return new;
end $$;

create trigger tickets_after_insert after insert on public.tickets
  for each row execute function public.tickets_after_insert();

create or replace function public.tickets_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  old_name text;
  new_name text;
begin
  if new.status is distinct from old.status then
    insert into public.ticket_activity (ticket_id, actor_id, type, old_value, new_value, note)
    values (new.id, actor, 'status_changed', old.status::text, new.status::text,
            case when new.status = 'completed' then new.resolution_note end);
  end if;

  if new.priority is distinct from old.priority then
    insert into public.ticket_activity (ticket_id, actor_id, type, old_value, new_value)
    values (new.id, actor, 'priority_changed', old.priority::text, new.priority::text);
  end if;

  if new.due_date is distinct from old.due_date then
    insert into public.ticket_activity (ticket_id, actor_id, type, old_value, new_value)
    values (new.id, actor, 'due_date_changed', old.due_date::text, new.due_date::text);
  end if;

  if new.category_id is distinct from old.category_id then
    insert into public.ticket_activity (ticket_id, actor_id, type, old_value, new_value)
    values (new.id, actor, 'category_changed',
            (select name from public.ticket_categories where id = old.category_id),
            (select name from public.ticket_categories where id = new.category_id));
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    select full_name into old_name from public.profiles where id = old.assigned_to;
    select full_name into new_name from public.profiles where id = new.assigned_to;

    update public.ticket_assignments
       set unassigned_at = now()
     where ticket_id = new.id and unassigned_at is null;

    if new.assigned_to is not null then
      insert into public.ticket_assignments (ticket_id, assigned_to, assigned_by)
      values (new.id, new.assigned_to, actor);
      insert into public.ticket_activity (ticket_id, actor_id, type, old_value, new_value)
      values (new.id, actor, 'assigned', old_name, new_name);
    else
      insert into public.ticket_activity (ticket_id, actor_id, type, old_value)
      values (new.id, actor, 'unassigned', old_name);
    end if;
  end if;
  return new;
end $$;

create trigger tickets_after_update after update on public.tickets
  for each row execute function public.tickets_after_update();

-- ---------------------------------------------------------------- comments / attachments -> activity
create or replace function public.comments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ticket_activity (ticket_id, actor_id, type, note)
  values (new.ticket_id, new.author_id, 'comment_added', left(new.body, 140));
  return new;
end $$;

create trigger comments_after_insert after insert on public.ticket_comments
  for each row execute function public.comments_after_insert();

create or replace function public.attachments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ticket_activity (ticket_id, actor_id, type, new_value)
  values (new.ticket_id, new.uploaded_by, 'attachment_added', new.file_name);
  return new;
end $$;

create trigger attachments_after_insert after insert on public.ticket_attachments
  for each row execute function public.attachments_after_insert();

-- ---------------------------------------------------------------- profiles guard
-- Ordinary users may change only their own display name. Administrators manage everything else.
-- Nobody can remove the last active administrator.
create or replace function public.profiles_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if new.id <> old.id or new.email is distinct from old.email then
    raise exception 'Profile id and email cannot be changed here.';
  end if;

  if uid is not null and not public.is_admin() then
    if old.id <> uid then
      raise exception 'You can only edit your own profile.';
    end if;
    if new.role is distinct from old.role
       or new.department_id is distinct from old.department_id
       or new.is_active is distinct from old.is_active then
      raise exception 'Only administrators can change role, department or account status.';
    end if;
  end if;

  if old.role = 'administrator' and old.is_active
     and (new.role <> 'administrator' or not new.is_active) then
    if not exists (select 1 from public.profiles p
                   where p.role = 'administrator' and p.is_active and p.id <> old.id) then
      raise exception 'There must be at least one active administrator.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger profiles_before_update before update on public.profiles
  for each row execute function public.profiles_before_update();

-- ---------------------------------------------------------------- queue view
-- security_invoker = the caller's RLS applies, so each user only ever sees tickets they may see.
-- Plain ORDER BY (priority, due_date nulls last, submitted_at) gives the default queue order.
-- needs_attention keeps old low-priority work visible: it flips on once a ticket that is still waiting
-- (not started) exceeds an age limit for its priority.
create view public.ticket_queue with (security_invoker = true) as
select
  t.*,
  c.name        as category_name,
  rp.full_name  as requester_name,
  d.name        as requester_department,
  ap.full_name  as assignee_name,
  (t.due_date is not null and t.due_date < public.app_today()
     and t.status not in ('completed', 'cancelled'))                      as is_overdue,
  floor(extract(epoch from (now() - t.submitted_at)) / 86400)::int        as age_days,
  (t.status in ('submitted', 'under_review', 'assigned', 'on_hold')
     and now() - t.submitted_at > case t.priority
           when 'critical' then interval '1 day'
           when 'high'     then interval '3 days'
           when 'normal'   then interval '7 days'
           else                 interval '14 days' end)                   as needs_attention
from public.tickets t
join public.ticket_categories c on c.id = t.category_id
join public.profiles rp         on rp.id = t.requester_id
join public.departments d       on d.id = t.requester_department_id
left join public.profiles ap    on ap.id = t.assigned_to;

-- ---------------------------------------------------------------- function privileges
revoke all on all functions in schema public from public, anon;
grant execute on function
  public.auth_role(), public.is_admin(), public.is_manager_or_admin(),
  public.can_view_ticket(uuid), public.safe_uuid(text), public.app_today()
to authenticated;
