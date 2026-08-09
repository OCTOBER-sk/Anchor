create table if not exists agents (
  id                  text primary key,           -- uuid, generated at creation
  key_hash            text not null unique,        -- sha-256 of the full agent key; raw key is never stored
  slug                text not null,
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
