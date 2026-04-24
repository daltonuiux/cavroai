-- Cavro AI — initial schema
-- Run this in the Supabase SQL editor to create the required tables.

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table if not exists clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  website_url       text not null,
  created_at        timestamptz not null default now(),
  relationship_type text,               -- current_client | past_client | warm | cold
  services          text[],
  focus             text,
  connections       text[],
  contact           jsonb                -- { name, role, linkedin? }
);

-- ---------------------------------------------------------------------------
-- analyses
-- ---------------------------------------------------------------------------

create table if not exists analyses (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  created_at          timestamptz not null default now(),
  status              text not null default 'pending', -- pending | complete | error
  summary             text,
  strategic_direction text[],
  opportunities       jsonb,             -- Opportunity[]
  suggested_pitch     text,
  recommended_actions jsonb,             -- RecommendedAction[]
  changes             jsonb,             -- SignalChange[]
  change_summary      text[],
  signals             jsonb,             -- Signals (current)
  last_signals        jsonb,             -- Signals (previous, for diff)
  last_analyzed_at    timestamptz,
  error_message       text
);

create index if not exists analyses_client_id_idx on analyses(client_id);
create index if not exists analyses_status_idx    on analyses(status);
create index if not exists analyses_created_at_idx on analyses(created_at desc);
