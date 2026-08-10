# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email the maintainer privately (see the [GitHub profile](https://github.com/OCTOBER-sk)) with:

- A short description of the issue
- The affected component (worker, dashboard, or auth)
- Steps to reproduce, if available

You will receive an acknowledgement within a few days, and a fix will be shipped as soon as possible. Public disclosure happens after the fix is live.

## Scope

- The MCP server endpoint (`/mcp`) and REST API (`/api/*`)
- Agent-key authentication and rate limiting
- The dashboard (Cloudflare Pages)
- Data isolation between agent keys (memory and usage records)

## Out of scope

- Social engineering of users
- Attacks requiring physical access to a user's device
- Known-fake "security" tool output from third-party AI runtimes

## Safe harbor

Researchers who report in good faith, follow this policy, and avoid privacy violations or service disruption are welcome. Please do not test against the live production endpoint without explicit permission — use the repository's test suite and local development setup instead.
