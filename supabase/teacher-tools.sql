-- PROJECT SIKAP: teacher and head-teacher tools.
-- Run this WHOLE file once in the Supabase SQL Editor, after proposal-alignment.sql.
-- Safe to rerun. No resources, files or accounts are deleted.
--
--  1. Rejected status (not fixable), separate from Returned
--  2. Review assignment to another head teacher or a subject coordinator
--  3. Subject coordinators, head-teacher promotion (owner only), deactivation
--  4. Problem reports on resources
--  5. Sharing a resource with a colleague
--  6. Personal archive ("My archive")
--  7. Extra files (answer key, worksheet) attached to a resource
--  8. Collaboration ownership transfer and @mentions in comments
--  9. Announcements to all teachers
-- 10. Report export rows for head teachers

begin;

do $$ begin
 if to_regprocedure('public.bank_list_before_lrmds(jsonb,integer)') is null
    or to_regprocedure('public.collab_action(uuid,text,jsonb,integer)') is null then
  raise exception 'Apply this after collaboration.sql and proposal-alignment.sql.';
 end if;
end $$;

-- Statuses and roles ----------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_approval_status_check;
alter table public.profiles add constraint profiles_approval_status_check
 check(approval_status in ('pending','approved','rejected','deactivated'));
alter table public.profiles add column if not exists is_coordinator boolean not null default false;
alter table public.profiles add column if not exists deactivated_at timestamptz;

alter table public.modules drop constraint if exists modules_status_check;
alter table public.modules add constraint modules_status_check
 check(status in ('pending','returned','approved','rejected'));
alter table public.modules add column if not exists assigned_reviewer uuid references public.profiles;
alter table public.modules add column if not exists rejected_reason text not null default '' check(length(rejected_reason)<=3000);

-- A resource's reviewer: any head teacher, or the coordinator it is assigned to.
create or replace function sikap_private.can_review(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.is_approved() and (sikap_private.is_head() or exists(
  select 1 from public.modules m join public.profiles p on p.id=auth.uid()
  where m.id=mid and m.assigned_reviewer=auth.uid() and p.is_coordinator)) $$;

-- Assigned reviewers can open the resource they review.
create or replace function sikap_private.can_access(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.is_approved() and exists(select 1 from public.modules where id=mid and (owner=auth.uid() or sikap_private.is_head() or assigned_reviewer=auth.uid())) $$;
create or replace function sikap_private.bank_access(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.is_approved() and exists(select 1 from public.modules m where m.id=mid and m.bank_category is not null and (m.owner=auth.uid() or sikap_private.is_head() or m.assigned_reviewer=auth.uid() or (m.status='approved' and not m.archived and not m.bank_draft))) $$;

-- Review: one decision function for heads and assigned coordinators -----------
create or replace function public.bank_decide(mid uuid,expected_revision integer,decision text,feedback text,checks jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;k text;needs_revision boolean:=false;begin
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.owner=auth.uid() or not sikap_private.can_review(mid) then raise exception 'A different approved reviewer must review this resource';end if;
 if exists(select 1 from public.versions v cross join lateral jsonb_array_elements(v.contributor_credits) credit where v.module=mid and v.version=m.version and credit->>'id'=auth.uid()::text) then raise exception 'A reviewer who did not contribute must review this version';end if;
 if m.bank_draft or m.archived or m.status<>'pending' or m.revision is distinct from expected_revision then raise exception 'Resource changed. Refresh before reviewing.';end if;
 if decision is null or decision not in ('approved','returned') or length(coalesce(feedback,''))>5000 then raise exception 'Invalid review decision';end if;
 foreach k in array array['objectives','content','activities','assessment'] loop
  if checks->>k is null or checks->>k not in ('met','revise') then raise exception 'Complete each review checklist item';end if;
  if checks->>k='revise' then needs_revision:=true;end if;
 end loop;
 if decision='approved' and needs_revision then raise exception 'Resolve checklist items before approval';end if;
 if decision='returned' and (not needs_revision or length(trim(coalesce(feedback,'')))=0) then raise exception 'Mark an item for revision and write revision feedback';end if;
 if not exists(select 1 from public.versions v join storage.objects o on o.bucket_id='sikap-modules' and o.name=v.key where v.module=mid and v.version=m.version) then raise exception 'Resource file unavailable';end if;
 insert into public.module_reviews(module,version,reviewer,decision,checklist,feedback) values(mid,m.version,auth.uid(),decision,checks,trim(coalesce(feedback,'')));
 update public.modules set status=decision,revision=revision+1,updated=now(),approver=case when decision='approved' then auth.uid() end,approved=case when decision='approved' then now() end,final_version=case when decision='approved' then version end where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),case when decision='approved' then 'Approved' else 'Returned' end||' resource version '||m.version);
 insert into public.notifications(owner,module,body) values(m.owner,mid,m.title||case when decision='approved' then ' was approved.' else ' was returned for revision.' end);
end $$;

create or replace function public.bank_reject(mid uuid,expected_revision integer,reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.owner=auth.uid() or not sikap_private.can_review(mid) then raise exception 'A different approved reviewer must review this resource';end if;
 if m.bank_draft or m.archived or m.status<>'pending' or m.revision is distinct from expected_revision then raise exception 'Resource changed. Refresh before reviewing.';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 3000 then raise exception 'Write the reason for rejecting this resource';end if;
 update public.modules set status='rejected',rejected_reason=trim(reason),revision=revision+1,updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Rejected resource version '||m.version||': '||trim(reason));
 insert into public.notifications(owner,module,body) values(m.owner,mid,m.title||' was not accepted: '||left(trim(reason),200));
end $$;

create or replace function public.bank_assign(mid uuid,reviewer uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 if not sikap_private.is_head() then raise exception 'Only a head teacher can assign reviews';end if;
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.bank_draft or m.archived or m.status<>'pending' then raise exception 'Only resources waiting for review can be assigned';end if;
 if reviewer is not null and (reviewer=m.owner or not exists(select 1 from public.profiles where id=reviewer and approval_status='approved' and (role='head' or is_coordinator))) then raise exception 'Choose a head teacher or subject coordinator who is not the author';end if;
 update public.modules set assigned_reviewer=reviewer,updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),case when reviewer is null then 'Removed the review assignment' else 'Assigned the review to '||(select name from public.profiles where id=reviewer) end);
 if reviewer is not null and reviewer<>auth.uid() then insert into public.notifications(owner,module,body) values(reviewer,mid,'Review assigned to you: '||m.title);end if;
end $$;

-- Resources waiting for review that were assigned to the caller.
create or replace function public.bank_assigned() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'creator',m.bank_creator_name,'subject',m.subject,'grade',m.grade,'term',m.term,'updated',m.updated,'revision',m.revision) order by m.updated) from public.modules m where m.assigned_reviewer=auth.uid() and m.status='pending' and not m.bank_draft and not m.archived),'[]'::jsonb);
end $$;

-- Accounts ----------------------------------------------------------------------
-- Only the school owner may grant or remove the Head Teacher role. Any head may
-- name subject coordinators. Nobody can change their own role.
create or replace function public.set_account_role(uid uuid,new_role text,coordinator boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.profiles;caller public.profiles;begin
 select * into caller from public.profiles where id=auth.uid();
 if not sikap_private.is_head() then raise exception 'Only a head teacher can change roles';end if;
 select * into target from public.profiles where id=uid for update;
 if target.id is null or target.id=auth.uid() or target.is_owner or target.approval_status<>'approved' then raise exception 'This account''s role cannot be changed';end if;
 if new_role is null or new_role not in ('teacher','head') then raise exception 'Invalid role';end if;
 if new_role<>target.role and not caller.is_owner then raise exception 'Only the school owner can grant or remove the Head Teacher role';end if;
 update public.profiles set role=new_role,is_coordinator=coalesce(coordinator,false) and new_role='teacher' where id=uid;
 insert into public.account_reviews(account,reviewer,decision,note) values(uid,auth.uid(),'approved','Role set to '||new_role||case when coalesce(coordinator,false) and new_role='teacher' then ' (subject coordinator)' else '' end);
end $$;

create or replace function public.set_account_active(uid uuid,active boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.profiles;begin
 if not sikap_private.is_head() then raise exception 'Only a head teacher can deactivate accounts';end if;
 select * into target from public.profiles where id=uid for update;
 if target.id is null or target.id=auth.uid() or target.is_owner or target.role<>'teacher' then raise exception 'Only teacher accounts can be deactivated';end if;
 if active and target.approval_status<>'deactivated' or not active and target.approval_status<>'approved' then raise exception 'Account status changed. Refresh the list.';end if;
 update public.profiles set approval_status=case when active then 'approved' else 'deactivated' end,deactivated_at=case when active then null else now() end,is_coordinator=is_coordinator and active where id=uid;
 update public.modules set assigned_reviewer=null where assigned_reviewer=uid and not active;
 insert into public.account_reviews(account,reviewer,decision,note) values(uid,auth.uid(),'approved',case when active then 'Reactivated' else 'Deactivated' end);
end $$;

-- Problem reports ---------------------------------------------------------------
create table if not exists public.resource_reports(
 id uuid primary key default gen_random_uuid(),
 module uuid not null references public.modules on delete cascade,
 reporter uuid not null references public.profiles,
 reason text not null check(reason in ('Wrong or broken file','Error in the content','Wrong grade, subject or competency','Copyright concern','Other')),
 details text not null default '' check(length(details)<=2000),
 status text not null default 'open' check(status in ('open','resolved')),
 resolution text not null default '' check(length(resolution)<=2000),
 resolved_by uuid references public.profiles,
 created timestamptz not null default now(),
 resolved timestamptz);
alter table public.resource_reports enable row level security;
revoke all on public.resource_reports from public,anon,authenticated;

create or replace function public.bank_report(mid uuid,reason text,details text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 if not sikap_private.bank_access(mid) then raise exception 'Resource not found or access denied';end if;
 select * into m from public.modules where id=mid;
 if exists(select 1 from public.resource_reports where module=mid and reporter=auth.uid() and status='open') then raise exception 'You already reported this resource. A head teacher will look at it.';end if;
 insert into public.resource_reports(module,reporter,reason,details) values(mid,auth.uid(),reason,trim(coalesce(details,'')));
 perform sikap_private.notify_heads(mid,auth.uid(),'Problem reported on '||m.title||': '||reason);
exception when check_violation then raise exception 'Choose a listed reason and keep details under 2,000 characters';
end $$;

create or replace function public.report_list() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_head() then raise exception 'Head Teacher access required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'module',r.module,'title',m.title,'reason',r.reason,'details',r.details,'status',r.status,'resolution',r.resolution,'reporter',p.name,'created',r.created,'resolved',r.resolved) order by r.status='resolved',r.created desc) from public.resource_reports r join public.modules m on m.id=r.module join public.profiles p on p.id=r.reporter),'[]'::jsonb);
end $$;

create or replace function public.report_resolve(rid uuid,note text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.resource_reports;begin
 if not sikap_private.is_head() then raise exception 'Head Teacher access required';end if;
 update public.resource_reports set status='resolved',resolution=trim(coalesce(note,'')),resolved_by=auth.uid(),resolved=now() where id=rid and status='open' returning * into r;
 if r.id is null then raise exception 'Report already resolved. Refresh the list.';end if;
 insert into public.notifications(owner,module,body) values(r.reporter,r.module,'Your report was resolved'||case when length(r.resolution)>0 then ': '||left(r.resolution,200) else '.' end);
end $$;

-- Sharing ------------------------------------------------------------------------
create or replace function public.bank_share(mid uuid,recipient uuid,note text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 select * into m from public.modules where id=mid;
 if m.id is null or not sikap_private.bank_access(mid) or m.status<>'approved' or m.archived or m.bank_draft then raise exception 'Only resources in the Digital Bank can be shared';end if;
 if recipient=auth.uid() or not exists(select 1 from public.profiles where id=recipient and approval_status='approved') then raise exception 'Choose an approved colleague';end if;
 if length(coalesce(note,''))>300 then raise exception 'Keep the note under 300 characters';end if;
 insert into public.notifications(owner,module,body) values(recipient,mid,(select name from public.profiles where id=auth.uid())||' shared a resource with you: '||m.title||case when length(trim(coalesce(note,'')))>0 then ' ("'||trim(note)||'")' else '' end);
end $$;

create or replace function public.colleague_list() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'coordinator',p.is_coordinator) order by p.name) from public.profiles p where p.approval_status='approved' and p.id<>auth.uid()),'[]'::jsonb);
end $$;

-- My archive -------------------------------------------------------------------
create table if not exists public.hidden_resources(
 owner uuid not null default auth.uid() references public.profiles,
 module uuid not null references public.modules on delete cascade,
 created timestamptz not null default now(),
 primary key(owner,module));
alter table public.hidden_resources enable row level security;
revoke all on public.hidden_resources from public,anon,authenticated;
grant select,insert,delete on public.hidden_resources to authenticated;
drop policy if exists hidden_own on public.hidden_resources;
create policy hidden_own on public.hidden_resources for all to authenticated
 using(owner=auth.uid() and sikap_private.is_approved())
 with check(owner=auth.uid() and exists(select 1 from public.modules m where m.id=module and m.owner=auth.uid()));

do $$begin
 if to_regprocedure('public.bank_list_before_tools(jsonb,integer)') is null then alter function public.bank_list(jsonb,integer) rename to bank_list_before_tools;end if;
 if to_regprocedure('public.bank_details_before_tools(uuid)') is null then alter function public.bank_details(uuid) rename to bank_details_before_tools;end if;
end $$;
revoke all on function public.bank_list_before_tools(jsonb,integer),public.bank_details_before_tools(uuid) from public,anon,authenticated;

-- "mine" hides archived-by-me resources; "myarchive" shows only them.
create or replace function public.bank_list(filters jsonb default '{}',page_no integer default 1) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare scope text:=coalesce(filters->>'scope','shared');result jsonb;everything jsonb:='[]'::jsonb;n integer:=1;kept jsonb;begin
 if scope not in ('mine','myarchive') then return public.bank_list_before_tools(filters,page_no);end if;
 if page_no is null or page_no<1 or page_no>100000 then raise exception 'Invalid page';end if;
 loop
  result:=public.bank_list_before_tools(jsonb_set(filters,'{scope}','"mine"'),n);
  everything:=everything||(result->'items');
  exit when jsonb_array_length(result->'items')<25 or n>=60;
  n:=n+1;
 end loop;
 select coalesce(jsonb_agg(t.r order by t.ord),'[]'::jsonb) into kept from jsonb_array_elements(everything) with ordinality t(r,ord)
  where exists(select 1 from public.hidden_resources h where h.owner=auth.uid() and h.module=(t.r->>'id')::uuid)=(scope='myarchive');
 return jsonb_build_object('items',coalesce((select jsonb_agg(x.r order by x.ord) from jsonb_array_elements(kept) with ordinality x(r,ord) where x.ord>(page_no-1)*25 and x.ord<=page_no*25),'[]'::jsonb),'total',jsonb_array_length(kept),'page',page_no,'pageSize',25);
end $$;

-- Extra files --------------------------------------------------------------------
create table if not exists public.resource_attachments(
 id uuid primary key default gen_random_uuid(),
 module uuid not null references public.modules on delete cascade,
 key text not null unique, name text not null, type text not null,
 size bigint not null check(size between 1 and 20971520),
 label text not null check(label in ('Answer key','Worksheet','Rubric','Teacher guide','Other')),
 uploader uuid not null references public.profiles,
 created timestamptz not null default now());
alter table public.resource_attachments enable row level security;
revoke all on public.resource_attachments from public,anon,authenticated;

create or replace function public.bank_attach(mid uuid,object_key text,label text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;f public.bank_uploads;begin
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.owner<>auth.uid() or m.archived or not (m.bank_draft or m.status='returned') then raise exception 'Add extra files while the resource is a draft or returned for revision';end if;
 if (select count(*) from public.resource_attachments where module=mid)>=5 then raise exception 'A resource can have up to 5 extra files';end if;
 f:=sikap_private.bank_file(mid,object_key);
 insert into public.resource_attachments(module,key,name,type,size,label,uploader) values(mid,f.key,f.filename,f.mime,f.bytes,label,auth.uid());
 delete from public.bank_uploads where key=f.key;
 update public.modules set revision=revision+1,updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Added '||lower(label)||': '||f.filename);
exception when check_violation then raise exception 'Choose a listed file label';
end $$;

create or replace function public.bank_detach(aid uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.resource_attachments;m public.modules;begin
 select * into a from public.resource_attachments where id=aid;
 select * into m from public.modules where id=a.module for update;
 if a.id is null or m.owner<>auth.uid() or m.archived or not (m.bank_draft or m.status='returned') then raise exception 'Extra files can be removed while the resource is a draft or returned';end if;
 delete from public.resource_attachments where id=aid;
 update public.modules set revision=revision+1,updated=now() where id=m.id;
 insert into public.events(module,actor,body) values(m.id,auth.uid(),'Removed '||lower(a.label)||': '||a.name);
end $$;

create or replace function public.bank_details(mid uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 result:=public.bank_details_before_tools(mid);
 return result||jsonb_build_object(
  'attachments',coalesce((select jsonb_agg(to_jsonb(a)-'uploader' order by a.created) from public.resource_attachments a where a.module=mid),'[]'::jsonb),
  'hidden',exists(select 1 from public.hidden_resources h where h.owner=auth.uid() and h.module=mid),
  'canReview',sikap_private.can_review(mid),
  'reviewers',case when sikap_private.is_head() then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'coordinator',p.is_coordinator) order by p.name) from public.profiles p where p.approval_status='approved' and (p.role='head' or p.is_coordinator)),'[]'::jsonb) else '[]'::jsonb end);
end $$;

-- Attachment files are readable by anyone who can open the resource.
do $$begin
 if to_regprocedure('sikap_private.object_access_before_tools(text)') is null then
  alter function sikap_private.object_access(text) rename to object_access_before_tools;
 end if;
end $$;
create or replace function sikap_private.object_access(object_key text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.object_access_before_tools(object_key) or exists(select 1 from public.resource_attachments a where a.key=object_key and sikap_private.bank_access(a.module)) $$;
-- Rebind the read policy to the current function (policies keep the old one after a rename).
drop policy if exists sikap_read on storage.objects;
create policy sikap_read on storage.objects for select to authenticated using(bucket_id='sikap-modules' and sikap_private.object_access(name));

-- Collaboration: ownership transfer and @mentions ------------------------------
create or replace function public.collab_transfer(mid uuid,expected_revision integer,new_owner uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.archived or m.owner<>auth.uid() then raise exception 'Only the owner can transfer this resource';end if;
 if m.revision is distinct from expected_revision then raise exception 'Resource changed. Refresh before continuing.';end if;
 if not m.bank_draft and m.status='pending' then raise exception 'This resource is locked during review';end if;
 if not exists(select 1 from public.collab_members where module=mid and collab_members.teacher=new_owner and status='accepted') then raise exception 'Choose a member who accepted the invitation';end if;
 delete from public.collab_members where module=mid and collab_members.teacher=new_owner;
 insert into public.collab_members(module,teacher,status) values(mid,auth.uid(),'accepted') on conflict(module,teacher) do update set status='accepted';
 update public.modules set owner=new_owner,revision=revision+1,updated=now() where id=mid;
 delete from public.hidden_resources where module=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Transferred ownership to '||(select name from public.profiles where id=new_owner));
 insert into public.notifications(owner,module,body) values(new_owner,mid,'You are now the owner of '||m.title);
end $$;

create or replace function sikap_private.collab_mentions() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.notifications(owner,module,body)
 select p.id,new.module,(select name from public.profiles where id=new.author)||' mentioned you: '||left(new.body,160)
 from public.profiles p
 where p.id<>new.author and position(lower('@'||p.name) in lower(new.body))>0
  and (p.id=(select owner from public.modules where id=new.module) or exists(select 1 from public.collab_members c where c.module=new.module and c.teacher=p.id and c.status='accepted'));
 return new;
end $$;
drop trigger if exists collab_mentions on public.collab_comments;
create trigger collab_mentions after insert on public.collab_comments for each row execute function sikap_private.collab_mentions();
revoke all on function sikap_private.collab_mentions() from public,anon,authenticated;

-- Announcements ------------------------------------------------------------------
create table if not exists public.announcements(
 id uuid primary key default gen_random_uuid(),
 author uuid not null references public.profiles,
 title text not null check(length(trim(title)) between 1 and 160),
 body text not null default '' check(length(body)<=3000),
 expires date,
 created timestamptz not null default now());
alter table public.announcements enable row level security;
revoke all on public.announcements from public,anon,authenticated;

create or replace function public.announcement_list() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'body',a.body,'expires',a.expires,'created',a.created,'author',p.name) order by a.created desc) from public.announcements a join public.profiles p on p.id=a.author where a.expires is null or a.expires>=current_date),'[]'::jsonb);
end $$;
create or replace function public.announcement_post(title text,body text,expires date default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare aid uuid;begin
 if not sikap_private.is_head() then raise exception 'Only a head teacher can post announcements';end if;
 if expires is not null and expires<current_date then raise exception 'Choose an end date from today onward';end if;
 insert into public.announcements(author,title,body,expires) values(auth.uid(),trim(title),trim(coalesce(body,'')),expires) returning id into aid;
 return aid;
exception when check_violation then raise exception 'Write a title (up to 160 characters) and keep the message under 3,000 characters';
end $$;
create or replace function public.announcement_delete(aid uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_head() then raise exception 'Only a head teacher can remove announcements';end if;
 delete from public.announcements where id=aid;
end $$;

-- Report export ------------------------------------------------------------------
create or replace function public.report_rows() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_head() then raise exception 'Head Teacher access required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'title',m.title,'teacher',m.bank_creator_name,'subject',m.subject,'grade',m.grade,'term',m.term,'category',m.bank_category,
  'status',case when m.archived then 'archived' when m.status='pending' and m.version>1 then 'resubmitted' else m.status end,
  'version',m.version,'submitted',m.bank_submitted_at,'approved',m.approved,'approver',a.name,'updated',m.updated)
  order by m.bank_creator_name,m.subject,m.grade,m.title)
  from public.modules m left join public.profiles a on a.id=m.approver
  where m.bank_category is not null and not m.bank_draft),'[]'::jsonb);
end $$;

-- Permissions ---------------------------------------------------------------------
revoke all on function sikap_private.can_review(uuid) from public,anon,authenticated;
revoke all on function public.bank_decide(uuid,integer,text,text,jsonb),public.bank_reject(uuid,integer,text),public.bank_assign(uuid,uuid),public.bank_assigned(),
 public.set_account_role(uuid,text,boolean),public.set_account_active(uuid,boolean),public.bank_report(uuid,text,text),public.report_list(),public.report_resolve(uuid,text),
 public.bank_share(uuid,uuid,text),public.colleague_list(),public.bank_list(jsonb,integer),public.bank_attach(uuid,text,text),public.bank_detach(uuid),public.bank_details(uuid),
 public.collab_transfer(uuid,integer,uuid),public.announcement_list(),public.announcement_post(text,text,date),public.announcement_delete(uuid),public.report_rows() from public,anon;
grant execute on function public.bank_decide(uuid,integer,text,text,jsonb),public.bank_reject(uuid,integer,text),public.bank_assign(uuid,uuid),public.bank_assigned(),
 public.set_account_role(uuid,text,boolean),public.set_account_active(uuid,boolean),public.bank_report(uuid,text,text),public.report_list(),public.report_resolve(uuid,text),
 public.bank_share(uuid,uuid,text),public.colleague_list(),public.bank_list(jsonb,integer),public.bank_attach(uuid,text,text),public.bank_detach(uuid),public.bank_details(uuid),
 public.collab_transfer(uuid,integer,uuid),public.announcement_list(),public.announcement_post(text,text,date),public.announcement_delete(uuid),public.report_rows() to authenticated;
notify pgrst, 'reload schema';
commit;
