-- PROJECT SIKAP: reviewed curriculum catalog (existing database upgrade).
-- Run this WHOLE file in the Supabase SQL Editor as the project administrator.
-- Prerequisite: the existing setup/account approval/school workflow/Digital Bank.
-- Do NOT rerun setup.sql. This file preserves resources, approvals and files.
-- No demonstration competencies are inserted. Import official entries as DRAFT,
-- then have a qualified Head Teacher check their source and verify them.
-- Strict enforcement starts OFF to keep the current upload form working.
-- Enable it ONLY after the new form is deployed and verified entries exist:
-- UPDATE public.curriculum_settings SET enforce_catalog = true WHERE singleton;

begin;

do $$ begin
 if to_regclass('public.modules') is null or to_regclass('public.versions') is null
    or to_regprocedure('public.bank_save(uuid,jsonb,integer,text,boolean)') is null
    or to_regprocedure('sikap_private.is_head()') is null then
  raise exception 'Apply this to the existing Project SIKAP Digital Bank database. Do not rerun setup.sql.';
 end if;
end $$;

create table if not exists public.curriculum_learning_areas (
 name text primary key,
 sort_order integer not null unique
);
-- Canonical learning-area names; keep departmental labels separate.
insert into public.curriculum_learning_areas(name,sort_order) values
 ('Araling Panlipunan',1),('English',2),('Filipino',3),('Mathematics',4),
 ('Science',5),('Technology and Livelihood Education',6),
 ('Music and Arts',7),('Physical Education and Health',8),('Values Education',9)
on conflict do nothing;

create table if not exists public.curriculum_settings (
 singleton boolean primary key default true check(singleton),
 enforce_catalog boolean not null default false
);
insert into public.curriculum_settings(singleton,enforce_catalog)
 values(true,false) on conflict(singleton) do nothing;

create table if not exists public.curriculum_competencies (
 id uuid primary key default gen_random_uuid(),
 learning_area text not null references public.curriculum_learning_areas(name),
 grade text not null check(grade in ('Grade 7','Grade 8','Grade 9','Grade 10')),
 -- NULL means the guide does not assign a quarter. Never guess its quarter.
 quarter text check(quarter in ('Quarter 1','Quarter 2','Quarter 3','Quarter 4')),
 official_code text check(official_code is null or length(trim(official_code)) between 1 and 120),
 competency_text text not null check(length(trim(competency_text)) between 1 and 3000),
 curriculum_version text not null check(length(trim(curriculum_version)) between 1 and 200),
 source_title text not null check(length(trim(source_title)) between 1 and 300),
 source_url text not null check(length(source_url)<=2000 and source_url ~ '^https://[^[:space:]]+$'),
 source_page text not null check(length(trim(source_page)) between 1 and 60),
 status text not null default 'draft' check(status in ('draft','verified','retired')),
 imported_by uuid references public.profiles(id),
 verified_by uuid references public.profiles(id),
 verified_at timestamptz,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status<>'verified' or (verified_by is not null and verified_at is not null))
);
create unique index if not exists curriculum_competency_source_unique
 on public.curriculum_competencies (
  md5(source_url||chr(31)||source_page||chr(31)||curriculum_version||chr(31)||
      learning_area||chr(31)||grade||chr(31)||coalesce(quarter,'')||chr(31)||
      coalesce(official_code,'')||chr(31)||competency_text)
 );
create index if not exists curriculum_verified_filter
 on public.curriculum_competencies(grade,learning_area,quarter) where status='verified';

create table if not exists public.curriculum_competency_reviews (
 id uuid primary key default gen_random_uuid(),
 competency_id uuid not null references public.curriculum_competencies(id),
 reviewer uuid not null references public.profiles(id),
 decision text not null check(decision in ('draft','verified','retired')),
 note text not null check(length(trim(note)) between 1 and 2000),
 created_at timestamptz not null default now()
);

alter table public.modules
 add column if not exists bank_competency_id uuid references public.curriculum_competencies(id),
 add column if not exists bank_competency_code text,
 add column if not exists bank_curriculum_version text,
 add column if not exists bank_competency_source jsonb,
 add column if not exists bank_competency_legacy boolean not null default true;
create index if not exists bank_competency_coverage on public.modules(bank_competency_id)
 where status='approved' and not archived and not bank_draft;
create index if not exists bank_legacy_filter on public.modules(bank_competency_legacy)
 where bank_category is not null;

-- Old file versions are left legacy. Do not invent their historical mapping.
alter table public.versions
 add column if not exists bank_competency_id uuid references public.curriculum_competencies(id),
 add column if not exists bank_competency_code text,
 add column if not exists bank_competency_text text,
 add column if not exists bank_curriculum_version text,
 add column if not exists bank_competency_source jsonb,
 add column if not exists bank_learning_area text,
 add column if not exists bank_grade text,
 add column if not exists bank_quarter text,
 add column if not exists bank_competency_legacy boolean not null default true;

alter table public.curriculum_learning_areas enable row level security;
alter table public.curriculum_settings enable row level security;
alter table public.curriculum_competencies enable row level security;
alter table public.curriculum_competency_reviews enable row level security;
revoke all on public.curriculum_learning_areas,public.curriculum_settings,
 public.curriculum_competencies,public.curriculum_competency_reviews from public,anon,authenticated;
grant select on public.curriculum_learning_areas,public.curriculum_settings,
 public.curriculum_competencies,public.curriculum_competency_reviews to authenticated;

drop policy if exists curriculum_areas_read on public.curriculum_learning_areas;
create policy curriculum_areas_read on public.curriculum_learning_areas for select
 to authenticated using(sikap_private.is_approved());
drop policy if exists curriculum_settings_read on public.curriculum_settings;
create policy curriculum_settings_read on public.curriculum_settings for select
 to authenticated using(sikap_private.is_approved());
drop policy if exists curriculum_entries_read on public.curriculum_competencies;
create policy curriculum_entries_read on public.curriculum_competencies for select
 to authenticated using(sikap_private.is_approved() and (status='verified' or sikap_private.is_head()));
drop policy if exists curriculum_reviews_read on public.curriculum_competency_reviews;
create policy curriculum_reviews_read on public.curriculum_competency_reviews for select
 to authenticated using(sikap_private.is_head());

-- Canonicalize selection on the server. Never trust submitted wording or codes.
create or replace function sikap_private.curriculum_metadata(d jsonb)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.curriculum_competencies;strict_mode boolean;begin
 select enforce_catalog into strict_mode from public.curriculum_settings where singleton;
 if d is null or jsonb_typeof(d)<>'object' then raise exception 'Choose valid resource metadata';end if;
 if nullif(d->>'competency_id','') is null then
  if strict_mode then raise exception 'Choose a verified learning competency for this grade and learning area';end if;
  -- Backward compatibility ONLY while the new form is being deployed.
  return d||jsonb_build_object('competency_id',null,'competency_code',null,
    'curriculum_version',null,'competency_source',null);
 end if;
 if (d->>'competency_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then raise exception 'Choose a valid learning competency';end if;
 select * into c from public.curriculum_competencies
  where id=(d->>'competency_id')::uuid and status='verified' for share;
 if c.id is null then raise exception 'This competency is not verified or is no longer available';end if;
 if c.grade is distinct from d->>'grade' or c.learning_area is distinct from d->>'subject'
    or (c.quarter is not null and c.quarter is distinct from d->>'term') then
  raise exception 'Competency does not match the selected grade, learning area and quarter';end if;
 return d||jsonb_build_object('competency_id',c.id,'competency',c.competency_text,
  'competency_code',c.official_code,'curriculum_version',c.curriculum_version,
  'competency_source',jsonb_build_object('title',c.source_title,'url',c.source_url,'page',c.source_page));
end $$;

create or replace function sikap_private.curriculum_guard_module()
 returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare d jsonb;begin
 if new.bank_category is null then return new;end if;
 if tg_op='UPDATE' then
  if row(new.subject,new.grade,new.term,new.bank_competency_id,new.bank_competency,
    new.bank_competency_code,new.bank_curriculum_version,new.bank_competency_source,new.bank_competency_legacy,new.bank_category)
   is not distinct from row(old.subject,old.grade,old.term,old.bank_competency_id,old.bank_competency,
    old.bank_competency_code,old.bank_curriculum_version,old.bank_competency_source,old.bank_competency_legacy,old.bank_category)
   then return new;end if;
 end if;
 d:=sikap_private.curriculum_metadata(jsonb_build_object('subject',new.subject,'grade',new.grade,
   'term',new.term,'competency_id',new.bank_competency_id,'competency',new.bank_competency));
 new.bank_competency_id:=nullif(d->>'competency_id','')::uuid;
 new.bank_competency:=d->>'competency';
 new.bank_competency_code:=d->>'competency_code';
 new.bank_curriculum_version:=d->>'curriculum_version';
 new.bank_competency_source:=nullif(d->'competency_source','null'::jsonb);
 new.bank_competency_legacy:=new.bank_competency_id is null;
 return new;
end $$;
drop trigger if exists bank_curriculum_guard on public.modules;
create trigger bank_curriculum_guard before insert or update on public.modules
 for each row execute function sikap_private.curriculum_guard_module();

create or replace function sikap_private.curriculum_version_snapshot()
 returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;strict_mode boolean;begin
 select * into m from public.modules where id=new.module;
 if m.bank_category is null then return new;end if;
 select enforce_catalog into strict_mode from public.curriculum_settings where singleton;
 if strict_mode and m.bank_competency_id is null then
  raise exception 'Map this legacy resource to a verified competency before submitting a new version';end if;
 if m.bank_competency_id is not null then
  perform sikap_private.curriculum_metadata(jsonb_build_object('subject',m.subject,'grade',m.grade,
   'term',m.term,'competency_id',m.bank_competency_id));
 end if;
 new.bank_competency_id:=m.bank_competency_id;new.bank_competency_code:=m.bank_competency_code;
 new.bank_competency_text:=m.bank_competency;new.bank_curriculum_version:=m.bank_curriculum_version;
 new.bank_competency_source:=m.bank_competency_source;new.bank_learning_area:=m.subject;
 new.bank_grade:=m.grade;new.bank_quarter:=m.term;new.bank_competency_legacy:=m.bank_competency_legacy;
 return new;
end $$;
drop trigger if exists bank_curriculum_version_snapshot on public.versions;
create trigger bank_curriculum_version_snapshot before insert on public.versions
 for each row execute function sikap_private.curriculum_version_snapshot();

create or replace function public.bank_curriculum()
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 return jsonb_build_object('enforced',(select enforce_catalog from public.curriculum_settings where singleton),
  'learning_areas',(select jsonb_agg(name order by sort_order) from public.curriculum_learning_areas),
  'verified_count',(select count(*) from public.curriculum_competencies where status='verified'));
end $$;

create or replace function public.bank_competency_list(filters jsonb default '{}',page_no integer default 1)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 if filters is null or jsonb_typeof(filters)<>'object' or page_no is null or page_no<1 or page_no>100000
  then raise exception 'Invalid competency filters';end if;
 with matched as (
  select c.* from public.curriculum_competencies c
  where (c.status='verified' or sikap_private.is_head())
   and (coalesce(filters->>'status','')='' or c.status=filters->>'status')
   and (coalesce(filters->>'grade','')='' or c.grade=filters->>'grade')
   and (coalesce(filters->>'subject','')='' or c.learning_area=filters->>'subject')
   and (coalesce(filters->>'term','')='' or c.quarter is null or c.quarter=filters->>'term')
   and (coalesce(filters->>'q','')='' or position(lower(left(filters->>'q',300)) in
    lower(coalesce(c.official_code,'')||' '||c.competency_text))>0)
 ), paged as (select * from matched order by grade,learning_area,quarter nulls first,
  official_code nulls last,competency_text,id limit 50 offset (page_no-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(p) from paged p),'[]'::jsonb),
  'total',(select count(*) from matched),'page',page_no,'pageSize',50) into result;
 return result;
end $$;

create or replace function public.bank_competency_import(entries jsonb)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;affected integer;added integer:=0;begin
 if not sikap_private.is_head() then raise exception 'Only an approved Head Teacher can import competencies';end if;
 if entries is null or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries) not between 1 and 500
    or octet_length(entries::text)>3000000 then raise exception 'Import 1 to 500 competency entries at a time';end if;
 for item in select value from jsonb_array_elements(entries) loop
  if jsonb_typeof(item)<>'object' then raise exception 'Each competency must be an object';end if;
  insert into public.curriculum_competencies(learning_area,grade,quarter,official_code,competency_text,
   curriculum_version,source_title,source_url,source_page,imported_by)
  values(trim(item->>'learning_area'),trim(item->>'grade'),nullif(trim(item->>'quarter'),''),
   nullif(trim(item->>'official_code'),''),trim(item->>'competency_text'),trim(item->>'curriculum_version'),
   trim(item->>'source_title'),trim(item->>'source_url'),trim(item->>'source_page'),auth.uid())
  on conflict do nothing;
  get diagnostics affected=row_count;added:=added+affected;
 end loop;
 return jsonb_build_object('imported',added,'duplicates',jsonb_array_length(entries)-added,'status','draft');
end $$;

create or replace function public.bank_competency_review(cid uuid,expected_revision integer,
 decision text,note text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.curriculum_competencies;begin
 if not sikap_private.is_head() then raise exception 'Only an approved Head Teacher can verify competencies';end if;
 if decision is null or decision not in ('draft','verified','retired') or
   coalesce(length(trim(note)),0) not between 1 and 2000 then raise exception 'Choose a status and write the source verification note';end if;
 select * into c from public.curriculum_competencies where id=cid for update;
 if c.id is null or c.revision is distinct from expected_revision then raise exception 'Competency changed. Refresh before reviewing.';end if;
 update public.curriculum_competencies set status=decision,
  verified_by=case when decision='verified' then auth.uid() end,
  verified_at=case when decision='verified' then now() end,
  revision=revision+1,updated_at=now() where id=cid;
 insert into public.curriculum_competency_reviews(competency_id,reviewer,decision,note)
  values(cid,auth.uid(),decision,trim(note));
end $$;

create or replace function public.bank_competency_coverage()
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_head() then raise exception 'Only a Head Teacher can view competency coverage';end if;
 return (with coverage as (
  select c.id,c.learning_area,c.grade,c.quarter,count(m.id) as approved_resources
  from public.curriculum_competencies c left join public.modules m on m.bank_competency_id=c.id
   and m.bank_category is not null and not m.bank_draft and not m.archived and m.status='approved'
  where c.status='verified' group by c.id,c.learning_area,c.grade,c.quarter
 ) select jsonb_build_object('verified_competencies',count(*),
  'without_approved_resource',count(*) filter(where approved_resources=0),
  'catalog_empty',count(*)=0,'items',coalesce(jsonb_agg(coverage order by grade,learning_area,id),'[]'::jsonb)) from coverage);
end $$;

-- Resource API replacements are appended below. They preserve the existing
-- checklist, approval, file verification, 20 MB PDF/DOCX rules and downloads.

create or replace function public.bank_save(mid uuid,d jsonb,expected_revision integer default null,object_key text default null,submit boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;f public.bank_uploads;new_item boolean;begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 d:=sikap_private.curriculum_metadata(d);
 perform sikap_private.bank_metadata(d);
 select * into m from public.modules where id=mid for update;
 new_item:=m.id is null;
 if not new_item and (m.bank_category is null or m.owner<>auth.uid() or not m.bank_draft or m.revision is distinct from expected_revision) then raise exception 'Only your current draft can be saved here';end if;
 if submit then f:=sikap_private.bank_file(mid,object_key);end if;
 if new_item then
  insert into public.modules(id,owner,title,subject,grade,term,year,bank_category,bank_creator_name,bank_draft,bank_competency,bank_competency_id) values(mid,auth.uid(),trim(d->>'title'),trim(d->>'subject'),d->>'grade',d->>'term',extract(year from now())::text,d->>'category',(select name from public.profiles where id=auth.uid()),true,trim(d->>'competency'),nullif(d->>'competency_id','')::uuid);
 end if;
 update public.modules set title=trim(d->>'title'),subject=trim(d->>'subject'),grade=d->>'grade',term=d->>'term',bank_category=d->>'category',bank_description=trim(d->>'description'),bank_competency=trim(d->>'competency'),bank_competency_id=nullif(d->>'competency_id','')::uuid,bank_competency_code=d->>'competency_code',bank_curriculum_version=d->>'curriculum_version',bank_competency_source=nullif(d->'competency_source','null'::jsonb),bank_competency_legacy=nullif(d->>'competency_id','') is null,bank_localization=trim(d->>'localization'),bank_tags=array(select jsonb_array_elements_text(d->'tags')),bank_source=coalesce(d->>'source',''),bank_notes=coalesce(d->>'notes',''),bank_draft=not submit,bank_submitted_at=case when submit then now() else bank_submitted_at end,revision=revision+1,updated=now() where id=mid;
 if submit then
  insert into public.versions(module,version,key,name,type,size,changes) values(mid,1,f.key,f.filename,f.mime,f.bytes,'Initial resource submission');
  delete from public.bank_uploads where key=f.key;
  perform sikap_private.notify_heads(mid,auth.uid(),(select name from public.profiles where id=auth.uid())||' submitted a resource: '||trim(d->>'title'));
  insert into public.notifications(owner,module,body) values(auth.uid(),mid,'Resource submitted: '||trim(d->>'title'));
 end if;
 insert into public.events(module,actor,body) values(mid,auth.uid(),case when submit then 'Submitted resource version 1' else 'Saved resource draft' end);
 return mid;
end $$;

create or replace function public.bank_edit(mid uuid,d jsonb,expected_revision integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 d:=sikap_private.curriculum_metadata(d);
 perform sikap_private.bank_metadata(d);
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.archived or m.revision is distinct from expected_revision or not (sikap_private.is_head() or (m.owner=auth.uid() and m.status='returned')) then raise exception 'Metadata cannot be edited. Refresh this resource.';end if;
 update public.modules set title=trim(d->>'title'),subject=trim(d->>'subject'),grade=d->>'grade',term=d->>'term',bank_category=d->>'category',bank_description=trim(d->>'description'),bank_competency=trim(d->>'competency'),bank_competency_id=nullif(d->>'competency_id','')::uuid,bank_competency_code=d->>'competency_code',bank_curriculum_version=d->>'curriculum_version',bank_competency_source=nullif(d->'competency_source','null'::jsonb),bank_competency_legacy=nullif(d->>'competency_id','') is null,bank_localization=trim(d->>'localization'),bank_tags=array(select jsonb_array_elements_text(d->'tags')),bank_source=coalesce(d->>'source',''),bank_notes=coalesce(d->>'notes',''),revision=revision+1,updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Updated resource metadata');
end $$;

create or replace function public.bank_list(filters jsonb default '{}',page_no integer default 1) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;scope text:=coalesce(filters->>'scope','shared');sort_key text:=coalesce(filters->>'sort',case when filters->>'scope'='review' then 'oldest' else 'approved' end);begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 if scope not in ('shared','mine','saved','recent','review','archived','all') or (scope in ('review','archived','all') and not sikap_private.is_head()) then raise exception 'Repository access denied';end if;
 if page_no is null or page_no<1 or page_no>100000 then raise exception 'Invalid page';end if;
 if coalesce(filters->>'date','')<>'' and (filters->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date filter';end if;
 with resources as (
  select m.id,m.title,m.owner,m.bank_creator_name as creator,m.bank_category as category,m.subject,m.grade,m.term,coalesce(m.bank_submitted_at,m.created) as created,m.updated,m.approved,m.version,m.revision,m.bank_draft,m.archived,m.bank_competency_id,m.bank_competency_code,m.bank_curriculum_version,m.bank_competency_legacy,
   case when m.archived then 'archived' when m.bank_draft then 'draft' when m.status='pending' and m.version>1 then 'resubmitted' else m.status end as state,
   v.name as filename,v.type,v.size,exists(select 1 from public.stars s where s.module=m.id and s.owner=auth.uid()) as saved
  from public.modules m left join public.versions v on v.module=m.id and v.version=m.version
  where m.bank_category is not null and sikap_private.bank_access(m.id)
   and case scope when 'mine' then m.owner=auth.uid() when 'review' then m.status='pending' and not m.bank_draft and not m.archived when 'archived' then m.archived when 'all' then not m.archived when 'saved' then not m.archived and exists(select 1 from public.stars s where s.module=m.id and s.owner=auth.uid()) else m.status='approved' and not m.bank_draft and not m.archived end
   and (coalesce(filters->>'category','')='' or m.bank_category=filters->>'category')
   and (coalesce(filters->>'legacy','')='' or (filters->>'legacy'='true' and m.bank_competency_legacy) or (filters->>'legacy'='false' and not m.bank_competency_legacy))
   and (coalesce(filters->>'subject','')='' or m.subject=filters->>'subject')
   and (coalesce(filters->>'grade','')='' or m.grade=filters->>'grade')
   and (coalesce(filters->>'term','')='' or m.term=filters->>'term')
   and (coalesce(filters->>'creator','')='' or m.bank_creator_name=filters->>'creator')
   and (coalesce(filters->>'type','')='' or v.type=filters->>'type')
   and (coalesce(filters->>'date','')='' or m.updated>=(filters->>'date')::date)
   and (coalesce(filters->>'q','')='' or sikap_private.bank_document(m.title,m.subject,m.grade,m.bank_creator_name,m.bank_competency,m.bank_tags) @@ plainto_tsquery('simple',left(filters->>'q',300)))
 ), matched as (select * from resources where coalesce(filters->>'status','')='' or state=filters->>'status'), paged as (
  select * from matched order by
   case when sort_key='name' then lower(title) end asc,
   case when sort_key='creator' then lower(creator) end asc,
   case when sort_key='oldest' then created end asc,
   case when sort_key='newest' then created end desc,
   case when sort_key='approved' then approved end desc nulls last,
   updated desc,id limit 25 offset (page_no-1)*25
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(p) from paged p),'[]'::jsonb),'total',(select count(*) from matched),'page',page_no,'pageSize',25) into result;
 return result;
end $$;

-- Permission boundaries: authenticated users cannot write catalog tables or
-- call private helpers directly. Head RPCs independently check approval/role.
revoke all on function sikap_private.curriculum_metadata(jsonb),
 sikap_private.curriculum_guard_module(),sikap_private.curriculum_version_snapshot()
 from public,anon,authenticated;
revoke all on function public.bank_curriculum(),public.bank_competency_list(jsonb,integer),
 public.bank_competency_import(jsonb),public.bank_competency_review(uuid,integer,text,text),
 public.bank_competency_coverage() from public,anon,authenticated;
grant execute on function public.bank_curriculum(),public.bank_competency_list(jsonb,integer),
 public.bank_competency_import(jsonb),public.bank_competency_review(uuid,integer,text,text),
 public.bank_competency_coverage() to authenticated;
revoke all on function public.bank_save(uuid,jsonb,integer,text,boolean),
 public.bank_edit(uuid,jsonb,integer),public.bank_list(jsonb,integer) from public,anon;
grant execute on function public.bank_save(uuid,jsonb,integer,text,boolean),
 public.bank_edit(uuid,jsonb,integer),public.bank_list(jsonb,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
