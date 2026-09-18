-- Slate — generations schema.
-- Apply in the Supabase SQL editor once the project exists.
-- Mirrors lib/generation/types.ts; the Supabase store adapter maps to it 1:1.

-- Idempotent: safe to re-run. CREATE TYPE has no IF NOT EXISTS.
do $$ begin
  create type generation_status as enum ('queued', 'generating', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type generation_stage as enum ('image', 'render', 'encode', 'upload');
exception when duplicate_object then null; end $$;

create table if not exists generations (
  id             uuid primary key default gen_random_uuid(),
  device_id      text        not null,
  prompt         text        not null check (char_length(prompt) between 3 and 2000),
  model          text        not null,
  motion         text        not null default 'static',
  duration_s     int         not null check (duration_s between 4 and 30),
  aspect_ratio   text        not null check (aspect_ratio in ('21:9','16:9','4:3','1:1','4:5','9:16')),
  resolution     text        not null check (resolution in ('480p','720p','1080p')),
  bitrate        text        not null check (bitrate in ('standard','high')),
  reference_url  text,
  seed           bigint      not null,
  status         generation_status not null default 'queued',
  stage          generation_stage,
  progress       int         not null default 0 check (progress between 0 and 100),
  output_url     text,
  poster_url     text,
  file_bytes     bigint,
  error_code     text,
  error_message  text,
  provider       text        not null default 'cinematic',
  adjustments    jsonb       not null default '[]'::jsonb,
  retry_of       uuid        references generations(id) on delete set null,
  heartbeat_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz
);

-- History is always "this device, newest first".
create index if not exists generations_device_created_idx
  on generations (device_id, created_at desc);

-- Supports the stale sweep without scanning finished rows.
create index if not exists generations_stale_idx
  on generations (status, heartbeat_at)
  where status in ('queued', 'generating');

alter table generations enable row level security;

-- No anon policies: every write goes through the server using the service role,
-- which is what lets device ownership be enforced by signed cookie rather than
-- by a client-supplied id that anyone could forge.

-- Storage buckets are created programmatically by scripts/setup-storage.mjs:
--   outputs    : public read, server write  (mp4 + poster)
--   references : public read, server write, 10MB object limit
