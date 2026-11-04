-- MediaDesk V1 — 0004: private attachment storage + starter data.

-- ---------------------------------------------------------------- storage bucket (private, 10 MB, safe types)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments', 'ticket-attachments', false, 10485760,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live at "<ticket_id>/<file>". Access follows the ticket: if you may view the ticket you may read
-- its files; if you may view the ticket you may add files to it. Same rule as the database tables.
create policy "ticket attachments: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and public.can_view_ticket(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy "ticket attachments: upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and public.can_view_ticket(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------- starter data (edit later in Settings)
insert into public.departments (name) values
  ('Media'), ('ICT'), ('Administration'), ('Finance')
on conflict (name) do nothing;

insert into public.ticket_categories (name, description, sort_order) values
  ('Equipment and technical issues', 'Faults, setup help and equipment requests', 10),
  ('Photography and videography',    'Event, portrait and video coverage',          20),
  ('Video and audio editing',        'Editing, mixing and post-production',         30),
  ('Graphic design',                 'Posters, flyers, slides and social graphics', 40),
  ('Live streaming and event support','Streaming, PA, projection and event tech',   50),
  ('General media requests',         'Anything else for the media team',            60)
on conflict (name) do nothing;

insert into public.app_settings (key, value) values ('timezone', 'UTC')
on conflict (key) do nothing;
