# Anchor — Frontend Engineering Spec

**Status**: greenfield build spec, companion to `backend.md`. Source of truth
for all MCP tool names, key format, protocol version, and error conventions
is `backend.md` — nothing in this document redefines them, only consumes
them.

**Fallback naming**: if the backend falls back to "Threadline"
(`threadline_*`), swap every `anchor_*` reference in this document
accordingly. Zero other changes.

---

## 0. Decisions Made to Close Gaps in the Brief

Two things the brief asked for aren't defined in `backend.md` and are
resolved here, explicitly, so implementation doesn't stall on ambiguity.

**0.1 — Dashboard auth model.** `backend.md` never defines end-user auth —
its only "auth" is agent-key verification for MCP calls, and its only use
of Supabase is the `service_role` pgvector store (§6.1, §7). The dashboard
needs a *separate*, human-facing login. Per product context (solo developer,
no public onboarding — `backend.md` §1 non-goals), the dashboard uses
**Supabase Auth, single-user, email OTP (magic link) as the credential**.
Phone number is captured as **profile metadata only** (shown in Settings,
used for nothing functional in v1 — no SMS OTP, no 2FA). Rationale: Supabase
Auth doesn't natively support "email + phone as one combined login step,"
and building that pairing for exactly one user is effort spent on a problem
that doesn't exist yet. If this is wrong for your actual use case, the
fallback is even simpler — see §5.7.

**0.2 — Dashboard REST API.** `backend.md` defines the MCP surface only
(`/mcp`, JSON-RPC). The dashboard needs plain REST endpoints for key CRUD
and usage display. §4 below specifies this contract in full and flags it
**"backend addition required"** — none of it exists in `backend.md` today.

---

## 1. Scope & Page Map

| Route | Purpose | Auth required |
|---|---|---|
| `/` | Landing — product pitch, 3 capability blocks, CTA to sign in | No |
| `/login` | Supabase Auth email-OTP entry | No |
| `/auth/callback` | Magic-link redirect handler, exchanges token → session | No |
| `/dashboard` | Home — usage overview, activity feed, agent key list | Yes |
| `/dashboard/onboarding` | First-run 2-minute setup flow (also reachable anytime) | Yes |
| `/dashboard/settings` | Profile (email, phone), key management, danger zone | Yes |
| `/docs` | Docs index — introduction | No |
| `/docs/quickstart` | Quickstart — same content as onboarding, static/shareable | No |
| `/docs/capabilities/search` | Capability page: Search (web search + AI summaries + auto-recall) | No |
| `/docs/capabilities/dev-search` | Capability page: Dev Search (package-aware developer search) | No |
| `/docs/capabilities/memory` | Capability page: Memory (persistent, cross-runtime recall) | No |
| `/docs/api-reference` | MCP protocol reference (from `backend.md` §8) — anchors: authentication, transport, error codes, rate limits | No |
| `/docs/troubleshooting` | Common errors mapped to `backend.md` §8 error table | No |

No routes beyond this list. No admin panel, no team/org pages, no billing
pages — all explicitly out of scope per `backend.md` §1.

---

## 2. Design System

### 2.1 Tokens (locked — verbatim)

Color tokens are **space-separated RGB triplets** declared as CSS variables in
`src/styles/globals.css`. `:root` holds the warm-paper light palette
(kept verbatim, no longer reachable); `.dark` holds the warm-paper **dark**
palette. `tailwind.config.ts` maps every token into a utility as
`rgb(var(--token) / <alpha-value>)` with `darkMode: 'class'`, so every surface
— backgrounds, text hierarchy, borders, status colors, code blocks, selection,
focus rings — resolves against the dark palette because the app is
**dark-only**: `.dark` is forced on `<html>` before first paint. Opacity
modifiers (`/50`, `/12`, …) work everywhere; the `/12` status tint is a named
step in the config's `opacity` scale.

**Light (`:root`) — warm paper, primary mode:**

```css
--bg-base:      #FAF8F4;
--bg-raised:    #F4F1EB;
--bg-sunken:    #EFECE4;

--text-primary:   #1A1A18;
--text-secondary: #4A4A45;
--text-tertiary:  #6E6E68;

--accent:        #1A6B4A;
--accent-hover:  #155C3E;
--accent-subtle: #E8F4EE;

--border-default: #E2DED5;
--border-strong:  #C8C4BB;
--border-accent:  #A8D4BC;

--status-success: #1A6B4A;
--status-warning: #B45309;
--status-error:   #B91C1C;

--code-bg:      #1C1C1A;
--code-text:    #E8E4DC;
--code-accent:  #5EC99A;
--code-string:  #D4A76A;
```

**Dark (`.dark`) — warm paper, never pure black** (contrast validated:
primary ≈15:1, secondary ≈7:1, accent ≥7:1 on dark bg; do not weaken):

```css
--bg-base:      #0E0F0D;
--bg-raised:    #161713;
--bg-sunken:    #1D1E1A;

--text-primary:   #F2F0E8;
--text-secondary: #B8B6AC;
--text-tertiary:  #8A887F;

--accent:        #4ADE9B;
--accent-hover:  #63E7AC;
--accent-subtle: #132A1F;

--border-default: #2A2B26;
--border-strong:  #3A3B34;
--border-accent:  #23563F;

--status-success: #4ADE9B;
--status-warning: #D9A05B;
--status-error:   #E57470;

--code-bg:      #0A0B09;
--code-text:    #E8E4DC;
--code-accent:  #5EC99A;
--code-string:  #D4A76A;
```

Code-block colors are dark in **both** modes (they already were). A single
`--overlay` token (the light-mode `text-primary` RGB, rendered at `/50`) is
the modal/scrim backdrop in both modes — modals stay dimmed in dark mode too.

**Dark-only (no toggle):** a single inline script in `dashboard/index.html`
runs before the bundle loads and forces the app dark with no flash:
`document.documentElement.classList.add('dark')`. There is **no theme
toggle** — no `ThemeToggle` component, no `localStorage` theme key, no
`matchMedia` theme logic, no light-mode render path. A single
`<meta name="theme-color" content="#0E0F0D">` matches the dark `bg-base`.
The `:root` light palette is retained in `globals.css` only to keep the token
block stable; nothing ever renders under it.

No other colors exist in the system. No gradients, no shadows, no glow, in
either mode.

### 2.2 Typography

| Role | Font | Weights | Source |
|---|---|---|---|
| Display (H1, H2, hero) | Zodiak | 400, 600 | Fontshare |
| Body / UI | Switzer | 400, 500, 600 | Fontshare |
| Code / config / keys | JetBrains Mono | 400, 500 | Google Fonts |

**Scale** (rem, 16px base):

| Token | Size | Line-height | Use |
|---|---|---|---|
| `display-xl` | 3rem | 1.1 | Landing hero only |
| `display-lg` | 2.25rem | 1.15 | Page H1 |
| `display-md` | 1.5rem | 1.2 | Section H2 |
| `body-lg` | 1.0625rem | 1.6 | Lead paragraphs |
| `body-md` | 0.9375rem | 1.6 | Default body |
| `body-sm` | 0.875rem | 1.5 | Meta, captions, labels |
| `mono-md` | 0.875rem | 1.5 | Inline code, snippets |
| `mono-sm` | 0.8125rem | 1.4 | Key strings, table cells |

Zodiak is used **only** for headlines and the wordmark — never for body
copy, buttons, or form labels. Switzer carries every UI surface. This
split is what keeps the "editorial, not generic-AI-tool" character; do not
blend them within one text block.

**Heading weight & tracking (sharp, editorial):** `h1`/`h2`/`h3` render at
`font-medium` (500) with `letter-spacing: -0.01em` (globals.css base rule).
The wordmark ("Anchor" in the landing NavBar) is `font-medium` as well. Body
copy stays `font-normal` (400). No weight or family beyond the loaded set
(fonts.css) — the 500 headline weight resolves against Zodiak's loaded
400/600 faces.

**Logo & favicon:** `dashboard/public/logo.svg` (flat mint `#4ADE9B` mark +
"Anchor" in thin serif `#F2F0E8`, used at ~28px on the nav, docs sidebar,
login, and dashboard shell) and `dashboard/public/favicon.svg` (mark only,
linked from `index.html`) — both on transparent, no gradients or glow.

**Italics:** Fontshare's Zodiak exposes only a `wght` axis — there is no
italic face (verified against the Fontshare API). The landing hero's single
accent word is therefore rendered in regular serif with `text-accent`; the
recall demo in the hero carries the emphasis instead. Never fake an italic
with a fallback font or a synthetic slant.

### 2.3 Spacing Rhythm

8px base unit. Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

- Card padding: 24px (mobile) / 32px (desktop).
- Section vertical rhythm: 64px between major sections, 96px on landing.
- Form field gap: 16px.
- Button padding: 12px 20px (default), 10px 16px (small/inline).

### 2.4 Component Style Rules

- **Cards**: `bg-raised`, 1px `border-default`, 12px radius, no shadow at
  rest; on hover, border shifts to `border-strong` — no shadow-based
  elevation anywhere in the system (flat, paper-like, matches the
  "warm paper-light" character).
- **Buttons**: primary = `accent` fill, white text, `accent-hover` on
  hover; secondary = transparent fill, `border-default`, text in
  `text-primary`; both 8px radius, Switzer 500.
- **Inputs**: `bg-sunken`, 1px `border-default`, 8px radius, focus ring =
  2px `border-accent` outline (`box-shadow: 0 0 0 2px rgb(var(--border-accent))`),
  no glow/shadow. Selection also uses the `border-accent`/`text-primary` tokens
  so it flips in dark mode.
- **Code blocks**: always `code-bg`/`code-text` (dark in both modes), JetBrains
  Mono, 8px radius, copy-button top-right (see §5.3 for behavior).
- **Status badges**: pill shape, `body-sm`, colored text on a 12%-opacity
  tint of the same status color as background (e.g. success badge =
  `text-status-success` on `bg-status-success/12`). The `/12` step lives in
  the config's `opacity` scale.
- **Capability icons**: line-weight SVG icons only (stroke, not fill), 1.5px
  stroke, `text-secondary` at rest / `accent` on the active card — no icon
  library dependency (hand-authored SVGs, keeps the "no paid icons"
  constraint trivially true and avoids generic icon-pack look).
- **Dark-only (no toggle)**: the app is always dark — `.dark` is forced on
  `<html>` before first paint; no theme toggle, no `localStorage` theme key,
  no light-mode render path (§2.1).
- **Decorative notch**: a single 12px `clip-path` corner utility
  (`.clip-corner`) exists for the landing recall terminal only. Never on
  buttons or cards, so focus rings always survive.

### 2.5 Product Surface Discipline (owner directive — non-negotiable)

Anchor's frontend presents a **professional, finished product** — never a
DIY/hobbyist surface. Two hard rules, applied everywhere (landing, dashboard,
docs, error messages, meta tags, empty states):

**Rule 1 — Zero tech-stack leakage.** Never mention, anywhere user-facing:
Tavily, DuckDuckGo, Apify, Cerebras, Gemini, Supabase, Turso, Cloudflare,
KV, pgvector, embeddings, "AI providers", model names, or any database/
infrastructure vocabulary. Capabilities are described by *what they do*, never
by *what powers them*. This includes: landing copy, dashboard copy, docs, tool
descriptions inside the product, error strings surfaced to the UI, and HTML
meta/OG tags. (Backend sanitization already guarantees error messages carry
platform categories only — the frontend must extend that discipline to all of
its own copy.)

**Rule 2 — No immature wordings.** Banned anywhere in the UI: "Working…",
"Under construction", "Coming soon" (unless genuinely dated), "Version x.y.z",
"Beta", "prototype", "demo", "TODO", lorem/placeholder text, "not yet
implemented", or any construction-state language. Every surface renders as if
it shipped yesterday: real copy, proper empty states (§4.4), real loading
states, zero placeholders. Shells during development must be visually clean —
a page with no data shows its empty state, not a notice.

**Surface doctrine**: the landing is a Decide/Learn surface (one idea per
section — a hero is correct there); the dashboard is a Monitor surface
(density, glanceable hierarchy — no hero, no marketing framing, no decorative
stats); settings/onboarding are Configure surfaces (progressive disclosure,
clear validation, low decoration). Never reach for the generic
hero-plus-three-equal-cards composition outside the landing, and even there
cards must be differentiated, not tiles.

**Terminology dictionary** (single source, enforced everywhere): product is
always "Anchor" (never "the app/platform/service"); "agent key" (never "API
key"); "capability" for Search / Dev Search / Memory (never "tool" in
user-facing copy — "tool" only inside /docs/api-reference where it mirrors
the MCP protocol's own vocabulary); "runtime" for Claude Code, Cursor,
OpenCode, Hermes, Antigravity; "connect a runtime"; Search / Dev Search /
Memory as written (never "Search Tool", "Dev-Search Tool"). Voice: direct,
editorial, unhyped — short declarative sentences, no exclamation points, no
"supercharge"/"unlock"/"seamlessly" register.

---

## 3. Component Tree Per Page

### 3.1 `/` (Landing — surface: Decide/Learn, pain-story composition)

The landing tells the owner-approved story: **"Every session, you re-explain
everything" → the 3-step fix → capabilities as real surfaces.** One idea per
section, no marketing filler, no fake stats, no generic tile grid.

```
LandingPage
├─ NavBar (wordmark, "Docs" link, "Sign in" button)
├─ Hero — the pain, not the pitch
│   ├─ Headline (Zodiak display-xl): "Every session, you re-explain everything."
│   │   — the word "re-explain" is the accent word, regular serif in
│   │   text-accent (Zodiak has no italic face on Fontshare — see §2.2)
│   ├─ Subhead (body-lg): "Anchor remembers what your agents already know.
│   │   Search, store, and recall context across every runtime."
│   ├─ CTA → /login ("Open dashboard")
│   └─ Recall demo — a clipped-corner JetBrains Mono terminal (.code-block
│       tokens) that types `$ anchor_recall "what did we learn?"` then
│       returns three stored memory lines; ~3s loop, static final state
│       under prefers-reduced-motion. Product proof, not decoration.
├─ HowItWorks — the 3-step fix (the story, not a feature grid)
│   └─ StepRow × 3: 1 · Search — "Ask anything. Get answers — and what you
│       already knew." 2 · It remembers — "What you learn is kept, so you
│       never re-explain it." 3 · Any agent recalls — "Claude Code writes,
│       OpenCode recalls. One memory, every runtime."
├─ CapabilitySection — the 3 capabilities, presented as REAL surfaces, not
│   equal-weight tiles. Each card shows its actual output flavor:
│   ├─ CapabilityCard "Search" — web search with AI summaries; card shows a
│   │   result-list mock (url + snippet + a related-memory line)
│   ├─ CapabilityCard "Dev Search" — package-aware developer answers; card
│   │   shows a registry-match mock (name + version + ecosystem)
│   └─ CapabilityCard "Memory" — persistent, cross-runtime; card shows a
│       memory-match mock (content + similarity)
├─ RuntimeStrip — text badges × 5 (Claude Code, Cursor, OpenCode, Hermes,
│   Antigravity; logotype-free — avoids third-party trademark art)
└─ Footer (docs link, GitHub link if public, no social icons)
```

Section entrances use one scroll-reveal treatment: IntersectionObserver,
opacity 0→1 with an 8px rise over 400ms ease-out, a slight stagger on the
capability cards, and no transform at all under `prefers-reduced-motion`.

Zero occurrences anywhere of: provider/database names (§2.5 Rule 1),
"working/under construction/version" language (§2.5 Rule 2), fake metrics,
testimonials, or decorative stats.

### 3.2 `/login`

```
LoginPage
├─ AuthCard
│   ├─ Wordmark
│   ├─ EmailInput { value, onChange, error }
│   ├─ SubmitButton { label: "Send magic link", loading }
│   └─ StatusMessage (idle | "Check your email" | error)
└─ (no password field, no OAuth buttons — email-OTP only per §0.1)
```

### 3.3 `/auth/callback`

```
AuthCallbackPage
├─ SpinnerState (brief — exchanges token via supabase.auth.exchangeCodeForSession)
└─ redirects → /dashboard/onboarding (first login) | /dashboard (returning)
```

### 3.4 `/dashboard` (Home)

```
DashboardHome
├─ DashboardShell (sidebar + topbar, wraps all /dashboard/* pages)
│   ├─ Sidebar { items: [Home, Onboarding, Settings, Docs↗] }
│   └─ TopBar { pageTitle, userMenu }
├─ UsageSummaryRow
│   └─ UsageStatCard × 3 (requests today, requests this month, active agent keys)
├─ CapabilityUsageGrid
│   └─ CapabilityUsageCard × 3 (Search / Dev Search / Memory — call count,
│       last-used timestamp, sparkline via ActivitySparkline)
├─ AgentKeysList
│   ├─ AgentKeyRow × N { slug, keyPrefix (masked), tier, status, lastUsedAt, actions }
│   └─ EmptyState (if zero keys — CTA into onboarding)
├─ ActivityFeed
│   └─ ActivityItem × N { tool, timestamp, status, latencyMs }
└─ CreateKeyButton → opens CreateKeyModal
```

### 3.5 `/dashboard/onboarding`

```
OnboardingFlow
├─ StepIndicator (1 of 4 style, horizontal)
├─ Step1_CreateKey
│   └─ KeyNameInput → calls POST /api/agent-keys → reveals raw key ONCE
├─ Step2_ChooseRuntime
│   └─ RuntimeSelector { options: [Claude Code, Cursor, OpenCode, Hermes, Antigravity] }
├─ Step3_ConfigSnippet
│   ├─ SnippetDisplay (JetBrains Mono, generated per runtime — see §5)
│   └─ CopyButton
├─ Step4_Validate
│   ├─ ValidateButton → triggers a live check against the MCP endpoint
│   ├─ ValidationStatus (pending | success | failed-with-hint)
│   └─ FinishButton → /dashboard
└─ SkipLink (always visible, top-right — never trap the user in onboarding)
```

### 3.6 `/dashboard/settings`

```
SettingsPage
├─ ProfileSection
│   ├─ EmailDisplay (read-only — email is the auth identity, not editable inline)
│   └─ PhoneInput { value, onChange, saveButton } — metadata only, per §0.1
├─ AgentKeysSection
│   ├─ AgentKeyRow × N { ...same as dashboard, plus RevokeButton }
│   └─ CreateKeyButton
├─ DangerZone
│   └─ RevokeAllButton (confirm-modal gated)
└─ SignOutButton
```

### 3.7 `/docs/*`

The docs inherit the predecessor's proven structure (owner directive — the
old product's docs were its strongest surface): a **grouped sidebar**
(Overview / Capabilities / Reference), **data-driven per-capability pages**
(what/problem → schema table → example → errors → limits), and an
anchor-linked API reference. Terminology per §2.5: "capability" everywhere
except /docs/api-reference, where "tool" mirrors the MCP protocol's own
vocabulary; zero tech-stack names.

```
DocsLayout
├─ DocsSidebar — grouped sections with anchor links:
│   Overview: Introduction (/docs), Quickstart (/docs/quickstart)
│   Capabilities: Search, Dev Search, Memory (/docs/capabilities/*)
│   Reference: API Reference (/docs/api-reference#authentication,
│     #transport, #error-codes, #rate-limits), Troubleshooting
└─ DocsContent (per-route) — every page opens with a one-line
    "What you'll accomplish" statement and a consistent Prerequisites box
    (both built from the locked tokens via docs-ui helpers):
    ├─ DocsHomePage — Introduction: what Anchor is, the 3-capability
    │   narrative, a compact Concepts glossary (agent key / capability /
    │   runtime / auto-recall / memory — one line each), both config forms,
    │   link to Quickstart
    ├─ QuickstartPage — mirrors OnboardingFlow content, static (no auth
    │   calls); "2-minute setup" lead. Every config snippet appears in BOTH
    │   forms: the Claude Code `.mcp.json` block (claude mcp add) and the
    │   OpenCode `mcp` block (opencode mcp add), with keys shown as
    │   `anchor_…` placeholders and copy buttons throughout
    ├─ CapabilityPage × 3 — data-driven from content/capability-pages-data.ts
    │   (predecessor's ToolPageData pattern, adapted): id, name, description,
    │   bestFor[], what it does, the problem it solves, input schema table
    │   (param/type/required/default/description), input example,
    │   output schema table (field/type/description), output example,
    │   worked examples, error rows (code/cause/resolution), limits table
    ├─ ApiReferencePage — the MCP protocol surface from backend.md §8:
    │   initialize, tools/list (5 tools), tools/call per tool with Zod
    │   schemas + output shapes, error table; anchors: authentication
    │   (agent-key bearer), transport (Streamable HTTP, protocol
    │   2025-11-25), error codes (all 7 rows), rate limits (30/min,
    │   500/day per agent)
    └─ TroubleshootingPage — one error card per platform error code
        (backend.md §8 table); each card follows a Cause → What you will
        see → Fix structure, imperative and calm, no "just/quickly/simply"
```

Docs typography: h1/h2 in Zodiak display, prose paragraphs capped at
`max-w-prose` (`prose-copy` utility), tokens/keys/endpoints in mono.

**Consistency rule**: the human docs and the agent-facing guide
(`worker/src/tools/guide.ts` GUIDE_CONTENT) must describe the same 5 tools
with the same descriptions — no drift between what a human reads and what an
agent sees. ApiReferencePage data and GUIDE_CONTENT both derive from
`backend.md` §8. This is a direct lesson from the predecessor, whose docs
drifted from its code (documented in the old project's known-issues).

---

## 4. Data Layer

### 4.1 REST Contract — ⚠ BACKEND ADDITION REQUIRED

None of the following exists in `backend.md`. It must be implemented as new
Worker routes, separate from `/mcp`, before the dashboard can function.
Auth method, error shape, and status-code conventions below intentionally
mirror `backend.md` §8/§9 so the two surfaces feel like one system.

**Base path**: `/api/*` on the same Worker (or a second lightweight Worker —
implementation's choice; contract is identical either way).

**Auth method**: dashboard REST calls are authenticated by the **Supabase
session JWT** (`Authorization: Bearer <supabase_access_token>`), NOT an
agent key — the dashboard is the thing that *manages* agent keys, so it
can't be gated by one. The Worker must verify the Supabase JWT against the
Supabase project's JWKS (or via `supabase.auth.getUser(token)` server-side)
on every `/api/*` request. This is a distinct auth path from `/mcp`'s
agent-key auth (`backend.md` §9) and must not be conflated with it.

**Error shape** (mirrors `backend.md` §8 error table, adapted to plain
REST/HTTP instead of JSON-RPC):

```
{
  "error": {
    "code": "AGENT_KEY_NOT_FOUND" | "VALIDATION_FAILED" | "UNAUTHORIZED" | "INTERNAL_ERROR",
    "message": "human-readable, safe to display"
  }
}
```

HTTP status mapping: `UNAUTHORIZED` → 401, `VALIDATION_FAILED` → 422,
`AGENT_KEY_NOT_FOUND` → 404, `INTERNAL_ERROR` → 500. Same sanitization
philosophy as `backend.md` §9 `utils/errors.ts` — internal details logged
server-side only, never in the response body.

#### Endpoints

**`GET /api/health`**
Response: `{ "status": "ok", "version": "1.0.0" }`
No auth required — used by the onboarding validation step (§5) to confirm
the MCP endpoint itself is reachable, independent of any specific key.

**`POST /api/agent-keys`**
Creates a new agent key. Body:
```
{ "name": string }  // free-form display name, 2-60 chars (see §5A.1) — slug derived server-side
```
Response (200):
```
{
  "id": string,
  "key": string,        // full raw key, anchor_<slug>_<hex> — returned ONLY on this call, never again
  "name": string,
  "slug": string,
  "tier": "standard",
  "createdAt": string   // ISO
}
```
Server-side: generates via the same `auth/keys.ts::generateAgentKey`
logic `backend.md` §4 already defines (slug auto-derived from name, URL-safe
and deduped), writes to Turso (`createAgent`) and KV (per `backend.md`'s
existing write-back-on-create behavior) — this endpoint is a thin HTTP
wrapper over functions that already exist in the backend spec, not new
key-generation logic.

**`GET /api/agent-keys`**
Response (200):
```
{
  "keys": Array<{
    id: string; name: string; slug: string; keyPrefix: string; // "anchor_claude…a1b2" masked after 8 hex chars
    tier: "standard" | "admin" | "debug";
    status: "active" | "revoked";
    createdAt: string; lastUsedAt: string | null;
    rateLimitPerMin: number; rateLimitPerDay: number;
  }>
}
```
Raw key is never returned here — only `keyPrefix`, matching `backend.md`
§6.2's "raw key is never stored" principle extended to "never re-served."

**`DELETE /api/agent-keys/:id`**
Revokes (sets `status: 'revoked'` in Turso, evicts the KV entry).
Response (200): `{ "id": string, "status": "revoked" }`
404 (`AGENT_KEY_NOT_FOUND`) if the id doesn't belong to the caller's
`owner_id`.

**`PATCH /api/agent-keys/:id`**
Renames an agent key (frontend.md §5A.1 — display name editable later; the
slug embedded in the key string is NOT editable). Body:
```
{ "name": string }  // 2-60 chars, same validation as create
```
Response (200): `{ "id": string, "name": string, "slug": string }`
Updates `name` in Turso + rewrites the KV agent record (same hash key —
only the name field changes). 404 if the id isn't the caller's.

**Note — `lastUsedAt`**: derived at read time in `listAgentKeys` via a
`max(created_at)` subquery on the `requests` log table (per-agent), never
stored as a live-updated column — the requests log is the source of truth.

**`GET /api/usage/summary`**
Response (200):
```
{
  "requestsToday": number; "requestsThisMonth": number;
  "activeKeyCount": number;
  "byCapability": {
    "search": { "count": number; "lastUsedAt": string | null };
    "devSearch": { "count": number; "lastUsedAt": string | null };
    "memory": { "count": number; "lastUsedAt": string | null };
  }
}
```
⚠ **Second backend addition required**: `backend.md` has no request-logging
table today (only rate-limit *counters*, which are ephemeral KV state, not
a queryable history). This endpoint needs a lightweight `requests` log
table (Turso, append-only: `id, agent_id, tool_name, status, latency_ms,
created_at`) written by `mcp/server.ts` after every `tools/call` completes.
This is new backend scope — flagged, not assumed.

**`GET /api/usage/activity?limit=20`**
Response (200):
```
{
  "items": Array<{
    id: string; tool: "anchor_search" | "anchor_dev_search" | "anchor_remember" | "anchor_recall" | "anchor_guide";
    status: "success" | "error"; errorCode?: string;
    latencyMs: number; createdAt: string; agentSlug: string;
  }>
}
```
Same dependency on the new `requests` log table above.

**`POST /api/onboarding/validate`**
Body: `{ "keyId": string }`
Server performs a live `initialize` + `tools/list` round-trip against `/mcp`
using the specified key, server-side (avoids CORS/browser complexity of
calling `/mcp` directly from the dashboard).
Response (200): `{ "valid": true, "toolCount": 5 }`
Response (200, soft-fail): `{ "valid": false, "reason": string }` — a
functional failure (e.g. key revoked mid-flow) is still a 200 with
`valid: false`, not an HTTP error; only transport/auth failures on the
dashboard-JWT layer itself return actual error status codes.

### 4.2 Supabase Auth Usage

- Client: `@supabase/supabase-js`, `createClient(url, anonKey)` — **anon
  key only**, never the `service_role` key (`backend.md` §7 explicitly
  marks `service_role` as "never expose to any client-facing surface";
  the dashboard is a client-facing surface).
- Flow: `supabase.auth.signInWithOtp({ email })` on `/login` submit →
  Supabase sends magic link → `/auth/callback` calls
  `supabase.auth.exchangeCodeForSession(code)` → session stored in
  Supabase's own cookie/localStorage handling (library default) → redirect.
- Session check: a `useSession()` hook wraps `supabase.auth.getSession()` +
  `onAuthStateChange` subscription; `DashboardShell` redirects to `/login`
  if no session.
- Phone number: stored in a `profiles` table (`id` = Supabase auth user id,
  `phone text`), **not** in Supabase Auth's own phone field (which would
  imply SMS-OTP capability that isn't being built). Read/write via a
  `useProfile()` hook calling Supabase's REST/PostgREST directly with the
  anon key + RLS policy `id = auth.uid()`.

### 4.3 Hook Structure

```
hooks/
  useSession.ts          — Supabase auth session state
  useProfile.ts          — profiles table read/write (phone)
  useAgentKeys.ts         — GET/POST/DELETE /api/agent-keys, optimistic revoke
  useUsageSummary.ts      — GET /api/usage/summary, poll every 60s on dashboard home
  useActivityFeed.ts      — GET /api/usage/activity, poll every 30s
  useOnboardingValidate.ts — POST /api/onboarding/validate, one-shot mutation
```

All data hooks follow one shape: `{ data, isLoading, error, refetch }`. No
external data-fetching library required (native `fetch` + `useState`/
`useEffect` is sufficient at this scale — adding React Query would be
scope creep for a 9-endpoint app).

### 4.4 Loading / Error / Empty States

- **Loading**: skeleton blocks (`bg-sunken`, pulse animation) matching the
  shape of the eventual content — never a spinner-only screen for list
  data; spinners reserved for button-level in-flight states and the auth
  callback redirect.
- **Error**: inline `ErrorCard` (border `status-error`, tinted background)
  with the sanitized message from the API's `error.message` — never a raw
  stack trace, consistent with `backend.md`'s no-raw-error philosophy.
- **Empty**: `EmptyState` component (icon + one-line copy + primary action)
  used for: zero agent keys ("Create your first agent key"), zero activity
  ("No activity yet — connect a runtime to get started").

---

## 5. Onboarding Flow Spec

### 5.1 Steps

1. **Create key** — name/slug input → `POST /api/agent-keys` → raw key
   shown once in a `KeyRevealCard` (monospace, copy button, explicit
   "you won't see this again" warning in `status-warning` color).
2. **Choose runtime** — single-select among the 5 supported runtimes
   (`RuntimeSelector`, card-style, not a dropdown — matches the visual
   weight of the rest of the system).
3. **Config snippet** — generated client-side (see §5.2), shown in a
   `SnippetDisplay` code block, copy button.
4. **Validate** — `POST /api/onboarding/validate` with the created key's
   id → success/failure UI (see §5.4).

### 5.2 Snippet Generation

Pure client-side string templating — no backend call needed to *generate*
a snippet, only to *validate* the resulting connection. One function per
runtime, all consuming the same two inputs: `endpointUrl` (the deployed
Worker's `/mcp` URL, environment-configured) and `agentKey` (the just-created
raw key).

```ts
// lib/snippets.ts
type Runtime = 'claude-code' | 'cursor' | 'opencode' | 'hermes' | 'antigravity';

function generateSnippet(runtime: Runtime, endpointUrl: string, agentKey: string): string
```

Each runtime's snippet follows that tool's actual MCP-server config format
(JSON config block for Claude Code/Cursor-style `mcpServers` entries;
whatever native format OpenCode/Hermes/Antigravity use). The MCP transport
detail (`Streamable HTTP`, header `Authorization: Bearer <key>`) is fixed
per `backend.md` §2/§9 — all 5 snippets point at the same endpoint and auth
header shape, only the surrounding config-file syntax differs.

### 5.3 Copy-to-Clipboard

Every code block (`SnippetDisplay`, `KeyRevealCard`, docs code samples)
uses the same `CopyButton` component: `navigator.clipboard.writeText()`,
button label flips to "Copied" for 2 seconds then reverts, no toast/modal
— the button itself is the only feedback needed.

### 5.4 Validation Behavior

- `ValidateButton` click → `isLoading` state → `POST /api/onboarding/validate`.
- Success (`valid: true`) → green `ValidationStatus`, "Connected — 5
  capabilities available," `FinishButton` enabled.
- Soft-fail (`valid: false`) → amber `ValidationStatus` with the server's
  `reason` string, plus a static hint list (key pasted correctly? runtime
  restarted after config change? — copy only, no dynamic diagnosis).
- Hard error (network/500) → red `ValidationStatus`, generic retry prompt.
- `SkipLink` remains available at every step — validation failure never
  blocks reaching `/dashboard`; onboarding is guidance, not a gate.

---

## 5A. Key Management UX — Premium Standard (owner requirement)

The previous product's key creation was: no naming freedom, key shown once
with no flow around it. That is the bar we are explicitly beating. Every
interaction below follows the GitHub/Stripe/Vercel key-management pattern —
free-form naming, reveal-once with copy-confirm, and a hard gate before the
raw key is gone for good.

### 5A.1 Free-form naming

- **Display name is required and free-form**: "Claude Code Laptop", "Cursor —
  work", "backup phone". Any characters, 2-60 chars, validated client-side
  (length + non-empty) and server-side.
- **Slug is derived, not typed**: the `anchor_<slug>_<hex>` key string is
  generated from the name — lowercase, URL-safe, deduped (append `-2`,
  `-3` on collision). The user never sees or thinks about slugs.
- **Name is editable later** in Settings (slug stays fixed — it is embedded
  in the key string; only the display name changes).
- `name` is stored on the agent record (backend addition, see §4.1) and
  shown everywhere a key appears: list rows, activity feed, revoke
  confirmations.

### 5A.2 Creation flow — two-step modal

1. **Step 1 — Name**: single input, live validation (2-60 chars), character
   counter, helper microcopy ("Give this key a name you'll recognize —
   e.g. 'Claude Code Laptop'"). Optional "Advanced" disclosure: tier
   (standard/admin/debug) and per-key rate limits — defaulted, rarely
   touched.
2. **Step 2 — Reveal**: after create, the modal becomes a `KeyRevealCard`:
   - Full key in monospace with a copy button ("Copied ✓" feedback for 2s).
   - Warning banner in `status-warning`: "You won't be able to see this key
     again after you close this window."
   - Primary button: **"Done — I've stored it"**.
   - **Close/dismiss without copying → confirm dialog**: "This key won't be
     shown again. Copy it now?" (Keep viewing / Dismiss). This is the
     premium gate — no accidental key loss.
   - Raw key is never retrievable after this point (server enforces: raw key
     returned only by `POST /api/agent-keys`; `GET` returns `keyPrefix`
     only — per §4.1).

### 5A.3 Key list rows (Dashboard + Settings)

Each `AgentKeyRow` shows: **name** (Switzer 500), masked prefix chip
(monospace: `anchor_claude…a1b2`), tier badge, status badge (active/revoked),
**last used** ("2h ago", "3 days ago" — relative time), created date. Actions:
Revoke (confirm modal naming the key + "runtimes using this key will lose
access immediately") and Edit name (inline).

### 5A.4 Copy standard

Microcopy for keys is warm, precise, zero hype (per §6): no "unlock",
"supercharge". The warning is honest and calm: "You won't be able to see
this key again after you close this window."

## 6. Copy Guidelines (Locked Terminology)

| Use | Never use |
|---|---|
| agent key | API key |
| capability | tool (in user-facing copy — "tool" is fine in `/docs/api-reference` where it mirrors MCP's own vocabulary, since that page is explicitly documenting the protocol surface) |
| Anchor | the app / the platform / the service |
| runtime | client / IDE (a "runtime" is Claude Code, Cursor, etc. — matches backend.md's own framing) |
| connect a runtime | install / integrate |
| Search / Dev Search / Memory | Search Tool / Dev-Search Tool / Memory Tool |

Voice: direct, editorial, unhyped — short declarative sentences, no
exclamation points, no "supercharge"/"unlock"/"seamlessly" register. The
landing headline ("The memory layer for your AI agents") sets the tone:
plain description, not a pitch.

---

## 7. Testing & Quality

**Build command**: `npm run build` (Vite) → static output deployed to
Cloudflare Pages. `npm run typecheck` (`tsc --noEmit`) must be clean before
any deploy.

**Onboarding validation** (manual, pre-launch):
- Fresh Supabase user → `/login` → magic link → `/dashboard/onboarding` →
  create key → generate snippet for each of the 5 runtimes → paste into a
  real instance of at least 2 runtimes (mirrors `backend.md` §12 Phase 7's
  "at least 2 real MCP clients" bar) → confirm `initialize` handshake
  succeeds live.

**Per-page acceptance criteria**:

| Page | Criteria |
|---|---|
| `/` | 3 capability cards, zero TTS/file-analysis copy anywhere, CTA reaches `/login` |
| `/login` | Email-only form, no password field, submit triggers real Supabase OTP send |
| `/dashboard` | Zero-state renders correctly with no keys; usage cards show real numbers once a key exists |
| `/dashboard/onboarding` | All 5 runtime snippets generate without placeholder text; skip link always reachable |
| `/dashboard/settings` | Phone save persists via `profiles` table; revoke immediately reflects `status: revoked` in the list |
| `/docs/api-reference` | All 5 tools documented, input/output shapes match `backend.md` §8 exactly, zero drift |
| `/docs/troubleshooting` | All 7 rows of `backend.md` §8's error table represented |

---

## 8. Implementation Plan

### Phase F1 — Scaffold & Design System

**Files**: `vite.config.ts`, `tailwind.config.ts` (token mapping from §2.1),
`src/styles/fonts.css` (Fontshare + Google Fonts `@import`), `src/main.tsx`,
route scaffolding for all pages in §1 (empty shells).

**Acceptance**: `npm run build` succeeds; every route in §1 renders with
correct fonts/colors loaded (verified visually); zero console errors; every
shell renders a clean surface — proper empty states, NO "under construction"/
placeholder notices (§2.5 Rule 2).

### Phase F2 — Auth

**Files**: `lib/supabase.ts` (client init, anon key only), `hooks/useSession.ts`,
`pages/Login.tsx`, `pages/AuthCallback.tsx`, `components/DashboardShell.tsx`
(session-gated wrapper).

**Acceptance**: email-OTP round-trip works against a real Supabase project;
unauthenticated visit to `/dashboard` redirects to `/login`; authenticated
visit to `/login` redirects to `/dashboard`.

### Phase F3 — Landing & Docs (no auth needed)

**Files**: `pages/Landing.tsx`, `components/CapabilitySection.tsx`,
`content/landing-copy.ts` (all landing copy as data — pain-story hero,
3-step HowItWorks, differentiated capability cards per §3.1),
`content/capability-pages-data.ts` (the ToolPageData pattern from §3.7:
Search / Dev Search / Memory pages data),
`content/api-reference-data.ts` (structured data mirroring `backend.md` §8,
consumed by `ApiReferencePage`), `pages/docs/*` (incl. 3 CapabilityPages).

**Acceptance**: landing renders the §3.1 pain-story composition (hero →
3-step fix → differentiated capability surfaces → runtime strip); API
reference page's schema tables match `backend.md` §8 field-for-field (manual
diff check against the source doc); zero tech-stack leakage and zero banned
wordings per §2.5 (grep-checked); the 10-tell slop audit (§2.5 surface
doctrine) scores ≤2 and is reported.

### Phase F4 — Dashboard Data Layer (depends on backend §4.1 endpoints existing)

**Files**: `hooks/useAgentKeys.ts`, `hooks/useUsageSummary.ts`,
`hooks/useActivityFeed.ts`, `lib/api.ts` (fetch wrapper attaching Supabase
JWT + parsing the `{error:{code,message}}` shape from §4.1).

**Acceptance**: all three hooks correctly handle loading/error/empty against
a mocked `/api/*` (MSW or hand-rolled fetch mock) before wiring to the real
backend; once wired, dashboard home reflects real created keys.

### Phase F5 — Dashboard UI

**Files**: `pages/DashboardHome.tsx`, `components/AgentKeysList.tsx`,
`components/UsageStatCard.tsx`, `components/ActivityFeed.tsx`,
`components/CreateKeyModal.tsx`.

**Acceptance**: create/revoke key round-trips against the live `/api/agent-keys`
endpoints; usage cards poll and update without a full page reload.

### Phase F6 — Onboarding Flow

**Files**: `pages/OnboardingFlow.tsx`, `lib/snippets.ts` (all 5 runtime
generators), `components/SnippetDisplay.tsx`, `components/CopyButton.tsx`,
`hooks/useOnboardingValidate.ts`.

**Acceptance**: all 5 snippets generate with zero placeholder/lorem text;
validate step correctly reflects success/soft-fail/hard-error against a
real key; skip link works from every step.

### Phase F7 — Settings & Polish

**Files**: `pages/Settings.tsx`, `hooks/useProfile.ts`, final responsive
pass (mobile breakpoints for all pages), self-review per §9 checklist.

**Acceptance**: phone number persists across reload; revoke-all is
confirm-gated; full self-review checklist (below) passes.

---

## 9. Acceptance Checklist

- [ ] Exactly 3 capability blocks appear anywhere capabilities are listed
      (landing, dashboard, docs) — zero TTS/file-analysis remnants
- [ ] All copy uses locked terminology (§2.5 + §6) — zero instances of "API
      key," "tool" (outside `/docs/api-reference`), or hype language
- [ ] Zero tech-stack leakage per §2.5 Rule 1 (grep for provider/database
      names across all UI copy, docs, error strings, and meta tags)
- [ ] Zero immature wordings per §2.5 Rule 2 ("Working…", "Under
      construction", "Version x.y.z", "Beta", placeholders — grep-checked)
- [ ] Surface doctrine honored: dashboard is Monitor (no hero/marketing),
      onboarding/settings are Configure, landing is Decide/Learn
- [ ] Design tokens match §2.1 exactly — zero colors, gradients, or fonts
      outside the locked set; no dark-mode toggle exists
- [ ] Zodiak used only for display headlines, never for body/UI text
- [ ] All 5 runtime config snippets (Claude Code, Cursor, OpenCode, Hermes,
      Antigravity) generate correctly with real endpoint + key interpolated
- [ ] Onboarding validate step performs a real `initialize` + `tools/list`
      check, not a client-side assumption of success
- [ ] `/docs/api-reference` content matches `backend.md` §8 with zero drift
      (tool names, input schemas, output shapes, error codes)
- [ ] Dashboard REST calls authenticate via Supabase JWT, never an agent
      key — the two auth systems are never conflated
- [ ] `service_role` Supabase key never appears in any client-bundled code
      (anon key only, verified by grepping the built bundle)
- [ ] Agent key create/list/revoke round-trip against real `/api/agent-keys`
      endpoints (flagged as backend-addition-required in §4.1)
- [ ] Raw agent key is displayed exactly once (creation moment), never
      re-fetchable afterward
- [ ] Loading/error/empty states implemented for every data-fetching
      component (§4.4) — no bare spinners on list views
- [ ] Fully responsive on mobile (dashboard sidebar collapses, onboarding
      steps stack vertically)
- [ ] `npm run build` and `tsc --noEmit` both clean
- [ ] Deployed successfully to Cloudflare Pages free tier (verify build
      count stays well under 500/month for solo iteration pace)
- [ ] Self-review: no placeholder/lorem text anywhere in shipped copy
- [ ] Self-review: every route in §1's table renders with no console errors

---

## Appendix: Review Pass (Atom, 2026-08-09)

Independent review of this spec against `backend.md` and the locked product
decisions. No substantive changes were required — the document is internally
consistent and in sync with the backend contract. Verified points:

1. **Tool-surface sync**: all 5 `anchor_*` names, the `anchor_<slug>_<hex>`
   key format, protocol version, and the sanitized-error philosophy match
   `backend.md` §4/§8/§9 exactly. Zero `opticontext`/`opctx_`/TTS/DeepDoc
   remnants (the only "TTS" mentions are acceptance criteria asserting
   absence — intentional).
2. **Error-table sync**: `/docs/troubleshooting` covers all 7 rows of
   `backend.md` §8's error table — count verified.
3. **Design tokens**: §2.1 matches the locked palette (warm paper-light,
   deep-green accent, Zodiak/Switzer/JetBrains Mono) with zero drift — no
   gradients, no dark-mode toggle, no icon-library dependency.
4. **Backend additions correctly flagged**: the dashboard REST contract
   (§4.1) and the `requests` usage-log table are both marked as
   "backend addition required" — nothing is silently assumed to exist.
5. **Auth separation**: dashboard uses Supabase Auth (email OTP, anon key
   only) while `/mcp` uses agent keys — never conflated; `service_role`
   never client-facing. Verified against `backend.md` §7.
6. **No thinking artifacts**: no in-document self-correction text, no
   TODO/TBD/XXX placeholders.

Two non-blocking flags for the owner (decisions, not errors):

- **§0.1 phone capture is YAGNI-adjacent**: it's stored as metadata with
  "nothing functional in v1." Harmless and cheap, but if maximum YAGNI is
  wanted, cut `PhoneInput`, `useProfile`, and the `profiles` table to
  v1.1. Spec left as written.
- **§3.3 first-login detection**: "first login vs returning" needs an
  implementation mechanism — suggested: existence of a `profiles` row for
  the session user (or a user-metadata flag set at end of onboarding).
  Implementation detail, not a spec gap.

## Appendix C: Key Management UX Upgrade (2026-08-09, owner requirement)

Owner directive: the previous product's key creation UX was the weakest
surface (no naming freedom, key shown once with no flow). Added §5A
(Key Management UX — Premium Standard) implementing the GitHub/Stripe/Vercel
pattern: free-form display names (slug auto-derived), two-step create modal
with reveal-once + copy-confirm + dismiss-gate, richer key list rows, and
warm honest copy. Contract changes to match:

- `POST /api/agent-keys` body: `{ "name" }` (2-60 chars) instead of
  `{ "slug" }` — slug derived server-side (URL-safe, deduped).
- `GET /api/agent-keys` and activity feed include `name`.
- `backend.md` §6.2 `agents` table gains `name text not null default ''`
  (editable; slug is not).
- B7 (dashboard REST) and Midas's frontend work must implement §5A as
  specified — the old "show once and pray" flow is explicitly banned.

## Appendix D: Product Surface Discipline (2026-08-09, owner directive)

Owner directive for the entire frontend: it must read as a professional,
finished product end-to-end, in sync with the MCP flow — clean terminology
everywhere, and **no mention of the underlying tech stack** (providers,
databases, models) anywhere user-facing, because that reads as cheap/DIY.
Implemented as §2.5 (Product Surface Discipline): Rule 1 zero tech-stack
leakage (banned: Tavily, DuckDuckGo, Apify, Cerebras, Gemini, Supabase,
Turso, Cloudflare, KV, pgvector, embeddings, model names, infra vocabulary),
Rule 2 no immature wordings (banned: "Working…", "Under construction",
"Version x.y.z", "Beta", placeholders), a terminology dictionary, and a
surface doctrine (landing = Decide/Learn, dashboard = Monitor, configure
surfaces for settings/onboarding) derived from the design skills (claude-design
10-tell slop audit; visual vocabulary closest to Notion's warm minimalism +
Stripe's typographic confidence). Landing composition updated to the
owner-approved pain story ("Every session, you re-explain everything" →
3-step fix → differentiated capability surfaces). F1 shells must be clean
empty states, never construction notices; F3 acceptance adds grep checks
for leakage/banned wordings plus a reported slop-audit score (≤2).

## Appendix E: Docs Structure Inspiration (2026-08-09, owner directive)

Owner directive: the predecessor's frontend was its strongest surface in the
docs — detailed, data-driven, per-capability. Anchor inherits that structure
while applying §2.5 (no tech leakage, clean terminology, "capability" not
"tool" outside the API reference). Implemented as §3.7 + §1 route additions:

- Grouped docs sidebar (Overview / Capabilities / Reference) with anchor
  links — from the predecessor's DocsLayout.
- Data-driven per-capability pages (what/problem → input schema table →
  example → output schema table → example → worked examples → errors →
  limits) — the predecessor's ToolPageData pattern, adapted.
- Anchor-linked API reference (authentication, transport, error codes,
  rate limits) with the full §8 error table.
- **Consistency rule (lesson from the predecessor's known-issues)**: docs
  and the agent-facing GUIDE_CONTENT must derive from backend.md §8 with
  zero drift — the old product's docs drifted from its code; Anchor's
  won't.
