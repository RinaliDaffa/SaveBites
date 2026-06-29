-- ========================================
-- FIX: Auth trigger not finding user_role enum
-- ========================================
-- Run this in Supabase Dashboard → SQL Editor → New query
-- Press Run

drop function if exists public.handle_new_user() cascade;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
declare
  _role text;
  _dietary_tags text[];
begin
  -- Safely extract and validate role
  _role := lower(coalesce(
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'consumer'
  ));
  if _role not in ('consumer', 'merchant') then
    _role := 'consumer';
  end if;

  -- Safely extract dietary_tags (default to empty array)
  begin
    _dietary_tags := array(
      select jsonb_array_elements_text(
        coalesce(new.raw_user_meta_data->'dietary_tags', '[]'::jsonb)
      )
    );
  exception when others then
    _dietary_tags := '{}';
  end;

  insert into public.profiles (id, email, full_name, phone, role, dietary_tags)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), null),
    _role::public.user_role,
    coalesce(_dietary_tags, '{}')
  );

  return new;
exception when others then
  raise warning 'handle_new_user error for user %: % (SQLSTATE %)', new.id, sqlerrm, sqlstate;
  raise;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Verify it worked
select 'trigger_fixed' as status;
