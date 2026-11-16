-- PROJECT SIKAP: proposal alignment (existing database upgrade).
-- Run this WHOLE file once in the Supabase SQL Editor, after collaboration.sql.
--
-- 1. PowerPoint (PPTX) resource files, alongside PDF and DOCX, still 20 MB.
-- 2. Resources labeled by school-calendar term (Term 1-3, DepEd Order No. 009,
--    s. 2026), as the Project SIKAP proposal schedules the school year.
-- 3. LRMDS descriptors: resource type, language and usage rights.
--
-- Safe while the current live site is still in use: it only ADDS allowed
-- values. PDF/DOCX uploads and resources already labeled "Quarter 1-4" keep
-- working exactly as before. No resources, files or accounts are changed.
-- The upload Edge Function must also be redeployed for PPTX uploads:
--   supabase functions deploy bank-upload --project-ref YOUR_PROJECT_REF

begin;

do $$ begin
 if to_regprocedure('sikap_private.bank_metadata(jsonb)') is null
    or to_regprocedure('sikap_private.file_check(text,text,text,bigint)') is null
    or to_regclass('public.curriculum_competencies') is null then
  raise exception 'Apply this to the existing Project SIKAP database after digital-bank.sql and curriculum-catalog.sql.';
 end if;
end $$;

-- 1. PowerPoint files -------------------------------------------------------
update storage.buckets set allowed_mime_types=array[
 'application/pdf',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
 where id='sikap-modules';

create or replace function sikap_private.file_check(object_key text,filename text,mime text,bytes bigint) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'Head Teacher approval required';end if;
 if split_part(object_key,'/',1)<>auth.uid()::text or bytes not between 1 and 20971520 or length(filename) not between 1 and 240
    or mime not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation')
    or lower(filename) !~ '\.(pdf|docx|pptx)$'
  then raise exception 'Invalid file';end if;
 if not exists(select 1 from storage.objects where bucket_id='sikap-modules' and name=object_key and owner_id=auth.uid()::text and (metadata->>'size')::bigint=bytes and metadata->>'mimetype'=mime) then raise exception 'Uploaded file could not be verified';end if;
end $$;

drop policy if exists sikap_upload on storage.objects;
create policy sikap_upload on storage.objects for insert to authenticated with check(sikap_private.is_approved() and bucket_id='sikap-modules' and split_part(name,'/',1)=auth.uid()::text and lower(name) ~ '\.(pdf|docx|pptx)$');

-- 2. Terms ------------------------------------------------------------------
-- "Quarter 1-4" stays valid so existing resources, and the live site until it
-- is republished, keep working. The new form offers Term 1-3 only.
create or replace function sikap_private.bank_metadata(d jsonb) returns void language plpgsql as $$
begin
 if d is null or jsonb_typeof(d)<>'object' or d->>'category' is null or d->>'category' not in ('METHODS','MODELS','UNITS') then raise exception 'Choose Methods, Models or Units';end if;
 if coalesce(length(trim(d->>'title')),0) not between 1 and 200 or coalesce(length(trim(d->>'subject')),0) not between 1 and 200 then raise exception 'Enter a title and learning area';end if;
 if d->>'grade' is null or d->>'grade' not in ('Grade 7','Grade 8','Grade 9','Grade 10') or d->>'term' is null or d->>'term' not in ('Term 1','Term 2','Term 3','Quarter 1','Quarter 2','Quarter 3','Quarter 4') then raise exception 'Choose a Junior High School grade and term';end if;
 if coalesce(length(trim(d->>'description')),0) not between 1 and 5000 or coalesce(length(trim(d->>'competency')),0) not between 1 and 3000 or coalesce(length(trim(d->>'localization')),0) not between 1 and 5000 then raise exception 'Complete description, learning competency and localization';end if;
 if jsonb_typeof(d->'tags') is distinct from 'array' or jsonb_array_length(d->'tags') not between 1 and 20 or octet_length((d->'tags')::text)>2000 or exists(select 1 from jsonb_array_elements(d->'tags') t where jsonb_typeof(t)<>'string' or length(trim(t#>>'{}'))=0) then raise exception 'Enter 1 to 20 tags';end if;
 if length(coalesce(d->>'source',''))>2000 or length(coalesce(d->>'notes',''))>3000 then raise exception 'Reference or notes are too long';end if;
end $$;

-- Competency catalog entries may name the term they are taught in.
alter table public.curriculum_competencies drop constraint if exists curriculum_competencies_quarter_check;
alter table public.curriculum_competencies add constraint curriculum_competencies_quarter_check
 check(quarter in ('Term 1','Term 2','Term 3','Quarter 1','Quarter 2','Quarter 3','Quarter 4'));

commit;

-- 3. LRMDS descriptors --------------------------------------------------------
-- Resource type, language and usage rights for each resource. All three are
-- optional in the database, so existing resources and the current live site
-- (which does not send them) keep working; the new form requires them.
-- If digital-bank.sql or curriculum-catalog.sql is ever rerun, rerun this file
-- afterwards so bank_save/bank_edit record these fields again.
begin;

alter table public.modules
 add column if not exists bank_resource_type text check(bank_resource_type in ('Lesson plan','Activity sheet or worksheet','Slide deck','Assessment','Reading material','Other')),
 add column if not exists bank_language text check(bank_language in ('English','Filipino','English and Filipino','Other')),
 add column if not exists bank_rights text check(bank_rights in ('Original work','Adapted from a source','Used with permission'));

create or replace function sikap_private.bank_descriptors(mid uuid,d jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Only touch fields the caller sent, so older clients never blank them.
 update public.modules set
  bank_resource_type=case when d ? 'resource_type' then nullif(d->>'resource_type','') else bank_resource_type end,
  bank_language=case when d ? 'language' then nullif(d->>'language','') else bank_language end,
  bank_rights=case when d ? 'rights' then nullif(d->>'rights','') else bank_rights end
 where id=mid and (d ? 'resource_type' or d ? 'language' or d ? 'rights');
exception when check_violation then
 raise exception 'Choose a listed resource type, language and usage rights';
end $$;
revoke all on function sikap_private.bank_descriptors(uuid,jsonb) from public,anon,authenticated;

do $$begin
 if to_regprocedure('public.bank_save_before_lrmds(uuid,jsonb,integer,text,boolean)') is null then alter function public.bank_save(uuid,jsonb,integer,text,boolean) rename to bank_save_before_lrmds;end if;
 if to_regprocedure('public.bank_edit_before_lrmds(uuid,jsonb,integer)') is null then alter function public.bank_edit(uuid,jsonb,integer) rename to bank_edit_before_lrmds;end if;
end $$;
revoke all on function public.bank_save_before_lrmds(uuid,jsonb,integer,text,boolean),public.bank_edit_before_lrmds(uuid,jsonb,integer) from public,anon,authenticated;

-- The original functions run first and enforce every existing permission and
-- validation rule; the descriptors are saved only if they succeed.
create or replace function public.bank_save(mid uuid,d jsonb,expected_revision integer default null,object_key text default null,submit boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare saved uuid;begin
 saved:=public.bank_save_before_lrmds(mid,d,expected_revision,object_key,submit);
 perform sikap_private.bank_descriptors(saved,d);
 return saved;
end $$;
create or replace function public.bank_edit(mid uuid,d jsonb,expected_revision integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.bank_edit_before_lrmds(mid,d,expected_revision);
 perform sikap_private.bank_descriptors(mid,d);
end $$;
-- Resource cards show the type, so the list returns it with each item.
do $$begin
 if to_regprocedure('public.bank_list_before_lrmds(jsonb,integer)') is null then alter function public.bank_list(jsonb,integer) rename to bank_list_before_lrmds;end if;
end $$;
revoke all on function public.bank_list_before_lrmds(jsonb,integer) from public,anon,authenticated;
create or replace function public.bank_list(filters jsonb default '{}',page_no integer default 1) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 result:=public.bank_list_before_lrmds(filters,page_no);
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(t.r||jsonb_build_object('bank_resource_type',(select m.bank_resource_type from public.modules m where m.id=(t.r->>'id')::uuid)) order by t.ord) from jsonb_array_elements(result->'items') with ordinality as t(r,ord)),'[]'::jsonb));
end $$;
revoke all on function public.bank_list(jsonb,integer) from public,anon;
grant execute on function public.bank_list(jsonb,integer) to authenticated;
revoke all on function public.bank_save(uuid,jsonb,integer,text,boolean),public.bank_edit(uuid,jsonb,integer) from public,anon;
grant execute on function public.bank_save(uuid,jsonb,integer,text,boolean),public.bank_edit(uuid,jsonb,integer) to authenticated;

commit;
