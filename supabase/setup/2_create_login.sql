-- FreshTrack, step 2 of 2: the business login every phone signs in with once.
--
-- Run this AFTER step 1 (supabase/migrations/20261012000000_freshtrack_app_sync.sql).
-- 1. Put your own password on the login_password line below (8+ characters).
-- 2. Run it in the Supabase SQL Editor.
-- 3. Do not save this file with the password in it.
--
-- Safe to run again: it then just sets the new password.

do $$
declare
  login_email    text := 'somil.agarwal2006@gmail.com';
  login_password text := 'PUT-YOUR-PASSWORD-HERE';   -- <== change this
  uid uuid;
begin
  if login_password = 'PUT-YOUR-PASSWORD-HERE' or length(login_password) < 8 then
    raise exception 'First put your own password (8 or more characters) on the login_password line';
  end if;

  select id into uid from auth.users where lower(email) = lower(login_email);

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', login_email,
      extensions.crypt(login_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', login_email, 'email_verified', true),
            'email', now(), now(), now());
  else
    update auth.users
       set encrypted_password = extensions.crypt(login_password, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = uid;
  end if;

  -- Only accounts listed here can see or change FreshTrack data.
  insert into public.ft_members (user_id, role) values (uid, 'owner') on conflict (user_id) do nothing;
end $$;

-- Should show one row with your email.
select u.email, m.role from public.ft_members m join auth.users u on u.id = m.user_id;
