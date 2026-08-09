# Anchor

The memory layer for your AI agents. Remote MCP server on Cloudflare Workers — Search, Dev Search, Memory behind one key, one endpoint.

## Specs

- `backend.md` — full backend engineering spec (greenfield, free-tier only): Cloudflare Worker MCP server, auth, rate limits, search providers, Supabase pgvector memory, auto-recall injection.
- `frontend.md` — full frontend spec: React 19 + Vite + Tailwind dashboard on Cloudflare Pages, locked design language (Zodiak/Switzer/JetBrains Mono, warm paper-light), onboarding flow, dashboard REST contract (flagged as backend additions).

## Stack (100% free tier)

Cloudflare Workers + KV · Supabase (pgvector) · Turso · Cerebras ↔ Gemini · Tavily / DDG / Apify
