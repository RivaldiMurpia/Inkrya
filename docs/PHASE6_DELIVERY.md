# Phase 6 — Story Doctor delivery notes

Status: **delivered — unit + typecheck + build + live migration + live E2E on Preview
passed** (The Last Signal real corpus, run as the project owner). Companion to
`PHASE2_3_4_DELIVERY.md` and `PHASE5_DELIVERY.md`.

Contract (`HACKATHON_IMPLEMENTATION.md`, Phase 6 row): "Cross-manuscript checks with evidence;
report checked coverage; no invented health scores."

## What was built

`POST /api/memory {action:'doctor'}` — a whole-manuscript report in one request:

1. **State package** (`lib/doctor.ts buildDoctorPackage`) — chapters in reading order with
   index status (`ready` = the same revision/hash/job gates retrieval trusts; `summarized` =
   an AI chunk summary exists for a current chunk), tracked cast, story-bible `world_rules`,
   approved/CANON facts, `current_timeline_events`, `current_character_knowledge`.
2. **Deterministic engine** (no AI, free, auditable): `checkForgottenCharacters` flags a
   tracked character absent from the trailing `max(2, ceil(30%))` chapters after appearing
   earlier — severity `low`, framed as an observation, evidence = the chapter of last
   appearance. Presence uses a case-insensitive **whole-word** match on name/alias, so a
   short name inside an unrelated word never counts as an appearance.
3. **AI semantic engine** — one `generateKryaText` call (task `memory`, workflow
   `story-doctor`, metadata-only LangSmith trace) over the package: plot holes, timeline
   conflicts, knowledge errors, relationship drift, world-rule violations, POV problems,
   unresolved threads, forgotten characters. `DOCTOR_SYSTEM` carries the same untrusted-
   content preamble and the flashback rule (reading order ≠ story time). The package is
   trimmed (summary bodies shortened, then dropped) until system+prompt fit generateKryaText's
   48,000-character ceiling; coverage is computed AFTER the trim so the UI never overstates
   what was actually examined.
4. **Fail-closed validation** (`lib/doctor-validation.ts validateDoctorFindings`): every
   finding must cite ≥1 `evidence_id` that resolves inside the package — fabricated ids
   drop the finding silently. Validation runs BEFORE the 8-item cap, so malformed items never
   consume a kept slot. `chapter_id` is a UI link only: it must resolve to a real **chapter**
   (not any evidence row) or it is nulled, and the finding stays. Unknown kind/severity,
   missing claim/explanation, overlong fields drop; duplicate evidence ids collapse; duplicate
   (kind, claim) findings are deduped so React keys never collide. Aggregate drop counters
   (shape/enum/text/no-evidence) report how many model drafts were discarded. Server resolves
   labels (`Peristiwa: Kematian Vale (2048-03-11)`) so evidence is inspectable without a
   second query.
5. **Coverage, measured not scored**: chapters ready/total, summarized, with story_time,
   canon facts/events/knowledge counts, tracked characters, world rules provided — plus an
   explicit "checks skipped" list when the basis is missing (e.g. "Story bible kosong — cek
   pelanggaran aturan dunia dilewati"). **No percentages, no health score** (PRD §22's own
   closing rule + the contract row).
6. **Persistence = AI history**: the report JSON lands in `ai_generations.result`
   (`action='doctor'`); the panel renders the latest complete report on mount with its
   timestamp — reopening the panel spends nothing, running again costs one slot.

## Locked decisions (user-approved)

- **Hybrid engine**: SQL/deterministic + AI semantic checks; coverage reports both.
- **1 run = 1 quota slot** (`ai_generations` row, 20/24h) — consistent with write.
- **Stateless report** in AI history — no findings table, no per-finding lifecycle; stale
  findings are impossible because findings are always re-derived from live data.

## Failure behavior

- No chapters → code findings only, no AI call, no quota row.
- AI failure after the quota row → the run degrades honestly: deterministic findings +
  `aiAvailable:false` + a warning notice; the generation row is marked error.
- Context read failure → 503 `Konteks Memory gagal dimuat.`, before any quota spend.
- Quota row inserted before the AI call: if the function is killed between the insert and the
  terminal status write, the row stays `pending` and still counts against the 20/24h quota.
  Bounded by the 35s call timeout plus maxDuration; not a correctness bug, a known cost of the
  insert-first convention shared with the write flow.

## Files

| File | Change |
|---|---|
| `database/doctor-phase6.sql` | NEW — `ai_generations.action` CHECK gains `'doctor'` (discover-and-replace pattern from `agent-writing.sql`). Applied live once; fresh-database order documented in `HACKATHON_SETUP.md` §0. |
| `lib/doctor.ts` | NEW — package builder, `doctorCoverage`, `checkForgottenCharacters` (whole-word presence). |
| `lib/doctor-validation.ts` | NEW — `validateDoctorFindings` + `evidenceLabels` + `dedupeFindings` (fail-closed, filter-before-cap). |
| `lib/agent-prompts.ts` | EDIT — `DOCTOR_SYSTEM` appended (kept with the other agent prompts instead of a separate file). |
| `lib/langsmith/tracing.ts` | EDIT — allowlist gains `'story-doctor'`. |
| `app/api/memory/route.ts` | EDIT — `doctor` action branch with the 48k trim; `maxDuration` stays 60. |
| `components/doctor-panel.tsx` | NEW — report UI: coverage + skipped checks, drop-count notice, timestamped report, findings grouped by severity with evidence + "Buka bab". |
| `components/studio.tsx` | EDIT — view `'doctor'`, sidebar button "Story Doctor". |
| `tests/doctor-validation.test.mjs` | NEW — validator cases: fixture package, fabricated ids, bogus/non-chapter chapter_id nulling, evidence dedupe, filter-before-cap, drop stats, INVALID_DOCTOR. |
| `tests/doctor.test.mjs` | NEW — coverage measurement, skipped checks, forgotten-character horizon (positive/negative/small-corpus), CONTEXT_READ_FAILED fail-closed, code findings pass the same validator. |
| `tests/doctor-panel.test.mjs` | NEW — clean report, severity grouping + evidence links, AI-failure degradation, persisted-report render on mount (no fetch), quota error notice. |
| `package.json` | EDIT — the three suites join `test:unit`. |
| `docs/HACKATHON_IMPLEMENTATION.md` | EDIT — Phase 6 row marked Delivered. |
| `docs/HACKATHON_SETUP.md` | EDIT — §0 fresh-database migration order. |
| `README.md`, `IMPLEMENTATION_STATUS.md` | EDIT — Phases 5–6 marked delivered. |

## Verification matrix

| Check | Result |
|---|---|
| Unit tests (109) | PASS |
| Typecheck (non-incremental) | PASS |
| Production build (`ƒ /api/memory` present) | PASS |
| Migration `doctor_action_phase6` applied; CHECK verified live (`action in chat|rewrite|continue|brainstorm|write|doctor`) | PASS |
| Live E2E Preview as synthetic owner (ownership transferred then reverted): The Last Signal run ×3 across the fix iterations | PASS |
| Coverage numbers match measured DB state (10/10 ready, 9 summarized — one stale summary correctly excluded by the revision+hash gate, 12 of 13 events current — one stale chunk gated, 25 facts, 6 knowledge, 3 characters) | PASS |
| First live run exposed a real gap: findings=0 because the package held no prose. Fixed: current-chunk AI summaries ride the package as `ringkasan_bab` and are citable evidence | PASS (fixed + re-run) |
| Second live run on a seeded trap project (promise → disappearance → object contradiction): model emitted findings the validator kept 0 of; drop counters added to distinguish clean vs discarded; prompt pins character-for-character id fidelity | PASS (fixed + re-run) |
| Trap project run: 2/2 AI findings kept, both evidence-resolvable — unresolved_thread (Arka's broken promise) and world_rule/continuity (notebook lost in Bab 3 reappears in Bab 4) | PASS |
| The Last Signal final run: 1 finding kept (a placement concern around the Bab 7 flashback), evidence resolved; the legal flashback itself is NOT flagged as alive-dead/timeline error (story_time rule held) | PASS |
| Report persisted in `ai_generations.result` (`action='doctor'`, status complete, trace `sent`); re-renders on panel open | PASS |
| LangSmith run `story-doctor` metadata-only, task `memory` | PASS |
| 1 run = 1 quota row (11 rows in the 24h window across doctor/analyze, all intentional E2E calls) | PASS |
| E2E artifacts fully reverted: ownership restored to `2863d8de…`, QA project deleted, synthetic user + ai_generations rows deleted; demo corpus intact (25 approved + 13 CANON events + 6 CANON knowledge, 0 pending proposals) | PASS |
| E2E scratch files (incl. the synthetic-session token) committed by accident were stripped from history via filter-branch; branch force-pushed; scratch patterns gitignored | PASS |
| Advisors | no new findings |

## Bugs caught during verification

1. **Knowledge coverage read 0** — `current_character_knowledge` returns nothing when
   `p_character_ids` is null; the package builder now selects character ids and passes them.
2. **The AI engine had nothing to say** — the first package carried chapter titles and canon
   rows only. Findings=0 was honest but useless; the package now carries current-chunk AI
   summaries (`ringkasan_bab`), stale ones excluded by the same revision+hash gate.
3. **Silent total discard** — a 515-token model response produced 0 kept findings with no
   explanation. `validateDoctorFindings` now returns aggregate drop counters (shape / enum /
   text / no-evidence), surfaced in the API response and logged as counts only.
4. **E2E scratch committed by `git add -A`** — including a synthetic-session token file.
   Stripped from the branch via filter-branch, force-pushed, patterns gitignored. The token
   belonged to a now-deleted synthetic user, but history hygiene was fixed regardless.

## Honest limits

- AI findings are leads with evidence, not verdicts — the UI says "pemeriksaan AI"; the
  author judges. The model can still miss subtle cross-chapter holes (chunk summaries are
  coarse; coverage states the basis).
- Unresolved threads have no explicit DB tracking — detection rides on summaries/canon.
- The deterministic engine has one check (forgotten characters); the seven PRD kinds not
  covered deterministically come only from the AI engine.
- Findings are not deduped across runs — each run is an independent report.
- No per-finding "resolve/dismiss" state (stateless by design decision).

## Notes for operators

- `DOCTOR_SYSTEM` lives in `lib/agent-prompts.ts`, not a `lib/doctor-prompts.ts` — one
  file fewer, prompts stay together.
- No new env vars, no new tables, no Tavily. Phase 7 remains the next phase.
