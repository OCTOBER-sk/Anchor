# Changelog

All notable changes to Anchor are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/); this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Re-viewable agent keys** — create a key with a tier (standard / admin / debug) and reveal or copy any key again from the dashboard, any time (keys are encrypted at rest)
- **Connect step** after key creation — copy-ready runtime config and an agent setup prompt, so a newly connected agent loads its capabilities on the first session
- Landing demo terminal now types inside a fixed box — the page stays perfectly still while it animates

## [1.0.0] — 2026-08-10

Anchor is live: a remote MCP server with a web dashboard and semantic vector memory.

### Added
- MCP server (`/mcp`): `anchor_search`, `anchor_dev_search`, `anchor_remember`, `anchor_recall`, `anchor_guide` — JSON-RPC 2.0 over Streamable HTTP (protocol 2025-11-25)
- Dashboard: onboarding, agent-key management (create/edit/revoke, reveal-once), usage stats, activity, settings
- Docs: quickstart, capability guides, API reference, troubleshooting
- Brand: Anchor logo (anchor + memory glyph), favicon, dark-only theme, thin editorial type
- Infra: key registry, rate-limit and cache layers, scheduled keepalive, magic-link auth

### Fixed
- Dashboard session verification used the wrong API key → corrected, regression tests added
- Key registry client dropped the `Authorization` header through the request guard → headers preserved, regression tests added
- Memory layer down: the embedding model in use was retired → switched to the current model, vector store migrated and re-indexed
- Magic links pointed at a localhost placeholder → site URL set to the live dashboard
- Capability docs routes redirected to the docs home → routed through a parameterized path
- Browser access from the dashboard's own origin was blocked → origin allowlist supports wildcard subdomains
- Dashboard API calls hit the wrong origin (404) → built with the correct API endpoint
- Settings profile phone editor had no backend endpoint → email-only profile

### Security
- Agent keys stored as hashes; raw key shown exactly once at creation
- SSRF guard on all outbound fetches; row-level security on memory storage
