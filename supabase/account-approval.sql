-- Upgrade an existing Project Sikap database. Run after setup.sql; safe to rerun.
-- Existing Head Teachers remain approved. Other existing accounts require review.
begin;
alter table public.profiles add column if not exists approval_status text not null default 'pending' check(approval_status in ('pending','approved','rejected'));
alter table public.profiles add column if not exists requested_at timestamptz not null default now();
alter table public.profiles add column if not exists decided_at timestamptz;
alter table public.profiles add column if not exists decided_by uuid references public.profiles;
alter table public.profiles add column if not exists approval_note text not null default '' check(length(approval_note)<=2000);
update public.profiles set approval_status='approved' where role='head';

create table if not exists public.account_reviews(
 id uuid primary key default gen_random_uuid(),account uuid not null references public.profiles,
 reviewer uuid not null references public.profiles,decision text not null check(decision in ('approved','rejected')),
 note text not null default '' check(length(note)<=2000),created timestamptz not null default now());
alter table public.account_reviews enable row level security;
revoke all on public.account_reviews from public,anon,authenticated;

create or replace function sikap_private.is_approved() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and approval_status='approved') $$;
create or replace function sikap_private.is_head() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='head' and approval_status='approved') $$;
create or replace function sikap_private.can_access(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.is_approved() and exists(select 1 from public.modules where id=mid and (owner=auth.uid() or sikap_private.is_head())) $$;

-- A reusable gate also protects SECURITY DEFINER workflow functions (which bypass RLS).
create or replace function sikap_private.file_check(object_key text,filename text,mime text,bytes bigint) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'Head Teacher approval required';end if;
 if split_part(object_key,'/',1)<>auth.uid()::text or bytes not between 1 and 20971520 or length(filename) not between 1 and 240 or mime not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or lower(filename) !~ '\.(pdf|docx)$' then raise exception 'Invalid file';end if;
 if not exists(select 1 from storage.objects where bucket_id='sikap-modules' and name=object_key and owner_id=auth.uid()::text and (metadata->>'size')::bigint=bytes and metadata->>'mimetype'=mime) then raise exception 'Uploaded file could not be verified';end if;
end $$;
create or replace function public.archive_module(mid uuid,archive boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 if not sikap_private.is_approved() then raise exception 'Head Teacher approval required';end if;
 select * into m from public.modules where id=mid for update;
 if auth.uid() is null or m.owner is distinct from auth.uid() then raise exception 'Only the submitting teacher can archive';end if;
 if m.status='pending' and archive then raise exception 'Pending submissions must be reviewed first';end if;
 update public.modules set archived=archive,updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),case when archive then 'Archived module' else 'Restored module' end);
end $$;

create or replace function public.decide_account(uid uuid,decision text,note text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare applicant public.profiles;begin
 if not sikap_private.is_head() then raise exception 'Only an approved Head Teacher can review accounts';end if;
 if decision is null or decision not in ('approved','rejected') or length(coalesce(note,''))>2000 then raise exception 'Invalid account decision';end if;
 select * into applicant from public.profiles where id=uid for update;
 if applicant.id is null or applicant.id=auth.uid() or applicant.role<>'teacher' or applicant.is_owner or applicant.approval_status<>'pending' then raise exception 'This account is not awaiting approval. Refresh the list.';end if;
 if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'The user must confirm their email before approval';end if;
 update public.profiles set approval_status=decision,decided_at=now(),decided_by=auth.uid(),approval_note=trim(coalesce(note,'')) where id=uid;
 insert into public.account_reviews(account,reviewer,decision,note) values(uid,auth.uid(),decision,trim(coalesce(note,'')));
end $$;

create or replace function public.get_state() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if not sikap_private.is_approved() then
  return jsonb_build_object('user',(select to_jsonb(p)||jsonb_build_object('isOwner',p.is_owner) from public.profiles p where id=auth.uid()),'modules','[]'::jsonb,'notes','[]'::jsonb,'notifications','[]'::jsonb,'teachers','[]'::jsonb,'events','[]'::jsonb);
 end if;
 return jsonb_build_object(
 'user',(select to_jsonb(p)||jsonb_build_object('isOwner',p.is_owner) from public.profiles p where id=auth.uid()),
 'modules',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('teacher',p.name,'approverName',a.name,'file',v.name,'size',v.size,'type',v.type,'starred',exists(select 1 from public.stars s where s.module=m.id and s.owner=auth.uid())) order by m.updated desc) from public.modules m join public.profiles p on p.id=m.owner left join public.profiles a on a.id=m.approver join public.versions v on v.module=m.id and v.version=m.version where m.owner=auth.uid() or sikap_private.is_head()),'[]'),
 'notes',coalesce((select jsonb_agg(n order by n.pinned desc,n.updated desc) from public.notes n where owner=auth.uid()),'[]'),
 'notifications',coalesce((select jsonb_agg(n order by n.created desc) from public.notifications n where owner=auth.uid()),'[]'),
 'teachers',case when sikap_private.is_head() then coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('emailConfirmed',u.email_confirmed_at is not null) order by p.requested_at desc) from public.profiles p join auth.users u on u.id=p.id),'[]') else '[]'::jsonb end,
 'events',coalesce((select jsonb_agg(x) from (select e.*,p.name as "actorName",m.title from public.events e join public.modules m on m.id=e.module join public.profiles p on p.id=e.actor where m.owner=auth.uid() or sikap_private.is_head() order by e.created desc limit 30)x),'[]'));
end $$;

-- No browser client can grant Head Teacher roles, even the owner. Provision them in SQL.
revoke execute on function public.change_role(uuid,text) from public,anon,authenticated;
revoke all on function public.decide_account(uuid,text,text) from public,anon;
grant execute on function public.decide_account(uuid,text,text) to authenticated;
revoke all on function sikap_private.is_approved() from public,anon;
grant execute on function sikap_private.is_approved() to authenticated;
revoke all on function sikap_private.file_check(text,text,text,bigint) from public,anon,authenticated;

drop policy if exists modules_read on public.modules;
create policy modules_read on public.modules for select to authenticated using(sikap_private.is_approved() and (owner=auth.uid() or sikap_private.is_head()));
drop policy if exists notes_own on public.notes;
create policy notes_own on public.notes for all to authenticated using(owner=auth.uid() and sikap_private.is_approved()) with check(owner=auth.uid() and sikap_private.is_approved());
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using(owner=auth.uid() and sikap_private.is_approved());
drop policy if exists notifications_mark on public.notifications;
create policy notifications_mark on public.notifications for update to authenticated using(owner=auth.uid() and sikap_private.is_approved()) with check(owner=auth.uid() and sikap_private.is_approved());
drop policy if exists stars_own on public.stars;
create policy stars_own on public.stars for all to authenticated using(owner=auth.uid() and sikap_private.is_approved()) with check(owner=auth.uid() and sikap_private.can_access(module));
drop policy if exists sikap_upload on storage.objects;
create policy sikap_upload on storage.objects for insert to authenticated with check(sikap_private.is_approved() and bucket_id='sikap-modules' and split_part(name,'/',1)=auth.uid()::text and lower(name) ~ '\.(pdf|docx)$');
commit;
