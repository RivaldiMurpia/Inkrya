# Phases 2–4 delivery notes

Recorded: 2026-10-07. Branch `hackathon/nebius-2026` @ `2464c8c`. Companion to
`HACKATHON_IMPLEMENTATION.md` (contract) and `STORY_MEMORY_ARCHITECTURE.md` (architecture).
All verification ran against Preview deployments with a synthetic test user and a synthetic
corpus; the owner's private novel was never used. Test users/projects were deleted after
verification and temporary Vercel protection bypasses were revoked.

## Phase 2 — Memory foundation (pgvector + hybrid retrieval)

Delivered (`database/memory-phase2.sql`, `database/memory-hybrid-retrieval.sql`,
`database/memory-phase3-retrieval.sql` — the last one is the live retrieval version):

- `story_embeddings` (pgvector `vector(4096)`), model `nebius:Qwen/Qwen3-Embedding-8B`.
  No ANN index yet — sequential scan, acceptable at demo corpus size. Add ivfflat/hnsw when
  chunks exceed a few thousand.
- Hybrid retrieval `retrieve_memory(uuid, text, vector)` — RRF fusion (k=60) of lexical
  tsvector + cosine similarity, approved-fact boost, revision-safe gating (chunk must match
  chapter `revision_number` + `md5(plain_text)` and `memory_jobs.status='ready'`).
- `story_facts` gained SPO columns (`subject/predicate/object`) + confidence, extended
  status model (`approved/ignored` for facts; `CANON/PROPOSED/RETRACTED/CONFLICTED` for
  events/knowledge).
- Two-hop retrieval without extra LLM calls: `secondHopQuery` + `mergeEvidence` (RRF merge)
  in `lib/story-context.ts`.

## Phase 3 — Ask Your Story

Delivered (`database/memory-phase3.sql`, `lib/story-context.ts`, `lib/ask.ts`,
`lib/memory-validation.ts`, memory panel UI):

- `chapters.story_time` — author-managed free text (null = unknown, never guessed). Direct
  column update, deliberately no revision bump (bookkeeping, not content).
- `timeline_events` + `character_knowledge` tables, `save_memory_insights` extended
  signature (facts with SPO, events with mandatory story_time, knowledge), everything lands
  PROPOSED/pending — nothing auto-canon.
- Review RPCs: `review_story_fact`, `review_timeline_event`,
  `review_character_knowledge` (owner-scoped, STALE_SOURCE-checked, revision-trigger bump).
- Abstention classes enforced in code: `ANSWERED` requires ≥1 exact-quote-validated claim;
  `NOT_ESTABLISHED` (evidence exists, doesn't establish); `NO_EVIDENCE` (nothing retrieved);
  `CONTRADICTION` (validator accepts; never triggered naturally in small corpus tests —
  covered by unit tests).
- Verbatim-quote validation: every claim's quote must be an exact substring of the cited
  chunk; stale-chapter re-check before returning an answer (`lib/ask.ts`).

### Critical bug fixed during Phase 3

**Ask 503 — PL/pgSQL ambiguity (42702).** `RETURNS TABLE` OUT parameters share names with
columns (`id`, `story_time`, …). Under `set search_path=''`, unqualified references inside
`current_timeline_events`/`current_character_knowledge` raised "column reference is
ambiguous". Fixed in commit `225b8a0` by fully qualifying every reference in the final
selects (alias `u`, `preferred`, `safe`). Lesson: **inside any function with
`search_path=''`, qualify every column reference against a table alias — never rely on the
OUT parameter name or the implicit column.** Migration: `memory_phase3_timeline_ambiguity_fix`.

## Phase 4 — Agentic Writing

Delivered (`lib/agent-graph.ts`, `lib/agent-prompts.ts`, `lib/agent-validation.ts`,
`app/api/write/route.ts`, `components/write-panel.tsx`, `database/agent-writing.sql`,
commit `5067d52` + 12 follow-up fixes):

- LangGraph JS (`@langchain/langgraph@1.4.20` + `@langchain/core@1.2.17`) StateGraph:
  planner → writer → guardian → conditional (clean or budget-exhausted → critic; else
  repair → guardian re-check, max 2) → critic. **No checkpointer** — single-request
  execution; the `ai_generations` row is the only persistence.
- Context grounding built once per request via `prepareAskContext` (Phase 3 machinery,
  unchanged). Agents never read the DB directly (architecture §3.7).
- **1 write request = 1 `ai_generations` row** (`action='write'`) = 1 quota slot of 20/24h;
  the 4–6 internal LLM calls get fresh trace UUIDs each (workflow `write-agent`). Trace id
  ≠ row id by design; quota traceability lives on the row.
- NDJSON stream (`application/x-ndjson`, `Cache-Control: no-store, no-transform`,
  `X-Accel-Buffering: no`): `{type:'stage',stage,detail}` per executed stage, then
  `{type:'result'}` or `{type:'error',code}`. Only executed stages emit (demo spec §8).
- Guardian validation (`validateGuardianIssues`): type/severity enums, ≤5 issues, every
  `evidence_ids` entry must be a real context id — fabricated ids silently drop the issue.
- `findings` channel accumulates all validated issues across guardian passes (deduped by
  type+claim); `issues` is the final-pass remainder driving `resolved`. UI renders the full
  findings list, labeled whether the final draft fixed them — a detected knowledge leak
  stays inspectable after repair (demo §19).
- Cancellation: `generateKryaText` accepts optional external `signal` (combined with its
  internal timeout via `AbortSignal.any`); route passes `req.signal`; abort between nodes
  throws `REQUEST_ABORTED` → stream error, row status `error`.
- Draft application is client-side only: paragraphs → tiptap doc JSON → `chapters.insert`
  (position max+1) → `save_chapter` rpc. Server never writes manuscript or canon.
- Per-role budgets: planner/critic/continuity 25s + 1400/900/1200 tokens, writer 45s +
  1800 tokens. Worst-case LLM chain fits `maxDuration=300` with one JSON retry per node.

### Bugs found and fixed during live E2E (chronological)

1. `INVALID_PLAN` — validator required `suggestedStoryTime` key; models omit it when no
   evidence supports a date. Now required-but-nullable (`604471a`).
2. Cast grounding — projects with no configured characters failed plan validation. Best
   effort: filter to configured names when the project has any (`5dff83d`).
3. Raw control character inside JSON string → parse failure. Strip C0 controls before
   parsing (`e964888`).
4. Trailing prose after the JSON object → parse failure. Extract the first balanced
   object/array (`036902c`).
5. **Guardian false positive on flashback** — a 2045 scene (Vale alive) was flagged
   alive/dead. Prompt-only restraint was insufficient; final fix: planner must always emit
   `suggestedStoryTime` (from the instruction when it names a time), guardian receives it
   as `scene_story_time` and judges death flags only against scenes set after the death
   (`f750bef`, `e196ede`). Verified live: 2045 scene → "Kontinuitas bersih".
6. **Planner ignored the instruction** — copied the retrieved confrontation scene over the
   requested scene. Fixed by splitting planner/writer input into labelled blocks:
   `adegan_yang_diminta_penulis` (binding) vs `latar_belakang_cerita`/bukti (background)
   (`380c20f`, `ae702e1`, `822fbcb`). Residual risk noted below.
7. Trailing comma in model JSON → single retry after stripping it outside strings
   (`a719393`); malformed bodies get one bounded re-draw per JSON node (`2464c8c`).

### Live verification matrix (headless, synthetic project)

- Signature demo prompt → guardian found knowledge leak + timeline contradiction with
  evidence ids; bounded repair ×2; honest unresolved when budget exhausted.
- Flashback negative (2045) → clean, no flags.
- Clean scene → planner→writer→guardian(clean)→critic, 4 calls, `resolved:true`.
- Quota: exactly 20/24h per user, 429 on the 21st; 10s rate limit between requests.
- Unit: 68/68; typecheck + build clean; `/api/write` in build output.

### Known gaps / honest limits

- **Planner instruction-following is imperfect**: occasionally still anchors on retrieved
  evidence when the instruction describes a scene very different from the corpus (e.g.
  flashback). Guardian then correctly flags the resulting draft. One more prompt iteration
  (or a small planner fine-tune) would help; not blocking for demo.
- Indonesian prose quality of the demo model has artifacts (mixed-language tokens,
  awkward phrasing). Model choice/capability, not pipeline logic — see the Phase 1 prose
  gate history in `HACKATHON_IMPLEMENTATION.md`.
- `CONTRADICTION` abstention status never occurred naturally (small corpus); covered only
  by unit tests.
- No per-call quota rows, no checkpointer resume, no model fallback — deliberate cuts.

## Ops notes (LangGraph + LangSmith)

- `@langchain/langgraph` (orchestration) and `langsmith` (tracing) are independent. The
  graph does not require LangSmith: with `LANGSMITH_TRACING!=true` every trace is
  `'disabled'` and all features work. They connect only through our code — node functions
  call `generateKryaText`, which calls `startTrace`.
- LangSmith remains metadata-only: pseudonymized project/user (sha256 24 chars), no
  manuscript text, `content_logging:false`, allowlisted workflows
  (`krya-assistant|memory-ask|memory-analyze|write-agent|provider-smoke`).
- One write request produces 4–6 LangSmith runs (one per LLM call). Expect that in the
  LangSmith UI; do not read it as a quota anomaly.

## Rebuilding the headless E2E

The QA driver was deleted after use (it embedded credentials). To recreate:

1. Create a synthetic user (auth.users + identities; fill token columns with `''` — GoTrue
   fails scanning NULL `confirmation_token`) and a project with 1–2 chapters whose
   plain_text contains a death date, a knowledge date, and a pre-death scene.
2. Run `private.process_memory_core(project_id, true)` via SQL (public wrapper requires
   `auth.uid()`); confirm `memory_jobs.status='ready'`.
3. Create a Vercel automation bypass if Deployment Protection is on; pass
   `x-vercel-protection-bypass` header; revoke afterwards.
4. `POST /api/write` with Bearer token; read NDJSON lines. Delete the test user/project
   afterwards (`projects` delete cascades memory tables; `ai_generations` rows remain as
   history).
