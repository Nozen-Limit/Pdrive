-- Run after setup.sql and account-approval.sql. Safe to rerun.
begin;
create or replace function public.send_module_alert(mid uuid,message text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;
begin
 if not sikap_private.is_head() then raise exception 'Only an approved Head Teacher can send alerts';end if;
 if message is null or length(trim(message)) not between 1 and 2000 then raise exception 'Enter an alert of 1 to 2000 characters';end if;
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.archived or m.owner=auth.uid() then raise exception 'Choose an active module submitted by another teacher';end if;
 insert into public.notifications(owner,module,body) values(m.owner,mid,'Head Teacher alert: '||trim(message));
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Sent alert: '||trim(message));
end $$;
revoke all on function public.send_module_alert(uuid,text) from public,anon;
grant execute on function public.send_module_alert(uuid,text) to authenticated;
commit;
