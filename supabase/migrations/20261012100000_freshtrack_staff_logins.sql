-- FreshTrack: every person signs in with their own email and password.
--
-- A login is a Supabase Auth user; ft_members says it may use FreshTrack
-- and whether it is an admin. The person's name and role inside the app
-- live in the app's own user list (ft_rows kind 'users'), matched by email.
--
-- The admin manages logins from the app's Users screen through
-- ft_admin_set_login / ft_admin_remove_login. Nobody else can.

create or replace function public.ft_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ft_members m
    where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  )
$$;

-- Creates the login if it is new (a password is then required), or sets a
-- new password when one is given, and lets it use FreshTrack. Internal: not
-- callable from the app directly.
create or replace function public.ft_upsert_login(login_email text, login_password text, member_role text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  em text := lower(trim(login_email));
  uid uuid;
begin
  if em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'not an email address' using errcode = '22023';
  end if;
  if login_password is not null and length(login_password) < 8 then
    raise exception 'password must be at least 8 characters' using errcode = '22023';
  end if;
  if member_role not in ('admin', 'staff') then
    raise exception 'role must be admin or staff' using errcode = '22023';
  end if;

  select u.id into uid from auth.users u where lower(u.email) = em;
  if uid is null then
    if login_password is null then
      raise exception 'a new login needs a password' using errcode = '22023';
    end if;
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      extensions.crypt(login_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true),
            'email', now(), now(), now());
  elsif login_password is not null then
    update auth.users
       set encrypted_password = extensions.crypt(login_password, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = uid;
  end if;

  insert into public.ft_members (user_id, role) values (uid, member_role)
  on conflict (user_id) do update set role = excluded.role;
  return uid;
end $$;

-- Admin only: add a person's login or give them a new password.
create or replace function public.ft_admin_set_login(login_email text, login_password text default null, is_admin boolean default false)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me text := (select lower(u.email) from auth.users u where u.id = (select auth.uid()));
begin
  if not public.ft_is_admin() then
    raise exception 'only the admin can manage logins' using errcode = '42501';
  end if;
  -- The admin cannot take away their own admin rights by mistake.
  if lower(trim(login_email)) = me and not is_admin then
    raise exception 'you cannot remove your own admin rights' using errcode = '22023';
  end if;
  perform public.ft_upsert_login(login_email, login_password, case when is_admin then 'admin' else 'staff' end);
end $$;

-- Admin only: stop a login from using FreshTrack and sign it out everywhere.
create or replace function public.ft_admin_remove_login(login_email text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if not public.ft_is_admin() then
    raise exception 'only the admin can manage logins' using errcode = '42501';
  end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(login_email));
  if uid is null then
    return;
  end if;
  if uid = (select auth.uid()) then
    raise exception 'you cannot remove your own login' using errcode = '22023';
  end if;
  delete from public.ft_members where user_id = uid;
  delete from auth.sessions where user_id = uid;
end $$;

revoke all on function public.ft_is_admin() from public, anon;
revoke all on function public.ft_upsert_login(text, text, text) from public, anon, authenticated;
revoke all on function public.ft_admin_set_login(text, text, boolean) from public, anon;
revoke all on function public.ft_admin_remove_login(text) from public, anon;
grant execute on function public.ft_is_admin() to authenticated;
grant execute on function public.ft_admin_set_login(text, text, boolean) to authenticated;
grant execute on function public.ft_admin_remove_login(text) to authenticated;

notify pgrst, 'reload schema';
