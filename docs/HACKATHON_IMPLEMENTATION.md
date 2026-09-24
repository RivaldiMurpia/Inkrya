# Inkrya Hackathon Edition — implementation contract

Updated: 2026-09-24. The supplied `INKRYA_HACKATHON_PRD.md` v1.0 is the product authority. Earlier alpha requirements remain context, not the hackathon delivery checklist. The previous whole-chapter-summary task was interrupted before implementation and is not delivered.

## Current increment: Phase 1 activated on Preview (prose-quality gate open)

Phase 1 is **INCOMPLETE**; Phase 2 has **not started**. Synthetic editor saves 8 → 9 → 10, the recovery-banner fix, and stale-source Memory UI were accepted without repeating live editor QA. Four persisted application generation IDs were read back from the same LangSmith run IDs with provider/model/task, pseudonymized project/user, source count, exact usage and latency, and metadata-only input/output. The readback made zero inference requests. The follow-up stale-source regression, unit suite, typecheck, local build and Gateway/Nebius signed-out HTTP checks passed. See `PHASE1_ACTIVATION.md` for IDs, deployments and bounded prose measurements.

The Super Indonesian writing gate failed human and objective review on a fixed four-case synthetic continue/rewrite corpus. Baseline and prompt/budget variants missed requested word ranges, introduced irrelevant foreign words/odd phrasing or contradicted story facts. A final writer-thinking diagnostic failed on its first request without returning reviewable prose. The three opt-in QA deployments failed safely; unapproved writing runtime changes have been rolled back, the exact-commit paid diagnostic is disabled, and the last known READY Preview continues to serve the stable application. Neither grounding nor abstention validation was relaxed. Production remains Gateway; no promotion or Phase 2 work until a future measured prose pass and regression on the approved code.

- `lib/ai/models.ts`: explicit provider switch and independent router/memory/planner/writer/continuity/critic/QA model configuration. All Nebius text model IDs must belong to the NVIDIA Nemotron family and appear in the authenticated model catalog. No guessed production model ID.
- `lib/ai/provider.ts`: Vercel AI SDK OpenAI-compatible chat-completions adapter using the official Nebius endpoint. Catalog success caches for 60 seconds, scoped to a hash of the credential and endpoint. No automatic provider/model fallback. Redirects rejected.
- `lib/ai/generate.ts`: one generation gateway for existing assistant and Memory routes. A generation record ID must exist first; 48,000 character input ceiling, 2,400 output-token ceiling, maximum 45-second inference timeout and no automatic retries. Current callers use 1,400/1,800 tokens and a 35-second timeout. These are request bounds, not a dollar budget or a tokenized context guarantee. The rejected experimental writer settings are not in the active runtime.
- `lib/ai/router.ts`: deterministic action-to-task routing, not an agent/intent model. Current assistant actions route to QA, writer or planner; Memory routes to QA or memory. Router/continuity/critic configurations are extension points, not implemented agents.
- `lib/langsmith/tracing.ts`: explicit metadata-only runs correlated with `ai_generations.id`; model/provider/task, pseudonymized project/user IDs, retrieved-source count, latency, numeric token usage and success/error. Awaited delivery; tracing outages do not discard generations. No prompts, prose, chapter titles, source text, raw provider exceptions or chain-of-thought.
- Existing Supabase history stores provider-qualified model IDs, output, usage, latency and trace delivery status. History remains addressable at authenticated `/api/ai/[id]`. No schema change or service-role access introduced.
- Krya sidebar shows the active configured model/provider label. `/api/ai` status is explicitly configuration-only: it is not proof of successful inference or trace delivery.

### Preserved invariants

Login, editor, revisions, autosave, RLS, quota (20 attempts/rolling 24h/user and 10-second minimum interval), existing lexical Memory and review flows remain intact. Gateway remains the default until an operator explicitly selects Nebius. Gateway still checks zero input/output price before inference. Nebius is NOT represented as free: it may consume credits and incur charges according to the account. There is no automatic paid fallback on gateway failure and no gateway fallback on Nebius failure.

Writers still review/copy suggestions; no agent writes manuscript/canon automatically. Existing `approved` facts are reviewed lexical records, NOT the complete new structured `CANON/PROPOSED/RETRACTED/CONFLICTED` state model. Existing review must not be renamed into new canon silently.

### Evidence and limits

- Verification on 2026-09-19: 11 new provider/tracing checks plus the existing Memory validation suite passed (12 Node test entries); clean non-incremental TypeScript check and Next.js production build passed. Local HTTP smoke tests passed for gateway/nebius configuration and signed-out rejection on assistant, Memory and generation-history endpoints. No signed-in browser E2E or live Nebius call was performed.
- Source import `d829eca98259fff4d791f023664d418068850ed6` was published through the confirmed GitHub integration. Production deployment `dpl_4zPCcZ9SQ3LVPAVmWoS38ffnE1uy` reached READY and serves `https://inkrya.vercel.app`. The initial README-only deployment had failed with `missing_pages_app`; the complete source import resolved that build error. The connected direct deploy tool remains unavailable; it was not used for this successful deployment.
- Production HTTP checks on 2026-09-19 passed: homepage 200, Google/GitHub provider status enabled, and unauthenticated assistant/Memory/history requests rejected with 401. `/api/ai` reports provider `gateway`, configured true and tracing false. This verifies the new runtime is deployed; it does not verify Nebius or LangSmith. No signed-in browser E2E was performed in this checkpoint.
- Automated tests use synthetic model IDs and mocked transports; they do not demonstrate live NVIDIA inference.
- On 2026-09-20 Vercel settings access succeeded. Preview selects Nebius Nemotron Super with tracing enabled. The authenticated catalog and four synthetic generations were exercised inside Vercel; production remains Gateway. See `PHASE1_ACTIVATION.md` for the exact evidence and failures. Secret values were never exposed.
- Production model choice and Indonesian prose quality remain unapproved. Live Preview inference, token accounting and application trace readback have been checked for the named synthetic runs; those observations do not establish future reliability or a production quality gate.
- Responses with explicit `<think>` blocks are rejected; normal reasoning channels are omitted. This is a safeguard, not a guarantee against every model emitting reasoning in its text channel.
- LangSmith model-run success means generation completed; it does not mean the later citation validator accepted it or a user approved canon. Full workflow/step trace trees arrive with LangGraph.
- No global dollar budget, production credit balance watcher, abuse-resistant public-judge access or global spending limit yet. Keep Nebius activation controlled; use provider-side spend limits where available. Per-user quota alone is not sufficient against multiple-account abuse.
- Package compatibility matters: AI SDK 7.0.99 and OpenAI-compatible 3.0.48 both use provider 4.0.14. 3.0.53 introduced incompatible provider metadata typings and was not retained. `typecheck` disables incremental caching to avoid stale diagnostics after provider-package changes. LangSmith 0.10.4's Client forces retries internally; the bounded transport converts failures to abort-class errors to prevent retry delays. Regression test covers this behavior.

## PRD-to-implementation map

| Phase | Existing foundation | Work still required / acceptance gate |
| --- | --- | --- |
| 1 Infrastructure | Catalog-selected Nemotron on Preview, live authenticated generations, role routing, metadata-only application trace readback, persisted history, stable editor autosave and stale-source review | Pass bounded Indonesian continue/rewrite prose acceptance and regression on approved runtime; assess credit controls before any promotion |
| 2 Memory | Revision-aware lexical chunks, approved-fact review, database Cron | Choose embedding model/dimension; pgvector migration/backfill; structured canon, character knowledge; hybrid ranking and temporal filters |
| 3 Ask Your Story | Grounded lexical Q&A with citations and abstention | Hybrid/context integration, story-time boundaries, benchmarked quality |
| 4 Agentic Writing | Non-agentic rewrite/continue | LangGraph JS planner → writer → guardian → bounded repair → critic; durable execution state, cancellation and honest activity UI |
| 5 Canon Update | Human fact review and chapter snapshots | Separate proposed canon diff; explicit approval; atomic revision-safe acceptance, idempotency and re-indexing |
| 6 Story Doctor | No implementation | Cross-manuscript checks with evidence; report checked coverage; no invented health scores |
| 7 Tavily | No implementation | Intentional opt-in research, bounded queries, citations, isolation from fictional canon, trace tool calls |
| 8 Evaluation | Synthetic unit/DB alpha tests | LangSmith datasets, baseline comparison, retrieval/continuity/knowledge metrics; Toloka optional |
| 9 Submission | Existing hosted alpha | Original The Last Signal corpus, accessible demo, public repository/license, before/after history, screenshots, E2E, demo video and submission |

Do not claim LangGraph, pgvector, Continuity Guardian, Story Doctor, Tavily research, full-chapter summaries, or hackathon readiness in this increment.

## Decisions that prevent coding ambiguity

1. Follow PRD phase order. Do not add unrelated publishing/collaboration/media features.
2. A missing character-knowledge row means UNKNOWN/UNESTABLISHED evidence, not proof a character never learned it. Record explicit knowledge state, source event and story time before high-confidence contradictions.
3. Story time and publication/chapter order are separate. A flashback cannot be rejected merely because its chapter number follows a death.
4. CANON is never inferred from a temporary generated draft or Tavily output. Proposed memory must be reviewed or derived from explicitly accepted manuscript according to a documented workflow.
5. Keep source revision/hash/project constraints in all retrieval, embedding, acceptance and review paths. Invalidated records remain history, not active evidence.
6. No fixed embedding dimension before verifying the selected embedding model. No fake vectors or keyword search labeled semantic.
7. Graph repair loops must have finite iteration, token, tool-call and time budgets; exhausted checks show unresolved issues instead of claiming success.
8. Public demos use original/synthetic The Last Signal content, never the owner's private novel. Demo claims must come from runtime checks, not prompt-specific hardcoded answers.
9. The user-supplied submission date and prize/track names remain PRD planning inputs, not independently verified competition rules. Verify the official rules before submission.
10. The confirmed repository is `https://github.com/RivaldiMurpia/Inkrya`. Its initial README commit is `52d43e2af03df3a85c7ec501f46c7610188c7b04`. This source import is a checkpoint of work already implemented, not evidence of earlier Git development history. Continue subsequent implementation on `hackathon/nebius-2026`. Do not publish secrets or claim an open-source license until a LICENSE file is adopted.

## Next executable gate

Authenticated generation, history, grounded Q&A, abstention, extraction and synthetic fact review were verified on 2026-09-20. Editor mount/history phantom saves and the recovery banner were fixed; subsequent live synthetic saves **8 → 9 → 10** and the stale Memory-source UI passed. Application LangSmith readback then matched all four persisted generation IDs with metadata-only traces and zero new inference. **Indonesian prose is the sole outstanding Phase 1 acceptance gate:** the baseline and two measured prompt/budget variants failed the four-case quality review; the writer-thinking attempt produced no reviewable prose. See `PHASE1_ACTIVATION.md` for exact evidence and constraints. Keep Production Gateway and Phase 2 blocked. Once Phase 1 *actually* passes, follow `STORY_MEMORY_ARCHITECTURE.md`: entities → structured facts → events → story time → verified embeddings/pgvector/hybrid retrieval → character knowledge → Story Context Builder, preserving the existing lexical/revision-safe evidence layer.
