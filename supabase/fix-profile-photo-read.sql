-- Correct the correlated object-name reference without changing who can view photos.
begin;
drop policy if exists sikap_avatar_read on storage.objects;
create policy sikap_avatar_read on storage.objects for select to authenticated
using (bucket_id='sikap-avatars' and sikap_private.is_approved() and exists (
  select 1 from public.profiles p
  where p.avatar_key=storage.objects.name
    and (p.id=auth.uid() or sikap_private.is_head())
));
commit;
