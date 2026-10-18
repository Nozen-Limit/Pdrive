-- Run in the existing Supabase SQL Editor. Preserves accounts and department values.
begin;
alter table public.profiles add column if not exists subjects text[] not null default '{}' check(cardinality(subjects)<=30 and octet_length(subjects::text)<=4000);
alter table public.profiles add column if not exists grade_levels text[] not null default '{}' check(cardinality(grade_levels)<=30 and octet_length(grade_levels::text)<=4000);
alter table public.profiles add column if not exists phone text not null default '' check(length(phone)<=40);
alter table public.profiles add column if not exists location text not null default '' check(length(location)<=200);
-- Existing own-profile RLS continues to apply. Role/approval columns remain protected.
grant update(subjects,grade_levels,phone,location) on public.profiles to authenticated;
commit;
