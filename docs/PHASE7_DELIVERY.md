# Phase 7 Delivery — Tavily Research

**Status:** delivered 2026-10-08, verified on Preview (see the verification matrix below).
**Contract** (`docs/HACKATHON_IMPLEMENTATION.md:75`), verbatim:

> Intentional opt-in research, bounded queries, citations, isolation from fictional canon,
> trace tool calls

**PRD references:** §5 Bonus Target (Best Use of Tavily), §10 Research Mode, §12.4 Research
Agent. Design decisions confirmed with the owner 2026-10-08: a standalone research panel (not
a node in the write graph), and a Tavily credit meter kept separate from the LLM quota.

## What shipped

An opt-in **Riset Tavily** panel in the Studio sidebar. The author types a real-world research
question; Krya plans at most three web queries, searches each, and writes citation-bearing
notes from the sources it actually retrieved. Nothing in this path can reach story canon.

```
Topik penulis
  → [LLM 1] rencana query (≤3, JSON, fail-closed)          … no LLM call if the plan is empty
  → [Tavily] cari per query (search_depth:'basic', ≤5 hasil) … 1 credit per search, metered per call
  → [LLM 2] catatan bersitasi [n] dari sumber nyata         … skipped when no sources were found
  → ai_generations.result (action='research')               … the ONLY destination
```

## Isolation from fictional canon

This is the load-bearing claim of the phase, and it holds structurally rather than by
convention:

- Research output is written to exactly one place: `ai_generations.result` on the run's own
  row. No research code path inserts into or updates `story_facts`, `timeline_events`,
  `character_knowledge`, or `canon_proposals`.
- The nearest side door — a research finding smuggled in as a canon proposal — is already
  closed by the Phase 5 validator: `validateCanonProposals` requires a quote that is a
  verbatim substring of an author-accepted draft and evidence ids that resolve to the
  story's own context. Web content satisfies neither.
- The panel states the rule in its own copy: research notes are reading material, never canon.

## Two separate meters

| Meter | What it counts | Bounds | Where |
|---|---|---|---|
| LLM quota | `ai_generations` rows in 24h | 20/24h, 10s min interval | existing `limit_ai_generation()` trigger, unchanged |
| Tavily credits | `Σ token_usage->>'tavily_credits'` on `research` rows | per user 24h: `TAVILY_DAILY_CREDITS_PER_USER` (default 24); global month: `TAVILY_MONTHLY_CREDITS` (default 500) | `research_credit_usage()` RPC + `lib/research-budget.ts` |

Cost basis, read from the Tavily docs rather than assumed: `basic`/`fast`/`ultra-fast` = 1
credit per search, `advanced` = 2. `lib/tavily.ts` pins `search_depth:'basic'` explicitly
because Tavily's `auto_parameters` can silently select `advanced` and double the bill. One
run makes at most `MAX_QUERIES = 3` searches, so `MAX_RUN_CREDITS = 3`.

The credit check reserves the **worst case**, not the optimistic one: a user with 2 credits
left is refused a run that could cost 3. Credits are recorded after each successful search,
before the next one, so a mid-run failure still meters what was spent.

## Bounds and limits

- At most 3 queries per run; at most 5 results per query; query strings capped at 200 chars.
- Notes: at most 6 kept, heading ≤100 chars, body ≤700 chars, every note must carry at least
  one citation resolving to a supplied source index. Unresolvable citations are stripped; a
  note left with none is dropped and counted.
- Source URLs must be `http:` or `https:` and ≤500 chars — a `javascript:`/`data:` URL from
  any layer is dropped and never rendered clickable.
- One run = one `ai_generations` row (`action='research'`) = one LLM slot; the credit meter
  rides the same row's `token_usage`.

## Files

| File | Change |
|---|---|
| `database/phase7-research.sql` | NEW — `ai_generations.action` gains `'research'` (`research_action_phase7`) and the credit RPC (`research_credit_usage_phase7`). |
| `lib/tavily.ts` | NEW — bounded search client, pinned basic depth, defensive parsing, no key in errors. |
| `lib/research.ts` | NEW — plan → search → cited-notes pipeline with injectable model/search seams. |
| `lib/research-validation.ts` | NEW — fail-closed query/notes validators + source dedupe with URL scheme floor. |
| `lib/research-budget.ts` | NEW — config parsing and the worst-case credit reservation. |
| `lib/agent-prompts.ts` | EDIT — `RESEARCH_QUERY_SYSTEM`, `RESEARCH_NOTES_SYSTEM`. |
| `lib/langsmith/tracing.ts` | EDIT — workflow `'research-agent'`; `traceToolRun` for the `tavily-search` tool run. |
| `app/api/research/route.ts` | NEW — `POST /api/research`. |
| `components/research-panel.tsx` | NEW — topic → cited notes + sources + credit line + isolation notice. |
| `components/studio.tsx` | EDIT — `'research'` view, sidebar button "Riset Tavily". |
| `tests/tavily.test.mjs`, `tests/research-validation.test.mjs`, `tests/research-budget.test.mjs`, `tests/research.test.mjs`, `tests/research-panel.test.mjs` | NEW — 43 tests; all joined `test:unit`. |
| `.env.example`, `docs/HACKATHON_SETUP.md`, `docs/HACKATHON_IMPLEMENTATION.md`, `README.md`, `IMPLEMENTATION_STATUS.md` | EDIT — env vars, migration order, Phase 7 marked delivered. |
| `docs/superpowers/plans/2026-10-08-phase7-tavily-research.md` | The implementation plan this phase was executed from. |

## Verification matrix

Live E2E on 2026-10-08, executed by the owner's standing automated test account
(`e2e-analyze@example.com`, exempt from the LLM quota by instruction) against the deployed
preview of commit `d33518d` (`inkrya-ifl49tv74`), plus an in-browser pass over the real UI.

| Check | Result |
|---|---|
| Unit suite (`npm run test:unit`) | PASS — 159 tests, up from 111 (10 Tavily client, 12 validator, 10 budget, 12 pipeline/trace, 8 panel) |
| Typecheck (non-incremental) | PASS |
| Production build lists `ƒ /api/research` | PASS |
| Migration `research_action_phase7` applied; CHECK lists `research`; a junk action still raises 23514 | PASS |
| Migration `research_credit_usage_phase7` applied; RPC returns the seeded credit sum; a foreign project raises `FORBIDDEN`; `anon` has no EXECUTE | PASS |
| Live research run on a real-world topic (Javanese coastal fisheries 2048; Jakarta transport 2049; Bandung rainfall — via panel and API) | PASS — 5 real runs, each 3 queries, 14–15 sources, 3–6 notes, every citation resolving, every URL http(s), ~17–20 s per run |
| Meter independence | PASS — every row carries BOTH `tavily_credits=3` and model tokens (input 3256–5894, output 852–1227); after 5 runs the RPC reads 15/24 user credits while the LLM meter shows 11 rows in 24h — two different meters |
| Canon isolation asserted by SQL | PASS — after every run the trap project's `story_facts`/`timeline_events`/`character_knowledge`/`canon_proposals` all stayed at 0 rows |
| Failure paths: validation (404 unknown project, 400 short topic); user limit → 429 with real numbers | PASS — after seeding a synthetic 22-credit row the meter returned `429 {"error":"Kuota riset web kamu tersisa 0 kredit dari 3 yang dibutuhkan satu riset. Coba lagi besok."}`; probe row deleted after the test |
| **Bug found live:** PostgREST wraps a set-returning function in an array and stringifies bigint, so the original route read `user_credits_24h` as undefined and the meter never refused | FIXED — `creditUsageRow` normaliser added (unit-tested), redeployed, 429 reproduced on the fixed deployment; caught by this exact probe before any user could hit it |
| Adversarial review (five lenses, 15 agents, 10 verdicts) | 8 confirmed → all fixed (4 distinct defects); 2 refuted (maxDuration budget; pending-row aging) |
| Post-review redeploy re-verified live (commit `42d11cf`) | PASS — a real run returned 200 in 18.7s, 3 queries / 15 sources / 3 notes, all citations resolving, longest title 97 chars, 0 drops; meters read 18/24 user and 18 global after 6 runs while the trap project's canon stayed 0/0/0/0 |
| RPC fix verified live | PASS — a cross-user row 2h old and the caller's own row 30h old each moved `global_credits_month` only (15→55→62) while `user_credits_24h` stayed at the caller's real 24h figure |
| Panel renders in a real browser (Orca embedded browser): nav "Riset Tavily", topic submit, notes with citation numbers, source links `rel="noopener noreferrer"`, credit line "Riset ini memakai 3 kredit Tavily. Sisa kuota riset harianmu 9 kredit.", isolation notice, no percentage anywhere | PASS |
| Honest no-results path | Verified at unit level (pipeline skips the notes call, credits still metered); no live run produced zero results — Tavily returned results for every real query |
| LangSmith | LLM runs trace via `workflow:'research-agent'` (metadata-only allowlist); the `tavily-search` tool run ships counts only. Live dashboard spot-check not performed — no local `LANGSMITH_API_KEY` in the working environment; tracing state is recorded per row |
| Missing-key 503 path | Verified by code path (fail-closed `researchConfig`); the key is present in Vercel so it was not exercised live |

## Bugs found during implementation

1. **Cap-before-filter in the query validator** — the first implementation applied
   `slice(0, MAX_QUERIES)` before dropping malformed entries, so a junk entry could consume
   one of the three valuable query slots (the same defect class fixed in Phase 6's findings
   validator). Filter first, cap last.
2. **`notesProposed` undercounted** — it counted only the first `MAX_NOTES` items, so the
   drop counters could not explain a report that came back short. It now counts everything
   the model emitted.
3. **Shape vs text drop buckets were conflated** — an overlong body was reported as a shape
   defect. The buckets now distinguish a missing/blank field from a present-but-overlong one.
4. **`pg_catalog.auth_uid()` does not exist** and `coalesce` cannot be schema-qualified —
   the RPC initially copied the `pg_catalog.` prefixing lesson too literally. Corrected to
   the `memory-phase5.sql` pattern (`auth.uid()`, bare `coalesce`/`sum`).
5. **`numeric` vs `bigint` return type** — `coalesce(sum(...), 0::bigint)` still resolves to
   `numeric`; the whole expression is cast (`...::bigint`) to match the declared column type.
6. **A non-standard `timeout` field in `RequestInit`** — the Tavily client passed a `timeout`
   property that TypeScript rejects and `fetch` ignores; replaced with
   `AbortSignal.any([AbortSignal.timeout(...), callerSignal])`.
7. **LangSmith rejects a non-UUID run id** on `updateRun`, so the derived tool-run id is a
   SHA-256 hash shaped into a UUID rather than `<generationId>-tool`.
8. **The RPC's two columns were the same number (adversarial review, highest severity)** — both
   output columns came from one identical sum over one OR'd `WHERE`, so `user_credits_24h`
   returned the *global month* total. Every author was locked out once ~24 credits had been
   spent by anyone that month, while the 500-credit global ceiling silently never fired; the
   panel also reported other users' spend as the author's own daily remaining. Four of the five
   review lenses found it independently. Fixed with two independent subqueries and verified live
   that a cross-user row and the caller's own 30h-old row each move the global sum only.
9. **Validator capped before it filtered** (adversarial review) — `validateResearchNotes` sliced
   to `MAX_NOTES` before validating, so malformed early notes consumed kept slots and valid notes
   past position six were discarded unassessed. The same defect class Phase 6 fixed.
10. **Tavily titles were uncapped** (adversarial review) — a pathological page title could push
    the notes prompt past the 48k ceiling *after* every search had already been paid for. Titles
    now cap at 200 characters.
11. **Both research LLM calls shared one trace id** (adversarial review) — LangSmith rejected the
    second `createRun` as a duplicate and the notes call lost its trace. Per-call UUID now,
    matching `agent-graph`.
12. **PostgREST shape mismatch disabled the meter (live E2E, high severity)** — a
   set-returning RPC arrives as an ARRAY with bigint values as strings, so the route's
   `usage?.user_credits_24h` read `undefined` and `researchCreditBudget` always saw 0 used.
   The limit probe against a real deployment returned 200 where it must have returned 429.
   Fixed with the unit-tested `creditUsageRow` normaliser; the 429 was then reproduced on the
   redeployed preview. This is exactly the class of failure the worst-case design was meant
   to prevent — the probe step was what caught it.

## Honest limits

- **The per-user daily figure is a rolling 24h window, not a calendar day.** A user who spent
  the full daily budget at 09:00 can research again after 09:00 tomorrow — correct for a rolling
  limit, but it will not reset at midnight.
- **The credit check is not atomic.** Two simultaneous runs can both pass it; the overshoot is
  bounded by one run's worst case (3 credits). Making it atomic needs a counter row with a
  transaction, which this phase deliberately does not add. Stated in the code, not hidden.
- **A failed run keeps its LLM slot.** The quota row is inserted before the model call (the
  insert-first convention shared with every other action), so a run that fails after insertion
  still consumes one of the 20. Its spent Tavily credits, however, are still recorded.
- **Notes are leads with sources, not verified facts.** The model summarizes what the retrieved
  snippets say; the author follows the links. Citation *resolution* is guaranteed; citation
  *accuracy* is the model's, and the panel links out so it can be checked.
- **No Tavily "answer" endpoint, news/finance topics, or crawl/extract.** Only `/search` at
  basic depth, bounded. Adding them is a later phase if the writing workflow needs it.
- **Research never writes to canon, by design.** If a future phase wants research-derived
  canon, it must go through the Phase 5 proposal + explicit-approval path with a manuscript
  quote — not through this panel.
- English-language sources are surfaced as-is; the notes are written in Indonesian, but the
  source snippets are not translated.
