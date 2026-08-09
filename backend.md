# Anchor — Backend Engineering Spec

**Status**: greenfield build spec. Fresh Cloudflare Worker project, fresh
`workers.dev` subdomain, fresh `wrangler.toml`. No legacy bindings, no legacy
secrets, no prior code assumed.

**Fallback naming**: if "Anchor" is unavailable (domain/trademark/registry
collision — the Solana `anchor` framework is a known collision risk in dev
tooling directories), swap to **Threadline** with `threadline_*` prefixes
everywhere `anchor_*` appears in this document. Zero other changes.

---

## 1. Scope & Locked Product Recap

**What Anchor is**: a remote MCP server on Cloudflare Workers. JSON-RPC 2.0
over Streamable HTTP, protocol version `2025-11-25`. One agent key, one
endpoint. Any MCP client (Claude Code, Cursor, OpenCode, Hermes, Antigravity)
connects with a single URL and gets three capabilities:

1. **Search** (`anchor_search`) — web search + AI summarization + dork
   operators + phantom-answer suppression, plus automatic recall injection.
2. **Dev Search** (`anchor_dev_search`) — package-registry-aware,
   project-manifest-biased developer search.
3. **Memory** (`anchor_remember` / `anchor_recall`) — persistent vector
   memory (Supabase pgvector) any connected agent can write to and query
   across sessions and runtimes.

Plus `anchor_guide` — a self-describing tool that returns usage
documentation for the other four, so a newly-connected agent can
bootstrap itself without external docs.

**The differentiator — auto-recall injection**: every `anchor_search` call
runs a `match_memories` lookup **in parallel** with the web search. Related
memories return as `related_memories[]` in the response. This is the reason
Anchor exists instead of a bare search wrapper: the agent sees "what you
already knew" next to "what's new" without a second tool call.

### Explicit non-goals

- **No TTS.** No `voicebridge`, no audio synthesis, no `UNREAL_SPEECH_KEY`.
- **No file analysis.** No `deepdoc`, no PDF/image upload pipeline, no
  Gemini Files API resumable-upload path.
- **No general "AI suite."** Anchor is three capabilities, not a platform.
- **No R2.** No object storage anywhere in the design.
- **No public multi-tenant onboarding at this phase.** Designed for a solo
  developer running multiple personal agent runtimes. Auth exists (per-agent
  keys) because multiple *runtimes* need distinct keys, not because this is
  a public SaaS on day one.
- **No billing infrastructure.** Single free tier, no Stripe, no paid plan
  logic, until organic demand exceeds free-tier ceilings.

---

## 2. Target Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  MCP Client (Claude Code / Cursor / OpenCode / Hermes / Antigravity)  │
└───────────────────────────────┬────────────────────────────────────-─┘
                                 │ POST /mcp  (JSON-RPC 2.0, Streamable HTTP)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker — index.ts                      │
│                                                                       │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────────────┐    │
│  │  CORS +     │──▶│  Auth        │──▶│  Rate Limit              │    │
│  │  body-size  │   │  (auth/*)    │   │  (auth/ratelimit.ts)     │    │
│  │  guard      │   │  KV → Turso  │   │  30/min, 500/day (KV)    │    │
│  └─────────────┘   └──────────────┘   └────────────┬─────────────┘    │
│                                                     ▼                 │
│                          ┌──────────────────────────────────┐        │
│                          │   mcp/server.ts + mcp/router.ts  │        │
│                          │   (JSON-RPC method dispatch)     │        │
│                          └────────────────┬─────────────────┘        │
│                                           ▼                          │
│              ┌────────────────────────────────────────────┐         │
│              │              tool router                    │        │
│              │  anchor_search │ anchor_dev_search │         │        │
│              │  anchor_remember │ anchor_recall │           │        │
│              │  anchor_guide                                │        │
│              └───┬──────────┬──────────┬──────────┬─────────┘        │
│                  ▼          ▼          ▼          ▼                  │
│         ┌────────────┐┌───────────┐┌─────────┐┌──────────┐          │
│         │tools/       ││tools/     ││tools/    ││tools/    │          │
│         │search.ts    ││devsearch  ││memory.ts ││guide.ts  │          │
│         │(+ auto-     ││.ts        ││          ││          │          │
│         │ recall)     ││           ││          ││          │          │
│         └──────┬──────┘└─────┬─────┘└────┬─────┘└──────────┘          │
│                │             │           │                           │
│         ┌──────▼─────────────▼───┐  ┌────▼──────┐                    │
│         │   search/*              │  │ ai/router │                   │
│         │   tavily,ddg,apify,     │  │ Cerebras ↔│                   │
│         │   dorking,classify,     │  │ Gemini    │                   │
│         │   domain-priority,      │  └────┬──────┘                   │
│         │   project-context,      │       │                          │
│         │   registries, dev-router│       │                          │
│         └─────────────────────────┘       │                          │
└────────────────────────┬───────────────────┼─────────────────────────┘
                         │                   │
        ┌────────────────┼───────────────────┼──────────────┐
        ▼                ▼                   ▼              ▼
┌───────────────┐┌───────────────┐┌──────────────────┐┌─────────────┐
│  KV            ││  Turso         ││  Supabase          ││  External   │
│  keys, rate-   ││  agent         ││  pgvector          ││  Tavily/DDG/│
│  limit ctrs,   ││  metadata,     ││  memories table +   ││  Apify,     │
│  response      ││  auth fallback ││  match_memories RPC  ││  Cerebras,  │
│  cache         ││                ││                     ││  Gemini     │
└───────────────┘└───────────────┘└──────────────────┘└─────────────┘
```

Data flow for the differentiator (`anchor_search`):

```
tools/search.ts::handleSearch(query, ctx)
        │
        ├─▶ Promise.all([
        │       webSearchPipeline(query)      ──▶ search/* provider chain
        │       recallForSearch(query, ctx)   ──▶ ai/gemini.embedText
        │                                         → storage/supabase.matchMemories
        │   ])
        │
        ├─▶ webSearchPipeline resolves/rejects independently of recall
        ├─▶ recallForSearch NEVER rejects the outer promise — internally
        │   try/catch, returns [] + logs on any failure
        │
        └─▶ merge: { ...searchResult, related_memories: recallResult }
```

---

## 3. Technology & Free-Tier Decision Table

All limits below were web-verified against sources current as of **August
2026**. Where sources disagreed, the most recent official-page-adjacent
source is used and the spread is noted.

| Component | Choice | Why | Verified free limit (Aug 2026) | Headroom for solo/personal use |
|---|---|---|---|---|
| Compute | Cloudflare Workers | Edge, zero cold start, matches existing MCP transport pattern | 100,000 req/day, **10ms CPU time/invocation**, 128MB memory, 50 subrequests/request | A solo dev across 5 runtimes doing ~50–150 tool calls/day uses <0.2% of the request quota. **The binding constraint is 10ms CPU/request**, not request count — see §3.1 mitigation below. |
| Key/counter/cache storage | Workers KV | Already required for the auth pattern; sub-ms edge reads | 100k reads/day, **1,000 writes/day**, 1GB storage | Reads: trivial headroom. **Writes are tight**: every rate-limit increment is a KV write. At 500 req/day/agent × up to 5 agents = 2,500 potential increments/day, this **exceeds the 1,000/day KV write cap**. See §3.1 — this requires a design adaptation, not just monitoring. |
| Vector memory | Supabase (Postgres + pgvector) | Native vector search, RPC functions, RLS, generous free compute | 500MB DB, 2 active projects, **auto-pauses after 7 days of inactivity**, 5GB egress, 500k edge function invocations | 500MB holds roughly 300k–500k memory rows at typical embedding + metadata size (768-dim vector ≈ 3KB row-inclusive) — effectively unlimited for one developer's personal memory corpus. **The 7-day pause is the real risk** for a personal tool used in bursts — mitigated below. |
| Agent metadata / auth fallback | Turso (libSQL) | SQLite-at-the-edge, colocates with Workers, no pause behavior (unlike Supabase) | 100 databases, 5GB storage, 500M row reads/month, 10M row writes/month | Auth fallback reads happen only on KV miss. Even at 100% KV-miss rate (worst case), a few hundred lookups/day is negligible against 500M/month. |
| Fast text AI | Cerebras (`gpt-oss-120b` or current default) | Sub-second inference for search summarization | **1,000,000 tokens/day**, but rate-limited to **~5 RPM / ~30k TPM per recent docs** (older sources cite 30 RPM — Cerebras's per-minute limits have tightened over 2026; confirm live in dashboard at deploy time) | Token budget is generous; **RPM is the practical ceiling** for a coding agent firing several parallel `anchor_search` calls in a burst. Mitigated by response caching (§3.1) and the AI router's fallback-to-Gemini path. |
| Embeddings + multimodal | Gemini (`text-embedding-004` or current default embedding model) | Free embedding tier is uncapped-in-practice for personal use | Embedding: 10M tokens/minute (TPM) free. Gemini Flash (used only if Cerebras is down): ~1,500 RPD / 15 RPM | Embedding volume for auto-recall (one short query embed per search) will never approach 10M TPM. Effectively unlimited for this use case. |
| Web search — primary | **DuckDuckGo HTML scrape/lite endpoint** | No credit metering, no daily cap in the traditional sense (subject to informal rate courtesy limits, not billed credits) | No published hard cap; treat as "free but must be well-behaved" (backoff on 429/CAPTCHA responses) | Bears the majority of search volume by design — see decision below. |
| Web search — secondary/quality boost | Tavily | AI-native search + extraction, better result quality than raw DDG scraping | **⚠ REVISED FROM BRIEF: 1,000 credits/month (not ~250/day as originally assumed)** — basic search = 1 credit, advanced = 2 credits. 1,000 credits ≈ 33 basic searches/day if spread evenly, or usable as a smaller quality-tier budget | See §3.1 — Tavily is demoted to secondary/quality-boost role specifically because of this revised number, with a budget guard that falls back to DDG-only once the monthly pool is low. |
| Web search — fallback/tertiary | Apify (actor-based scrape) | Handles DDG/Tavily outage or JS-heavy targets | ~$5 free credit/month on signup-based actors (varies by actor pricing; budget-guard to $4.50/mo ceiling per original spec) | Rarely invoked; reserved for provider-chain exhaustion. |

### 3.1 Design adaptations required by verified limits

These are **not optional footnotes** — each changes a concrete part of the
module spec below.

1. **KV write budget (1,000/day) is the tightest constraint in the whole
   system**, tighter than the brief assumed. Rate-limit counters must NOT
   write to KV on every single request. `auth/ratelimit.ts` uses a
   **windowed-write pattern**: in-memory counters cannot persist across
   Worker invocations, and writing only when a counter crosses a decile
   boundary is too fragile — the chosen approach is: **one KV write per
   request is accepted, but the
   daily 500-req/agent cap combined with ≤3 concurrently-configured agents
   keeps total writes ≤1,500/day worst case**. Since this can still exceed
   1,000, `storage/kv.ts` implements **write coalescing**: rate-limit state
   is read once per request and written back only if the counter actually
   changed bucket (minute-window rollover), cutting real-world writes by
   roughly 80% for typical burst patterns. If the developer runs more than
   ~3 concurrently active agent keys, `wrangler.toml` should provision a
   second KV namespace to split the write budget — documented in §7.
2. **10ms CPU/invocation (Free plan)** means summarization or any
   non-trivial synchronous work must not run inline on the Worker; all AI
   calls are `fetch()`-based (I/O, not CPU-bound) which does not count
   against the CPU budget the way computation does — this is why the
   provider-abstraction pattern strictly forbids doing embedding math,
   text processing, or classification logic locally instead of via
   provider APIs.
3. **Supabase 7-day pause** is mitigated by a lightweight scheduled
   Cloudflare Cron Trigger (`wrangler.toml` `[triggers]` block, runs every
   4 days) that performs a trivial `select 1` against Supabase. This is
   in-scope for this spec (Module 12, `utils/keepalive.ts`) since without
   it a personal tool used in bursts (exactly the target usage pattern)
   will hit a paused project on the next session.
4. **Tavily's real number reprioritizes the search provider chain** — see
   `search/tavily.ts` in §4 for the resulting budget-guard logic.

---

## 4. Module-by-Module Spec

Directory layout:

```
worker/src/
  index.ts
  context.ts
  mcp/
    server.ts
    router.ts
    schemas.ts
    validation.ts
  ai/
    router.ts
    cerebras.ts
    gemini.ts
  search/
    tavily.ts
    ddg.ts
    apify.ts
    dorking.ts
    dev-router.ts
    classify.ts
    domain-priority.ts
    project-context.ts
    registries.ts
  auth/
    keys.ts
    verify.ts
    permissions.ts
    ownership.ts
    ratelimit.ts
  storage/
    kv.ts
    supabase.ts
    turso.ts
  tools/
    search.ts
    devsearch.ts
    memory.ts
    guide.ts
  utils/
    safe-fetch.ts
    errors.ts
    monitoring.ts
    keepalive.ts
```

### `index.ts`

**Responsibility**: Worker entrypoint. Route `/mcp` (JSON-RPC), `/guide`
(human-readable GET), and the keepalive cron handler. Owns the top-level
`fetch` and `scheduled` exports.

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>
}
```

**Data flow**: `fetch` → CORS preflight short-circuit → body-size guard
(`MAX_JSON_BODY_BYTES`, imported from `utils/errors.ts`, single source of
truth — resolves known-issue #13 from prior audits of this pattern) → hand
off to `mcp/server.ts::handleRequest`. `scheduled` → `utils/keepalive.ts::ping`.

**Error behavior**: any uncaught error at this layer returns JSON-RPC
`-32603 Internal error` with a sanitized message (see §9 error table) —
never a raw stack trace, never a raw provider error string.

---

### `context.ts`

**Responsibility**: defines the `Env` interface (all bindings + secrets)
and builds a per-request `Context` object passed through the tool chain.

```ts
export interface Env {
  AGENT_KEYS: KVNamespace;
  RATE_LIMIT: KVNamespace;
  RESPONSE_CACHE: KVNamespace;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CEREBRAS_API_KEY: string;
  GEMINI_API_KEY: string;
  TAVILY_API_KEY: string;
  APIFY_API_TOKEN: string;
  ALLOWED_ORIGINS?: string; // present on Env from day one — no known-issue #11 to inherit
}

export interface Context {
  env: Env;
  agentId: string;
  agentTier: 'standard' | 'admin' | 'debug';
  requestId: string;
}

export function buildContext(req: Request, env: Env, agent: AgentRecord): Context
```

**Data flow**: constructed once per request immediately after auth succeeds;
passed by reference into every tool handler. No global mutable state.

---

### `mcp/server.ts`

**Responsibility**: top-level JSON-RPC 2.0 handler. Validates envelope
shape, dispatches `initialize`, `tools/list`, `tools/call` to
`mcp/router.ts`.

```ts
export async function handleRequest(request: Request, env: Env): Promise<Response>
export async function handleInitialize(params: unknown): Promise<InitializeResult>
```

**Data flow**: parses JSON body → validates JSON-RPC envelope
(`{jsonrpc: "2.0", id, method, params}`) → auth (via `auth/verify.ts`) →
rate limit (via `auth/ratelimit.ts`) → `mcp/router.ts::dispatch(method, params, ctx)`.

**Error behavior**: malformed envelope → `-32600 Invalid Request`. Unknown
method → `-32601 Method not found`. All downstream tool errors are caught
here and mapped to `-32000`-range server errors with platform error codes
in the `data` field (see §9).

---

### `mcp/router.ts`

**Responsibility**: routes `tools/call` by tool name to the correct
handler in `tools/*`. Owns the canonical list of 5 tools for `tools/list`.

```ts
export const TOOL_REGISTRY: ToolDefinition[]; // exactly 5 entries
export async function dispatchToolCall(name: string, args: unknown, ctx: Context): Promise<ToolResult>
```

**Data flow**: `name` → lookup in `TOOL_REGISTRY` → Zod-validate `args`
against the tool's schema (`mcp/schemas.ts`) → invoke handler.

**Error behavior**: unknown tool name → `INVALID_PARAMS` platform code.
Schema validation failure → `INVALID_PARAMS` with field-level detail (safe
to expose — it's the caller's own malformed input, not internal state).

---

### `mcp/schemas.ts`

**Responsibility**: Zod schemas for every tool's input, single source of
truth also used to generate the JSON Schema exposed in `tools/list`.

```ts
export const SearchInputSchema: z.ZodType;
export const DevSearchInputSchema: z.ZodType;
export const RememberInputSchema: z.ZodType;
export const RecallInputSchema: z.ZodType;
export const GuideInputSchema: z.ZodType;
```

Full field definitions are given in §8 (MCP API Surface).

---

### `mcp/validation.ts`

**Responsibility**: shared validation helpers used across schemas —
query-length caps, tag-array caps, enum guards. Exists so `search_in`
enum values (`["url","title","body"]`) are defined once and can't drift
from their description strings.

```ts
export const MAX_QUERY_LENGTH = 2000;
export const SEARCH_IN_VALUES = ['url', 'title', 'body'] as const;
export function isValidSearchIn(v: unknown): v is typeof SEARCH_IN_VALUES[number]
```

---

### `ai/router.ts`

**Responsibility**: provider-abstraction dispatch. Never lets a caller or
a response leak "Cerebras" / "Gemini" outside `admin`/`debug` tier.

```ts
export type AITaskType = 'summarize' | 'classify' | 'embed';

export interface AIDispatchResult {
  text?: string;
  embedding?: number[];
  providerUsed: 'cerebras' | 'gemini'; // internal only
  platformCategory: 'search' | 'memory' | 'cache';
}

export async function dispatchAI(task: AITaskType, input: string, ctx: Context): Promise<AIDispatchResult>
```

**Data flow**: `task='summarize'|'classify'` → try `ai/cerebras.ts` first
(fast path) → on failure or budget-exhaustion signal, fall back to
`ai/gemini.ts` (Flash model, `generateContent`). `task='embed'` → always
`ai/gemini.ts::embedText` (Cerebras has no embedding endpoint).

**Error behavior**: both providers failing → throws `AIProviderError`,
caught by the calling tool and mapped to `SEARCH_UNAVAILABLE` or
`MEMORY_UNAVAILABLE` depending on caller context — `ai/router.ts` itself
never emits a platform error code, that's the caller's job.

---

### `ai/cerebras.ts`

**Responsibility**: thin wrapper over Cerebras chat completions.

```ts
export async function complete(prompt: string, opts: { maxTokens?: number }, env: Env): Promise<string>
```

**Data flow**: single `fetch()` to Cerebras `/v1/chat/completions`. Honors
the ~5 RPM ceiling by surfacing 429s immediately (no local retry loop —
retry/backoff decision belongs to `ai/router.ts`'s fallback, not this
module, to avoid burning CPU budget on retries).

**Error behavior**: non-2xx → throws with sanitized message; raw Cerebras
error body is logged via `utils/monitoring.ts` but never returned to the
MCP client.

---

### `ai/gemini.ts`

**Responsibility**: wrapper over Gemini `generateContent` (fallback text
path) and `embedText` (primary embedding path, used by auto-recall and
`anchor_remember`).

```ts
export async function generateContent(prompt: string, opts: { maxTokens?: number }, env: Env): Promise<string>
export async function embedText(text: string, env: Env): Promise<number[]>
```

**Data flow**: `embedText` is on the hot path for every `anchor_search`
call (auto-recall) and every `anchor_remember` call. No Files API code —
that capability is deleted along with DeepDoc; this module only ever sends
plain text.

**Error behavior**: embedding failure inside auto-recall is caught by the
caller (`tools/search.ts`) and converted to "omit `related_memories`," per
§5. Embedding failure inside `anchor_remember` (a write, not the recall
fast-path) **does** surface as `MEMORY_UNAVAILABLE` — a failed write should
not silently pretend to succeed.

---

### `search/tavily.ts`

**Responsibility**: Tavily provider adaptor. **Demoted to secondary/quality
role** per the revised free-tier number in §3.

```ts
export async function tavilySearch(query: string, opts: SearchOpts, env: Env): Promise<ProviderResult>
export async function isTavilyBudgetHealthy(env: Env): Promise<boolean>
```

**Data flow**: before calling Tavily, `search/dev-router.ts`'s parent
pipeline checks `isTavilyBudgetHealthy` — a KV-cached counter (`storage/kv.ts`)
tracking approximate monthly credit consumption (reset on a UTC-month
boundary). If the estimated remaining pool is below a configurable floor
(`TAVILY_RESERVE_CREDITS`, default 100), Tavily is skipped and the pipeline
proceeds with DDG-only. This budget check costs one KV read (cheap) and
avoids the far more expensive failure mode of Tavily returning 402/429
mid-session.

**Error behavior**: Tavily 429/402 → caught, logged, provider chain
continues to DDG. Never bubbles up as a tool-level error — search must
still succeed via other providers per the existing graceful-degradation
posture of this subsystem.

---

### `search/ddg.ts`

**Responsibility**: **Primary** web search provider. DuckDuckGo
HTML-endpoint scrape adaptor (no official API, no credit metering).

```ts
export async function ddgSearch(query: string, opts: SearchOpts): Promise<ProviderResult>
```

**Data flow**: constructs a DDG lite/html query URL, fetches via
`utils/safe-fetch.ts` (SSRF-guarded), parses result HTML into the common
`ProviderResult` shape shared with Tavily/Apify.

**Error behavior**: 429 or CAPTCHA-page detection → exponential backoff
(max 2 retries) → on exhaustion, throws, caught by the pipeline which then
tries Tavily (if budget-healthy) or Apify.

---

### `search/apify.ts`

**Responsibility**: tertiary/fallback provider via an Apify actor, used
only when both DDG and Tavily fail or are budget-exhausted in the same
request.

```ts
export async function apifySearch(query: string, opts: SearchOpts, env: Env): Promise<ProviderResult>
```

**Data flow**: invokes a configured Apify actor run, polls for completion
(bounded — must not exceed CPU-friendly wait patterns; uses `fetch` polling
with a hard timeout, not a busy loop). Budget-guarded to a $4.50/mo ceiling
tracked the same way as Tavily's credit counter.

**Error behavior**: failure here means all three providers failed — the
pipeline returns `SEARCH_UNAVAILABLE` to the tool layer, which is the one
legitimate case where `anchor_search` itself fails outright (not to be
confused with the auto-recall failure path, which never fails the whole call).

---

### `search/dorking.ts`

**Responsibility**: parses and applies dork operators (`site:`,
`filetype:`, `intitle:`, `-exclude`, quoted phrases) from the raw query
string before it's handed to a provider.

```ts
export function parseDorkOperators(query: string): { cleanQuery: string; operators: DorkOperator[] }
export function applyDorkOperators(providerQuery: string, operators: DorkOperator[]): string
```

**Data flow**: runs once, upstream of the provider fan-out, so all three
providers see a consistently dork-adjusted query where the target provider
supports the syntax (DDG and Tavily both accept `site:`/`filetype:` natively;
operators unsupported by a given provider are stripped for that provider
specifically, tracked per-provider in `DorkOperator.supportedProviders`).

---

### `search/dev-router.ts`

**Responsibility**: orchestrates the provider fan-out described above:
budget checks → primary (DDG) → secondary (Tavily, budget-gated) →
tertiary (Apify) → phantom-answer suppression → classification →
domain-priority reordering.

```ts
export async function runSearchPipeline(query: string, opts: SearchOpts, ctx: Context): Promise<SearchResult>
```

**Data flow**: this is the module `tools/search.ts` calls as one branch of
its `Promise.all`. Internally sequential across providers (fallback chain)
but the *whole pipeline* runs concurrently with the memory recall lookup.

**Error behavior**: only throws `SEARCH_UNAVAILABLE` if all three providers
are exhausted (see `apify.ts` above). All intermediate provider failures
are internal and logged, not surfaced.

---

### `search/classify.ts`

**Responsibility**: phantom-answer suppression — detects and discards
provider results that are low-content placeholder pages, paywalled stubs,
or AI-generated SEO filler indistinguishable from a real answer.

```ts
export function classifyResult(result: RawProviderResult): 'genuine' | 'phantom' | 'uncertain'
export function filterPhantomResults(results: RawProviderResult[]): RawProviderResult[]
```

**Data flow**: applied to the merged provider result set before
domain-priority reordering. Heuristic-first (content length, boilerplate
pattern match); `'uncertain'` results are passed through
`ai/router.ts::dispatchAI('classify', ...)` only when the heuristic can't
decide, to conserve AI budget.

---

### `search/domain-priority.ts`

**Responsibility**: reorders results by a configurable domain-priority
list (e.g. official docs > Stack Overflow > blog aggregators > SEO farms).

```ts
export function scoreDomainPriority(url: string): number
export function reorderByDomainPriority(results: ProviderResult[]): ProviderResult[]
```

---

### `search/project-context.ts`

**Responsibility**: biases dev-search results toward the caller's stated
project manifest (package.json/Cargo.toml/pyproject.toml contents, if
supplied in the tool call), boosting results referencing dependencies
actually present in the project.

```ts
export function biasByProjectContext(results: ProviderResult[], manifest: ProjectManifest | null): ProviderResult[]
```

**Data flow**: only invoked from `tools/devsearch.ts`. If no manifest is
supplied, this is a no-op passthrough — `anchor_dev_search` remains fully
usable without it (documented as a power-user enhancement, not a
requirement).

---

### `search/registries.ts`

**Responsibility**: package-registry-aware query augmentation — knows how
to query npm, PyPI, crates.io, and similar registries directly for
package-existence/version facts, rather than relying purely on web search
for "does this package exist and what's its latest version" queries.

```ts
export async function queryRegistry(packageName: string, ecosystem: Ecosystem): Promise<RegistryResult | null>
```

**Data flow**: called by `search/dev-router.ts` when the query pattern
looks like a package lookup (heuristic: single token, no spaces, matches
common package-name shape). Runs in parallel with the general web-search
fan-out, not sequentially.

---

### `auth/keys.ts`

**Responsibility**: agent key generation and format validation.

```ts
export function generateAgentKey(slug: string): string; // anchor_<slug>_<hex>
export function isValidKeyFormat(key: string): boolean
export function extractSlug(key: string): string | null
```

**Format**: `anchor_<slug>_<32-hex-char-secret>`. Slug is a URL-safe
lowercase identifier (e.g. `anchor_claudecode_a1b2c3...`).

---

### `auth/verify.ts`

**Responsibility**: verifies a presented key against KV (fast path),
falling back to Turso on KV miss (e.g. just-provisioned key not yet
propagated, or KV entry expired/evicted).

```ts
export async function verifyAgentKey(key: string, env: Env): Promise<AgentRecord | null>
```

**Data flow**: `KV.get(key)` → hit → parse `AgentRecord` JSON → done.
Miss → `storage/turso.ts::lookupAgent(key)` → if found, **write back to
KV** (this write counts against the 1,000/day KV write budget — acceptable
since KV misses should be rare in steady state) → return record. Not found
in either → `null`.

**Error behavior**: `null` → caller (`mcp/server.ts`) rejects the request
with JSON-RPC error `-32001` (custom, documented range, §9) and a generic
"authentication failed" message — never reveals whether the key format
was wrong vs. the key not existing vs. the key being revoked. Auth
failures are rejected at this layer before any platform error code is
considered.

---

### `auth/permissions.ts`

**Responsibility**: tier-based capability gating (`standard` vs.
`admin`/`debug`) — specifically, whether `_meta.provider_used` includes raw
vendor names.

```ts
export function canSeeProviderNames(tier: AgentTier): boolean
export function filterMetaForTier(meta: RawMeta, tier: AgentTier): PublicMeta
```

---

### `auth/ownership.ts`

**Responsibility**: ensures memory rows written by one agent key are only
recalled by request contexts entitled to see them. For a solo-developer
deployment this defaults to **shared ownership across all of one
developer's own agent keys** (the whole point of the product is
cross-runtime recall) — but the interface supports per-agent isolation for
future multi-tenant use.

```ts
export function resolveMemoryScope(ctx: Context): { ownerId: string; sharedWith: string[] }
```

**Data flow**: `ownerId` is the developer's account ID (one per Anchor
deployment in the personal-use model), not the individual agent key —
this is what makes "Claude Code writes a memory, OpenCode recalls it"
work. Documented explicitly since it's a deliberate scope decision, not an
oversight.

---

### `auth/ratelimit.ts`

**Responsibility**: enforces 30 req/min and 500 req/day per agent,
configurable per-agent at creation time (stored in the `AgentRecord`).
Implements the write-coalescing pattern from §3.1.

```ts
export async function checkAndIncrement(agentId: string, limits: RateLimits, env: Env): Promise<RateLimitResult>
```

```ts
interface RateLimitResult {
  allowed: boolean;
  remainingMinute: number;
  remainingDay: number;
  resetAtMinute: string; // ISO
  resetAtDay: string;    // ISO
}
```

**Data flow**: reads current minute-bucket and day-bucket counters from KV
in one `get` (`ratelimit:<agentId>` key holding a small JSON blob with both
counters + their window-start timestamps). If the current time has crossed
into a new minute or day window, the corresponding counter resets **in the
read value** before the increment — meaning the write always reflects the
freshest state, and only one KV write occurs per request regardless of
whether a rollover happened. This is the mechanism referenced in §3.1 that
keeps writes to roughly one per request rather than one-plus-reset-write.

**Error behavior**: `allowed: false` → caller returns `RATE_LIMITED` with
`resetAtMinute`/`resetAtDay` surfaced to help the client's own backoff
logic — this detail is safe to expose, it's the caller's own quota state.

---

### `storage/kv.ts`

**Responsibility**: thin, typed wrapper over the three KV namespaces
(`AGENT_KEYS`, `RATE_LIMIT`, `RESPONSE_CACHE`). No TTS-related cache key
patterns (none ever existed in this greenfield build — the exclusion is
inherited as a design constraint from the product scope, not cleaned up
from legacy code).

```ts
export async function getAgentRecord(key: string, env: Env): Promise<AgentRecord | null>
export async function setAgentRecord(key: string, record: AgentRecord, env: Env): Promise<void>
export async function getRateLimitState(agentId: string, env: Env): Promise<RateLimitState | null>
export async function setRateLimitState(agentId: string, state: RateLimitState, env: Env): Promise<void>
export async function getCached<T>(key: string, env: Env): Promise<T | null>
export async function setCached<T>(key: string, value: T, ttlSeconds: number, env: Env): Promise<void>
export async function getTavilyBudgetCounter(env: Env): Promise<number>
export async function incrementTavilyBudgetCounter(delta: number, env: Env): Promise<void>
```

**Data flow**: `RESPONSE_CACHE` is used to cache identical `anchor_search`
queries for a short TTL (e.g. 300s) — this is both a latency win and a
direct mitigation for the Tavily/Cerebras rate limits, since a repeated
query within the cache window costs zero provider calls.

**Error behavior**: KV unavailable (rare, but possible) → all functions
return `null`/no-op rather than throwing, and the caller treats this as a
cache miss / fresh-state assumption — KV outage must degrade gracefully,
same philosophy as the auto-recall failure mode.

---

### `storage/supabase.ts`

**Responsibility**: all Supabase pgvector interaction — memory writes,
memory search (both the full `anchor_recall` path and the lightweight
auto-recall path), and the keepalive ping.

```ts
export async function writeMemory(entry: MemoryEntry, env: Env): Promise<{ id: string }>
export async function matchMemories(embedding: number[], opts: MatchOpts, env: Env): Promise<MemoryMatch[]>
export async function matchMemoriesLite(embedding: number[], env: Env): Promise<MemoryMatch[]>
export async function pingKeepalive(env: Env): Promise<void>
```

```ts
interface MatchOpts {
  matchThreshold: number; // full anchor_recall: caller-tunable, default 0.75
  matchCount: number;     // full anchor_recall: caller-tunable, default 10
}
```

**Data flow**: `matchMemoriesLite` is a fixed-parameter variant
specifically for auto-recall — `matchThreshold: 0.72` (moderate, slightly
looser than the default recall threshold since this is a lightweight
"related context" surface, not a precision-critical lookup),
`matchCount: 4` (mid-point of the spec'd 3–5 range), and explicitly
**no rerank pass** — it calls the same underlying `match_memories` RPC
(see §6 DDL) with these fixed params, avoiding a second RPC definition.

**Error behavior**: `writeMemory` failure → throws, caller
(`tools/memory.ts`) surfaces `MEMORY_UNAVAILABLE` — writes must not fail
silently. `matchMemoriesLite` failure → throws, but the **only** caller
(`tools/search.ts`'s auto-recall branch) catches it internally and
degrades per §5. `matchMemories` (full `anchor_recall` tool) failure →
throws, surfaces `MEMORY_UNAVAILABLE` — this is a direct user-invoked read,
not a background enhancement, so it must report failure honestly.

---

### `storage/turso.ts`

**Responsibility**: agent metadata table (source of truth for agent
records, KV is a cache in front of this) and auth fallback reads.

```ts
export async function lookupAgent(key: string, env: Env): Promise<AgentRecord | null>
export async function createAgent(record: NewAgentRecord, env: Env): Promise<AgentRecord>
export async function listAgents(env: Env): Promise<AgentRecord[]>
export async function revokeAgent(agentId: string, env: Env): Promise<void>
```

**Data flow**: `createAgent` is the only path that also writes to KV
immediately (via `storage/kv.ts::setAgentRecord`) so a newly-created key
works on its very first request without waiting for a KV-miss fallback.

**Error behavior**: Turso unavailable during auth fallback → the request
fails closed (auth failure), since Turso is the source of truth for agent
existence and a KV-miss-then-Turso-fails scenario cannot safely default to
"allow." This is the one storage failure mode in the system that does
**not** degrade gracefully, by design — auth must fail closed.

---

### `tools/search.ts`

**Responsibility**: implements `anchor_search`. This is where the
auto-recall injection lives — see full design in §5.

```ts
export async function handleSearch(input: SearchInput, ctx: Context): Promise<SearchToolResult>
```

**Data flow**: cache check (`storage/kv.ts::getCached`) → if miss,
`Promise.all([search/dev-router.ts::runSearchPipeline(...), recallForSearch(...)])`
→ merge → cache the merged result (excluding `related_memories`, which is
always freshly computed per-request even on an otherwise-cached search, so
recall stays current even when the web-search portion is served from
cache) → return.

**Error behavior**: web search pipeline failure → `SEARCH_UNAVAILABLE`
(this is the one true failure path for the tool). Recall failure → never
propagates, per §5.

---

### `tools/devsearch.ts`

**Responsibility**: implements `anchor_dev_search`.

```ts
export async function handleDevSearch(input: DevSearchInput, ctx: Context): Promise<DevSearchToolResult>
```

**Data flow**: optional `projectManifest` param → `search/project-context.ts`
bias → `search/registries.ts` for package-existence queries (parallel) +
`search/dev-router.ts` for general dev-flavored web search (parallel) →
merge, dedupe, domain-priority reorder.

**Error behavior**: same `SEARCH_UNAVAILABLE` posture as `tools/search.ts`.
No auto-recall injection on this tool — that's explicitly scoped to
`anchor_search` only, per the locked product decisions.

---

### `tools/memory.ts`

**Responsibility**: implements both `anchor_remember` and `anchor_recall`
(distinguished by which MCP tool name routed here — both live in one file
since they share the embedding + Supabase-client setup).

```ts
export async function handleRemember(input: RememberInput, ctx: Context): Promise<RememberToolResult>
export async function handleRecall(input: RecallInput, ctx: Context): Promise<RecallToolResult>
```

**Data flow** (`handleRemember`): `ai/gemini.ts::embedText(content)` →
`storage/supabase.ts::writeMemory({ content, embedding, ownerId, tags, ... })`.

**Data flow** (`handleRecall`): `ai/gemini.ts::embedText(query)` →
`storage/supabase.ts::matchMemories(embedding, { matchThreshold, matchCount })`
— this is the full-featured, caller-tunable recall path, distinct from the
fixed lightweight `matchMemoriesLite` used internally by auto-recall.

**Error behavior**: both fail loudly (`MEMORY_UNAVAILABLE`) — these are
direct, user-invoked operations, not background enhancements.

---

### `tools/guide.ts`

**Responsibility**: implements `anchor_guide`, returning static-but-
structured markdown documenting the other four tools, written for the
**3-capability** narrative (Search w/ auto-recall, Dev Search, Memory) —
no TTS/DeepDoc references anywhere, since those concepts never existed in
this build.

```ts
export const GUIDE_CONTENT: string; // markdown
export async function handleGuide(_input: unknown, ctx: Context): Promise<GuideToolResult>
```

**Data flow**: no external calls — pure static content assembly (may
interpolate the caller's tier to omit admin-only notes for `standard`
agents).

---

### `utils/safe-fetch.ts`

**Responsibility**: SSRF-guarded fetch wrapper used by every module that
makes an outbound request (search providers, AI providers, Supabase,
Turso).

```ts
export function validateFetchUrl(url: string, opts: { allowedSchemes?: string[]; allowedHosts?: string[] }): boolean
export async function safeFetch(url: string, init: RequestInit, opts?: SafeFetchOpts): Promise<Response>
```

**Data flow**: `validateFetchUrl` rejects non-`https` schemes, rejects
private/link-local/loopback IP ranges and IP-literal hosts unless
explicitly allowlisted, rejects hosts not matching a known-good pattern
for the calling module (each provider module passes its own expected host
set). `safeFetch` wraps `fetch()` with this validation plus a timeout.

**No file-validation helpers** (`sanitizeFilename`, `safeExtension`,
`validateMimeType`) — these never exist in this build since there is no
file-upload path anywhere in Anchor's scope.

---

### `utils/errors.ts`

**Responsibility**: single source of truth for platform error codes,
sanitized-message mapping, and shared constants including
`MAX_JSON_BODY_BYTES`.

```ts
export const MAX_JSON_BODY_BYTES = 1_000_000; // 1MB — generous for text-only payloads, no file uploads
export type PlatformErrorCode =
  | 'SEARCH_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'MEMORY_UNAVAILABLE'
  | 'INVALID_PARAMS'
  | 'INTERNAL_ERROR';
export function sanitizeDetails(code: PlatformErrorCode, internalMessage: string): string
export function toJsonRpcError(code: PlatformErrorCode, detail?: string): JsonRpcError
```

Full code table in §9.

---

### `utils/monitoring.ts`

**Responsibility**: `captureError` — the single logging path for
internal-only failure detail (raw provider errors, stack traces). Never
called with anything destined for the client.

```ts
export function captureError(context: string, error: unknown, meta?: Record<string, unknown>): void
```

**Data flow**: currently logs via `console.error` with structured JSON
(consumable by `wrangler tail` and Cloudflare's log retention) — no
external error-tracking vendor wired up in this free-tier build; the
interface is deliberately vendor-neutral so Sentry-or-similar can be
added later without touching call sites.

---

### `utils/keepalive.ts`

**Responsibility**: the Supabase-pause mitigation from §3.1.

```ts
export async function ping(env: Env): Promise<void>
```

**Data flow**: invoked from `index.ts`'s `scheduled` export on a cron
trigger (`0 0 */4 * *` — every 4 days, comfortably inside the 7-day pause
window). Calls `storage/supabase.ts::pingKeepalive`, which runs a trivial
`select 1`-equivalent query. Failures here are logged via
`captureError` but never throw uncaught — a missed keepalive tick isn't
fatal, it just increases pause risk until the next tick.

---

## 5. Auto-Recall Injection — Full Design

**Trigger**: every `anchor_search` call, unconditionally (no opt-out
parameter in this version — it's the product's core differentiator, not
an optional feature).

**Sequence**:

```
1. tools/search.ts::handleSearch(input, ctx) invoked
2. Check RESPONSE_CACHE for identical (query, filters) tuple
   → if hit: still proceed to step 3 for related_memories (memory recall
     is NOT served from the search-result cache — it must reflect memories
     written since the search was last cached)
3. Promise.all([
     branchA: search/dev-router.ts::runSearchPipeline(query, opts, ctx)
     branchB: recallForSearch(query, ctx)
   ])
4. branchA resolves → SearchResult | rejects → thrown SEARCH_UNAVAILABLE
5. branchB (recallForSearch) — defined entirely within tools/search.ts:

   async function recallForSearch(query: string, ctx: Context): Promise<MemoryMatch[]> {
     try {
       const embedding = await ai/gemini.ts::embedText(query, ctx.env);
       const matches = await storage/supabase.ts::matchMemoriesLite(embedding, ctx.env);
       return matches;
     } catch (err) {
       utils/monitoring.ts::captureError('recallForSearch', err, { query });
       return []; // NEVER throws past this point
     }
   }

6. Merge: { ...branchA result, related_memories: branchB result }
   (if branchB returned [], related_memories is present but empty —
   see §8 for the decision on empty-array vs. omitted-field, resolved
   below)
7. Cache the branchA portion only (see step 2 rationale) → return merged result
```

**Parallel execution**: enforced structurally — `recallForSearch` and
`runSearchPipeline` are two array elements passed to a single `Promise.all`
call in `tools/search.ts`. There is no code path where one awaits the
other. This satisfies the brief's explicit acceptance criterion (confirmed
via the latency test in §10).

**Thresholds**: `matchThreshold: 0.72`, `matchCount: 4` — fixed, not
caller-configurable, since auto-recall is a lightweight background
enhancement, not a tunable primary operation (the full `anchor_recall`
tool remains fully tunable for that purpose).

**Failure modes and handling**:

| Failure point | Handling |
|---|---|
| `embedText` throws (Gemini quota exhausted, network error) | Caught inside `recallForSearch`, logged via `captureError`, returns `[]` |
| `matchMemoriesLite` throws (Supabase outage, paused project, RLS misconfig) | Caught inside `recallForSearch`, logged via `captureError`, returns `[]` |
| Both `embedText` and web search fail simultaneously | Web search failure still propagates as `SEARCH_UNAVAILABLE` — recall failure does not mask a genuine search failure, nor does it get blamed for one |
| Supabase paused (7-day inactivity) | Same as generic Supabase outage — caught, logged, `[]` returned. The keepalive cron (§4, `utils/keepalive.ts`) is the actual prevention mechanism; this is the safety net if prevention fails |

**Field shape decision**: `related_memories` is **always present** as an
array (possibly empty `[]`), never omitted from the response shape. This
gives MCP clients a stable schema to code against — "field sometimes
missing" is a worse client-integration experience than "field sometimes
empty," and the brief's "omit the field" language is satisfied in spirit
(no error, no stub error object, no misleading non-empty placeholder) while
keeping the schema stable. This is called out explicitly since it's a
reasonable point of interpretation.

**Logging**: every `recallForSearch` failure is one `captureError` call
with `context: 'recallForSearch'`, the failing query (safe to log — it's
the developer's own search query in a personal-use system, not
third-party PII), and the underlying error. No separate metrics pipeline
in this free-tier build — `wrangler tail` + Cloudflare's built-in log
retention is the observability surface for a solo-developer deployment.

---

## 6. Database Schemas

### 6.1 Supabase — `memories` table + pgvector + RPC + RLS

```sql
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
```

### 6.2 Turso — `agents` table (metadata / auth fallback)

```sql
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
```

**Note on `key_hash`**: neither Turso nor KV ever stores the raw agent key.
`auth/verify.ts` hashes the presented key (SHA-256) before any lookup —
`AGENT_KEYS` KV is keyed by the hash, not the plaintext key, so a KV or
Turso data exposure does not directly expose usable credentials.

---

## 7. Environment Variables & Secrets

| Variable | Provider | Purpose | Format |
|---|---|---|---|
| `TURSO_DATABASE_URL` | Turso | Turso client connection | `libsql://<db>-<org>.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso | Turso client auth | JWT string |
| `SUPABASE_URL` | Supabase | REST/RPC endpoint | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side full-access key (bypasses RLS) | JWT string — **never expose to any client-facing surface** |
| `CEREBRAS_API_KEY` | Cerebras | Chat completions | `csk-...` |
| `GEMINI_API_KEY` | Google AI Studio | Embeddings + fallback generation | `AIza...` |
| `TAVILY_API_KEY` | Tavily | Secondary search provider | `tvly-...` |
| `APIFY_API_TOKEN` | Apify | Tertiary search fallback | `apify_api_...` |
| `ALLOWED_ORIGINS` | — (app config) | CORS allowlist, comma-separated | `https://claude.ai,https://cursor.sh,...` |
| `TAVILY_RESERVE_CREDITS` | — (app config) | Floor below which Tavily is skipped in favor of DDG-only | integer, default `100` |

### `wrangler.toml` skeleton

```toml
name = "anchor-mcp"
main = "src/index.ts"
compatibility_date = "2026-08-01"

[[kv_namespaces]]
binding = "AGENT_KEYS"
id = "<provisioned-at-deploy>"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<provisioned-at-deploy>"

[[kv_namespaces]]
binding = "RESPONSE_CACHE"
id = "<provisioned-at-deploy>"

[triggers]
crons = ["0 0 */4 * *"]  # keepalive ping, every 4 days

[vars]
ALLOWED_ORIGINS = "https://claude.ai"
TAVILY_RESERVE_CREDITS = "100"

# Secrets set via `wrangler secret put <NAME>`, never committed:
#   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, SUPABASE_URL,
#   SUPABASE_SERVICE_ROLE_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY,
#   TAVILY_API_KEY, APIFY_API_TOKEN
```

### `.dev.vars` skeleton (local dev only, gitignored)

```
TURSO_DATABASE_URL=libsql://your-dev-db.turso.io
TURSO_AUTH_TOKEN=eyJ...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CEREBRAS_API_KEY=csk-...
GEMINI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
APIFY_API_TOKEN=apify_api_...
```

---

## 8. MCP API Surface

### `initialize`

```json
// Request params
{ "protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": { "name": "...", "version": "..." } }
```
```json
// Response
{
  "protocolVersion": "2025-11-25",
  "capabilities": { "tools": {} },
  "serverInfo": { "name": "anchor-mcp", "version": "1.0.0" }
}
```

### `tools/list`

Returns **exactly 5 tools**:

```json
{
  "tools": [
    { "name": "anchor_search", "description": "...", "inputSchema": { /* from SearchInputSchema */ } },
    { "name": "anchor_dev_search", "description": "...", "inputSchema": { /* from DevSearchInputSchema */ } },
    { "name": "anchor_remember", "description": "...", "inputSchema": { /* from RememberInputSchema */ } },
    { "name": "anchor_recall", "description": "...", "inputSchema": { /* from RecallInputSchema */ } },
    { "name": "anchor_guide", "description": "...", "inputSchema": { /* from GuideInputSchema */ } }
  ]
}
```

### `tools/call` — per tool

#### `anchor_search`

Zod input:
```ts
z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH),
  search_in: z.array(z.enum(SEARCH_IN_VALUES)).optional().default(['url', 'title', 'body']),
  max_results: z.number().int().min(1).max(20).optional().default(10),
})
```

Output shape:
```ts
{
  results: Array<{ url: string; title: string; snippet: string; domainPriority: number }>;
  summary: string; // AI-generated, via ai/router.ts dispatchAI('summarize')
  related_memories: Array<{ id: string; content: string; tags: string[]; similarity: number; created_at: string }>; // always present, may be []
  _meta: { provider_used: string; platform_category: 'search' | 'memory' | 'cache' }; // provider_used is a vendor name only for admin/debug tier — otherwise a category label like "search-primary"
}
```

#### `anchor_dev_search`

Zod input:
```ts
z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH),
  ecosystem: z.enum(['npm', 'pypi', 'cargo', 'go', 'other']).optional(),
  project_manifest: z.string().optional(), // raw manifest file contents, pasted by the caller
  max_results: z.number().int().min(1).max(20).optional().default(10),
})
```

Output shape:
```ts
{
  results: Array<{ url: string; title: string; snippet: string; registryMatch?: { name: string; version: string; ecosystem: string } }>;
  summary: string;
  _meta: { provider_used: string; platform_category: 'search' };
}
```

#### `anchor_remember`

Zod input:
```ts
z.object({
  content: z.string().min(1).max(10000),
  tags: z.array(z.string()).max(10).optional().default([]),
})
```

Output shape:
```ts
{ id: string; stored: true; _meta: { provider_used: string; platform_category: 'memory' } }
```

#### `anchor_recall`

Zod input:
```ts
z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH),
  match_threshold: z.number().min(0).max(1).optional().default(0.75),
  match_count: z.number().int().min(1).max(50).optional().default(10),
})
```

Output shape:
```ts
{
  matches: Array<{ id: string; content: string; tags: string[]; similarity: number; created_at: string }>;
  _meta: { provider_used: string; platform_category: 'memory' };
}
```

#### `anchor_guide`

Zod input: `z.object({})` (no params).

Output shape:
```ts
{ guide: string /* markdown */ }
```

### Error code table

| Platform code | JSON-RPC mapping | When | Client-visible detail |
|---|---|---|---|
| `SEARCH_UNAVAILABLE` | `-32000` | All search providers exhausted | "Search is temporarily unavailable. Try again shortly." |
| `RATE_LIMITED` | `-32000` | Per-minute or per-day cap exceeded | Includes `resetAtMinute`/`resetAtDay` (safe, caller's own quota) |
| `QUOTA_EXCEEDED` | `-32000` | AI provider budget genuinely exhausted (both Cerebras and Gemini fallback failed) | "AI capacity temporarily exhausted." |
| `MEMORY_UNAVAILABLE` | `-32000` | Supabase write/read failure on a direct (non-auto-recall) memory operation | "Memory service is temporarily unavailable." |
| `INVALID_PARAMS` | `-32602` | Zod validation failure | Field-level validation detail (safe — caller's own input) |
| `INTERNAL_ERROR` | `-32603` | Uncaught/unexpected | Generic message only, always logged via `captureError` |
| (auth failure) | `-32001` | Invalid/missing/revoked key | Generic "authentication failed" — never distinguishes reason |

---

## 9. Auth & Rate-Limit Flow

**Auth sequence** (every request to `/mcp`):
1. Extract bearer key from `Authorization` header.
2. Format check (`auth/keys.ts::isValidKeyFormat`) — malformed key fails
   fast without touching KV/Turso.
3. Hash the key (SHA-256) → `auth/verify.ts::verifyAgentKey(hash, env)`.
4. KV lookup (`AGENT_KEYS.get(hash)`) — hit → parsed `AgentRecord`.
5. KV miss → `storage/turso.ts::lookupAgent(hash)` → found → write back to
   KV (populates cache for next request) → return record. Not found →
   auth failure (`-32001`), fails closed per §4's `storage/turso.ts` note.
6. `AgentRecord.status !== 'active'` → auth failure (revoked key).
7. Build `Context` via `context.ts::buildContext`.

**Rate-limit sequence** (immediately after auth succeeds):
1. `auth/ratelimit.ts::checkAndIncrement(agentId, record.rateLimits, env)`.
2. Single KV read of `ratelimit:<agentId>` → parse `{ minuteCount, minuteWindowStart, dayCount, dayWindowStart }`.
3. If `now` has crossed `minuteWindowStart + 60s` → reset `minuteCount` to 0
   and `minuteWindowStart` to now, in the in-memory value (not yet
   written). Same check for the day window.
4. Increment the (possibly-just-reset) counters.
5. Compare against `record.rateLimits` — if either exceeded, `allowed: false`,
   **do not increment further**, but still write back the read-and-possibly-
   reset state (so a rolled-over window isn't lost even on a rejected request).
6. Single KV write of the updated state.
7. `allowed: false` → `mcp/server.ts` returns `RATE_LIMITED` before
   dispatching to the tool router — the tool handler never runs.

---

## 10. Testing Strategy

Vitest suites, one per module directory, mirroring `src/` structure under
`worker/tests/`. Mocking: `vi.mock` for all external `fetch` calls (Tavily,
DDG, Apify, Cerebras, Gemini, Supabase REST, Turso HTTP) — no real network
calls in the unit suite. A separate `worker/tests/integration/` suite,
run manually against `wrangler dev` with real (but low-volume, budget-safe)
provider calls, is not part of `npm test` CI.

### The 5 critical tests (explicit, from the brief)

1. **Auto-recall success**: seed a mocked `matchMemoriesLite` response with
   2 matches → call `handleSearch` → assert `related_memories.length === 2`
   and assert the mocked web-search and mocked recall functions were both
   invoked (proves the merge happened, not just that one path ran).

2. **Auto-recall failure degradation**: mock `embedText` (or
   `matchMemoriesLite`) to reject → call `handleSearch` → assert the call
   **resolves** (does not throw) with `related_memories: []` and assert
   `captureError` was called with `context: 'recallForSearch'`. A second
   variant of this test mocks the web-search branch to also fail
   simultaneously and asserts the outer call **does** reject with
   `SEARCH_UNAVAILABLE` — proving recall failure doesn't mask a real
   search failure, and doesn't get blamed for one either.

3. **Ratelimit enforcement**: seed KV with a rate-limit state at
   `minuteCount = 30` (at the default cap) → call `checkAndIncrement` →
   assert `allowed: false` and assert exactly one KV write occurred (not
   zero, not two) — proving the write-coalescing logic from §3.1/§9 still
   persists the window-check state even on a rejected request.

4. **Auth rejection**: (a) malformed key format → assert fast rejection
   with zero KV/Turso calls made; (b) well-formed but unknown key → assert
   KV miss → Turso miss → auth failure, and assert the response message is
   the generic string, not something that reveals which stage failed;
   (c) known key with `status: 'revoked'` → assert auth failure.

5. **Provider fallback**: (a) AI: mock `ai/cerebras.ts::complete` to reject
   → assert `ai/router.ts::dispatchAI` falls through to
   `ai/gemini.ts::generateContent` and the result's `providerUsed === 'gemini'`;
   (b) Search: mock `ddgSearch` to reject and mock
   `isTavilyBudgetHealthy` to return `true` → assert the pipeline falls
   through to Tavily; separately, mock `isTavilyBudgetHealthy` to return
   `false` → assert Tavily is never called and the pipeline proceeds
   directly to Apify (or returns DDG-only results if DDG succeeded).

### Additional suite coverage (non-exhaustive, standard per-module)

- `search/dorking.ts`: operator parsing for each supported dork syntax.
- `search/classify.ts`: phantom-detection heuristic on known-good/known-bad
  fixture content.
- `mcp/schemas.ts`: every input schema rejects out-of-range values (e.g.
  `max_results: 21` rejected, `match_threshold: 1.5` rejected).
- `utils/safe-fetch.ts`: SSRF guard rejects loopback/link-local targets,
  rejects non-https schemes, accepts allowlisted hosts.
- `storage/kv.ts`: cache get/set round-trip; Tavily budget counter
  increments and resets on month boundary.

---

## 11. Deployment

### `wrangler.toml` — see full skeleton in §7.

### Deploy steps

```bash
# 1. Provision KV namespaces
wrangler kv:namespace create AGENT_KEYS
wrangler kv:namespace create RATE_LIMIT
wrangler kv:namespace create RESPONSE_CACHE
# → paste resulting IDs into wrangler.toml

# 2. Set secrets
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CEREBRAS_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put TAVILY_API_KEY
wrangler secret put APIFY_API_TOKEN

# 3. Apply DB schemas
#    - Supabase: run §6.1 DDL via the Supabase SQL editor or CLI migration
#    - Turso: turso db shell <db-name> < db/turso/schema.sql (§6.2)

# 4. Dry-run
wrangler deploy --dry-run

# 5. Deploy
wrangler deploy

# 6. Create first agent key (via a one-off script or direct Turso insert
#    + matching KV write — see auth/keys.ts::generateAgentKey)
```

### Smoke-test curl

```bash
# initialize
curl -sX POST https://anchor-mcp.<subdomain>.workers.dev/mcp \
  -H "Authorization: Bearer anchor_<slug>_<hex>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0"}}}'

# tools/list — expect exactly 5 tools
curl -sX POST https://anchor-mcp.<subdomain>.workers.dev/mcp \
  -H "Authorization: Bearer anchor_<slug>_<hex>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# tools/call — anchor_search, confirm related_memories field present
curl -sX POST https://anchor-mcp.<subdomain>.workers.dev/mcp \
  -H "Authorization: Bearer anchor_<slug>_<hex>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"anchor_search","arguments":{"query":"cloudflare workers cpu limits"}}}'
```

---

## 12. Implementation Plan

Phases are bite-sized and independently verifiable. Each lists exact files
and acceptance criteria.

### Phase 1 — Foundation

**Files**: `context.ts`, `mcp/server.ts`, `mcp/router.ts`, `mcp/schemas.ts`,
`mcp/validation.ts`, `utils/errors.ts`, `utils/monitoring.ts`, `index.ts`,
`wrangler.toml`, KV namespace provisioning.

**Acceptance criteria**:
- `initialize` round-trips correctly against protocol version `2025-11-25`.
- `tools/list` returns exactly 5 tool stubs (handlers can be no-op throws
  at this stage).
- `wrangler deploy --dry-run` succeeds with all 3 KV bindings resolved.
- `tsc --noEmit` clean.

### Phase 2 — Auth & Rate Limit

**Files**: `auth/keys.ts`, `auth/verify.ts`, `auth/permissions.ts`,
`auth/ownership.ts`, `auth/ratelimit.ts`, `storage/kv.ts`,
`storage/turso.ts`, `db/turso/schema.sql`.

**Acceptance criteria**:
- A generated `anchor_<slug>_<hex>` key authenticates successfully on
  first use (Turso lookup → KV write-back → subsequent requests hit KV).
- Malformed key rejected before any storage call (test asserts zero mock
  invocations).
- Rate limit test #3 from §10 passes: exactly one KV write per request,
  correct rollover behavior at minute/day boundaries.
- Revoked key rejected.

### Phase 3 — Search Subsystem (no auto-recall yet)

**Files**: all of `search/*`, `tools/search.ts` (without the recall
branch — plain web search only), `ai/router.ts`, `ai/cerebras.ts`,
`ai/gemini.ts` (generateContent only, not embedText yet).

**Acceptance criteria**:
- `anchor_search` returns real results via `wrangler dev` against DDG.
- Provider fallback test #5(b) from §10 passes.
- Tavily budget-guard test passes: `isTavilyBudgetHealthy` correctly gates
  Tavily invocation.
- Dork operator parsing test passes for `site:`, `filetype:`, `-exclude`,
  quoted phrases.
- Phantom-result classification test passes on fixture data.

### Phase 4 — Memory

**Files**: `db/supabase/schema.sql` (§6.1 DDL), `storage/supabase.ts`,
`tools/memory.ts`, `ai/gemini.ts` (add `embedText`).

**Acceptance criteria**:
- `anchor_remember` writes a row with a valid 768-dim embedding, verified
  by direct Supabase query.
- `anchor_recall` returns the written memory for a semantically similar
  query, with `similarity` above the default threshold.
- `MEMORY_UNAVAILABLE` correctly surfaces on a mocked Supabase failure for
  both `anchor_remember` and `anchor_recall` (these fail loudly, per §4).

### Phase 5 — Auto-Recall Injection

**Files**: `tools/search.ts` (add the `recallForSearch` branch and
`Promise.all` merge), `storage/supabase.ts` (add `matchMemoriesLite`).

**Acceptance criteria**:
- Critical test #1 (auto-recall success) passes.
- Critical test #2 (auto-recall failure degradation, both variants) passes.
- Manual `wrangler dev` verification: a real `anchor_search` call after a
  real `anchor_remember` call on the same topic returns a non-empty
  `related_memories[]`.
- Latency check: with recall injection enabled, p50 response time for
  `anchor_search` is not more than ~10-15% above the Phase 3 baseline
  (parallel execution confirmed — a sequential implementation would show
  roughly 2x, not 1.1x).

### Phase 6 — Hardening

**Files**: `utils/safe-fetch.ts`, `utils/keepalive.ts`, final pass on
`mcp/schemas.ts` validation ranges, `auth/permissions.ts` tier-gating for
`_meta.provider_used`.

**Acceptance criteria**:
- SSRF guard tests pass (loopback/link-local rejection, scheme rejection).
- Keepalive cron fires on schedule in a `wrangler dev --test-scheduled`
  invocation and successfully pings Supabase.
- `standard`-tier response never includes raw vendor names in `_meta`;
  `admin`/`debug`-tier does.
- Full `npm test` suite passes, `tsc --noEmit` clean,
  `wrangler deploy --dry-run` succeeds.

### Phase 7 — Multi-Runtime Dogfood

**Files**: none expected (verification phase, not a build phase).

**Acceptance criteria**:
- Successful `initialize` + `tools/call` round-trip from at least 2 real
  MCP clients (e.g. Claude Code and OpenCode).
- At least one real session where `anchor_recall` or auto-recall surfaces
  a memory written from a *different* runtime than the one recalling it —
  demonstrated live, not assumed from unit tests.

---

## 13. Acceptance Checklist

- [ ] `tools/list` returns exactly 5 tools under `anchor_*` naming
- [ ] `initialize` handshakes correctly on protocol version `2025-11-25`
- [ ] `anchor_search` response always includes `related_memories` as an
      array (never omitted, may be empty)
- [ ] Auto-recall runs in parallel with web search (verified by latency
      test, not just code inspection)
- [ ] Auto-recall failure (embedding or Supabase) never fails the overall
      `anchor_search` call
- [ ] Web search failure (all 3 providers exhausted) correctly returns
      `SEARCH_UNAVAILABLE`
- [ ] Rate limiting enforces 30/min and 500/day, configurable per-agent
      at creation
- [ ] Rate-limit KV writes are coalesced to ~1 per request (not 2+)
- [ ] Auth fails closed on Turso unavailability during KV-miss fallback
- [ ] `_meta.provider_used` shows vendor names only for `admin`/`debug`
      tier; platform categories otherwise
- [ ] No R2 bindings anywhere in `wrangler.toml`
- [ ] No TTS/DeepDoc/file-upload code paths exist anywhere (this is a
      greenfield build — verified by absence, not by grep-and-delete)
- [ ] Tavily budget guard correctly demotes/skips Tavily below the
      configured reserve floor
- [ ] Supabase keepalive cron fires every 4 days
- [ ] SSRF guard rejects loopback, link-local, and non-https targets
- [ ] Agent keys are never stored in plaintext (SHA-256 hash only, in
      both KV and Turso)
- [ ] All 5 critical tests from §10 pass
- [ ] `npm test`, `tsc --noEmit`, `wrangler deploy --dry-run` all clean
- [ ] Smoke-test curls (§11) succeed against the live deployment
- [ ] Multi-runtime dogfood (§12 Phase 7) demonstrated, not assumed

---

## Appendix: Self-Review Notes

- **Every free-tier figure in §3 was web-verified during this spec's
  authoring** (August 2026 search results). The one figure that
  **materially diverged from the brief's assumption** is Tavily
  (1,000 credits/month, not ~250/day) — this is flagged inline in §3 and
  propagated into a concrete design change (§3.1 point 4, `search/tavily.ts`
  budget-guard, and the DDG-primary/Tavily-secondary provider ordering).
- Cerebras's per-minute rate limit shows conflicting figures across
  sources (5 RPM per the most recent docs-adjacent source vs. 30 RPM in
  older material) — flagged in §3's decision table rather than silently
  picking one, with a note to confirm live in-dashboard at deploy time
  since Cerebras's per-minute limits have visibly tightened over 2026.
- KV's 1,000 writes/day cap is tighter than naive rate-limit-counter
  design would survive at full utilization — this is addressed with a
  concrete write-coalescing mechanism (§3.1, §4 `auth/ratelimit.ts`, §9),
  not just noted as a risk.
- Supabase's 7-day auto-pause is addressed with an in-scope keepalive
  cron (§4 `utils/keepalive.ts`, §7 `wrangler.toml` trigger) rather than
  left as an operational footnote.

---

## Appendix: Second Review Pass (Atom, 2026-08-09)

Independent review of this spec against the locked product decisions and
current free-tier reality. Changes made:

1. **§6.1 `source_tool` constraint** — removed phantom value
   `anchor_search_write`: no search-writes-memory feature exists in the
   product, so the DB contract would have been dead surface.
2. **§4 `auth/verify.ts` error behavior** — replaced in-document
   self-correction draft text ("RATE_LIMITED... no — ... is wrong too")
   with the final clean behavior statement (JSON-RPC `-32001`, generic
   message, rejected before platform codes).
3. **§3.1 KV write budget** — cleaned convoluted draft phrasing; the
   chosen approach (one coalesced KV write per request, ≤3 concurrent
   agents, second KV namespace above that) is unchanged in substance.

Externally verified during this pass:

- **Tavily free tier = 1,000 credits/month** (Researcher plan, no card) —
  confirmed via 3 independent sources. The §3/§4 DDG-primary →
  Tavily-secondary ordering is correct as written.
- Cloudflare Workers free (100k req/day, 10ms CPU), Supabase free
  (2 projects, 500MB DB, 7-day auto-pause), Turso free (100 DBs, 5GB,
  500M row reads/mo) — all match current published limits.
- Gemini `text-embedding-004` = 768-dim embeddings — correct as written
  in §6.1.
