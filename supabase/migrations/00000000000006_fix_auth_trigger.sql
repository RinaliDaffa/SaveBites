-- ========================================
-- Auto-create profile on signup (safeguarded)
-- ========================================

drop function if exists public.handle_new_user() cascade;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
declare
  _role text;
  _dietary_tags text[];
begin
  -- Safely extract role with validation
  _role := coalesce(
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'consumer'
  );

  -- Validate role against enum values
  if _role not in ('consumer', 'merchant') then
    _role := 'consumer';
  end if;

  -- Safely extract dietary_tags
  _dietary_tags := coalesce(
    array(select jsonb_array_elements_text(
      coalesce(new.raw_user_meta_data->'dietary_tags', '[]'::jsonb)
    )),
    '{}'
  );

  insert into public.profiles (id, email, full_name, phone, role, dietary_tags)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), null),
    _role::public.user_role,
    _dietary_tags
  );

  return new;
exception when others then
  -- Log the error details (will show in Supabase logs)
  raise warning 'handle_new_user error for user %: % (SQLSTATE %)', new.id, sqlerrm, sqlstate;
  -- Re-raise so auth still completes even if profile creation fails
  raise;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
