# Contributing to Anchor

Thanks for taking the time to contribute. Anchor is a memory layer for AI agents — a remote MCP server with a web dashboard. This project is maintained by one person on a strict free-tier budget, so please keep changes small and reviewable.

## Getting started

1. Fork the repository and clone your fork.
2. Set up the worker (`cd worker && npm ci`) and the dashboard (`cd dashboard && npm ci`).
3. Run the worker test suite before and after your change: `cd worker && npm test`.

## Before you open a PR

- **One goal per PR.** No side refactors, no opportunistic "improvements".
- **Tests.** Worker changes must include tests (`cd worker && npm test` — vitest). Dashboard changes must pass `npm run typecheck` and `npm run build`.
- **Copy discipline.** User-facing text: no tech-stack names (no provider/database/model names), no hype words, no "beta"/"working" phrasing. Call it a capability, not a tool.
- **Free-tier constraint.** Everything must stay within free tiers. If your change adds a provider or a paid feature, it will be rejected.

## Pull request checklist

- [ ] `npm test` passes in `worker/`
- [ ] `npm run typecheck && npm run build` pass in `dashboard/`
- [ ] No unrelated changes in the diff
- [ ] User-facing copy follows the discipline above

## Reporting bugs

Open an issue with the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include the exact request you made, the response you got, and the error code if there was one (e.g. `RATE_LIMITED`, `MEMORY_UNAVAILABLE`).

## Security

Found a vulnerability? Do **not** open a public issue. See [SECURITY.md](./SECURITY.md).
