-- Create the FIRST administrator (run once, in the Supabase SQL Editor, after migrations 0001-0004).
--
-- 1. Supabase dashboard -> Authentication -> Users -> "Add user" -> "Create new user".
--    Enter the email and a strong password, and tick "Auto Confirm User".
-- 2. Edit the two values below, then run this script.
--    Every later account is created from inside MediaDesk (Team page) by an administrator.

insert into public.profiles (id, full_name, email, department_id, role, is_active)
select u.id, 'Your Full Name', lower(u.email), d.id, 'administrator', true
from auth.users u
join public.departments d on d.name = 'Media'
where lower(u.email) = lower('you@example.org')
on conflict (id) do nothing;

-- Check it worked (should return one row with role = administrator):
select id, full_name, email, role, is_active from public.profiles where role = 'administrator';
