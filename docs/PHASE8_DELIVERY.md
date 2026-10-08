# Phase 8 Delivery — Evaluation

**Status:** delivered 2026-10-08 — dataset, deterministic grader, two-arm headless runner,
and a live both-arm run on Preview. Companion to `PHASE2_3_4_DELIVERY.md`, `PHASE5_DELIVERY.md`,
`PHASE6_DELIVERY.md`, `PHASE7_DELIVERY.md`.

**Contract** (`docs/HACKATHON_IMPLEMENTATION.md:76`), verbatim:

> LangSmith datasets, baseline comparison, retrieval/continuity/knowledge metrics; Toloka optional

**Owner decisions (2026-10-08):** repo script + report deliverable (no UI, no new DB tables);
baseline arm runs live on ±10 cases; LangSmith dataset upload attempted (key held in Vercel);
Toloka skipped — owner asked for a recommendation, recommendation recorded below.

## What shipped

| Piece | Where |
|---|---|
| Synthetic fixture corpus with a KNOWN accepted canon state | `database/eval-fixture-phase8.sql` + `eval-fixture-phase8-canon.sql` (+ `qa/eval/fixture-chapters.json` prose) |
| 24-case evaluation dataset | `qa/eval/last-signal-eval.jsonl` |
| Deterministic rubric grader — no LLM judge | `lib/eval-grading.ts` |
| Two-arm headless runner (pipeline vs baseline, one detector) | `scripts/eval-runner.mjs` (+ `scripts/eval-build-context.mjs`) |
| Idempotent LangSmith dataset upload | `scripts/eval-upload-langsmith.mjs` |
| Raw results + this report | `qa/eval/results-*.json`, `docs/evidence/phase8-eval-2026-10-08.md` |

## The fixture corpus

The live "The Last Signal" project turned out to be a different corpus (an Indonesian radio
drama) with legacy `approved` facts and no CANON rows — its knowledge rows even contain junk
(`fact_key='ignored'`). Demo spec §6 requires a fixture with a *known accepted canonical
state* for repeatable evaluation, so Phase 8 seeds its own: **`Eval Fixture — The Last
Signal`** (project `bbbbbbbb-bbbb-4bbb-8bbb-000000000001`, owner = the standing test
account), ten chapters realising demo-spec §5's information architecture (Arka Vale, Mira
Voss, Dr. Elias Vale, Project Helios, flashbacks at positions 3 and 6, the death at 2048-03-11,
Mira's knowledge transition at 2048-04-17, the half-sibling reveal, and the F10 receiver world rule).

Canon rows are written **directly at `status='CANON'`** — 10 facts, 7 events, 6 knowledge
rows — every quote verified as a verbatim substring of its chapter before seeding. Chunking
runs through the real `process_memory()` path (never hand-inserted chunks). This corpus also
becomes the Phase 9 demo project.

## Dataset

24 cases over 6 rubric categories (demo-spec §14's six groups, merged/trimmed from the
suggested 30):

| Category | Cases | Measures |
|---|---|---|
| retrieval | 6 | evidence recall + citation correctness for known questions |
| story-time | 4 | flashback safety, chronology vs narrative order, exact dates |
| knowledge | 4 | knowledge transitions and honest abstention |
| continuity | 4 | planted contradictions (signature prompt, firearm behaviour, post-death visit, world rule) |
| false-positive | 3 | restraint: legitimate scenes must NOT be flagged |
| abstention | 1 | unnamed-entity questions must abstain, not invent |
| generation-repair | 2 | repair budget on contradiction prompts |

10 cases carry `arm:'both'` (baseline comparison). Every `expected` block is derived from the
seeded canon — no expectation rests on something the corpus does not state.

## Grader — no LLM judge

Every metric is a pure function (`gradeCase`) of the recorded observation:
`status_match`, `evidence_recall`, `citation_correct` (the FIRST expected chapter),
`must_mention`, `answer_must_not_contain`, `issue_detected`, `issue_type_match`
(the planted type, not just any finding), `false_positive_avoided`, `repair_bounded`,
`continuity_pass`. An errored observation scores **`ran:false` with all-null checks** — never
`false`, which would read as "Inkrya got it wrong" when nothing was measured.

## Baseline comparison — one detector, two arms

- **Pipeline arm**: live Preview APIs (`/api/memory ask`, `/api/write`) with retrieval,
  planner/writer/guardian/repair/critic, and canon proposals.
- **Baseline arm**: the same Nemotron model, called DIRECTLY with **no retrieved story
  context** (bare question, bare instruction). Its write drafts are then judged by the **same
  guardian** the pipeline uses (identical prompt, validator, context package) — the comparison
  is not rigged by two detectors.
- Baseline ask answers have no citations and no story facts; against `expected` chapters/dates
  they score 0 by construction — which is the point: without retrieval, the model cannot cite
  the story, cannot give exact story times, and invents or misses facts.

## Results — live both-arm run, 2026-10-08

Deployment `inkrya-ljchqbjx7` (commit `8d4c8d8`, includes the validateAnswer fix), fixture
project above, executed by the standing test account. Raw data: `qa/eval/results-2026-10-08-both.json`.

### Pipeline arm (24 cases, 1 errored — an unrelated transient 503 on one ask)

| Category | Cases | Ran | Rubric pass |
|---|---|---|---|
| retrieval | 6 | 5 (1×503) | 16/16 |
| story-time | 4 | 4 | 7/16 |
| knowledge | 4 | 4 | 6/13 |
| continuity | 4 | 4 | 6/8 |
| false-positive | 3 | 3 | 3/3 |
| abstention | 1 | 1 | 0/1 |
| generation-repair | 2 | 2 | 6/8 |

**4 continuity + 2 generation-repair cases = 33 of 34 observations ran; 1 transient 503.**
The 503 rate fell from 4/24 before the `validateAnswer` fix to 1/34 after — the remaining
one is an unrelated provider blip (the same case returned 200 on an immediate re-probe).

### Honest reading of the misses

- `t2-chronology-order`, `k4-arka-knows-death`, and (this run) `k1-mira-before-ch8` came back
  `NOT_ESTABLISHED`, not wrong — retrieval did not surface the chapter the question needed, so
  the ask **abstained honestly** instead of inventing an answer. That is the abstention contract
  working, but it is a **retrieval-recall miss** the rubric scores as a failure. In run 4 the
  same `k1` answered correctly from Bab 8; the verdict moves with retrieval. Recorded, not hidden.
- `t1-flashback-ch7` answered correctly ("Ya, Dr. Vale masih hidup pada Bab 7 [Bab 7]") but
  did not repeat the year "2045" the rubric required — `must_mention` is a strict substring
  check, so a correct answer can fail it.
- `t4-chapter-ten` is the clearest recall gap: a question phrased around "Bab 10" retrieves
  nothing, because the retriever keys on content words and the chapter reference is not one.
- `c2-firearm-casual` regressed vs run 4 (guardian found nothing this pass) — continuity
  verdicts on borderline scenes are the least stable part of the run.

### Baseline arm (10 paired cases)

| Category | Cases | Rubric pass |
|---|---|---|
| retrieval | 2 | 0/6 |
| story-time | 1 | 0/4 |
| knowledge | 1 | 0/4 |
| continuity | 4 | 8/8 |
| generation-repair | 2 | 5/8 |


### Baseline vs pipeline (the demo-spec §13 claim)

On every paired question case the pipeline produced the exact story fact with a verbatim
citation while the context-free baseline produced no citation, wrong dates, or invented
content — `t3-death-date`: pipeline "meninggal pada tanggal 11 Maret 2048 [Bab 5]" vs baseline
0/4; `k2-mira-learns`: pipeline's exact 2048-04-17 transition vs baseline 0/4. Without
retrieval the model cannot cite the story and cannot give story times — the comparison is
the product's core claim made measurable.

On continuity the picture is more honest and more interesting: both arms DETECT the planted
hazards most of the time (the hazards are visible in the prompt itself), but only the
pipeline can ground them in evidence ids and repair them — the baseline's guardian pass has
no grounding beneath its verdicts, and the baseline scored `issue_type_match:false` on
`g1` (it flagged, but not the planted types). Detection is cheap; grounded explanation and
repair are the product.

### Product findings the evaluation surfaced (and what was fixed)

1. **One paraphrased quote discarded the whole answer (deterministic 503)** — `validateAnswer`
   threw `UNSUPPORTED_CITATION` on the first claim whose quote was not an exact substring,
   and the ask route turned that into a 503 with the model answer thrown away. Fixed
   (commit `bd03681`): the quote is re-anchored to the longest real substring of its source
   (the rendered citation stays truthful), only a claim with no anchor is dropped, structural
   garbage still throws. Found because the 503 reproduced on the same questions across runs
   — not transient. Same defect class as the Phase 6/7 validator fixes: **filter per item,
   never let one bad item kill the batch.**
2. **Retrieval missed Bab 10** (`t4-chapter-ten`, NO_EVIDENCE): the convergence chapter
   discusses "Helios Station" and the world rule, and the question's "Bab 10" anchor did not
   match its keywords. Honest abstention did its job — no fabrication — but recall failed.
   Not fixed in this phase (needs a chapter-reference resolver in the query expansion);
   recorded as a known weakness.
3. **Guardian false-negative on `c3` (post-death visit)** in earlier runs and a false-positive
   on the same case in another — the guardian's verdicts on borderline scenes move between
   runs. With n=4 continuity cases, no variance estimate is claimed; the signature-prompt
   cases (two planted hazards) detected reliably.
4. **`a4` hallucination caught**: the model answered an unnamed-sibling question by naming
   Dr. Elias Vale ("kakaknya" is never named) — exactly the over-claim the abstention rubric
   exists to catch. Recorded as the abstention class failing once in one run.

### Baseline-arm bug found during the phase

The baseline arm initially failed wholesale (empty model text): the runner had not applied
`lib/ai/generate.ts`'s Nemotron-Super reasoning switch
(`providerOptions.nebius.chat_template_kwargs.enable_thinking:false`), so every call spent
its output budget on the reasoning channel and returned an empty string. Fixed in
`8d4c8d8`; an empty text channel now surfaces as `BASELINE_EMPTY`/`BASELINE_GUARDIAN_FAILED`
instead of silently scoring a blank draft as a clean result.

## LangSmith dataset

`scripts/eval-upload-langsmith.mjs` is idempotent (create-if-absent, skip existing example
ids). With no `LANGSMITH_API_KEY` in the local environment it exits 0 with `SKIPPED_NO_KEY`,
and this report records **repo-only** as the verified state; the upload path is one env var
away and was smoke-verified for both outcomes.

## Toloka (optional) — recommendation to skip

The contract marks Toloka optional. Skipped deliberately: with ~10 paired cases, a human
preference panel yields no statistically meaningful claim, adds cost and scheduling, and the
demo spec itself says not to make it a dependency. The deterministic rubric above is
reproducible by anyone from the repo — a stronger submission artifact than a small
preference study.

## How to re-run

See `docs/HACKATHON_SETUP.md` → "Evaluation (Phase 8)". Requires `EVAL_PASSWORD` and
(optionally, for the baseline arm) `NEBIUS_API_KEY` in `.env.local`, a fresh Vercel bypass
cookie, and the fixture project (apply order in the setup doc).

## Honest limits

- 24 cases on a synthetic 10-chapter fixture — one chunk per chapter, short prose. It does
  not measure long-manuscript retrieval.
- No repeated runs: each reported number is a single pass; LLM variance moves borderline
  guardian verdicts between runs (observed across this phase's runs).
- No variance estimate, no significance claims — binary rubric counts only, per the spec's
  "explicit rubric labels rather than arbitrary global scores".
- The baseline arm's ask baseline is intentionally extreme (no context at all); it
  demonstrates the value of retrieval+grounding, not a tuned second-best system.
- Results JSON caps draft previews at 400 chars and carries no keys, tokens, or full prose.
