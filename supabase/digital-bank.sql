-- Apply after account-approval.sql and upgrade-school-workflow.sql.
begin;
alter table public.modules add column if not exists bank_category text check(bank_category in ('METHODS','MODELS','UNITS'));
alter table public.modules add column if not exists bank_description text not null default '' check(length(bank_description)<=5000);
alter table public.modules add column if not exists bank_competency text not null default '' check(length(bank_competency)<=3000);
alter table public.modules add column if not exists bank_localization text not null default '' check(length(bank_localization)<=5000);
alter table public.modules add column if not exists bank_tags text[] not null default '{}' check(cardinality(bank_tags)<=20 and octet_length(bank_tags::text)<=2000);
alter table public.modules add column if not exists bank_source text not null default '' check(length(bank_source)<=2000);
alter table public.modules add column if not exists bank_notes text not null default '' check(length(bank_notes)<=3000);
alter table public.modules add column if not exists bank_creator_name text;
alter table public.modules add column if not exists bank_draft boolean not null default false;
alter table public.modules add column if not exists bank_submitted_at timestamptz;
alter table public.modules add column if not exists bank_archived_at timestamptz;
create index if not exists bank_browse on public.modules(bank_category,status,approved desc) where bank_category is not null;
create index if not exists bank_owner on public.modules(owner,updated desc) where bank_category is not null;
create or replace function sikap_private.bank_document(title text,subject text,grade text,creator text,competency text,tags text[]) returns tsvector language sql immutable set search_path=public,pg_temp as $$ select to_tsvector('simple',title||' '||subject||' '||grade||' '||coalesce(creator,'')||' '||competency||' '||array_to_string(tags,' ')) $$;
create index if not exists bank_search on public.modules using gin(sikap_private.bank_document(title,subject,grade,bank_creator_name,bank_competency,bank_tags)) where bank_category is not null;

-- Only the upload function's service client can issue verification receipts.
create table if not exists public.bank_uploads(key text primary key,owner uuid not null references public.profiles,module uuid not null,filename text not null,mime text not null,bytes bigint not null check(bytes between 1 and 20971520),sha256 text not null check(length(sha256)=64),created timestamptz not null default now());
alter table public.bank_uploads enable row level security;
revoke all on public.bank_uploads from public,anon,authenticated;
grant select,insert,delete on public.bank_uploads to service_role;

create or replace function sikap_private.bank_access(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.is_approved() and exists(select 1 from public.modules m where m.id=mid and m.bank_category is not null and (m.owner=auth.uid() or sikap_private.is_head() or (m.status='approved' and not m.archived and not m.bank_draft))) $$;
create or replace function sikap_private.object_access(object_key text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.versions v join public.modules m on m.id=v.module where v.key=object_key and (sikap_private.can_access(m.id) or (sikap_private.bank_access(m.id) and v.version=m.final_version))) $$;
drop policy if exists stars_own on public.stars;
create policy stars_own on public.stars for all to authenticated using(owner=auth.uid() and sikap_private.is_approved()) with check(owner=auth.uid() and (sikap_private.can_access(module) or sikap_private.bank_access(module)));

create or replace function sikap_private.bank_metadata(d jsonb) returns void language plpgsql as $$
begin
 if d is null or jsonb_typeof(d)<>'object' or d->>'category' is null or d->>'category' not in ('METHODS','MODELS','UNITS') then raise exception 'Choose Methods, Models or Units';end if;
 if coalesce(length(trim(d->>'title')),0) not between 1 and 200 or coalesce(length(trim(d->>'subject')),0) not between 1 and 200 then raise exception 'Enter a title and learning area';end if;
 if d->>'grade' is null or d->>'grade' not in ('Grade 7','Grade 8','Grade 9','Grade 10') or d->>'term' is null or d->>'term' not in ('Quarter 1','Quarter 2','Quarter 3','Quarter 4') then raise exception 'Choose a Junior High School grade and quarter';end if;
 if coalesce(length(trim(d->>'description')),0) not between 1 and 5000 or coalesce(length(trim(d->>'competency')),0) not between 1 and 3000 or coalesce(length(trim(d->>'localization')),0) not between 1 and 5000 then raise exception 'Complete description, learning competency and localization';end if;
 if jsonb_typeof(d->'tags') is distinct from 'array' or jsonb_array_length(d->'tags') not between 1 and 20 or octet_length((d->'tags')::text)>2000 or exists(select 1 from jsonb_array_elements(d->'tags') t where jsonb_typeof(t)<>'string' or length(trim(t#>>'{}'))=0) then raise exception 'Enter 1 to 20 tags';end if;
 if length(coalesce(d->>'source',''))>2000 or length(coalesce(d->>'notes',''))>3000 then raise exception 'Reference or notes are too long';end if;
end $$;
create or replace function sikap_private.bank_file(mid uuid,object_key text) returns public.bank_uploads language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.bank_uploads;begin
 select * into f from public.bank_uploads u where u.key=object_key and u.owner=auth.uid() and u.module=mid for update;
 if f.key is null then raise exception 'Upload the file through the Digital Bank before submitting';end if;
 perform sikap_private.file_check(f.key,f.filename,f.mime,f.bytes);
 return f;
end $$;
create or replace function public.bank_save(mid uuid,d jsonb,expected_revision integer default null,object_key text default null,submit boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;f public.bank_uploads;new_item boolean;begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 perform sikap_private.bank_metadata(d);
 select * into m from public.modules where id=mid for update;
 new_item:=m.id is null;
 if not new_item and (m.bank_category is null or m.owner<>auth.uid() or not m.bank_draft or m.revision is distinct from expected_revision) then raise exception 'Only your current draft can be saved here';end if;
 if submit then f:=sikap_private.bank_file(mid,object_key);end if;
 if new_item then
  insert into public.modules(id,owner,title,subject,grade,term,year,bank_category,bank_creator_name,bank_draft) values(mid,auth.uid(),trim(d->>'title'),trim(d->>'subject'),d->>'grade',d->>'term',extract(year from now())::text,d->>'category',(select name from public.profiles where id=auth.uid()),true);
 end if;
 update public.modules set title=trim(d->>'title'),subject=trim(d->>'subject'),grade=d->>'grade',term=d->>'term',bank_category=d->>'category',bank_description=trim(d->>'description'),bank_competency=trim(d->>'competency'),bank_localization=trim(d->>'localization'),bank_tags=array(select jsonb_array_elements_text(d->'tags')),bank_source=coalesce(d->>'source',''),bank_notes=coalesce(d->>'notes',''),bank_draft=not submit,bank_submitted_at=case when submit then now() else bank_submitted_at end,revision=revision+1,updated=now() where id=mid;
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
 perform sikap_private.bank_metadata(d);
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.archived or m.revision is distinct from expected_revision or not (sikap_private.is_head() or (m.owner=auth.uid() and m.status='returned')) then raise exception 'Metadata cannot be edited. Refresh this resource.';end if;
 update public.modules set title=trim(d->>'title'),subject=trim(d->>'subject'),grade=d->>'grade',term=d->>'term',bank_category=d->>'category',bank_description=trim(d->>'description'),bank_competency=trim(d->>'competency'),bank_localization=trim(d->>'localization'),bank_tags=array(select jsonb_array_elements_text(d->'tags')),bank_source=coalesce(d->>'source',''),bank_notes=coalesce(d->>'notes',''),revision=revision+1,updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Updated resource metadata');
end $$;
create or replace function public.bank_revise(mid uuid,expected_revision integer,object_key text,changes text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;f public.bank_uploads;begin
 select * into m from public.modules where id=mid for update;
 if not sikap_private.is_approved() or m.id is null or m.bank_category is null or m.owner<>auth.uid() or m.status<>'returned' or m.archived or m.revision is distinct from expected_revision then raise exception 'Only your returned resource can be revised. Refresh before retrying.';end if;
 if coalesce(length(trim(changes)),0) not between 1 and 3000 then raise exception 'Describe the changes in this revision';end if;
 f:=sikap_private.bank_file(mid,object_key);
 insert into public.versions(module,version,key,name,type,size,changes) values(mid,m.version+1,f.key,f.filename,f.mime,f.bytes,trim(changes));
 delete from public.bank_uploads where key=f.key;
 update public.modules set version=version+1,revision=revision+1,status='pending',updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Resubmitted resource version '||(m.version+1));
 perform sikap_private.notify_heads(mid,auth.uid(),m.title||' was resubmitted.');
end $$;
create or replace function public.bank_decide(mid uuid,expected_revision integer,decision text,feedback text,checks jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;k text;needs_revision boolean:=false;begin
 select * into m from public.modules where id=mid for update;
 if not sikap_private.is_head() or m.id is null or m.bank_category is null or m.owner=auth.uid() then raise exception 'A different approved Head Teacher must review this resource';end if;
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
create or replace function public.bank_archive(mid uuid,expected_revision integer,archive boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 select * into m from public.modules where id=mid for update;
 if not sikap_private.is_head() or m.id is null or m.bank_category is null or m.bank_draft or m.revision is distinct from expected_revision then raise exception 'Only a Head Teacher can archive or restore this resource';end if;
 update public.modules set archived=archive,bank_archived_at=case when archive then now() end,revision=revision+1,updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),case when archive then 'Archived resource' else 'Restored resource' end);
end $$;
create or replace function public.bank_delete_draft(mid uuid,expected_revision integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.modules where id=mid and owner=auth.uid() and bank_draft and bank_category is not null and revision=expected_revision and sikap_private.is_approved() for update;
 if not found then raise exception 'Draft changed or is unavailable';end if;
 delete from public.events where module=mid;
 delete from public.stars where module=mid;
 delete from public.modules where id=mid;
end $$;

create or replace function public.bank_list(filters jsonb default '{}',page_no integer default 1) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;scope text:=coalesce(filters->>'scope','shared');sort_key text:=coalesce(filters->>'sort',case when filters->>'scope'='review' then 'oldest' else 'approved' end);begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 if scope not in ('shared','mine','saved','recent','review','archived','all') or (scope in ('review','archived','all') and not sikap_private.is_head()) then raise exception 'Repository access denied';end if;
 if page_no is null or page_no<1 or page_no>100000 then raise exception 'Invalid page';end if;
 if coalesce(filters->>'date','')<>'' and (filters->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date filter';end if;
 with resources as (
  select m.id,m.title,m.owner,m.bank_creator_name as creator,m.bank_category as category,m.subject,m.grade,m.term,coalesce(m.bank_submitted_at,m.created) as created,m.updated,m.approved,m.version,m.revision,m.bank_draft,m.archived,
   case when m.archived then 'archived' when m.bank_draft then 'draft' when m.status='pending' and m.version>1 then 'resubmitted' else m.status end as state,
   v.name as filename,v.type,v.size,exists(select 1 from public.stars s where s.module=m.id and s.owner=auth.uid()) as saved
  from public.modules m left join public.versions v on v.module=m.id and v.version=m.version
  where m.bank_category is not null and sikap_private.bank_access(m.id)
   and case scope when 'mine' then m.owner=auth.uid() when 'review' then m.status='pending' and not m.bank_draft and not m.archived when 'archived' then m.archived when 'all' then not m.archived when 'saved' then not m.archived and exists(select 1 from public.stars s where s.module=m.id and s.owner=auth.uid()) else m.status='approved' and not m.bank_draft and not m.archived end
   and (coalesce(filters->>'category','')='' or m.bank_category=filters->>'category')
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
create or replace function public.bank_details(mid uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare private_view boolean;begin
 if not sikap_private.bank_access(mid) then raise exception 'Resource not found or access denied';end if;
 private_view:=sikap_private.can_access(mid);
 return jsonb_build_object(
  'resource',(select to_jsonb(m)||jsonb_build_object('creator',m.bank_creator_name,'approverName',p.name,'saved',exists(select 1 from public.stars s where s.module=mid and s.owner=auth.uid())) from public.modules m left join public.profiles p on p.id=m.approver where m.id=mid),
  'private',private_view,
  'versions',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('uploader',m.bank_creator_name) order by v.version desc) from public.versions v join public.modules m on m.id=v.module where v.module=mid and (private_view or v.version=m.final_version)),'[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('reviewerName',p.name) order by r.created desc) from public.module_reviews r join public.profiles p on p.id=r.reviewer where r.module=mid and (private_view or (r.decision='approved' and r.version=(select final_version from public.modules where id=mid)))),'[]'::jsonb),
  'events',case when private_view then coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('actorName',p.name) order by e.created desc) from public.events e join public.profiles p on p.id=e.actor where e.module=mid),'[]'::jsonb) else '[]'::jsonb end);
end $$;
create or replace function public.bank_facets() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 return jsonb_build_object('subjects',coalesce((select jsonb_agg(subject order by subject) from (select distinct subject from public.modules m where m.bank_category is not null and sikap_private.bank_access(m.id) limit 200) q),'[]'::jsonb),'creators',coalesce((select jsonb_agg(creator order by creator) from (select distinct bank_creator_name as creator from public.modules m where m.bank_category is not null and sikap_private.bank_access(m.id) limit 1000) q),'[]'::jsonb));
end $$;
revoke all on function public.bank_facets() from public,anon;
grant execute on function public.bank_facets() to authenticated;
create or replace function public.bank_stats() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_head() then raise exception 'Head Teacher access required';end if;
 return (select jsonb_build_object('approved',count(*) filter(where status='approved' and not archived),'pending',count(*) filter(where status='pending' and not bank_draft and not archived),'returned',count(*) filter(where status='returned' and not archived),'methods',count(*) filter(where bank_category='METHODS' and status='approved' and not archived),'models',count(*) filter(where bank_category='MODELS' and status='approved' and not archived),'units',count(*) filter(where bank_category='UNITS' and status='approved' and not archived)) from public.modules where bank_category is not null);
end $$;

-- Existing module endpoints cannot bypass the Digital Bank validation workflow.
do $$declare signature text;definition text;at integer;begin
 foreach signature in array array['public.revise_module(uuid,integer,text,text,text,bigint,text)','public.review_module_checked(uuid,integer,text,text,jsonb)','public.archive_module(uuid,boolean)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('Use the Digital Bank workflow' in definition)=0 then
   at:=position('begin' in lower(definition));
   definition:=overlay(definition placing 'begin if exists(select 1 from public.modules where id=mid and bank_category is not null) then raise exception ''Use the Digital Bank workflow'';end if;' from at for 5);
   execute definition;
  end if;
 end loop;
end $$;

-- Keep the legacy workspace payload free of repository rows; Digital Bank pages paginate.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.get_state()'::regprocedure);
 if position('m.bank_category is null' in definition)=0 then
  definition:=replace(definition,'where m.owner=auth.uid() or sikap_private.is_head()','where m.bank_category is null and (m.owner=auth.uid() or sikap_private.is_head())');
  execute definition;
 end if;
end $$;

revoke all on function sikap_private.bank_metadata(jsonb),sikap_private.bank_file(uuid,text) from public,anon,authenticated;
revoke all on function sikap_private.bank_access(uuid) from public,anon;
grant execute on function sikap_private.bank_access(uuid) to authenticated;
revoke all on function public.bank_save(uuid,jsonb,integer,text,boolean),public.bank_edit(uuid,jsonb,integer),public.bank_revise(uuid,integer,text,text),public.bank_decide(uuid,integer,text,text,jsonb),public.bank_archive(uuid,integer,boolean),public.bank_delete_draft(uuid,integer),public.bank_list(jsonb,integer),public.bank_details(uuid),public.bank_stats() from public,anon;
grant execute on function public.bank_save(uuid,jsonb,integer,text,boolean),public.bank_edit(uuid,jsonb,integer),public.bank_revise(uuid,integer,text,text),public.bank_decide(uuid,integer,text,text,jsonb),public.bank_archive(uuid,integer,boolean),public.bank_delete_draft(uuid,integer),public.bank_list(jsonb,integer),public.bank_details(uuid),public.bank_stats() to authenticated;
commit;
