-- Additive school workflow upgrade. Run after account-approval.sql.
begin;
create table if not exists public.requirements(
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 200),
 subject text not null check(length(trim(subject)) between 1 and 200),grade text not null check(length(trim(grade)) between 1 and 200),
 term text not null check(length(trim(term)) between 1 and 200),year text not null check(length(trim(year)) between 1 and 200),
 instructions text not null default '' check(length(instructions)<=3000),due_at timestamptz not null,
 created_by uuid not null references public.profiles,created timestamptz not null default now(),cancelled boolean not null default false,revision integer not null default 1);
create table if not exists public.requirement_teachers(requirement uuid references public.requirements,teacher uuid references public.profiles,primary key(requirement,teacher));
create table if not exists public.requirement_events(id uuid primary key default gen_random_uuid(),requirement uuid not null references public.requirements,actor uuid not null references public.profiles,body text not null,created timestamptz not null default now());
alter table public.modules add column if not exists requirement_id uuid references public.requirements;
create unique index if not exists one_requirement_submission on public.modules(requirement_id,owner) where requirement_id is not null;
alter table public.notifications alter column module drop not null;
alter table public.notifications add column if not exists requirement_id uuid references public.requirements;
create table if not exists public.module_reviews(id uuid primary key default gen_random_uuid(),module uuid not null references public.modules,version integer not null,reviewer uuid not null references public.profiles,decision text not null check(decision in ('approved','returned')),checklist jsonb not null,feedback text not null,created timestamptz not null default now(),unique(module,version));
alter table public.requirements enable row level security;
alter table public.requirement_teachers enable row level security;
alter table public.requirement_events enable row level security;
alter table public.module_reviews enable row level security;
revoke all on public.requirements,public.requirement_teachers,public.requirement_events,public.module_reviews from public,anon,authenticated;
-- Only RPCs expose these records, with explicit identity checks.
create or replace function public.create_requirement(details jsonb,teacher_ids uuid[]) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;begin
 if not sikap_private.is_head() then raise exception 'Only a Head Teacher can set requirements';end if;
 if teacher_ids is null or cardinality(teacher_ids)=0 or cardinality(teacher_ids)>500 then raise exception 'Select 1 to 500 teachers';end if;
 if (details->>'due_at')::timestamptz is null or (details->>'due_at')::timestamptz<=now() then raise exception 'Choose a future deadline';end if;
 if exists(select 1 from unnest(teacher_ids) t(id) left join public.profiles p on p.id=t.id where p.id is null or p.role<>'teacher' or p.approval_status<>'approved') then raise exception 'Choose approved Teacher accounts only';end if;
 insert into public.requirements(title,subject,grade,term,year,instructions,due_at,created_by) values(trim(details->>'title'),trim(details->>'subject'),trim(details->>'grade'),trim(details->>'term'),trim(details->>'year'),coalesce(details->>'instructions',''),(details->>'due_at')::timestamptz,auth.uid()) returning id into rid;
 insert into public.requirement_teachers select rid,id from (select distinct unnest(teacher_ids) id) t;
 insert into public.requirement_events(requirement,actor,body) values(rid,auth.uid(),'Created requirement');
 insert into public.notifications(owner,requirement_id,body) select teacher,rid,'New requirement: '||(details->>'title') from public.requirement_teachers where requirement=rid;
 return rid;end $$;
create or replace function public.update_requirement(rid uuid,expected_revision integer,new_due timestamptz,cancel boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.requirements;begin
 if not sikap_private.is_head() then raise exception 'Only a Head Teacher can change requirements';end if;
 select * into r from public.requirements where id=rid for update;
 if r.id is null or r.cancelled or r.revision is distinct from expected_revision then raise exception 'Requirement changed. Refresh the list';end if;
 if cancel is null or (not cancel and (new_due is null or new_due<=now())) then raise exception 'Choose a future deadline';end if;
 update public.requirements set due_at=case when cancel then due_at else new_due end,cancelled=cancel,revision=revision+1 where id=rid;
 insert into public.requirement_events(requirement,actor,body) values(rid,auth.uid(),case when cancel then 'Cancelled requirement' else 'Changed deadline from '||r.due_at::text||' to '||new_due::text end);
 insert into public.notifications(owner,requirement_id,body) select teacher,rid,case when cancel then 'Cancelled requirement: ' else 'Deadline changed: ' end||r.title from public.requirement_teachers where requirement=rid;
 end $$;
-- Preserve the original transactional upload/review implementations privately.
do $$begin
 if to_regprocedure('sikap_private.workflow_submit_base(uuid,jsonb,text,text,text,bigint)') is null then
  alter function public.submit_module(uuid,jsonb,text,text,text,bigint) set schema sikap_private;
  alter function sikap_private.submit_module(uuid,jsonb,text,text,text,bigint) rename to workflow_submit_base;
 end if;
 if to_regprocedure('sikap_private.workflow_review_base(uuid,integer,text,text)') is null then
  alter function public.review_module(uuid,integer,text,text) set schema sikap_private;
  alter function sikap_private.review_module(uuid,integer,text,text) rename to workflow_review_base;
 end if;
end $$;
revoke all on function sikap_private.workflow_submit_base(uuid,jsonb,text,text,text,bigint),sikap_private.workflow_review_base(uuid,integer,text,text) from public,anon,authenticated;
create or replace function public.submit_module(mid uuid,details jsonb,object_key text,filename text,mime text,bytes bigint) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.requirements;rid uuid:=nullif(details->>'requirement_id','')::uuid;begin
 if not sikap_private.is_approved() or not exists(select 1 from public.profiles where id=auth.uid() and role='teacher') then raise exception 'Only an approved Teacher can submit modules';end if;
 if rid is not null then
  select * into r from public.requirements where id=rid for update;
  if r.id is null or r.cancelled or not exists(select 1 from public.requirement_teachers where requirement=rid and teacher=auth.uid()) then raise exception 'This requirement is unavailable';end if;
  if exists(select 1 from public.modules where requirement_id=rid and owner=auth.uid()) then raise exception 'Already submitted. Open the existing module to revise it';end if;
  -- The requirement owns classification; the browser cannot substitute it.
  details:=details||jsonb_build_object('subject',r.subject,'grade',r.grade,'term',r.term,'year',r.year,'deadline',null);
 else details:=details||jsonb_build_object('deadline',null);end if;
 perform sikap_private.workflow_submit_base(mid,details,object_key,filename,mime,bytes);
 update public.modules set requirement_id=rid where id=mid;
 return mid;end $$;
-- Legacy callers must supply a checklist through the new RPC; no approval bypass.
create or replace function public.review_module(mid uuid,expected_revision integer,decision text,feedback text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'Use the review checklist before making a decision';end $$;
create or replace function public.review_module_checked(mid uuid,expected_revision integer,decision text,feedback text,checks jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;k text;needs_revision boolean:=false;begin
 if not sikap_private.is_head() then raise exception 'Only an approved Head Teacher can review';end if;
 if decision is null or decision not in ('approved','returned') then raise exception 'Invalid decision';end if;
 if checks is null or jsonb_typeof(checks)<>'object' then raise exception 'Complete the review checklist';end if;
 foreach k in array array['objectives','content','activities','assessment'] loop
  if checks->>k is null or checks->>k not in ('met','revise') then raise exception 'Complete each checklist item';end if;
  if checks->>k='revise' then needs_revision:=true;end if;
 end loop;
 if decision='approved' and needs_revision then raise exception 'Resolve checklist items before approval';end if;
 if decision='returned' and (not needs_revision or length(trim(coalesce(feedback,'')))=0) then raise exception 'Mark what needs revision and explain the required changes';end if;
 select * into m from public.modules where id=mid for update;
 if m.id is null or expected_revision is null then raise exception 'Module unavailable';end if;
 perform sikap_private.workflow_review_base(mid,expected_revision,decision,feedback);
 insert into public.module_reviews(module,version,reviewer,decision,checklist,feedback) values(mid,m.version,auth.uid(),decision,jsonb_build_object('objectives',checks->>'objectives','content',checks->>'content','activities',checks->>'activities','assessment',checks->>'assessment'),coalesce(trim(feedback),''));
 end $$;
create or replace function public.get_workflow_state() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then return jsonb_build_object('requirements','[]'::jsonb,'assignments','[]'::jsonb,'requirementEvents','[]'::jsonb,'reviews','[]'::jsonb);end if;
 return jsonb_build_object(
 'requirements',coalesce((select jsonb_agg(r order by due_at) from public.requirements r where sikap_private.is_head() or exists(select 1 from public.requirement_teachers a where a.requirement=r.id and a.teacher=auth.uid())),'[]'::jsonb),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('requirement_id',a.requirement,'teacher_id',a.teacher,'teacher',p.name,'module_id',m.id,'status',coalesce(m.status,'missing'),'submitted_at',m.created,'late',coalesce(m.created>r.due_at,false),'overdue',not r.cancelled and now()>r.due_at and (m.id is null or m.status='returned'))) from public.requirement_teachers a join public.requirements r on r.id=a.requirement join public.profiles p on p.id=a.teacher left join public.modules m on m.requirement_id=a.requirement and m.owner=a.teacher where sikap_private.is_head() or a.teacher=auth.uid()),'[]'::jsonb),
 'requirementEvents',coalesce((select jsonb_agg(e order by e.created desc) from public.requirement_events e where sikap_private.is_head() or exists(select 1 from public.requirement_teachers a where a.requirement=e.requirement and a.teacher=auth.uid())),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('reviewerName',p.name) order by r.created desc) from public.module_reviews r join public.profiles p on p.id=r.reviewer where sikap_private.can_access(r.module)),'[]'::jsonb));
end $$;
revoke all on function public.create_requirement(jsonb,uuid[]),public.update_requirement(uuid,integer,timestamptz,boolean),public.get_workflow_state(),public.review_module_checked(uuid,integer,text,text,jsonb),public.submit_module(uuid,jsonb,text,text,text,bigint),public.review_module(uuid,integer,text,text) from public,anon;
grant execute on function public.create_requirement(jsonb,uuid[]),public.update_requirement(uuid,integer,timestamptz,boolean),public.get_workflow_state(),public.review_module_checked(uuid,integer,text,text,jsonb),public.submit_module(uuid,jsonb,text,text,text,bigint),public.review_module(uuid,integer,text,text) to authenticated;
commit;
