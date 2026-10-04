-- FIRST sign up and confirm YOUR account in Project Sikap.
-- Replace the email below, then run this in Supabase SQL Editor (never in browser code).
do $$
declare owner_id uuid;
begin
 select id into owner_id from auth.users where lower(email)=lower('REPLACE_WITH_YOUR_EMAIL') and email_confirmed_at is not null;
 if owner_id is null then raise exception 'Sign up and confirm this email before assigning the owner';end if;
 if exists(select 1 from public.profiles where is_owner and id<>owner_id) then raise exception 'An owner is already configured';end if;
 update public.profiles set role='head',is_owner=true,approval_status='approved' where id=owner_id;
end $$;
