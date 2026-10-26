-- Apply AFTER curriculum-catalog.sql. No accounts, resources or files are deleted.
begin;
create table if not exists public.collab_members (
 module uuid not null references public.modules on delete cascade,
 teacher uuid not null references public.profiles,
 status text not null default 'invited' check(status in ('invited','accepted','declined','removed')),
 created timestamptz not null default now(), primary key(module,teacher)
);
create table if not exists public.collab_comments (
 id uuid primary key default gen_random_uuid(), module uuid not null references public.modules on delete cascade,
 author uuid not null references public.profiles, body text not null check(length(trim(body)) between 1 and 5000), created timestamptz not null default now()
);
create table if not exists public.collab_proposals (
 id uuid primary key default gen_random_uuid(), module uuid not null references public.modules on delete cascade,
 author uuid not null references public.profiles, key text not null unique, name text not null, type text not null,
 size bigint not null check(size between 1 and 20971520), changes text not null check(length(trim(changes)) between 1 and 3000),
 selected boolean not null default false, created timestamptz not null default now()
);
alter table public.versions add column if not exists contributor_credits jsonb not null default '[]';
alter table public.collab_members enable row level security;
alter table public.collab_comments enable row level security;
alter table public.collab_proposals enable row level security;
revoke all on public.collab_members,public.collab_comments,public.collab_proposals from public,anon,authenticated;
create unique index if not exists collab_selected on public.collab_proposals(module) where selected;
create index if not exists collab_teacher on public.collab_members(teacher,status);
create or replace function sikap_private.collab_member(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.is_approved() and exists(select 1 from public.modules m where m.id=mid and m.bank_category is not null and (m.owner=auth.uid() or exists(select 1 from public.collab_members c where c.module=mid and c.teacher=auth.uid() and c.status='accepted')))
$$;
-- Keep existing file rules and access, adding private proposal reads for members.
do $$begin
 if to_regprocedure('sikap_private.object_access_before_collab(text)') is null then
  alter function sikap_private.object_access(text) rename to object_access_before_collab;
 end if;
end $$;
create or replace function sikap_private.object_access(object_key text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select sikap_private.object_access_before_collab(object_key) or exists(select 1 from public.collab_proposals p where p.key=object_key and sikap_private.collab_member(p.module))
$$;
create or replace function public.collab_state(mid uuid default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 if mid is null then
  return jsonb_build_object(
   'resources',coalesce((select jsonb_agg(to_jsonb(q) order by q.updated desc) from (
    select m.id,m.title,m.owner,m.subject,m.grade,m.term,m.bank_category as category,m.bank_draft,m.archived,m.status,m.revision,m.updated,p.name as creator,c.status as membership
    from public.modules m join public.profiles p on p.id=m.owner left join public.collab_members c on c.module=m.id and c.teacher=auth.uid()
    where m.bank_category is not null and not m.archived and (m.owner=auth.uid() or c.status in ('accepted','invited'))
   ) q),'[]'::jsonb),
   'teachers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.profiles p where p.role='teacher' and p.approval_status='approved' and p.id<>auth.uid()),'[]'::jsonb));
 end if;

 if not sikap_private.collab_member(mid) then raise exception 'Collaboration access denied';end if;
 return jsonb_build_object('resource',(select to_jsonb(resource_row) from public.modules resource_row where resource_row.id=mid),'members',coalesce((select jsonb_agg(jsonb_build_object('id',c.teacher,'name',p.name,'status',c.status) order by c.created) from public.collab_members c join public.profiles p on p.id=c.teacher where c.module=mid),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('name',p.name) order by c.created) from public.collab_comments c join public.profiles p on p.id=c.author where c.module=mid),'[]'::jsonb),
 'proposals',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('uploader',p.name,'submitted',exists(select 1 from public.versions v where v.key=c.key)) order by c.created desc) from public.collab_proposals c join public.profiles p on p.id=c.author where c.module=mid),'[]'::jsonb));
end $$;
create or replace function public.collab_action(mid uuid,action text,payload jsonb default '{}',expected_revision integer default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules; target uuid; f public.bank_uploads; proposal public.collab_proposals; credits jsonb;begin
 if not sikap_private.is_approved() then raise exception 'School account approval required';end if;
 select * into m from public.modules where id=mid for update;
 if m.id is null or m.bank_category is null or m.archived then raise exception 'Resource unavailable';end if;
 if action='respond' then
  if payload->>'status' is null or payload->>'status' not in ('accepted','declined') then raise exception 'Choose accept or decline';end if;
  update public.collab_members set status=payload->>'status' where module=mid and teacher=auth.uid() and status='invited';
  if not found then raise exception 'Invitation unavailable';end if;
  insert into public.notifications(owner,module,body) values(m.owner,mid,(select name from public.profiles where id=auth.uid())||' '||(payload->>'status')||' your collaboration invitation: '||m.title);
  return;
 end if;
 if not sikap_private.collab_member(mid) then raise exception 'Collaboration access denied';end if;
 if m.revision is distinct from expected_revision then raise exception 'Resource changed. Refresh before continuing.';end if;
 if not m.bank_draft and m.status='pending' then raise exception 'This submitted version is locked during review';end if;
 if action in ('invite','remove') then
  if m.owner<>auth.uid() then raise exception 'Only the owner can manage contributors';end if;
  target:=(payload->>'teacher')::uuid;
  if target=auth.uid() or not exists(select 1 from public.profiles where id=target and role='teacher' and approval_status='approved') then raise exception 'Choose an approved teacher';end if;
  if action='invite' then
   insert into public.collab_members(module,teacher) values(mid,target) on conflict(module,teacher) do update set status='invited' where collab_members.status in ('removed','declined');
   if found then insert into public.notifications(owner,module,body) values(target,mid,'Collaboration invitation: '||m.title);end if;
  else update public.collab_members set status='removed' where module=mid and teacher=target;
  end if;
 elsif action='comment' then
  insert into public.collab_comments(module,author,body) values(mid,auth.uid(),trim(payload->>'body'));
 elsif action='propose' then
  -- Upload into a fresh staging UUID through the EXISTING verified upload service.
  -- A receipt can only be consumed by its uploader, once, for this proposal.
  f:=sikap_private.bank_file((payload->>'upload_module')::uuid,payload->>'object_key');
  insert into public.collab_proposals(module,author,key,name,type,size,changes) values(mid,auth.uid(),f.key,f.filename,f.mime,f.bytes,trim(payload->>'changes'));
  delete from public.bank_uploads where key=f.key;
 elsif action='select' then
  if m.owner<>auth.uid() then raise exception 'Only the owner can select the submitted file';end if;
  select * into proposal from public.collab_proposals where id=(payload->>'proposal')::uuid and module=mid;
  if proposal.id is null or not (proposal.author=m.owner or exists(select 1 from public.collab_members where module=mid and teacher=proposal.author and status='accepted')) then raise exception 'Proposal unavailable';end if;
  update public.collab_proposals set selected=false where module=mid and selected;
  update public.collab_proposals set selected=true where id=proposal.id;
 elsif action='submit' then
  if m.owner<>auth.uid() then raise exception 'Only the owner can submit';end if;
  -- Revalidate the canonical curriculum metadata at the server boundary.
  perform sikap_private.bank_metadata(jsonb_build_object('title',m.title,'category',m.bank_category,'subject',m.subject,'grade',m.grade,'term',m.term,'description',m.bank_description,'competency',m.bank_competency,'competency_id',to_jsonb(m)->>'bank_competency_id','localization',m.bank_localization,'tags',m.bank_tags,'source',m.bank_source,'notes',m.bank_notes));
  select * into proposal from public.collab_proposals where module=mid and selected;
  if proposal.id is null or exists(select 1 from public.versions where key=proposal.key) or not (proposal.author=m.owner or exists(select 1 from public.collab_members where module=mid and teacher=proposal.author and status='accepted')) then raise exception 'Select a new proposed file before submitting';end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='sikap-modules' and o.name=proposal.key and (o.metadata->>'size')::bigint=proposal.size and o.metadata->>'mimetype'=proposal.type) then raise exception 'Selected file unavailable';end if;
  select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) into credits from public.profiles p where p.id=m.owner or exists(select 1 from public.collab_members c where c.module=mid and c.teacher=p.id and c.status='accepted');
  insert into public.versions(module,version,key,name,type,size,changes,contributor_credits) values(mid,case when m.bank_draft then 1 else m.version+1 end,proposal.key,proposal.name,proposal.type,proposal.size,proposal.changes,credits);
  update public.modules set bank_draft=false,status='pending',version=case when m.bank_draft then 1 else m.version+1 end,bank_submitted_at=now(),updated=now(),revision=revision+1 where id=mid;
  insert into public.events(module,actor,body) values(mid,auth.uid(),'Submitted collaborative resource version '||(case when m.bank_draft then 1 else m.version+1 end));
  perform sikap_private.notify_heads(mid,auth.uid(),'Collaborative resource ready for review: '||m.title);
  insert into public.notifications(owner,module,body) select c.teacher,mid,'Collaborative resource submitted: '||m.title from public.collab_members c where c.module=mid and c.status='accepted';
  return;
 else raise exception 'Invalid collaboration action';end if;
 update public.modules set revision=revision+1,updated=now() where id=mid;
end $$;
-- Preserve existing list/details RPCs, adding version-specific credit snapshots.
do $$begin
 if to_regprocedure('public.bank_list_before_collab(jsonb,integer)') is null then alter function public.bank_list(jsonb,integer) rename to bank_list_before_collab;end if;
 if to_regprocedure('public.bank_details_before_collab(uuid)') is null then alter function public.bank_details(uuid) rename to bank_details_before_collab;end if;
 if to_regprocedure('public.bank_decide_before_collab(uuid,integer,text,text,jsonb)') is null then alter function public.bank_decide(uuid,integer,text,text,jsonb) rename to bank_decide_before_collab;end if;
 if to_regprocedure('public.bank_delete_draft_before_collab(uuid,integer)') is null then alter function public.bank_delete_draft(uuid,integer) rename to bank_delete_draft_before_collab;end if;
end $$;
create or replace function public.bank_decide(mid uuid,expected_revision integer,decision text,feedback text,checks jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.modules where id=mid for update;
 if exists(select 1 from public.versions v join public.modules m on m.id=v.module cross join lateral jsonb_array_elements(v.contributor_credits) credit where v.module=mid and v.version=m.version and credit->>'id'=auth.uid()::text) then raise exception 'A head teacher who did not contribute must review this version';end if;
 perform public.bank_decide_before_collab(mid,expected_revision,decision,feedback,checks);
end $$;
create or replace function public.bank_delete_draft(mid uuid,expected_revision integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.modules where id=mid and owner=auth.uid() and bank_draft and bank_category is not null and revision=expected_revision and sikap_private.is_approved() for update;
 if not found then raise exception 'Draft changed or is unavailable';end if;
 delete from public.notifications where module=mid;
 perform public.bank_delete_draft_before_collab(mid,expected_revision);
end $$;
create or replace function public.bank_list(filters jsonb default '{}',page_no integer default 1) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 result:=public.bank_list_before_collab(filters,page_no);
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(r||jsonb_build_object('contributors',coalesce((select v.contributor_credits from public.versions v join public.modules m on m.id=v.module where v.module=(r->>'id')::uuid and v.version=case when filters->>'scope' in ('shared','recent') or coalesce(filters->>'scope','shared')='shared' then m.final_version else m.version end),'[]'::jsonb))) from jsonb_array_elements(result->'items') r),'[]'::jsonb));
end $$;
create or replace function public.bank_details(mid uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 result:=public.bank_details_before_collab(mid);
 return jsonb_set(result,'{resource,contributors}',coalesce((select v.contributor_credits from public.versions v join public.modules m on m.id=v.module where v.module=mid and v.version=case when sikap_private.can_access(mid) then m.version else m.final_version end),'[]'::jsonb));
end $$;
-- The old metadata editor must not mutate a collaborative review snapshot.
create or replace function sikap_private.collab_lock_metadata() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not old.bank_draft and old.status in ('pending','approved') and exists(select 1 from public.versions where module=old.id and contributor_credits<>'[]'::jsonb) and
  (new.title,new.subject,new.grade,new.term,new.bank_category,new.bank_description,new.bank_competency,new.bank_localization,new.bank_tags,new.bank_source,new.bank_notes,new.bank_competency_id,new.bank_competency_code,new.bank_curriculum_version) is distinct from
  (old.title,old.subject,old.grade,old.term,old.bank_category,old.bank_description,old.bank_competency,old.bank_localization,old.bank_tags,old.bank_source,old.bank_notes,old.bank_competency_id,old.bank_competency_code,old.bank_curriculum_version) then raise exception 'Submitted collaborative metadata is locked. Create a new revision.';end if;
 return new;
end $$;
drop trigger if exists collab_lock_metadata on public.modules;
create trigger collab_lock_metadata before update on public.modules for each row execute function sikap_private.collab_lock_metadata();
-- Also credit accepted contributors when an owner uses the normal upload form.
create or replace function sikap_private.collab_snapshot_credits() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.collab_members c where c.module=new.module and c.status='accepted') then
  select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) into new.contributor_credits from public.profiles p where p.id=(select owner from public.modules where id=new.module) or exists(select 1 from public.collab_members c where c.module=new.module and c.teacher=p.id and c.status='accepted');
 end if;
 return new;
end $$;
drop trigger if exists collab_snapshot_credits on public.versions;
create trigger collab_snapshot_credits before insert on public.versions for each row execute function sikap_private.collab_snapshot_credits();
revoke all on function sikap_private.collab_snapshot_credits() from public,anon,authenticated;
revoke all on function sikap_private.collab_member(uuid),sikap_private.collab_lock_metadata(),sikap_private.object_access_before_collab(text) from public,anon,authenticated;
revoke all on function public.bank_list_before_collab(jsonb,integer),public.bank_details_before_collab(uuid) from public,anon,authenticated;
revoke all on function public.bank_decide_before_collab(uuid,integer,text,text,jsonb),public.bank_delete_draft_before_collab(uuid,integer) from public,anon,authenticated;
revoke all on function public.collab_state(uuid),public.collab_action(uuid,text,jsonb,integer),public.bank_list(jsonb,integer),public.bank_details(uuid) from public,anon;
grant execute on function public.collab_state(uuid),public.collab_action(uuid,text,jsonb,integer),public.bank_list(jsonb,integer),public.bank_details(uuid) to authenticated;
revoke all on function public.bank_decide(uuid,integer,text,text,jsonb),public.bank_delete_draft(uuid,integer) from public,anon;
grant execute on function public.bank_decide(uuid,integer,text,text,jsonb),public.bank_delete_draft(uuid,integer) to authenticated;
notify pgrst, 'reload schema';
commit;



