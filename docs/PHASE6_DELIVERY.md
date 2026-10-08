# Phase 6 — Story Doctor delivery notes

Status: **delivered — unit + typecheck + build + live migration + live E2E on Preview
passed** (The Last Signal real corpus, run as the project owner). Companion to
`PHASE2_3_4_DELIVERY.md` and `PHASE5_DELIVERY.md`.

Contract (`HACKATHON_IMPLEMENTATION.md:72`): "Cross-manuscript checks with evidence; report
checked coverage; no invented health scores."

## What was built

`POST /api/memory {action:'doctor'}` — a whole-manuscript report in one request:

1. **State package** (`lib/doctor.ts buildDoctorPackage`) — chapters in reading order with
   index status (`ready` = the same revision/hash/job gates retrieval trusts; `summarized` =
   an AI chunk summary exists for a current chunk), tracked cast, story-bible `world_rules`,
   approved/CANON facts, `current_timeline_events`, `current_character_knowledge`.
2. **Deterministic engine** (no AI, free, auditable): `checkForgottenCharacters` flags a
   tracked character absent from the trailing `max(2, ceil(30%))` chapters after appearing
   earlier — severity `low`, framed as an observation, evidence = the chapter of last
   appearance.
3. **AI semantic engine** — one `generateKryaText` call (task `memory`, workflow
   `story-doctor`, metadata-only LangSmith trace) over the package: plot holes, timeline
   conflicts, knowledge errors, relationship drift, world-rule violations, POV problems,
   unresolved threads, forgotten characters. `DOCTOR_SYSTEM` carries the same untrusted-
   content preamble and the flashback rule (reading order ≠ story time).
4. **Fail-closed validation** (`lib/doctor-validation.ts validateDoctorFindings`): every
   finding must cite ≥1 `evidence_id` that resolves inside the package — fabricated ids
   drop the finding silently. `chapter_id` is a UI link only: an unresolvable one is
   nulled, the finding stays. Unknown kind/severity, missing claim/explanation, overlong
   fields drop. Cap 8. Malformed body → retry by the caller was NOT added (single call,
   honest failure, deterministic findings still answer). Server resolves labels
   (`Peristiwa: Kematian Vale (2048-03-11)`) so evidence is inspectable without a second
   query.
5. **Coverage, measured not scored**: chapters ready/total, summarized, with story_time,
   canon facts/events/knowledge counts, tracked characters, world rules provided — plus an
   explicit "checks skipped" list when the basis is missing (e.g. "Story bible kosong — cek
   pelanggaran aturan dunia dilewati"). **No percentages, no health score** (PRD §22's own
   closing rule + contract line 72).
6. **Persistence = AI history**: the report JSON lands in `ai_generations.result`
   (`action='doctor'`); the panel renders the latest complete report on mount — reopening
   the panel spends nothing, running again costs one slot.

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

## Files

| File | Change |
|---|---|
| `database/doctor-phase6.sql` | NEW — `ai_generations.action` CHECK gains `'doctor'` (discover-and-replace pattern from `agent-writing.sql`). Applied live once. |
| `lib/doctor.ts` | NEW — package builder, `doctorCoverage`, `checkForgottenCharacters`. |
| `lib/doctor-validation.ts` | NEW — `validateDoctorFindings` + `evidenceLabels` (fail-closed). |
| `lib/agent-prompts.ts` | EDIT — `DOCTOR_SYSTEM` appended (kept with the other agent prompts instead of a separate file). |
| `lib/langsmith/tracing.ts` | EDIT — allowlist gains `'story-doctor'`. |
| `app/api/memory/route.ts` | EDIT — `doctor` action branch (`maxDuration` stays 60: package + one bounded 35s call fit). |
| `components/doctor-panel.tsx` | NEW — report UI: coverage, skipped checks, findings grouped by severity with evidence buttons and "Buka bab". |
| `components/studio.tsx` | EDIT — view `'doctor'`, sidebar button "Story Doctor". |
| `tests/doctor-validation.test.mjs` | NEW — 10 validator cases (fixture package, fabricated ids, bogus chapter nulling, cap, INVALID_DOCTOR). |
| `tests/doctor.test.mjs` | NEW — coverage measurement, skipped checks, forgotten-character horizon (positive/negative/small-corpus), CONTEXT_READ_FAILED fail-closed, code findings pass the same validator. |
| `tests/doctor-panel.test.mjs` | NEW — clean report, severity grouping + evidence links, AI-failure degradation, persisted-report render on mount (no fetch), quota error notice. |
| `package.json` | EDIT — the three suites join `test:unit`. |
| `docs/HACKATHON_IMPLEMENTATION.md` | EDIT — Phase 6 row marked Delivered. |

## Verification matrix

| Check | Result |
|---|---|
| Unit tests (106) | PASS |
| Typecheck (non-incremental) | PASS |
| Production build (`ƒ /api/memory` present) | PASS |
| Migration `doctor_action_phase6` applied; CHECK verified live (write/doctor accepted, other values rejected) | PASS |
| Live E2E Preview as owner: Story Doctor run on The Last Signal (10 chapters) | PASS |
| Coverage numbers match measured DB state (10/10 ready, 8 with story_time, facts/events/knowledge counts) | PASS |
| Findings render with resolvable evidence buttons; "Buka bab" opens the right chapter | PASS |
| Report persisted in `ai_generations.result` (`action='doctor'`) and re-renders on panel open | PASS |
| LangSmith run `story-doctor` metadata-only, task `memory` | PASS |
| 1 run = 1 quota row; reopening the panel spends nothing | PASS |
| False-positive guard: flashback-era Elias scenes not flagged (story_time rule in prompt; validator drops evidence-less findings) | PASS (corpus carries the trap) |
| E2E artifacts fully reverted (ownership, quota rows) | PASS |

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
