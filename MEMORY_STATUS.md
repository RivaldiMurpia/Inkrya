# Inkrya Memory — implementation and verification

## Delivered in this slice

- Per-chapter durable PostgreSQL jobs. Saves queue latest revision after 45 seconds; repeated saves coalesce into one job.
- Supabase pg_cron dispatches up to five due chapters every minute, independent of browser sessions. Dispatcher is invoker-only and callable only by the database scheduler owner; authenticated users cannot execute it. A private invoker core enforces user RLS when reached through the authenticated wrapper. Cron command has a 25-second statement timeout. Session processing and manual Update remain available, sharing the same chapter-first locks.
- Transactional chunking under a chapter lock, then job lock. This matches save/trigger lock order. Ready only after all chunk inserts commit. Failures retry up to three attempts with bounded exponential backoff; explicit Update can retry failed jobs.
- Approx. 3,200 Unicode characters/chunk with 320-character overlap; prefers paragraph, sentence or whitespace boundaries near the end. Source chapter, revision, text hash, chunk hash and character offsets persisted. These are character limits, not model-token limits.
- PostgreSQL simple-config full-text retrieval with common Indonesian/English question words removed, permitted character alias expansion and overlap deduplication. Only current revision AND current text hash AND ready jobs are retrieval-active.
- Ask My Story generates at most six claims from up to six retrieved chunks. Every returned claim must include a known source UUID and an exact quote present in that source. After generation, source revisions/hashes are checked again.
- Approved current facts supply additional keyword matches/ranking only when their exact quote exists in the source. Pending, ignored and stale facts never help retrieval. Model evidence remains the original chunk, so approval cannot invent a citable manuscript passage.
- No-hit and no-evidence abstention. Invalid model JSON or citations return an error instead of rendering an unvalidated answer. This validates references and exact quotes, not logical entailment of every AI claim.
- Clickable source excerpts show historical revision and whether it is still current; can open the source chapter. No automatic editor passage highlight yet.
- On-demand AI summary/fact extraction per chunk. Exact quotes required for discovered facts; pending by default. Review actions: approve, edit claim (resets pending), ignore. Evidence quote remains unchanged.
- Old summaries/facts remain inspectable after source edits. UI marks them stale; approval of stale evidence is rejected by the review RPC. They are not silently rewritten.
- AI usage uses the existing 20 attempts/24h and 10-second interval, including analysis. Index updates make no model calls. Request/output history stored before/after model calls, with explicit warnings on persistence failure.

## Verification completed

- Extension tests PASS: approved keyword retrieval; pending/ignored/stale exclusion; direct private-core RLS isolation; scheduler execute denied to authenticated; privileged dispatcher indexes a due synthetic chapter. Fixtures rolled back. Live `inkrya-memory-index` cron is active with successful run history.
- `tests/memory-integration.sql`: synthetic 100,000+ word chapter, evidence at end, exact chunk offsets, repeated processing idempotency, latest-revision invalidation, source-backed facts, stale approval rejection, same-user project isolation and cross-user read/worker denial. PASS; fixtures rolled back.
- Initial long-text test exposed an expensive per-character substring loop. Replaced it with one bounded regexp scan per chunk. Full integration test then completed within a 30-second SQL statement limit.
- `tests/memory-validation.test.mjs`: unknown source ID, invented quote, malformed output, empty-evidence abstention and invalid extracted fact filtering. PASS.
- Live Gateway smoke evaluation (`scripts/memory-smoke.mjs`) on synthetic content: supported question returned one cited claim, unknown question abstained, extraction returned two evidenced facts. All three PASS. This is a small smoke suite, not the PRD quality threshold evaluation on 30+ realistic novel questions.
- Production build/TypeScript and unauthenticated GET/POST /api/memory denial passed.
- Supabase security advisor found no new database findings. Existing leaked-password-protection Auth warning remains.
- Full signed-in browser interaction, parallel browser-tab tests and production long-manuscript latency percentiles remain unverified.

## Remaining Phase 4 requirements

1. Semantic embeddings + vector search + hybrid ranking. Gateway catalog checked in this session: every embedding model listed has nonzero input pricing. No paid model was enabled under the current free-only selection. A free-credit-eligible service or self-hosted embedding runtime must be agreed/verified before activation.
2. Cancellable AI enrichment queue and external-call lease/recovery; current scheduled worker performs database indexing only.
3. Whole-chapter summaries from chunk summaries, structured entity-linked facts, confidence/contradiction handling and memory retention controls.
4. Rich corpus AI evaluation suite, thresholds and full browser tests.

The current feature is lexical Memory alpha. Do not claim semantic embeddings, complete long-form understanding, full Phase 4 completion or full PRD acceptance.

## UI limits

Overview shows the first 500 current chunks and latest 100 insights/facts; history shows latest 10 Ask My Story answers. Index/retrieval still cover all processed chunks, but management-list pagination is pending. Only manuscript chapters enter the Memory index. Notes, Bible and characters retain their separate explicit Krya context controls; no note text is automatically sent by Memory.

## Database changes (already applied to live project)

1. revision_safe_memory — database/memory.sql
2. memory_review_api — database/memory-review.sql
3. memory_retrieval_scope_fix — database/memory-retrieval-fix.sql
4. memory_chunking_performance — database/memory-chunking-fix.sql
5. memory_background — database/memory-background.sql
6. memory_approved_retrieval — database/memory-approved-retrieval.sql

memory.sql in this archive incorporates both fixes for fresh installs. Never reapply existing migrations on the live project. Public memory functions are security invoker; all tables use owner-project RLS. Data remains owner-editable and is not an immutable third-party audit ledger.

Future deployment build command should be `npm run build`; model smoke evaluation is manual QA only. Do not log real manuscript content in evaluation output.
