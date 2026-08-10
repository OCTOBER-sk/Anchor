create table if not exists agents (
  id                  text primary key,           -- uuid, generated at creation
  key_hash            text not null unique,        -- sha-256 of the full agent key; used for auth (raw key never compared)
  key_ciphertext      text,                        -- AES-256-GCM of the raw key (base64 iv||ct||tag) for dashboard reveal; NULL for pre-migration keys
  slug                text not null,
  name                text not null default '',    -- free-form display name (editable); slug is derived and fixed
  owner_id            text not null,               -- ties to the same owner_id used in Supabase memories
  tier                text not null default 'standard' check (tier in ('standard', 'admin', 'debug')),
  rate_limit_per_min  integer not null default 30,
  rate_limit_per_day  integer not null default 500,
  status              text not null default 'active' check (status in ('active', 'revoked')),
  created_at          text not null default (datetime('now')),
  last_used_at        text
);

create index if not exists agents_key_hash_idx on agents (key_hash);
create index if not exists agents_owner_idx on agents (owner_id);

-- Append-only request log for the dashboard usage/activity endpoints
-- (frontend.md §4.1 — "backend addition required" implemented in this phase).
-- created_at is an ISO-8601 string so the Worker can write it without
-- relying on database timezones/clock.
create table if not exists requests (
  id          text primary key,          -- uuid, generated in the Worker
  agent_id    text not null,             -- which agent key produced this call
  tool_name   text not null,             -- anchor_search | anchor_dev_search | anchor_remember | anchor_recall | anchor_guide
  status      text not null,             -- 'success' | 'error'
  error_code  text,                      -- platform code (e.g. SEARCH_UNAVAILABLE) when status = 'error'
  latency_ms  integer not null,
  created_at  text not null
);

create index if not exists requests_agent_created_idx on requests (agent_id, created_at);
