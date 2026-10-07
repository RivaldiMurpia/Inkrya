# Phase 5 — Canon Update delivery notes

Status: **delivered — unit + typecheck + build + live SQL invariants + headless live E2E on
Preview all passed** (synthetic user/project, revoked after). Companion to
`PHASE2_3_4_DELIVERY.md`.

Contract (`HACKATHON_IMPLEMENTATION.md` Phase 5 row): "Separate proposed canon diff;
explicit approval; atomic revision-safe acceptance, idempotency and re-indexing."

## What was built

A `canon` node as the LAST step of the Phase 4 write graph (demo spec §8 "Final result →
Canon Diff"): after critic runs, one extra model call (task `memory`, the same role the
analyze flow already uses for fact extraction) extracts persistent NEW information from the
final draft and returns up to 5 `proposals`. A canon diff may be empty — most continuations
introduce nothing persistent. Extraction failure is best-effort: the draft survives and the
stage honestly reports "Usulan kanon tidak tersedia".

Proposals persist into `public.canon_proposals` (the table named in
`STORY_MEMORY_ARCHITECTURE.md` §17) via `save_canon_proposals` — best-effort from the
route. Because the draft is not yet a chapter, proposals attach to a chapter only when the
author applies the draft (`attach_canon_proposals` from write-panel's apply step) — encoding
arch §6 "canon is derived from the explicitly accepted manuscript". The author then decides
per proposal: Setujui / Edit / Tolak through `decide_canon_proposals`.

## Locked decisions (user-approved)

- **Edit = accept-with-edit**: one click commits the author-edited claim to canon; the
  proposal payload keeps the original as history.
- **Backlog in Memory panel**: undecided proposals from earlier generations stay decidable
  in a new "Usulan kanon" section (extended `memory_overview`).
- **All three kinds accepted**: fact → `story_facts`, event → `timeline_events`, knowledge
  → `character_knowledge`, all inserted with `status='CANON'`.
- **No silent rename**: the legacy `story_facts.status='approved'` vocabulary is untouched
  (`HACKATHON_IMPLEMENTATION.md` invariant). New rows use `CANON`; retrieval already reads
  both (`memory-phase3-retrieval.sql:36`).
- **Quota unchanged**: 1 write request = 1 `ai_generations` row = 1 of 20/24h. The canon
  call is an internal node like guardian/critic. Accept/reject is quota-free (review RPC
  precedent).

## Safety mechanics

- **Anti-fabrication (client + DB, fail-closed)**: a proposal's `quote` must be a verbatim
  substring of the DRAFT (validator, `lib/agent-validation.ts`) and later of the applied
  chapter's current chunk (`strpos`, `decide_canon_proposals`); `evidence_ids` must resolve
  to real context ids or the item is dropped silently; an event without `story_time` is
  dropped, never dated by guesswork; knowledge must name a real project character.
- **Explicit approval**: no proposal becomes canon without the author clicking. The draft
  itself is never canon.
- **Atomic batch**: `decide_canon_proposals` runs one PL/pgSQL transaction — any raise
  rolls back every item (verified: a good first item does not survive a later stale item).
- **Revision safety**: per item, `FOR UPDATE` row lock + client revision must equal the
  locked row's revision (REVISION_CONFLICT) + chunk currency gate (chapter `revision_number`
  and `md5(plain_text)` must match the chunk's snapshot — STALE_SOURCE / QUOTE_NOT_IN_CHAPTER).
- **Idempotency**: unique(project_id, dedup_key) blocks duplicate proposals (dedup key =
  md5(generation+kind+normalized claim)); an already-decided proposal is a no-op on
  re-decide; a second accept cannot duplicate the canon row.
- **Re-indexing = live retrieval, zero new machinery**: chapter text never changes on
  accept, so re-chunk/re-embed would be no-ops. Accepted facts are read live by
  `retrieve_memory` (lateral join on `status in ('approved','CANON')` + quote strpos);
  events/knowledge by `current_timeline_events` / `current_character_knowledge` (status
  `CANON` + chunk currency + jobs ready). Verified live: an accepted fact is retrievable
  immediately.
- **UI gating**: decision buttons stay disabled until the draft is applied to a chapter AND
  the quote still matches the chapter text (`current` flag). Rejecting an unattached
  proposal is allowed (harmless). Write panel no longer switches view on apply — the
  proposal cards stay visible right where the author decided to keep the chapter.

## Files

| File | Change |
|---|---|
| `database/memory-phase5.sql` | NEW — migration `canon_update_phase5`: `canon_proposals` table (unique(project_id,dedup_key), RLS owner policy), `save_canon_proposals`, `attach_canon_proposals`, `decide_canon_proposals`, extended `memory_overview` (proposals backlog), indexes incl. generation/chapter lookups. Applied live once. |
| `lib/agent-validation.ts` | EDIT — `CanonProposal` type + `validateCanonProposals(value, draft, context)` fail-closed per item. |
| `lib/agent-prompts.ts` | EDIT — `CANON_SYSTEM` (only-new persistent info, verbatim quotes, empty diff valid, pendant example). |
| `lib/agent-graph.ts` | EDIT — `canon` node after critic (edges critic→canon→END), `proposals` channel, `WriteResult.proposals`, TIMEOUT/TOKENS entries, best-effort catch. |
| `app/api/write/route.ts` | EDIT — `prepared.canon` via `prepareModel('memory')`, modelLabel 5 roles, best-effort `save_canon_proposals`, result event + result JSON carry `generationId` + `proposals`. |
| `components/write-panel.tsx` | EDIT — canon stage label, "Usulan kanon" cards (Setujui/Edit/Tolak gated on attach+current), apply chains `attach_canon_proposals`, decide via RPC with Indonesian error mapping; attach failure surfaced. |
| `components/memory-panel.tsx` | EDIT — proposals backlog section with the same decide flow + source viewer. |
| `components/studio.tsx` | EDIT — `onChapterCreated` no longer switches view (proposal cards must stay visible after apply). |
| `tests/canon-proposals.test.mjs` | NEW — 9 validator cases (pendant fixture, verbatim/fabrication/date/character fail-closed, cap, INVALID_CANON). |
| `tests/agent-graph.test.mjs` | EDIT — canon stage in sequences, pendant proposals ride the result, fabricated quote drops, node failure keeps draft intact. |
| `tests/write-panel.test.mjs` | EDIT — proposal cards render, decisions gated until apply, apply spent after use, attach+decide RPC payloads asserted. |
| `tests/canon-integration.sql` | NEW — live-SQL invariant script (single-transaction, all asserts inside one `do $$`; mirrors memory-integration.sql). |
| `package.json` | EDIT — test:unit + canon-proposals. |

## Verification matrix

| Check | Result |
|---|---|
| Unit tests (84) | PASS |
| Typecheck (non-incremental) | PASS |
| Production build (`ƒ /api/write` present) | PASS |
| Migration `canon_update_phase5` applied + schema verified (table/3 RPC/RLS/unique/FK cascade) | PASS |
| save: 3 items → 1 (dedup + draft-quote fail-closed + word-boundary guard) | PASS (live SQL) |
| decide before attach → PROPOSAL_NOT_ATTACHED | PASS (live SQL) |
| accept → `story_facts` CANON row + target_id stamped + confidence 0.8 stored | PASS (live SQL) |
| re-accept → no duplicate (idempotent) | PASS (live SQL) |
| accepted fact retrievable via `retrieve_memory` immediately | PASS (live SQL) |
| Edit commits edited claim, keeps original payload | PASS (live SQL) |
| rejected claim never becomes canon | PASS (live SQL) |
| knowledge accept → `character_knowledge` CANON row, knows=false preserved, target_id via RETURNING | PASS (live SQL) |
| stale revision → REVISION_CONFLICT | PASS (live SQL) |
| atomic batch: good item rolled back when later item raises | PASS (live SQL) |
| chapter edited after attach → QUOTE_NOT_IN_CHAPTER | PASS (live SQL) |
| direct table writes denied: authenticated holds SELECT only (save/attach/decide are security definer with their own owner checks) | PASS (live grants) |
| Live E2E on Preview (synthetic user, headless): signature prompt → NDJSON stages context→plan→draft→guardian(1 issue)→repair→recheck(teratasi)→critic→**canon (2 proposals)**; proposals persisted unattached | PASS |
| apply chain: chapters insert + save_chapter + process_memory + attach → 2 proposals bound to Bab 3 | PASS (live, REST as the user) |
| accept via decide RPC as user → 1 CANON fact + target_id; reject → no canon row; re-accept → no-op (`decided:0`) | PASS (live) |
| accepted fact retrievable via `retrieve_memory` (Bab 3 chunks ranked) + memory_overview shows backlog states | PASS (live) |
| Hybrid retrieval regression found & fixed during E2E: `OPERATOR(public.<=>)` broke after the vector extension moved to `extensions` (42883 on the 3-arg retrieve_memory, so every semantic-context request failed with CONTEXT_READ_FAILED). Re-created with `OPERATOR(extensions.<=>)`; repo file updated | PASS (hybrid call returns rows) |
| E2E artifacts revoked (synthetic user, project, proposals, chapter deleted) | PASS |
| Advisors | no new security findings; 2 covering indexes added for new FKs |

## Bugs caught during verification

Five-lens adversarial review of the diff (plus live SQL probing) found and fixed:

1. **CAS was a tautology** — the first `decide` implementation compared `revision` against
   the value it had just read, so a decision made against a stale view was silently
   accepted. Fixed: the caller's revision must equal the locked row's revision
   (`pr.revision<>(d->>'revision')::integer → REVISION_CONFLICT`).
2. **Cross-project attach** — `attach_canon_proposals` checked only that the chapter and the
   proposals were owned by the caller, so proposals from project A could be bound to a
   chapter of project B (same owner), which would later surface B's chapter title next to
   A's proposals and insert A's canon rows against B's chunk. Fixed: `cp.project_id =
   c.project_id` in the attach update.
3. **MCP tool escaping corrupted two regexes live** — the confidence guard was applied as
   `'\\.'` instead of `'\.'`, so `'0.8' ~ ...` is false and every decimal confidence was
   silently stored NULL. The same escaping had already corrupted the legacy Phase 3
   `save_memory_insights` (confidence always NULL since it shipped). Fixed both by writing
   the class without a backslash (`[.]`), confirmed live: `confidence = 0.8`.
4. **Knowledge proposals rendered inverted** — `row.payload.knows==='false'` never matched
   (supabase-js parses jsonb booleans to JS booleans), so a "X does not know" proposal read
   as "X knows" at the consent gate. Fixed in both panels via `String(...)==='false'`.
5. **Validator over-restricted knowledge** — an event's mandatory `story_time` check ran
   for knowledge items too, dropping valid proposals whose learning time is unknown.
6. **Substring-only grounding** — a 5-char quote could be a mid-word fragment of an
   unrelated word ("ndela" inside "jendela") and pass every downstream `strpos` re-check.
   Fixed client and DB: floor 20 chars + word-boundary test on both sides of the match.
7. **Quote longer than the chunker overlap** — a verbatim quote over 319 chars that
   straddles a chunk boundary exists in the chapter but in no single `story_chunk`, so
   acceptance would raise QUOTE_NOT_IN_CHAPTER forever. Fixed: quote capped at 320 in the
   validator and in `save_canon_proposals`.
8. **Abort swallowed at the canon node** — a bare `catch{}` turned a cancelled request into
   `status='complete'`. Fixed: rethrow as `REQUEST_ABORTED`.
9. **Truncated diff** — `TOKENS.canon=1200` could truncate five legal proposals into
   unbalanced JSON, dropping the whole diff. Raised to 2400 (the gateway's ceiling).
10. **Unindexed FKs** — advisors flagged the two new FKs; covering indexes added.
11. **Deterministic provenance** — knowledge `target_id` used `order by created_at desc
    limit 1`, which ties when two same-quote knowledge proposals are accepted in one batch.
    Fixed with `RETURNING` on the insert-select.
12. **Apply unmounted the decision surface** — studio switched to the manuscript view on
    `onChapterCreated`, so the newly-enabled proposal buttons were never visible. Fixed:
    the view stays; apply is one-shot, and a failed attach leaves apply enabled so the
    retry re-runs the attach only (no second chapter) — guarded by a `canon_proposals`
    lookup that skips insertion when the generation is already bound.
13. **Legacy `CANON` facts mislabelled** — facts accepted through Phase 5 carry
    `status='CANON'`; the older fact review UI labelled them "Menunggu review" and offered
    a button that would rewrite them to `'approved'`. Fixed: CANON facts show as
    "Kanon (dari usulan)" and their review actions are disabled.
14. **Hybrid retrieval broke after the security relocation** (found by the live E2E, not by
    Phase 5 code) — the 2026-10-07 vector-extension move to `extensions` left
    `retrieve_memory(uuid,text,vector)` referencing `OPERATOR(public.<=>)`, so every
    semantic-context request failed 42883 → `CONTEXT_READ_FAILED` on Ask and Write.
    Fixed: operator re-qualified to `extensions.<=>` (repo + live).

## Honest limits

- Cross-generation dedup: the same claim re-proposed by a different write creates a second
  proposal (per-generation dedup only). The author rejects the noise.
- No `CONFLICTED` workflow, no retraction UI, no legacy `approved`→`CANON` migration —
  later phases.
- Canon rows are not embedded (no vector index over canon); retrieval relies on quote
  strpos against chunks, sufficient at demo corpus scale.
- An unapplied draft's proposals can be rejected but not accepted (fail-closed by design).
- Proposal payloads keep draft quotes verbatim — quotes are author-visible only (RLS
  owner-gated), never sent to LangSmith (workflow stays `write-agent`, metadata-only).
