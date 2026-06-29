-- Diagnostic query: check the auth trigger and its state
-- Run this in Supabase SQL Editor

-- 1. Does the function exist?
select
  p.proname as function_name,
  p.prosecdef as is_security_definer
from pg_proc p
where p.proname = 'handle_new_user';

-- 2. What triggers reference it?
select
  t.tgname as trigger_name,
  c.relname as table_name,
  t.tgenabled as enabled,
  pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on t.tgrelid = c.oid
where t.tgname = 'on_auth_user_created';

-- 3. Try the insert logic manually with a test row
do $$
declare
  test_id uuid := gen_random_uuid();
  test_email text := 'diagtest_' || test_id::text || '@test.local';
begin
  -- Insert into auth.users as the postgres role would (this needs to be done via auth API)
  -- We just test the trigger function's insert logic
  begin
    insert into public.profiles (id, email, full_name, phone, role, dietary_tags)
    values (
      test_id,
      test_email,
      coalesce(null::text, split_part(test_email, '@', 1)),
      null,
      coalesce(null::public.user_role, 'consumer'),
      coalesce(
        array(select jsonb_array_elements_text('[]'::jsonb)),
        '{}'
      )
    );
    raise notice 'Profile insert succeeded for %', test_email;
    delete from public.profiles where id = test_id;
  exception when others then
    raise notice 'Profile insert FAILED: % (SQLSTATE %)', SQLERRM, SQLSTATE;
  end;
end $$;

-- 4. Show last 5 errors in postgres logs (if accessible)
select
  logged_at,
  error_message,
  metadata
from public.error_logs
order by logged_at desc
limit 5;
