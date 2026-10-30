-- Gym Tracker schema
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement checks whether the object already exists.

-- One row per training session: a real calendar date + the body part trained.
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  body_part   text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, date, body_part)
);

-- One row per logged set. Exercise is stored by name, so editing the exercise
-- list in the app never touches existing history.
create table if not exists public.sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  exercise    text not null,
  set_number  smallint not null check (set_number between 1 and 20),
  weight_kg   numeric(6,2) check (weight_kg >= 0),
  reps        smallint check (reps >= 0),
  updated_at  timestamptz not null default now(),
  unique (workout_id, exercise, set_number)
);

-- Which body part each weekday is set to (1 = Monday ... 7 = Sunday),
-- so the day screen preselects it on every device.
create table if not exists public.day_preferences (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),
  body_part   text not null,
  primary key (user_id, weekday)
);

create index if not exists workouts_user_date_idx on public.workouts (user_id, date);
create index if not exists sets_user_exercise_idx on public.sets (user_id, exercise);

-- Row Level Security: each signed-in user can only see and change their own rows.
alter table public.workouts        enable row level security;
alter table public.sets            enable row level security;
alter table public.day_preferences enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'workouts' and policyname = 'own workouts') then
    create policy "own workouts" on public.workouts
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sets' and policyname = 'own sets') then
    create policy "own sets" on public.sets
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'day_preferences' and policyname = 'own day preferences') then
    create policy "own day preferences" on public.day_preferences
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
