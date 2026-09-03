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

-- ================= LEADERBOARD =================
-- Stores individual run results for the global leaderboard.
create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null default '匿名玩家',
  character_id text,
  character_name text,
  character_icon text,
  victory boolean not null default false,
  death_cause text not null default '',
  act int not null default 1,
  floor int not null default 0,
  score int not null default 0,
  final_hp int not null default 0,
  max_hp int not null default 0,
  enemies_defeated int not null default 0,
  elites_defeated int not null default 0,
  bosses_defeated int not null default 0,
  gold_earned int not null default 0,
  relic_ids jsonb,
  deck_ids jsonb,
  created_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

-- Anyone (even anonymous) can read the leaderboard.
create policy "Anyone can view leaderboard"
  on public.leaderboard for select
  using (true);

-- Only authenticated users can insert their own runs.
create policy "Users can insert their own runs"
  on public.leaderboard for insert
  with check (auth.uid() = user_id);

-- Users can delete their own runs (optional, for cleanup).
create policy "Users can delete their own runs"
  on public.leaderboard for delete
  using (auth.uid() = user_id);

-- ================= MONSTER RATINGS =================
-- Stores player thumbs-up/down ratings after combat.
create table if not exists public.monster_ratings (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  direction text not null check (direction in ('up', 'down')),
  enemy_ids text[] not null default '{}',
  combat_key text not null default '',
  tier text not null default 'normal',
  created_at timestamptz not null default now()
);

alter table public.monster_ratings enable row level security;

-- Anyone can read aggregate ratings (for stats display).
create policy "Anyone can view monster ratings"
  on public.monster_ratings for select
  using (true);

-- Authenticated users can insert their own ratings.
create policy "Users can insert their own ratings"
  on public.monster_ratings for insert
  with check (auth.uid() = user_id);

-- Allow anonymous inserts (if anonymous auth is enabled).
create policy "Anonymous can insert ratings"
  on public.monster_ratings for insert
  with check (true);

-- ================= PVP DECKS =================
-- Stores a player's final deck + relics + HP after clearing the game,
-- so other players can challenge them in async PVP.
create table if not exists public.pvp_decks (
  user_id uuid references auth.users(id) on delete cascade primary key,
  player_name text not null default '匿名玩家',
  character_id text,
  character_name text,
  character_icon text,
  max_hp int not null default 80,
  deck_ids jsonb not null default '[]'::jsonb,   -- ["strike","defend","strike+"...]
  relic_ids jsonb not null default '[]'::jsonb,    -- ["relic_id",...]
  wins int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.pvp_decks enable row level security;

-- Anyone can view PVP decks (to build the challenge roster).
create policy "Anyone can view pvp decks"
  on public.pvp_decks for select
  using (true);

-- Users can upsert their own deck.
create policy "Users can upsert their own pvp deck"
  on public.pvp_decks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own pvp deck"
  on public.pvp_decks for update
  using (auth.uid() = user_id);

-- Allow anonymous to read (for roster).
create policy "Anonymous can view pvp decks"
  on public.pvp_decks for select
  using (true);

-- Trigger for updated_at.
drop trigger if exists trg_pvp_decks_updated_at on public.pvp_decks;
create trigger trg_pvp_decks_updated_at
  before update on public.pvp_decks
  for each row execute function public.set_updated_at();

-- ================= PVP BATTLE LOGS =================
create table if not exists public.pvp_battle_logs (
  id bigint generated always as identity primary key,
  attacker_id uuid references auth.users(id) on delete set null,
  attacker_name text not null default '',
  defender_id uuid references auth.users(id) on delete set null,
  defender_name text not null default '',
  winner_id uuid,
  winner_name text not null default '',
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.pvp_battle_logs enable row level security;

-- Anyone can read battle logs.
create policy "Anyone can view pvp battle logs"
  on public.pvp_battle_logs for select
  using (true);

-- Authenticated users can insert their own battles.
create policy "Users can insert their own pvp battles"
  on public.pvp_battle_logs for insert
  with check (auth.uid() = attacker_id);

-- Allow anonymous inserts.
create policy "Anonymous can insert pvp battles"
  on public.pvp_battle_logs for insert
  with check (true);
