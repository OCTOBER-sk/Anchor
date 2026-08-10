<p align="center">
  <img src="dashboard/public/logo.svg" alt="Anchor" width="240" />
</p>

<h1 align="center">Anchor</h1>

<p align="center">
  <b>The memory layer for your AI agents.</b><br/>
  One key, one endpoint. Search, store, and recall context across every runtime — so your agents never re-explain themselves.
</p>

<p align="center">
  <a href="https://github.com/OCTOBER-sk/Anchor/actions/workflows/ci.yml"><img src="https://github.com/OCTOBER-sk/Anchor/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-1A6B4A" alt="License: MIT"></a>
  <a href="https://anchor-dashboard-5mp.pages.dev"><img src="https://img.shields.io/badge/dashboard-live-4ADE9B" alt="Dashboard"></a>
</p>

---

**Anchor** is a remote [MCP](https://modelcontextprotocol.io) server that gives AI agents a persistent, shared memory. Agent sessions start empty — Anchor fixes that. Write a decision once from any runtime; recall it forever from any other.

- **Search** — web search with AI summaries, plus the context you already have, matched in parallel.
- **Dev Search** — package-aware developer answers, biased toward your own project manifest.
- **Memory** — store what you learn; any agent recalls it, in any runtime.

Works with Claude Code, Cursor, OpenCode, Hermes, Antigravity, and any MCP-compatible runtime.

## Quickstart

1. **Create an agent key** — [open the dashboard](https://anchor-dashboard-5mp.pages.dev), sign in, and create a key. Each runtime gets its own.
2. **Point your runtime at Anchor** — every runtime uses the same endpoint and header; only the surrounding config file differs.

```jsonc
// Claude Code — .mcp.json  (also Cursor, Hermes, Antigravity)
{
  "mcpServers": {
    "anchor": {
      "type": "http",
      "url": "https://<your-anchor-endpoint>/mcp",
      "headers": { "Authorization": "Bearer anchor_…" }
    }
  }
}
```

```jsonc
// OpenCode — opencode.json
{
  "mcp": {
    "anchor": {
      "type": "http",
      "url": "https://<your-anchor-endpoint>/mcp",
      "headers": { "Authorization": "Bearer anchor_…" }
    }
  }
}
```

3. **Verify** — ask your agent to call `anchor_recall`; it answers from memory.

Full setup: [Quickstart guide](https://anchor-dashboard-5mp.pages.dev/docs/quickstart) · [All documentation](https://anchor-dashboard-5mp.pages.dev/docs)

## Capabilities

| Tool | What it does |
|---|---|
| `anchor_search` | Web search with AI summarization, dork operators, and automatic injection of related memories. |
| `anchor_dev_search` | Package-registry-aware developer search, ranked against your project manifest. |
| `anchor_remember` | Store a persistent memory under tags you choose. |
| `anchor_recall` | Retrieve memories semantically similar to a query, with similarity scores. |
| `anchor_guide` | In-server usage documentation for the other tools. |

## Architecture

```
┌─────────────────────┐        ┌──────────────────────┐
│  Runtime (MCP client)│  HTTP  │  Anchor server        │
│  Claude Code / ...   │ ─────► │  JSON-RPC 2.0 / MCP    │
└─────────────────────┘        └───────┬──────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              ┌───────────┐    ┌──────────────┐   ┌─────────────┐
              │  Memory   │    │ Agent keys   │   │   Search    │
              │  (vector) │    │  (registry)  │   │   sources   │
              └───────────┘    └──────────────┘   └─────────────┘
```

- **Server** — the MCP endpoint: auth (one agent key per runtime), rate limits, search with automatic fallback between sources, semantic memory, auto-recall injection. Ships with a 177-test suite.
- **Dashboard** — the key and usage surface: create and revoke keys, watch activity. Dark-only, editorial type.
- **Memory** — semantic vector search with automatic recall of related context on every search.
- **Keys** — one registry, one row per runtime key; raw keys are shown exactly once, at creation.

## Repository layout

```
worker/     MCP server — protocol, API, storage, tests
dashboard/  Web dashboard — React app, docs, design system
```

## Local development

```bash
# Server
cd worker
npm ci
npm test              # 177 tests
npx tsc --noEmit

# Dashboard
cd dashboard
npm ci
npm run dev           # local dev server
npm run typecheck && npm run build
```

## Documentation

- [Live docs](https://anchor-dashboard-5mp.pages.dev/docs) — quickstart, capabilities, API reference, troubleshooting

## License

[MIT](./LICENSE) © 2026 Santhoshkumar S
