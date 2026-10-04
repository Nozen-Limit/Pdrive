-- Run once in a NEW Supabase project's SQL Editor. Never run over another app's tables.
begin;
create schema if not exists sikap_private;
revoke all on schema sikap_private from public;
grant usage on schema sikap_private to authenticated;
create table public.profiles(id uuid primary key references auth.users on delete cascade,email text not null,name text not null check(length(name) between 1 and 120),role text not null default 'teacher' check(role in ('teacher','head')),is_owner boolean not null default false,assignment text not null default '' check(length(assignment)<=120));
create unique index one_school_owner on public.profiles(is_owner) where is_owner;
create table public.modules(id uuid primary key,owner uuid not null references public.profiles,title text not null check(length(title) between 1 and 200),subject text not null check(length(subject) between 1 and 200),grade text not null check(length(grade) between 1 and 200),term text not null check(length(term) between 1 and 200),year text not null check(length(year) between 1 and 200),remarks text not null default '' check(length(remarks)<=3000),deadline date,status text not null default 'pending' check(status in ('pending','returned','approved')),version integer not null default 1,revision integer not null default 1,created timestamptz not null default now(),updated timestamptz not null default now(),approver uuid references public.profiles,approved timestamptz,final_version integer,approved_folder text,archived boolean not null default false);
create index modules_owner on public.modules(owner);
create table public.versions(id uuid primary key default gen_random_uuid(),module uuid not null references public.modules,version integer not null,key text not null unique,name text not null,type text not null,size bigint not null check(size>0 and size<=20971520),changes text not null check(length(changes) between 1 and 3000),created timestamptz not null default now(),unique(module,version));
create table public.comments(id uuid primary key default gen_random_uuid(),module uuid not null references public.modules,author uuid not null references public.profiles,version integer not null,body text not null check(length(body) between 1 and 5000),created timestamptz not null default now());
create table public.events(id uuid primary key default gen_random_uuid(),module uuid not null references public.modules,actor uuid not null references public.profiles,body text not null,created timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),owner uuid not null references public.profiles,module uuid not null references public.modules,body text not null,created timestamptz not null default now(),read boolean not null default false);
create table public.notes(id uuid primary key default gen_random_uuid(),owner uuid not null default auth.uid() references public.profiles,title text not null check(length(title) between 1 and 160),body text not null check(length(body) between 1 and 5000),pinned boolean not null default false,updated timestamptz not null default now());
create table public.stars(id uuid primary key default gen_random_uuid(),owner uuid not null default auth.uid() references public.profiles,module uuid not null references public.modules,unique(owner,module));

create function sikap_private.new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.profiles(id,email,name) values(new.id,coalesce(new.email,''),left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1),'Teacher'),120));return new;end $$;
create trigger sikap_new_user after insert on auth.users for each row execute function sikap_private.new_user();
create function sikap_private.is_head() returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.profiles where id=auth.uid() and role='head')$$;
create function sikap_private.can_access(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select auth.uid() is not null and exists(select 1 from public.modules where id=mid and (owner=auth.uid() or sikap_private.is_head()))$$;
create function sikap_private.object_access(object_key text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.versions where key=object_key and sikap_private.can_access(module))$$;
create function sikap_private.notify_heads(mid uuid,who uuid,message text) returns void language sql security definer set search_path=public,pg_temp as $$insert into public.notifications(owner,module,body) select id,mid,message from public.profiles where role='head' and id<>who$$;
create function sikap_private.file_check(object_key text,filename text,mime text,bytes bigint) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if split_part(object_key,'/',1)<>auth.uid()::text or bytes not between 1 and 20971520 or length(filename) not between 1 and 240 or mime not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or lower(filename) !~ '\.(pdf|docx)$' then raise exception 'Invalid file';end if;
 if not exists(select 1 from storage.objects where bucket_id='sikap-modules' and name=object_key and owner_id=auth.uid()::text and (metadata->>'size')::bigint=bytes and metadata->>'mimetype'=mime) then raise exception 'Uploaded file could not be verified';end if;
end $$;

create function public.submit_module(mid uuid,details jsonb,object_key text,filename text,mime text,bytes bigint) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 perform sikap_private.file_check(object_key,filename,mime,bytes);
 insert into public.modules(id,owner,title,subject,grade,term,year,remarks,deadline) values(mid,auth.uid(),trim(details->>'title'),trim(details->>'subject'),trim(details->>'grade'),trim(details->>'term'),trim(details->>'year'),coalesce(details->>'remarks',''),nullif(details->>'deadline','')::date);
 insert into public.versions(module,version,key,name,type,size,changes) values(mid,1,object_key,filename,mime,bytes,'Initial submission');
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Submitted version 1');
 perform sikap_private.notify_heads(mid,auth.uid(),'A new module is ready for review.');return mid;
end $$;
create function public.revise_module(mid uuid,expected_revision integer,object_key text,filename text,mime text,bytes bigint,changes text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 select * into m from public.modules where id=mid for update;
 if m.owner is distinct from auth.uid() or auth.uid() is null then raise exception 'Only the submitting teacher can revise';end if;
 if m.status<>'returned' or m.archived or m.revision<>expected_revision then raise exception 'Module changed or is locked. Reload before resubmitting.';end if;
 perform sikap_private.file_check(object_key,filename,mime,bytes);
 insert into public.versions(module,version,key,name,type,size,changes) values(mid,m.version+1,object_key,filename,mime,bytes,trim(changes));
 update public.modules set version=version+1,revision=revision+1,status='pending',updated=now() where id=mid;
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Resubmitted version '||(m.version+1));
 perform sikap_private.notify_heads(mid,auth.uid(),m.title||' was revised and resubmitted.');
end $$;
create function public.review_module(mid uuid,expected_revision integer,decision text,feedback text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 select * into m from public.modules where id=mid for update;
 if not sikap_private.is_head() or m.owner=auth.uid() or m.id is null then raise exception 'A different head teacher must review this module';end if;
 feedback=coalesce(feedback,'');
 if m.status<>'pending' or m.archived or m.revision<>expected_revision then raise exception 'Module changed. Reload before reviewing.';end if;
 if decision not in ('approved','returned') or length(feedback)>5000 or (decision='returned' and length(trim(feedback))=0) then raise exception 'A return requires feedback';end if;
 if decision='approved' and not exists(select 1 from public.versions v join storage.objects o on o.bucket_id='sikap-modules' and o.name=v.key where v.module=mid and v.version=m.version) then raise exception 'The final file must exist before approval';end if;
 update public.modules set status=decision,revision=revision+1,updated=now(),approver=case when decision='approved' then auth.uid() end,approved=case when decision='approved' then now() end,final_version=case when decision='approved' then version end,approved_folder=case when decision='approved' then 'approved/'||year||'/'||subject||'/'||grade||'/'||id||'/v'||version end where id=mid;
 if length(trim(feedback))>0 then insert into public.comments(module,author,version,body) values(mid,auth.uid(),m.version,trim(feedback));end if;
 insert into public.events(module,actor,body) values(mid,auth.uid(),case when decision='approved' then 'Approved' else 'Returned' end||' version '||m.version);
 insert into public.notifications(owner,module,body) values(m.owner,mid,m.title||case when decision='approved' then ' was approved.' else ' was returned for revision.' end);
end $$;
create function public.comment_module(mid uuid,message text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin
 select * into m from public.modules where id=mid for update;
 if not sikap_private.can_access(mid) or m.archived then raise exception 'Module unavailable';end if;
 insert into public.comments(module,author,version,body) values(mid,auth.uid(),m.version,trim(message));
 insert into public.events(module,actor,body) values(mid,auth.uid(),'Added feedback on version '||m.version);
 if m.owner<>auth.uid() then insert into public.notifications(owner,module,body) values(m.owner,mid,'New feedback on '||m.title);else perform sikap_private.notify_heads(mid,auth.uid(),'Teacher replied on '||m.title);end if;
end $$;
create function public.archive_module(mid uuid,archive boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.modules;begin select * into m from public.modules where id=mid for update;
 if auth.uid() is null or m.owner is distinct from auth.uid() then raise exception 'Only the submitting teacher can archive';end if;
 if m.status='pending' and archive then raise exception 'Pending submissions must be reviewed first';end if;
 update public.modules set archived=archive,updated=now() where id=mid;insert into public.events(module,actor,body) values(mid,auth.uid(),case when archive then 'Archived module' else 'Restored module' end);end $$;
create function public.change_role(uid uuid,new_role text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin if not exists(select 1 from public.profiles where id=auth.uid() and is_owner) then raise exception 'Only the owner can manage roles';end if;
 if uid=auth.uid() or new_role not in ('head','teacher') then raise exception 'Invalid role change';end if;
 update public.profiles set role=new_role where id=uid and not is_owner;end $$;

create function public.module_details(mid uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin if not sikap_private.can_access(mid) then raise exception 'Module not found or access denied';end if;
 return jsonb_build_object('module',(select to_jsonb(m)||jsonb_build_object('teacher',p.name) from public.modules m join public.profiles p on p.id=m.owner where m.id=mid),'versions',coalesce((select jsonb_agg(v order by v.version desc) from public.versions v where module=mid),'[]'),'comments',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('authorName',p.name) order by c.created) from public.comments c join public.profiles p on p.id=c.author where c.module=mid),'[]'),'events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('actorName',p.name) order by e.created desc) from public.events e join public.profiles p on p.id=e.actor where e.module=mid),'[]'));end $$;
create function public.get_state() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin if auth.uid() is null then raise exception 'Sign in required';end if;
 return jsonb_build_object(
 'user',(select to_jsonb(p)||jsonb_build_object('isOwner',p.is_owner) from public.profiles p where id=auth.uid()),
 'modules',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('teacher',p.name,'approverName',a.name,'file',v.name,'size',v.size,'type',v.type,'starred',exists(select 1 from public.stars s where s.module=m.id and s.owner=auth.uid())) order by m.updated desc) from public.modules m join public.profiles p on p.id=m.owner left join public.profiles a on a.id=m.approver join public.versions v on v.module=m.id and v.version=m.version where m.owner=auth.uid() or sikap_private.is_head()),'[]'),
 'notes',coalesce((select jsonb_agg(n order by n.pinned desc,n.updated desc) from public.notes n where owner=auth.uid()),'[]'),
 'notifications',coalesce((select jsonb_agg(n order by n.created desc) from public.notifications n where owner=auth.uid()),'[]'),
 'teachers',case when sikap_private.is_head() then coalesce((select jsonb_agg(p order by p.name) from public.profiles p),'[]') else '[]'::jsonb end,
 'events',coalesce((select jsonb_agg(x) from (select e.*,p.name as "actorName",m.title from public.events e join public.modules m on m.id=e.module join public.profiles p on p.id=e.actor where m.owner=auth.uid() or sikap_private.is_head() order by e.created desc limit 30)x),'[]'));end $$;

-- No direct mutation of roles, module decisions, version history, or audit records.
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or sikap_private.is_head());
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.modules enable row level security;
create policy modules_read on public.modules for select to authenticated using(owner=auth.uid() or sikap_private.is_head());
alter table public.versions enable row level security;
create policy versions_read on public.versions for select to authenticated using(sikap_private.can_access(module));
alter table public.comments enable row level security;
create policy comments_read on public.comments for select to authenticated using(sikap_private.can_access(module));
alter table public.events enable row level security;
create policy events_read on public.events for select to authenticated using(sikap_private.can_access(module));
alter table public.notes enable row level security;
create policy notes_own on public.notes for all to authenticated using(owner=auth.uid()) with check(owner=auth.uid());
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using(owner=auth.uid());
create policy notifications_mark on public.notifications for update to authenticated using(owner=auth.uid()) with check(owner=auth.uid());
alter table public.stars enable row level security;
create policy stars_own on public.stars for all to authenticated using(owner=auth.uid()) with check(owner=auth.uid() and sikap_private.can_access(module));
revoke all on public.profiles,public.modules,public.versions,public.comments,public.events,public.notifications,public.notes,public.stars from anon,authenticated;
grant select on public.profiles,public.modules,public.versions,public.comments,public.events,public.notifications,public.notes,public.stars to authenticated;
grant update(name,assignment) on public.profiles to authenticated;
grant update(read) on public.notifications to authenticated;
grant insert,update,delete on public.notes to authenticated;
grant insert,delete on public.stars to authenticated;
revoke all on all functions in schema sikap_private from public,anon,authenticated;
grant execute on function sikap_private.is_head(),sikap_private.can_access(uuid),sikap_private.object_access(text) to authenticated;
revoke all on function public.submit_module(uuid,jsonb,text,text,text,bigint),public.revise_module(uuid,integer,text,text,text,bigint,text),public.review_module(uuid,integer,text,text),public.comment_module(uuid,text),public.archive_module(uuid,boolean),public.change_role(uuid,text),public.module_details(uuid),public.get_state() from public,anon;
grant execute on function public.submit_module(uuid,jsonb,text,text,text,bigint),public.revise_module(uuid,integer,text,text,text,bigint,text),public.review_module(uuid,integer,text,text),public.comment_module(uuid,text),public.archive_module(uuid,boolean),public.change_role(uuid,text),public.module_details(uuid),public.get_state() to authenticated;

-- Private, append-only document storage. No UPDATE/DELETE policy: uploads cannot overwrite prior versions.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sikap-modules','sikap-modules',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy sikap_upload on storage.objects for insert to authenticated with check(bucket_id='sikap-modules' and split_part(name,'/',1)=auth.uid()::text and lower(name) ~ '\.(pdf|docx)$');
create policy sikap_read on storage.objects for select to authenticated using(bucket_id='sikap-modules' and sikap_private.object_access(name));
commit;
