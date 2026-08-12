-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Stores each user's meta-progression (achievements, discovery log, lifetime stats)
-- as a single JSON blob, keyed by their auth.users id.

create table if not exists public.profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each logged-in user can only read/write their own row.
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
