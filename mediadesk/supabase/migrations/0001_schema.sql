-- MediaDesk V1 — 0001: schema (tables, enums, indexes)
-- Run migrations in order: 0001 -> 0002 -> 0003 -> 0004.


-- ---------------------------------------------------------------- enums
create type public.user_role as enum ('administrator', 'media_manager', 'media_member', 'requester');

-- Declaration order matters: ORDER BY priority ASC sorts Critical -> Low.
create type public.ticket_priority as enum ('critical', 'high', 'normal', 'low');

create type public.ticket_status as enum (
  'submitted', 'under_review', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'
);

create type public.activity_type as enum (
  'created', 'status_changed', 'priority_changed', 'assigned', 'unassigned',
  'due_date_changed', 'category_changed', 'comment_added', 'attachment_added'
);

-- ---------------------------------------------------------------- reference data
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.ticket_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  description text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- profiles
-- One row per person who may use MediaDesk. Passwords live only in Supabase Auth.
-- No profile row (or is_active = false) means no access to anything.
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null check (length(trim(full_name)) > 0),
  email          text not null unique check (email = lower(email)),
  department_id  uuid not null references public.departments (id),
  role           public.user_role not null default 'requester',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role) where is_active;
create index profiles_department_idx on public.profiles (department_id);

-- ---------------------------------------------------------------- tickets
create table public.ticket_counters (
  year        int primary key,
  last_value  int not null default 0
);

create table public.tickets (
  id                      uuid primary key default gen_random_uuid(),
  ticket_number           text not null unique,
  title                   text not null check (char_length(trim(title)) between 3 and 200),
  description             text not null check (char_length(trim(description)) between 10 and 10000),
  requester_id            uuid not null references public.profiles (id),
  requester_department_id uuid not null references public.departments (id),
  category_id             uuid not null references public.ticket_categories (id),
  suggested_priority      public.ticket_priority not null default 'normal',
  priority                public.ticket_priority not null default 'normal',
  status                  public.ticket_status not null default 'submitted',
  due_date                date,
  assigned_to             uuid references public.profiles (id),
  resolution_note         text,
  submitted_at            timestamptz not null default now(),
  assigned_at             timestamptz,
  started_at              timestamptz,
  completed_at            timestamptz,
  updated_at              timestamptz not null default now(),
  constraint tickets_completed_needs_note
    check (status <> 'completed' or char_length(trim(coalesce(resolution_note, ''))) >= 5)
);

-- Default queue order: priority, earliest due date (NULLs last), oldest first.
create index tickets_queue_idx       on public.tickets (priority, due_date nulls last, submitted_at);
create index tickets_status_idx      on public.tickets (status);
create index tickets_requester_idx   on public.tickets (requester_id, submitted_at desc);
create index tickets_assigned_idx    on public.tickets (assigned_to) where assigned_to is not null;
create index tickets_category_idx    on public.tickets (category_id);

-- Full history of who was assigned when (current assignee also lives on tickets.assigned_to).
create table public.ticket_assignments (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.tickets (id) on delete cascade,
  assigned_to    uuid not null references public.profiles (id),
  assigned_by    uuid references public.profiles (id),
  assigned_at    timestamptz not null default now(),
  unassigned_at  timestamptz
);
create index ticket_assignments_ticket_idx on public.ticket_assignments (ticket_id, assigned_at desc);
create index ticket_assignments_user_idx   on public.ticket_assignments (assigned_to);

create table public.ticket_comments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid not null references public.profiles (id),
  body        text not null check (char_length(trim(body)) between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);

create table public.ticket_activity (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  actor_id    uuid references public.profiles (id),
  type        public.activity_type not null,
  old_value   text,
  new_value   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index ticket_activity_ticket_idx on public.ticket_activity (ticket_id, created_at);

create table public.ticket_attachments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets (id) on delete cascade,
  uploaded_by   uuid not null references public.profiles (id),
  file_name     text not null check (length(trim(file_name)) > 0),
  storage_path  text not null unique,          -- "<ticket_id>/<uuid>-<file name>" in bucket ticket-attachments
  mime_type     text,
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at    timestamptz not null default now()
);
create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);
