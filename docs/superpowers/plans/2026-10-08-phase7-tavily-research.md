# Phase 7 — Tavily Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in live-research panel for Inkrya that answers a writer's factual research question with cited sources from Tavily, keeps a separate Tavily credit meter per user, and can never write to story canon.

**Architecture:** A standalone panel (not a node in the write graph). One research run = one `ai_generations` row (`action='research'`) = one LLM slot, exactly like the Phase 6 doctor. Pipeline: author topic → one LLM call plans ≤3 bounded Tavily queries → Tavily `basic` search per query (1 credit each, credits recorded in the DB immediately after each call) → one LLM call writes citation-bearing notes → fail-closed validator drops any note whose citation index does not resolve. Notes live only in `ai_generations.result`; there is no code path from research output to `story_facts`, `timeline_events`, `character_knowledge` or `canon_proposals`.

**Tech Stack:** Next.js App Router route handlers, Supabase Postgres + RLS, LangGraph-adjacent plain TS pipeline, Nebius/Nemotron via the existing `memory` model task, Tavily REST API, LangSmith metadata-only tracing, `node:test` unit suites.

**Spec:** `docs/HACKATHON_IMPLEMENTATION.md:75` (Phase 7 contract), `docs/INKRYA_HACKATHON_PRD.md` §5 Bonus Target, §10 Research Mode, §12.4 Research Agent, §11 graph order. Established patterns come from `database/doctor-phase6.sql`, `lib/doctor.ts`, `lib/doctor-validation.ts`, `app/api/memory/route.ts` (doctor branch), `components/doctor-panel.tsx`, `tests/doctor*.test.mjs`.

## Global Constraints

- Phase 7 contract, verbatim: **"Intentional opt-in research, bounded queries, citations, isolation from fictional canon, trace tool calls."**
- Tavily endpoint `POST https://api.tavily.com/search`. Credit cost: `basic`/`fast`/`ultra-fast` = **1 credit**, `advanced` = **2 credits**. `auto_parameters` can silently flip the depth to `advanced` and double the cost, so **`search_depth:'basic'` is pinned explicitly in every request body**.
- Bounds, exact values: `MAX_QUERIES = 3`, `MAX_RESULTS_PER_QUERY = 5`, `TAVILY_COST_PER_SEARCH = 1`, per-call timeout `15000` ms, one run's worst-case cost `MAX_QUERIES * TAVILY_COST_PER_SEARCH = 3` credits.
- Credit defaults: `TAVILY_DAILY_CREDITS_PER_USER = 24`, `TAVILY_MONTHLY_CREDITS = 500`. Both env-overridable.
- The Tavily API key never leaves the server. `TAVILY_API_KEY` is already set in Vercel; it is read only inside server modules.
- Research output must never be treated as canon. No research code path may insert into or update `story_facts`, `timeline_events`, `character_knowledge`, or `canon_proposals`.
- All model calls stay inside the existing `generateKryaText` path: prompt+system ≤ 48000 chars, `maxOutputTokens ≤ 2400`, one `ai_generations` row per run (insert-first, before the LLM call).
- Every user-facing string is Indonesian. Copy that states a limit must state the real number.
- No scores, ratings, or quality percentages anywhere (same rule as Phase 6).
- LangSmith stays metadata-only and allowlisted: codes and counts, never query text, source text, notes, or model prose.
- Tests are plain `.mjs` with `node:test` — no TypeScript syntax inside test files (no `import type`, no `!`, no type annotations, no `as`).
- New unit suites must be added to the `test:unit` script in `package.json` or they never run.

## Review Focus

Input classes and failure modes the spec implies but no task's happy-path test covers. Each line names the behaviour a reasonable person expects; the task that owns the code carries the test.

1. **Tavily returns zero results, or every query comes back empty.** Expect: the run still finishes, the report says plainly that no sources were found, and the model is never asked to write notes from nothing — no invented sources, no crash. (Task 7, Task 5.)
2. **A model-emitted URL that is not `http`/`https`** (a Tavily result carrying `javascript:` or `data:`), rendered as a clickable link. Expect: the source is dropped at validation, never rendered clickable. (Task 4.)
3. **A model citation index that does not exist** (cites `[7]` when 3 sources were supplied, or cites nothing at all). Expect: that note is dropped and counted, and the drop count is shown to the author rather than an empty report with no explanation. (Task 4, Task 7.)
4. **Tavily HTTP failure or timeout part-way through the queries.** Expect: the run is marked `error`, every credit already spent is still counted in the meter (so failure cannot be used to spend unmetered credits), and the author sees an Indonesian message naming what happened. (Task 2, Task 7, Task 9.)
5. **Two research runs started at once (two tabs) both passing the credit check.** Expect: the overshoot is bounded by exactly one run's worst case (`3` credits) and the code states that bound rather than claiming the check is atomic. (Task 5.)

---

### Task 1: Allow `action='research'` in `ai_generations`

**Files:**
- Create: `database/phase7-research.sql`
- Verify: live Supabase project `ecurjotykfqiejrpczdm`

**Interfaces:**
- Consumes: the `ai_generations.action` CHECK constraint extended by `database/doctor-phase6.sql` (current members: `chat`, `rewrite`, `continue`, `brainstorm`, `write`, `doctor`).
- Produces: an accepted `action` value `'research'` that Task 9's insert depends on.

- [ ] **Step 1: Write the migration using the discover-and-replace pattern**

Copy the structure of `database/doctor-phase6.sql` exactly: find the CHECK constraint on `public.ai_generations.action` by definition match, drop it, re-add it with `'research'` appended to the existing member list. The member list must be discovered, not hardcoded, so a future phase cannot silently drop a member. Header comment: one-time via `apply_migration`, never reapply; Task 8 appends the credit RPC to this same file, so fresh databases receive the whole file in one run while the live project receives it as two sequential migrations.

- [ ] **Step 2: Apply it live**

Apply via Supabase MCP `apply_migration` with the name `research_action_phase7`.

- [ ] **Step 3: Verify the CHECK accepts the new value and still rejects junk**

Run in `execute_sql`, expecting the first insert to succeed and the second to raise `23514`:

```sql
begin;
insert into public.ai_generations (project_id, action, model, prompt)
values ('55950f54-a502-41a4-9154-e8bdabf7d971','research','verify:phase7','[verify]');
rollback;
begin;
insert into public.ai_generations (project_id, action, model, prompt)
values ('55950f54-a502-41a4-9154-e8bdabf7d971','not_an_action','verify:phase7','[verify]');
rollback;
```

- [ ] **Step 4: Read the constraint definition back**

Query `pg_constraint` for the CHECK on `ai_generations` and confirm the printed definition lists every member including `research`. Assert the readable list, not the migration's own text.

- [ ] **Step 5: Commit**

```bash
git add database/phase7-research.sql
git commit -m "feat(research): allow action='research' on ai_generations"
```

---

### Task 2: Tavily client

**Files:**
- Create: `lib/tavily.ts`
- Test: `tests/tavily.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, used by Tasks 4–6:
  - `export type TavilyResult = {title:string;url:string;content:string;score:number}`
  - `export const TAVILY_ENDPOINT = 'https://api.tavily.com/search'`
  - `export const TAVILY_COST_PER_SEARCH = 1`
  - `export const MAX_RESULTS_PER_QUERY = 5`
  - `export const QUERY_MAX_LENGTH = 200`
  - `export async function searchTavily(query:string, options:{apiKey:string;maxResults?:number;timeoutMs?:number;signal?:AbortSignal;request?:typeof fetch}):Promise<TavilyResult[]>`

- [ ] **Step 1: Write the failing test**

Cover, one `test()` per behaviour: the request body pins `search_depth:'basic'` and `max_results` (assert on the captured `init.body`, because an unpinned depth silently doubles the bill); a non-2xx response throws `TAVILY_UNAVAILABLE`; a body that is not an object with an array `results` throws `TAVILY_INVALID_RESPONSE`; a query longer than `QUERY_MAX_LENGTH` or blank throws `TAVILY_QUERY_INVALID` **without any fetch being made**; malformed result rows (missing/non-string `url` or `title`, non-numeric `score`) are dropped while well-formed rows survive; the `Authorization: Bearer <key>` header is sent; a `redirect:'error'` fetch option is passed. Every test injects `request` — no real network call in the suite.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/tavily.test.mjs`
Expected: FAIL — cannot find module `lib/tavily.ts`.

- [ ] **Step 3: Implement `lib/tavily.ts`**

Server-only guard (`if(typeof window!=='undefined')throw Error('SERVER_ONLY')`). POST JSON `{query, search_depth:'basic', max_results, include_answer:false, include_raw_content:false}`, `Authorization: Bearer`, `redirect:'error'`, `AbortSignal.timeout(timeoutMs ?? 15000)` combined with the caller's signal, `cache:'no-store'`. Trim the query, validate length before fetching. Parse defensively and return only `{title,url,content,score}` with `content` capped at 2000 chars. No key in any error message.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/tavily.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tavily.ts tests/tavily.test.mjs
git commit -m "feat(research): bounded Tavily search client with pinned basic depth"
```

---

### Task 3: Research prompts

**Files:**
- Modify: `lib/agent-prompts.ts` (append after `DOCTOR_SYSTEM`, same file, same `AGENT_SYSTEM` prefix)

**Interfaces:**
- Consumes: `AGENT_SYSTEM` already defined in that file.
- Produces, used by Task 7: `export const RESEARCH_QUERY_SYSTEM`, `export const RESEARCH_NOTES_SYSTEM`.

- [ ] **Step 1: Write `RESEARCH_QUERY_SYSTEM`**

Indonesian, JSON-only, exactly `{"queries":[{"query":"...","reason":"..."}]}`. Rules to state: at most 3 queries; each query is a web search string of at most 200 characters aimed at real-world facts (place, time, technology, terminology, culture) — never at the author's invented story; no story character names in queries unless the author's topic names them as real-world entities; `{"queries":[]}` is a valid answer when the topic needs no web research.

- [ ] **Step 2: Write `RESEARCH_NOTES_SYSTEM`**

Indonesian, JSON-only, exactly `{"summary":"...","notes":[{"heading":"...","body":"...","citations":[1]}],"unanswered":["..."]}`. Rules to state: every note must carry at least one citation whose number is the index of a supplied source, copied exactly — a note citing a number that was not supplied will be discarded; never invent a source, a URL, or a fact not present in the supplied source text; `unanswered` lists parts of the topic the sources do not cover, and an empty list is fine; this is background research for a fiction writer, not an answer about the author's story — never state or imply anything about their characters, plot, or canon; no scores or ratings.

- [ ] **Step 3: Verify both prompts fit the budget**

Run: `node -e "import('./lib/agent-prompts.ts').then(m=>{const n=m.RESEARCH_QUERY_SYSTEM.length+m.RESEARCH_NOTES_SYSTEM.length;console.log(n);if(n>6000)throw Error('prompts too large for the 48k input budget')})"` with `--experimental-strip-types`.
Expected: prints a number below 6000 and exits 0.

- [ ] **Step 4: Commit**

```bash
git add lib/agent-prompts.ts
git commit -m "feat(research): query-planning and notes prompts"
```

---

### Task 4: Fail-closed research validator

**Files:**
- Create: `lib/research-validation.ts`
- Test: `tests/research-validation.test.mjs`

**Interfaces:**
- Consumes: `parseModelJSON` from `./memory-validation.ts`; `TavilyResult` from `./tavily.ts`.
- Produces, used by Tasks 5 and 7:
  - `export type ResearchQuery = {query:string;reason:string}`
  - `export type ResearchSource = {index:number;title:string;url:string;content:string}`
  - `export type ResearchNote = {heading:string;body:string;citations:number[]}`
  - `export type ResearchNotes = {summary:string;notes:ResearchNote[];unanswered:string[]}`
  - `export type ResearchDropStats = {notesProposed:number;notesKept:number;badShape:number;badText:number;noCitation:number;badUrl:number}`
  - `export const MAX_QUERIES = 3`
  - `export function validateResearchQueries(value:unknown, topic:string, maxQueries?:number):ResearchQuery[]` — throws `INVALID_RESEARCH_PLAN`
  - `export function dedupeSources(batches:TavilyResult[][]):ResearchSource[]`
  - `export function validateResearchNotes(value:unknown, sources:ResearchSource[], stats?:ResearchDropStats):ResearchNotes` — throws `INVALID_RESEARCH_NOTES`

- [ ] **Step 1: Write the failing test**

One `test()` per behaviour:

- The happy path: 2 queries returned for a topic; `validateResearchQueries` returns them in order with trimmed text.
- More than `MAX_QUERIES` proposals are capped, not rejected; a non-array or non-object body throws `INVALID_RESEARCH_PLAN`.
- A query that merely restates the topic, or is blank, or exceeds 200 characters, is dropped; if nothing survives, the function returns `[]` (a valid outcome — the run will report no sources).
- `dedupeSources` collapses the same URL appearing in two batches into one source, keeps first-seen order, and numbers from 1.
- `validateResearchNotes` keeps a note citing a real index and strips an unresolvable one from that note's `citations`; a note left with no citations is dropped and counted under `noCitation`.
- **A source whose URL is not `http:`/`https:` (feed it `javascript:alert(1)` and `data:text/html,x`) is dropped and counted under `badUrl` — the authored URL never survives to the UI.**
- Malformed items (missing heading/body, body over 700 chars, more than 6 notes, more than 5 `unanswered` entries) are dropped or capped per the stated limits, and `stats` reports `notesProposed`, `notesKept` and each bucket.
- An empty-by-design answer — `{"summary":"...","notes":[],"unanswered":[...]}` — is valid and returns zero notes without throwing.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/research-validation.test.mjs`
Expected: FAIL — cannot find module `lib/research-validation.ts`.

- [ ] **Step 3: Implement `lib/research-validation.ts`**

Shape it like `lib/doctor-validation.ts`: validate every item first, drop silently per item while filling `stats`, and only then apply the caps. URL scheme test: parse with `new URL(url)` inside a `try`, accept only `http:`/`https:` protocols **and** `url.length <= 500`; a malformed URL string is dropped the same way.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/research-validation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/research-validation.ts tests/research-validation.test.mjs
git commit -m "feat(research): fail-closed notes validator with citation and URL floors"
```

---

### Task 5: Credit meter math

**Files:**
- Create: `lib/research-budget.ts`
- Test: `tests/research-budget.test.mjs`

**Interfaces:**
- Consumes: `Environment` from `./ai/models.ts`; `MAX_QUERIES` and `TAVILY_COST_PER_SEARCH` from Tasks 2 and 4.
- Produces, used by Tasks 6 and 8:
  - `export const DEFAULT_DAILY_CREDITS_PER_USER = 24`
  - `export const DEFAULT_MONTHLY_CREDITS = 500`
  - `export const MAX_RUN_CREDITS = MAX_QUERIES * TAVILY_COST_PER_SEARCH` (= 3)
  - `export type ResearchConfig = {apiKey:string;dailyCreditsPerUser:number;monthlyCredits:number}`
  - `export function researchConfig(env:Environment=process.env):ResearchConfig` — throws `TAVILY_API_KEY_MISSING` when the key is absent or blank; throws `TAVILY_CREDITS_INVALID` when an override is present but not a positive integer
  - `export type CreditDecision = {allowed:boolean;reason:'ok'|'USER_LIMIT'|'GLOBAL_LIMIT';userUsed:number;userRemaining:number;globalRemaining:number;runCost:number}`
  - `export function researchCreditBudget(input:{userUsed:number;globalUsed:number;config:Pick<ResearchConfig,'dailyCreditsPerUser'|'monthlyCredits'>}):CreditDecision`

- [ ] **Step 1: Write the failing test**

One `test()` per behaviour: defaults are 24/500 when the env vars are unset; a valid numeric override is honoured; a blank/`0`/negative/non-numeric override throws `TAVILY_CREDITS_INVALID`; a missing key throws `TAVILY_API_KEY_MISSING`; the decision is `ok` with `userRemaining`/`globalRemaining` computed exactly when both meters have room for `MAX_RUN_CREDITS`; `USER_LIMIT` when the user's remaining is below the run cost but the global budget still has room; `GLOBAL_LIMIT` when the global remaining is below the run cost; and **the reservation is worst-case, not optimistic** — a user with 2 credits left against a run that could cost 3 is refused, so a refusal can never leave a run half-paid. Also assert `MAX_RUN_CREDITS === 3`, the bound Review Focus 5 relies on.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/research-budget.test.mjs`
Expected: FAIL — cannot find module `lib/research-budget.ts`.

- [ ] **Step 3: Implement `lib/research-budget.ts`**

Pure arithmetic, no IO. Integer parse helper for the overrides that rejects anything not matching `/^\d+$/` with a value ≥ 1. Include one comment stating the concurrency bound from Review Focus 5 in words: the check runs before the insert, so two simultaneous runs can each pass and the overshoot is bounded by one run's worst case; making it atomic would need a counter row, which this phase does not add.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/research-budget.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/research-budget.ts tests/research-budget.test.mjs
git commit -m "feat(research): separate Tavily credit meter with worst-case reservation"
```

---

### Task 6: Trace the tool calls

**Files:**
- Modify: `lib/langsmith/tracing.ts`
- Test: create `tests/research.test.mjs` (Task 7 extends this file with the pipeline cases)

**Interfaces:**
- Consumes: the existing `createTraceClient(env, request)` and `pseudonym` helpers in that module.
- Produces, consumed by Task 7:
  - `export type ToolTraceContext = {generationId:string;projectId:string;tool:'tavily-search';queryCount:number;sourceCount:number;credits:number}`
  - `export async function traceToolRun(context:ToolTraceContext, env?:Environment, request?:typeof fetch):Promise<TraceState>`

- [ ] **Step 1: Add `'research-agent'` to the `TraceContext['workflow']` union**

One-line change to the existing union so the research LLM calls will trace.

- [ ] **Step 2: Write the failing test**

Create `tests/research.test.mjs` with the harness-free pattern used by other lib tests. Assert that with tracing enabled and an injected `request` that records calls, `traceToolRun` issues exactly one run-creation request whose serialized body contains the query count, source count, pseudonymised project id, and `content_logging:false` — and that the body contains none of: a topic string, a query string, a source URL, or any note text. Also assert it resolves `'disabled'` without any fetch when `LANGSMITH_TRACING` is not `'true'`, and `'failed'` (never throws) when the request rejects.

- [ ] **Step 3: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/research.test.mjs`
Expected: FAIL — `traceToolRun is not a function`.

- [ ] **Step 4: Implement `traceToolRun`**

Reuse `createTraceClient`. Derive the run id deterministically as `` `${context.generationId}-tool` `` so no randomness is needed and a retry does not orphan a run. `run_type:'tool'`, `name:'Krya tavily-search'`, `inputs:{query_count, source_count, credits}`, `extra:{metadata:{...pseudonyms, tool, content_logging:false}}`. Wrap everything in try/catch and return `'failed'` on any error — observability must never break a paid run.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/research.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/langsmith/tracing.ts tests/research.test.mjs
git commit -m "feat(research): metadata-only tool-call tracing for Tavily searches"
```

---

### Task 7: Research pipeline

**Files:**
- Create: `lib/research.ts`
- Test: extend `tests/research.test.mjs` (created in Task 6)

**Interfaces:**
- Consumes: `searchTavily`, `TavilyResult`, `TAVILY_COST_PER_SEARCH`, `MAX_RESULTS_PER_QUERY` (Task 2); `RESEARCH_QUERY_SYSTEM`, `RESEARCH_NOTES_SYSTEM` (Task 3); `validateResearchQueries`, `dedupeSources`, `validateResearchNotes`, `MAX_QUERIES`, `ResearchQuery`, `ResearchSource`, `ResearchNotes`, `ResearchDropStats` (Task 4); `ResearchConfig` (Task 5); `traceToolRun` (Task 6); `generateKryaText` from `./ai/generate.ts`; `parseModelJSON` from `./memory-validation.ts`; `prepareModel` from `./ai/provider.ts`.
- Produces, used by Task 9:
  - `export type ResearchStep = {stage:'plan'|'search'|'notes';detail:string;queryCount?:number;sourceCount?:number}`
  - `export type ResearchResult = {topic:string;queries:ResearchQuery[];sources:ResearchSource[];notes:ResearchNotes;dropStats:ResearchDropStats;credits:number;steps:ResearchStep[];tokenUsage:{inputTokens:number;outputTokens:number};warning:string|null}`
  - `export type ResearchCallFn = (system:string,prompt:string,maxOutputTokens:number)=>Promise<{text:string;usage:{inputTokens?:number;outputTokens?:number}}>`
  - `export async function runResearch(input:{topic:string;prepared:unknown;config:ResearchConfig;generationId:string;projectId:string;userId:string;recordCredits:(credits:number)=>Promise<void>;search?:typeof searchTavily;call?:ResearchCallFn;signal?:AbortSignal}):Promise<ResearchResult>`

- [ ] **Step 1: Write the failing test**

Inject both seams (`call` and `search`) — no network, no model. One `test()` per behaviour:

- The happy path: a plan of 2 queries, one source per query, notes citing `[1]` and `[2]` → `queries.length === 2`, `sources.length === 2` numbered 1 and 2, `credits === 2`, and `recordCredits` was called once per search with `1` each time (assert the call log, because credits must be recorded as they are spent and not only at the end).
- **Every query returns zero results → `sources === []`, `credits === 0`, the notes LLM call is never made (assert the call log length), and the result carries a warning saying no sources were found.**
- The plan comes back empty → zero searches, zero credits, same honest "no sources" outcome, no crash.
- **A Tavily failure on the second of two queries → `runResearch` rejects, but `recordCredits` was already called once for the first query, so the spent credit is still counted.**
- The notes response cites a nonexistent index → that note is dropped, `dropStats.noCitation === 1`, and the surviving notes are the ones with real citations.
- The plan proposes 6 queries → exactly `MAX_QUERIES` searches are made (assert the search call count), proving the bound.
- The prompt sent to each model call is under the 48000-character ceiling and the notes prompt contains the source list (assert on the captured prompt string).
- Token totals accumulate across both calls.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/research.test.mjs`
Expected: FAIL — cannot find module `lib/research.ts`.

- [ ] **Step 3: Implement `lib/research.ts`**

Mirror the write-graph seam: `ResearchCallFn` defaults to a wrapper over `generateKryaText` with `maxOutputTokens` 700 for the plan and 1800 for the notes, `timeoutMs` 25000 / 35000, `workflow:'research-agent'`, and a per-call `generationId` derived from the run's id. Run searches sequentially with `MAX_RESULTS_PER_QUERY`, calling `await recordCredits(TAVILY_COST_PER_SEARCH)` immediately after each successful search and before the next. Push a `ResearchStep` per stage. Do not call the notes model when `sources.length === 0`; return the empty-notes result with the warning instead. `traceToolRun` is called once, after the searches, with the query count and total credits.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/research.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/research.ts tests/research.test.mjs
git commit -m "feat(research): bounded plan → search → cited notes pipeline"
```

---

### Task 8: Research credit-usage RPC

**Files:**
- Modify: `database/phase7-research.sql` (append)
- Verify: live project

**Interfaces:**
- Consumes: `ai_generations` rows with `action='research'` whose `token_usage->>'tavily_credits'` holds the credits spent (written by Task 9's route — written before this task runs, so verify the column merge against a live row produced in Task 9's verification or a hand-inserted row inside the rolled-back transaction).
- Produces, consumed by Task 9: RPC `public.research_credit_usage(p_project_id uuid)` returning one row `(user_credits_24h bigint, global_credits_month bigint)`.

- [ ] **Step 1: Append the RPC to the migration and apply it as its own live migration**

Append the RPC to `database/phase7-research.sql` (one source-of-truth file for fresh databases), then apply the appended section via `apply_migration` under the name `research_credit_usage_phase7` — the live project already consumed the first half of the file as `research_action_phase7`, and Supabase migrations are one-shot.

`security definer set search_path=''`, all column references fully qualified (the `42702` lesson from `memory-phase5.sql`). Raise `UNAUTHORIZED` when `auth.uid()` is null and `FORBIDDEN` when the caller does not own `p_project_id` — checked **before** any aggregate runs, so the global figure is never exposed to a user without a project. `user_credits_24h` sums the caller's `research` rows in the last 24 hours; `global_credits_month` sums every `research` row since `date_trunc('month', now())`. Use `coalesce(...,0)` and cast with `pg_catalog`. Revoke `execute` from `anon`; keep it for `authenticated`.

- [ ] **Step 2: Verify live, including the negative cases**

Run in `execute_sql`: as the real owner (JWT claims simulated in a transaction) confirm the RPC returns the summed credits for a hand-inserted row; confirm a different project the caller does not own raises `FORBIDDEN`; confirm `anon` has no execute privilege by reading `pg_proc.proacl`. Roll back the hand-inserted row.

- [ ] **Step 3: Commit**

```bash
git add database/phase7-research.sql
git commit -m "feat(research): owner-scoped credit-usage RPC for the separate Tavily meter"
```

---

### Task 9: Research API route

**Files:**
- Create: `app/api/research/route.ts`
- Test: covered by Task 10's panel test plus the live E2E in Task 12

**Interfaces:**
- Consumes: `runResearch` (Task 7); `researchConfig`, `researchCreditBudget` (Task 5); `userDatabase` from `lib/server-auth.ts`; `prepareModel` and `configurationErrorMessage`; the RPC from Task 8; `MAX_RUN_CREDITS` for the reservation.
- Produces, consumed by Task 10: `POST /api/research` with body `{projectId:string, topic:string}` → `200 {topic,queries,sources,notes,dropStats,credits,creditsRemaining,steps,warning}`; `400` for a malformed body or a topic outside 3–300 characters; `401` unauthenticated; `404` unknown project; `429` for `USER_LIMIT` / `GLOBAL_LIMIT` / the existing `AI_DAILY_LIMIT` / `AI_RATE_LIMIT`; `503` for a missing Tavily key or an upstream failure.

- [ ] **Step 1: Implement the route**

Mirror `app/api/memory/route.ts`'s doctor branch: validate the body and `uuid` before any work; confirm project ownership through the user JWT; read `researchConfig` and fail closed with a configuration message when the key is missing; call the credit RPC and refuse with the real numbers in the Indonesian message when `researchCreditBudget` says no; `prepareModel('memory')` **before** the insert so a broken model config never burns an LLM slot; insert the `ai_generations` row with `action:'research'` and map the existing quota errors; then `runResearch` with `recordCredits` implemented as an update of that row's `token_usage` that **merges** `{...existingUsage, tavily_credits}` rather than overwriting, so credits survive a later failure; on success write `result` + `status:'complete'`; on failure write `status:'error'` and return the Indonesian message for the failure kind. Log codes only — never topic text, queries, URLs, or notes.

- [ ] **Step 2: Verify the merge, not the overwrite**

In the live database, confirm after a real run that the row's `token_usage` contains both `tavily_credits` and the model's `input_tokens`/`output_tokens`. If the credit update had clobbered the column, one of the two would be missing — that is the assertion.

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0, and the build output lists `ƒ /api/research`.

- [ ] **Step 4: Commit**

```bash
git add app/api/research/route.ts
git commit -m "feat(research): opt-in research endpoint with separate credit metering"
```

---

### Task 10: Research panel

**Files:**
- Create: `components/research-panel.tsx`
- Modify: `components/studio.tsx` (view union, nav button, render branch, all three in the existing style)
- Test: `tests/research-panel.test.mjs`
- Test: `tests/research-panel.test.mjs` is added to the `test:unit` script

**Interfaces:**
- Consumes: the route from Task 9; `loadComponent` from `./helpers/component-runtime.mjs` and `setDatabase` from `./helpers/mock-db.mjs` (the harness `tests/doctor-panel.test.mjs` already uses).
- Produces: a `Riset Tavily` sidebar button and a `<ResearchPanel projectId={project.id}/>` view.

- [ ] **Step 1: Write the failing test**

Follow `tests/doctor-panel.test.mjs` exactly: `loadComponent`, `setDatabase` with a fake `auth.getSession`, `globalThis.fetch` stubbed and restored in `finally`, `React.createElement`, `act`, unmount. One `test()` per behaviour:

- A successful report renders the summary, each note's heading and body, and the source list — and each source renders as an `<a>` whose `href` is the source URL with `rel` containing `noopener`.
- The credit line states the real numbers from the response (credits used this run and remaining), and the panel shows the isolation notice that research notes never become story canon.
- **A response whose source URL is `javascript:alert(1)` renders no anchor with that href (assert no element in the container has it).**
- A `429` with the user-limit message renders that message inside `role="alert"` and leaves the topic in the textarea so the author does not lose it.
- The submit button is disabled while the request is in flight and a second click does not issue a second request (assert the fetch call count).
- Zero sources renders the "no sources found" copy, not an empty section with no explanation.
- When the response carries a nonzero drop count, the panel states how many proposed notes were discarded (drop counters, same honesty rule as Phase 6).
- The panel contains no percentage, score, or rating text (assert `doesNotMatch` on `%`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/research-panel.test.mjs`
Expected: FAIL — cannot find module `components/research-panel.tsx`.

- [ ] **Step 3: Implement `components/research-panel.tsx`**

`'use client'`. Local state for `topic`, `running`, `error`, `result`, `reportTime`. Abort the in-flight request on unmount (`useEffect` cleanup, `active` ref — the pattern in `write-panel.tsx`). Cite markers in note bodies render as superscript numbers keyed by note id and index, never as raw model text injected via `dangerouslySetInnerHTML`. Keep the copy honest: one research run uses one of the 20 AI requests per 24 hours **and** charges the separate Tavily credit meter — state both.

- [ ] **Step 4: Wire the view into `components/studio.tsx`**

Add `'research'` to the view union in three places (state type, `switchView`, and the render chain), and add the nav button after `Story Doctor` using `Globe` or `Search` from the existing `lucide-react` import. Place the render branch beside the doctor branch, keyed on `project.id`.

- [ ] **Step 5: Run the panel test and the whole suite**

Run: `node --experimental-strip-types --test tests/research-panel.test.mjs`
Expected: PASS.
Then add the three new test files to the `test:unit` script and run `npm run test:unit`.
Expected: all suites pass, test count rises from 111.

- [ ] **Step 6: Commit**

```bash
git add components/research-panel.tsx components/studio.tsx tests/research-panel.test.mjs package.json
git commit -m "feat(research): opt-in research panel with citations and credit meter"
```

---

### Task 11: Environment and docs

**Files:**
- Modify: `.env.example` (the `TAVILY_API_KEY` line already exists — annotate it and add the two credit vars)
- Modify: `docs/HACKATHON_SETUP.md` (§0 migration order and the env list)
- Modify: `docs/HACKATHON_IMPLEMENTATION.md` (Phase 7 row)
- Modify: `README.md`, `IMPLEMENTATION_STATUS.md`
- Create: `docs/PHASE7_DELIVERY.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the operator-facing record that Phase 7 is delivered, with its limits.

- [ ] **Step 1: Annotate `.env.example`**

State for each of the three vars what it does and its default: `TAVILY_API_KEY` (server-only; research panel fails closed without it), `TAVILY_DAILY_CREDITS_PER_USER` (default 24), `TAVILY_MONTHLY_CREDITS` (default 500). Note in a comment that `basic` depth costs 1 credit per search and that one run costs at most 3.

- [ ] **Step 2: Update `docs/HACKATHON_SETUP.md`**

Append `phase7-research.sql` to the §0 migration order after `doctor-phase6.sql`, and extend the env list.

- [ ] **Step 3: Write `docs/PHASE7_DELIVERY.md`**

Mirror `docs/PHASE6_DELIVERY.md`'s structure: the contract quoted verbatim, the pipeline, the two separate meters with the exact numbers, the isolation argument (why research cannot reach canon, naming the Phase 5 validator that closes the side door), the credit-budget table, a verification matrix filled in **after** Task 12 runs, the bugs found during verification, and an honest-limits section. Limits to state plainly: the credit check is not atomic (overshoot bounded by one run); failed runs keep their LLM slot (insert-first, shared with every other action); notes are leads with sources, not verified facts; no Tavily "answer" endpoint, no news/finance topics, no crawl/extract.

- [ ] **Step 4: Update the status docs**

Mark Phase 7 delivered in `docs/HACKATHON_IMPLEMENTATION.md` (row 7) and in `README.md` / `IMPLEMENTATION_STATUS.md`, linking `docs/PHASE7_DELIVERY.md`. Keep the remaining "do not claim" line accurate — remove Tavily from the list of things not to claim, leave evaluation datasets and hackathon readiness on it.

- [ ] **Step 5: Commit**

```bash
git add .env.example docs/ PHASE7_DELIVERY.md README.md IMPLEMENTATION_STATUS.md
git commit -m "docs: record Phase 7 Tavily research delivery and operator notes"
```

---

### Task 12: Live end-to-end verification

**Files:**
- No source changes expected; defects found here are fixed where they live and committed.

**Interfaces:**
- Consumes: the deployed preview, the permanent test account (`e2e-analyze@example.com`, uid `aa000000-0000-4000-8000-000000000098`, exempt from the LLM quota — see the test-account memory), the `get_access_to_vercel_url` bypass flow, and the seeded trap project `aaaaaaaa-aaaa-4aaa-8aaa-000000000001`.
- Produces: the verification matrix in `docs/PHASE7_DELIVERY.md`.

- [ ] **Step 1: Deploy and confirm the key is present**

Deploy the branch, then confirm `TAVILY_API_KEY` is visible to the deployment's environment (a research run returning `503` with the configuration message means it is not — the user set it in Vercel; verify rather than assume).

- [ ] **Step 2: Run a real research topic**

As the test account, `POST /api/research` with a real-world topic that a fiction writer would research (for example a 2010 Bandung setting). Assert: `200`, at least one source, every note citation resolving to a listed source index, `credits >= 1`, and every source URL `https`.

- [ ] **Step 3: Verify the meters move independently**

Read back the `ai_generations` row: `action='research'`, `status='complete'`, `token_usage.tavily_credits` present **and** the model token counts present. Then call the credit RPC and confirm `user_credits_24h` rose by exactly the run's credits. Confirm the LLM-side daily count also rose by one, and that the two numbers are not the same meter.

- [ ] **Step 4: Verify canon isolation against the live database**

After the run, assert by SQL that the project's `story_facts`, `timeline_events`, `character_knowledge` counts and every row's `status` are **unchanged** from before the run, and that `canon_proposals` gained no row. This is the load-bearing check for the phase's headline claim.

- [ ] **Step 5: Exercise the failure paths live**

Force a bad key (temporarily, in a scratch env), confirm `503` and that the row lands `status='error'` with any credits already spent still recorded. Restore the key. Confirm the user-limit path by setting `TAVILY_DAILY_CREDITS_PER_USER=1` in a preview env and observing the `429` with the real number, then restore.

- [ ] **Step 6: Confirm the run renders in the panel**

Open the deployed app with the bypass link, run the panel, and confirm the notes, sources, credit line, and timestamp all render, and that the LangSmith `research-agent` LLM run and the `tavily-search` tool run both appear with metadata only.

- [ ] **Step 7: Record results and commit**

Fill the verification matrix in `docs/PHASE7_DELIVERY.md` with what actually happened, including anything that failed, then commit.

```bash
git add docs/PHASE7_DELIVERY.md
git commit -m "docs: record Phase 7 live E2E results"
```
