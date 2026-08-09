-- Anchor §6.1 — Supabase memories table + pgvector + RPC + RLS
-- Requires the pgvector extension
create extension if not exists vector;

create table if not exists memories (
  id              uuid primary key default gen_random_uuid(),
  owner_id        text not null,              -- developer account id (see auth/ownership.ts)
  agent_id        text not null,               -- which agent key wrote this (for provenance, not access control)
  content         text not null,
  embedding       vector(768) not null,        -- matches Gemini text-embedding-004 dimensionality; confirm against active model at deploy time
  tags            text[] default '{}',
  source_tool     text not null check (source_tool = 'anchor_remember'),  -- provenance only; no search-write path exists in the product
  created_at      timestamptz not null default now()
);

-- Vector similarity index (IVFFlat; adequate at this table's expected scale —
-- hundreds of thousands of rows, not tens of millions)
create index if not exists memories_embedding_idx
  on memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists memories_owner_idx on memories (owner_id);
create index if not exists memories_created_idx on memories (created_at desc);

-- RPC: match_memories — used by both the full anchor_recall path
-- (caller-tunable threshold/count) and the fixed-parameter auto-recall
-- lite path (storage/supabase.ts::matchMemoriesLite calls this same RPC
-- with fixed args, per the module spec in §4 — no second RPC definition)
create or replace function match_memories (
  query_embedding vector(768),
  match_threshold  float,
  match_count      int,
  filter_owner_id  text
)
returns table (
  id          uuid,
  content     text,
  tags        text[],
  similarity  float,
  created_at  timestamptz
)
language sql stable
as $$
  select
    memories.id,
    memories.content,
    memories.tags,
    1 - (memories.embedding <=> query_embedding) as similarity,
    memories.created_at
  from memories
  where memories.owner_id = filter_owner_id
    and 1 - (memories.embedding <=> query_embedding) > match_threshold
  order by memories.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS: service-role key (used server-side by storage/supabase.ts) bypasses
-- RLS by default in Supabase, but the policy is defined anyway as
-- defense-in-depth in case a future client-side/anon-key path is added.
alter table memories enable row level security;

create policy "owner can read own memories"
  on memories for select
  using (owner_id = current_setting('request.jwt.claims', true)::json->>'owner_id');

create policy "owner can insert own memories"
  on memories for insert
  with check (owner_id = current_setting('request.jwt.claims', true)::json->>'owner_id');
