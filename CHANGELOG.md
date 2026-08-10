# Changelog

All notable changes to Anchor are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/); this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-08-10

Anchor is live: remote MCP server on Cloudflare Workers + dashboard on Cloudflare Pages, with pgvector semantic memory.

### Added
- MCP server (`/mcp`): `anchor_search`, `anchor_dev_search`, `anchor_remember`, `anchor_recall`, `anchor_guide` — JSON-RPC 2.0 over Streamable HTTP (protocol 2025-11-25)
- Dashboard (React): onboarding, agent-key management (create/edit/revoke, reveal-once), usage stats, activity, settings
- Docs: quickstart, capability guides, API reference, troubleshooting
- Brand: Anchor logo (anchor + memory glyph), favicon, dark-only theme, thin editorial type
- Infra: KV namespaces (agent keys, rate limits, response cache), cron keepalive, magic-link auth

### Fixed
- Dashboard JWT introspection used the user token as the API key → now uses the project anon key
- Turso client dropped the `Authorization` header through the SSRF-guard wrapper → headers preserved, regression tests added
- Memory layer down: `text-embedding-004` retired (404) → `gemini-embedding-001` (3072-dim), pgvector migrated `vector(768)` → `vector(3072)` with an HNSW/halfvec index (pgvector caps vector-type ANN indexes at 2000 dims)
- Supabase magic links pointed at `localhost:3000` → site URL set to the live dashboard
- Capability docs routes redirected to the docs home → routed through `capabilities/:capabilityId`
- CORS blocked the dashboard's own API calls → wildcard support for Pages origins
- Dashboard API calls hit the Pages origin (404) → built with the worker API URL
- Settings profile phone editor had no backend endpoint → email-only profile

### Security
- Agent keys stored as SHA-256 hashes; raw key shown exactly once at creation
- SSRF guard on all outbound fetches; row-level security on memory storage
