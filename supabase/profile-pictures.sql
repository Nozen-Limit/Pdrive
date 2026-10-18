begin;
alter table public.profiles add column if not exists avatar_key text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sikap-avatars','sikap-avatars',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists sikap_avatar_upload on storage.objects;
create policy sikap_avatar_upload on storage.objects for insert to authenticated with check(sikap_private.is_approved() and bucket_id='sikap-avatars' and split_part(name,'/',1)=auth.uid()::text and lower(name) ~ '\.(jpg|jpeg|png|webp)$');
drop policy if exists sikap_avatar_read on storage.objects;
create policy sikap_avatar_read on storage.objects for select to authenticated using(bucket_id='sikap-avatars' and sikap_private.is_approved() and exists(select 1 from public.profiles p where p.avatar_key=name and (p.id=auth.uid() or sikap_private.is_head())));
create or replace function public.set_profile_photo(object_key text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not sikap_private.is_approved() then raise exception 'Account approval required';end if;
 if object_key is not null and (split_part(object_key,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='sikap-avatars' and name=object_key and owner_id=auth.uid()::text and (metadata->>'size')::bigint between 1 and 2097152 and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp'))) then raise exception 'Profile picture could not be verified';end if;
 update public.profiles set avatar_key=object_key where id=auth.uid();
end $$;
revoke all on function public.set_profile_photo(text) from public,anon;
grant execute on function public.set_profile_photo(text) to authenticated;
commit;
