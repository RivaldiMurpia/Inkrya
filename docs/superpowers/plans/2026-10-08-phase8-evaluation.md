# Phase 8 — Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satisfy the Phase 8 contract — "LangSmith datasets, baseline comparison, retrieval/continuity/knowledge metrics; Toloka optional" — with a reproducible fixture corpus, a 24-case dataset, a headless two-arm runner, and a published results report.

**Architecture:** A synthetic fixture corpus is seeded into the live database under the standing test account, with canon rows written directly at `status='CANON'` (not LLM-extracted), so every expected answer has a known-accepted basis. A deterministic grader (`lib/eval-grading.ts`, no LLM judge) maps observed pipeline output to per-case rubric booleans. A headless runner drives live Preview APIs with the test account for the pipeline arm and calls Nebius directly without retrieval for the baseline arm. Results land in the repo and in a LangSmith dataset.

**Tech Stack:** Node 22+ (`node --experimental-strip-types`), `@supabase/supabase-js`, `langsmith` 0.10.4, `ai` v7 via `lib/ai/provider.ts` (unchanged), Supabase Postgres via MCP.

**Spec:** `docs/HACKATHON_DEMO_SPEC.md` (§6 fixtures, §7 signature prompt, §10 false positives, §13–14 evaluation) and `docs/HACKATHON_IMPLEMENTATION.md:76`.

## Global Constraints

These apply to every task; exact values are copied from the spec.

- Dataset size: **20–40 high-quality cases, not hundreds** (demo §14).
- Categories (demo §14): 5 retrieval/citation · 5 story-time · 5 character-knowledge · 5 continuity contradiction · 5 false-positive/abstention · 5 generation+repair. **This plan uses 24** by merging story-time into retrieval and trimming two categories; the plan records which and why.
- **No LLM judge anywhere.** Every metric is a deterministic function of observed output.
- **No invented global health score** (demo §13: "Prefer explicit rubric labels rather than arbitrary global scores").
- Fixture facts F1–F10 (demo §6) must all be represented in the seeded canon, with a documented accepted state.
- Never use the owner's private novel; synthetic material only (demo §2).
- Grader output must be `true`/`false`/`null` per case — `null` means the case did not run, never silently `true`.
- The runner must never print keys, tokens, or full story prose into logs.

## Review Focus

Input classes and failure modes the spec implies but individual task tests do not exercise. Each line names a behaviour a reasonable person would expect, and the task that pins it.

1. **A case whose expected answer is genuinely absent from the corpus** — the pipeline must abstain, and the grader must score `status_match=true` rather than treating an empty answer as a miss. → Task 4 (`no-evidence` case) and Task 3 (`status_match` null-safety).
2. **Two arms scored by different detectors** — a baseline that is judged by a laxer path is a rigged comparison. Both arms must be scored by the same grader against the same expectations. → Task 5.
3. **A pipeline run that errors mid-case** (503, 429, timeout) — the runner must record `error` and score the case `null`, never `false` (a `false` would read as "Inkrya got it wrong" when in fact nothing was measured). → Task 5.
4. **A citation that resolves to a real chunk but the wrong chapter** — evidence recall can be right while citation correctness is wrong; they are separate rubric fields. → Task 3.
5. **A guardian that finds the planted contradiction for the wrong reason** (e.g. flags `behavior_inconsistency` when the fixture expects `knowledge_leak`) — issue-type matching, not mere issue presence. → Task 3 and Task 6.

---

### Task 1: Fixture corpus DDL and seed

**Files:**
- Create: `database/eval-fixture-phase8.sql`
- Create: `qa/eval/fixture-chapters.json` (the prose, kept out of SQL for readability)

**Interfaces:**
- Consumes: nothing.
- Produces: a project with fixed id `bbbbbbbb-bbbb-4bbb-8bbb-000000000001`, title `Eval Fixture — The Last Signal`, owner `aa000000-0000-4000-8000-000000000098` (the standing test account), 10 chapters with `position` 0..9, their auto-created `story_chunks`, and canon rows addressed by the keys `F1`..`F10` documented in the file header.

- [ ] **Step 1: Write the fixture prose file**

`qa/eval/fixture-chapters.json`: an array of 10 objects `{position, title, story_time, text}`. Content must realise demo §5's information architecture:
position 0 Ch1 2048-03-02 (Arka detects signal, knows Helios, avoids weapon) · 1 Ch2 2048-03-04 (refuses pistol) · 2 Ch3 2048-03-07 (world evidence Helios real, Mira still ignorant, Dr. Vale alive) · 3 Ch4 **2045-08-19 flashback** (Dr. Vale working on Helios earlier) · 4 Ch5 2048-03-11 (**Dr. Vale dies**) · 5 Ch6 2048-03-14 (misleading info, Helios Station status) · 6 Ch7 **2045-08-20 flashback** (Dr. Vale alive legitimately) · 7 Ch8 2048-04-17 (**Mira learns Helios exists**) · 8 Ch9 2048-04-19 (Mira is Arka's half-sister) · 9 Ch10 2048-04-21 (convergence, world rule about receiver configuration).
Each `text` is 300–600 characters of Indonesian prose. Keep under 3200 chars total per chapter so each chapter yields exactly one chunk.

- [ ] **Step 2: Write the SQL**

`database/eval-fixture-phase8.sql` — one file, idempotent by delete-then-insert on the fixed project id, wrapped so it is safe to re-run. It must:
1. delete any existing fixture project (cascade removes chapters/chunks/canon);
2. insert the project with the fixed id and the test-account owner;
3. insert the 10 chapters (the `queue_chapter_memory` trigger creates `memory_jobs`);
4. insert `characters` rows for Arka Vale, Mira Voss, Dr. Elias Vale;
5. inline the chapter prose for a one-shot apply, and after chunking insert canon rows: `story_facts` (`status='CANON'`, with `subject`/`predicate`/`object`, `source_chapter_id`, and a `quote` that is a verbatim substring of that chapter's `plain_text`), `timeline_events` (`status='CANON'`, `event_type` from the allowed set, `chapter_id`), `character_knowledge` (`status='CANON'`, resolved `character_id`, `learned_at_chapter_id`, `learned_at_story_time`).

Header comment maps each row to F1–F10.

- [ ] **Step 3: Apply via MCP and chunk**

Apply as migration `eval_fixture_phase8`, then call `process_memory` for the project as the test account (10 times or until `processed=false`) to create `story_chunks`.

- [ ] **Step 4: Verify the seed**

Run and read: chapter count 10, one chunk per chapter, `story_facts` 10 rows all `CANON`, `timeline_events` ≥ 8 all `CANON`, `character_knowledge` ≥ 6 all `CANON`.
Expected: every count matches; no row has `status <> 'CANON'`.

- [ ] **Step 5: Commit**

```bash
git add database/eval-fixture-phase8.sql qa/eval/fixture-chapters.json
git commit -m "feat(eval): synthetic fixture corpus with known accepted canon"
```

---

### Task 2: Dataset

**Files:**
- Create: `qa/eval/last-signal-eval.jsonl`
- Create: `qa/eval/README.md`

**Interfaces:**
- Consumes: Task 1's fixture (chapter titles and canon claims must match the seeded text).
- Produces: JSONL, one object per line, fields:
  `id` (string) · `category` (`retrieval|citation|story-time|knowledge|continuity|false-positive|abstention|generation-repair`) · `arm` (`pipeline|both`) · `input` (object; for `ask` cases `{question}`, for `write` cases `{instruction}`) · `expected` (object, shape per category — see Task 3) · `note` (string, why the case exists).

- [ ] **Step 1: Write 24 cases**

Coverage: 6 retrieval/citation · 4 story-time · 4 knowledge · 4 continuity · 4 false-positive/abstention · 2 generation+repair. Mark the 10 cases whose generation arm runs as `arm:'both'`; the rest `arm:'pipeline'`. Every `expected` block is derived from Task 1's seeded canon — no expectation may rest on something the corpus does not state.

- [ ] **Step 2: Write the README**

`qa/eval/README.md`: how to run the runner, what each category measures, which cases are `both`, and the honest note that this dataset measures the synthetic fixture only.

- [ ] **Step 3: Verify the file parses**

Run: `node -e "const fs=require('fs');const L=fs.readFileSync('qa/eval/last-signal-eval.jsonl','utf8').trim().split('\n');L.forEach((l,i)=>JSON.parse(l));console.log('cases',L.length)"`
Expected: `cases 24`.

- [ ] **Step 4: Commit**

```bash
git add qa/eval/last-signal-eval.jsonl qa/eval/README.md
git commit -m "feat(eval): 24-case Last Signal evaluation dataset"
```

---

### Task 3: Deterministic grader

**Files:**
- Create: `lib/eval-grading.ts`
- Test: `tests/eval-grading.test.mjs`

**Interfaces:**
- Consumes: `GuardianIssue` (from `lib/agent-validation.ts`), dataset `expected` blocks (Task 2).
- Produces:
```ts
export type AskObservation={kind:'ask';status:string;citations:{chapter_id:string;title:string}[];answer:string;error?:string};
export type WriteObservation={kind:'write';findings:GuardianIssue[];repairAttempts:number;unresolved:number;draft:string;error?:string};
export type Observation=AskObservation|WriteObservation;
export type Rubric={ran:boolean;checks:Record<string,boolean|null>;passed:number;applicable:number};
export function gradeCase(expected:Record<string,unknown>,observation:Observation):Rubric;
```
Rubric keys produced: `status_match`, `citation_correct`, `evidence_recall`, `issue_detected`, `false_positive_avoided`, `issue_type_match`, `continuity_pass`, `repair_bounded`, `citations_supported`. A key is **absent** (not `false`) when the case's `expected` block does not define it.

- [ ] **Step 1: Write the failing test**

`tests/eval-grading.test.mjs`, at minimum:
```js
test('an errored observation scores null, never false', ...)   // error:'503' → ran:false, all checks null
test('status_match compares the abstention class', ...)        // expected.status NOT_ESTABLISHED vs observed ANSWERED → false
test('citation_correct checks the chapter, not just presence', ...) // expected_chapters ['Ch8'] vs observed ['Ch3'] → false
test('issue_type_match requires the planted type', ...)        // expected issue_type knowledge_leak, observed alive_dead_conflict → false
test('false_positive_avoided fails when a forbidden type appears', ...)
test('a case with no expected keys reports no checks', ...)    // applicable 0
```
Each test asserts the exact rubric object (`assert.deepEqual` on `checks`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/eval-grading.test.mjs`
Expected: FAIL — `gradeCase` is not exported / module not found.

- [ ] **Step 3: Implement `gradeCase`**

Pure function, no I/O, no imports beyond the `GuardianIssue` type. Normalise chapter references by substring match on the citation's `title` **and** by id set, because the dataset names chapters by label ("Bab 8") while the API returns ids and titles. `issue_detected` = at least one observation finding; `issue_type_match` = the expected type is present; `false_positive_avoided` = none of `expected.forbidden_issue_types` are present.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/eval-grading.test.mjs`
Expected: PASS.

- [ ] **Step 5: Add to the suite and commit**

Add `tests/eval-grading.test.mjs` to `test:unit` in `package.json`, run `npm run test:unit`, then:
```bash
git add lib/eval-grading.ts tests/eval-grading.test.mjs package.json
git commit -m "feat(eval): deterministic rubric grader with null-safe abstention"
```

---

### Task 4: Pipeline arm runner

**Files:**
- Create: `scripts/eval-runner.mjs`

**Interfaces:**
- Consumes: Task 2 dataset, Task 3 `gradeCase`, the standing test account (memory `inkrya-test-account`), live Preview API.
- Produces: `qa/eval/results-<date>.json` — `{generated_at, deployment, fixture_project_id, cases:[{id,category,arm,observation,rubric}], summary:{by_category:{...},totals:{...}}}`.

- [ ] **Step 1: Write the runner**

Sign in via Supabase password grant to the test account, mint a Vercel bypass link for the current Preview deployment, then for each `pipeline` case call `/api/memory {action:'ask'}` or `/api/write` and build the matching `Observation`. Map HTTP errors to `observation.error` (never to a `false` rubric). Run cases sequentially with a small delay to respect the 10-second interval rule (the test account is exempt, but the runner should not assume it).

- [ ] **Step 2: Run it against the fixture**

Run: `node --env-file=.env.local scripts/eval-runner.mjs --arm pipeline`
Expected: 24 lines of per-case progress, then `results-<date>.json` written; zero cases with `error`.

- [ ] **Step 3: Read the file and sanity-check**

Read `qa/eval/results-<date>.json`. Expected: every case has a non-null rubric, `summary.totals.ran` equals the case count, and no `observation` field contains a key or a token.

- [ ] **Step 4: Commit**

```bash
git add scripts/eval-runner.mjs qa/eval/results-*.json
git commit -m "feat(eval): headless pipeline-arm runner writing raw observations"
```

---

### Task 5: Baseline arm

**Files:**
- Modify: `scripts/eval-runner.mjs`

**Interfaces:**
- Consumes: Task 4's runner, `lib/ai/provider.ts` `prepareModel`, `lib/eval-grading.ts` `gradeCase`.
- Produces: baseline observations in the same `results-<date>.json` under `cases[].arm === 'baseline'`, and `summary.baseline_vs_pipeline`.

- [ ] **Step 1: Write the failing test**

Add to `tests/eval-grading.test.mjs`:
```js
test('baseline and pipeline observations are graded by the identical rubric shape', ...)
```
Assert `Object.keys(gradeCase(expected, pipelineObs).checks)` deep-equals `Object.keys(gradeCase(expected, baselineObs).checks)` for the same `expected`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/eval-grading.test.mjs`
Expected: FAIL if the grader branches on arm; PASS immediately if it is arm-agnostic (then record that the arm-agnosticism was already true and keep the test as the pin).

- [ ] **Step 3: Implement the baseline arm**

For each `arm:'both'` case, call Nebius **once** through `prepareModel('writer')` for write cases and `prepareModel('qa')` for ask cases with **no retrieved context** — only the bare instruction or question. For write cases, feed the baseline draft to the same guardian the pipeline uses (a single `continuity` call with the fixture's real context) so both arms are scored by the same detector. Record `attempted_at` and the model id.

- [ ] **Step 4: Run both arms**

Run: `node --env-file=.env.local scripts/eval-runner.mjs --arm both`
Expected: pipeline cases plus baseline cases for the 10 `both` cases; `summary.baseline_vs_pipeline` present.

- [ ] **Step 5: Commit**

```bash
git add scripts/eval-runner.mjs tests/eval-grading.test.mjs qa/eval/results-*.json
git commit -m "feat(eval): baseline arm scored by the same detector as the pipeline"
```

---

### Task 6: Live continuity and false-positive verification

**Files:**
- Modify: `qa/eval/results-<date>.json` (via re-run)

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: evidence that the four continuity cases and the four false-positive/abstention cases actually exercise the intended behaviour — not merely that they returned.

- [ ] **Step 1: Inspect the four continuity observations**

Read the `results-<date>.json` entries for the `continuity` category. Expected: the signature-prompt case reports at least `knowledge_leak` and `alive_dead_conflict`; the flashback case reports **no** `alive_dead_conflict`; the unknown-knowledge case reports no certainty claim.

- [ ] **Step 2: Fix the fixtures, not the grader, if a case does not discriminate**

If a continuity case passes for every arm, it is not measuring anything: tighten the `expected` block or the instruction so the case discriminates, then re-run Task 4. Record the change as a ledger ruling.

- [ ] **Step 3: Commit**

```bash
git add qa/eval/last-signal-eval.jsonl qa/eval/results-*.json
git commit -m "fix(eval): make the continuity cases discriminate between arms"
```

---

### Task 7: LangSmith dataset upload

**Files:**
- Create: `scripts/eval-upload-langsmith.mjs`

**Interfaces:**
- Consumes: Task 2 dataset; `LANGSMITH_API_KEY` from the environment (pulled from Vercel into the git-ignored `.env.local`).
- Produces: a LangSmith dataset named `inkrya-last-signal-eval` with one example per case.

- [ ] **Step 1: Pull the key**

Use the Vercel MCP to obtain the Preview `LANGSMITH_API_KEY` value into `.env.local` without printing it. If retrieval is not possible, the script must exit 0 with `SKIPPED_NO_KEY` and Task 8 records repo-only.

- [ ] **Step 2: Write the uploader**

Use the `langsmith` package's dataset API (already a dependency). Idempotent: create the dataset if absent, and skip examples whose `id` already exists.

- [ ] **Step 3: Run and verify**

Run: `node --env-file=.env.local scripts/eval-upload-langsmith.mjs`
Expected: `uploaded 24 examples` (or `SKIPPED_NO_KEY`).

- [ ] **Step 4: Commit**

```bash
git add scripts/eval-upload-langsmith.mjs
git commit -m "feat(eval): idempotent LangSmith dataset upload"
```

---

### Task 8: Results report and docs

**Files:**
- Create: `docs/evidence/phase8-eval-2026-10-08.md`
- Modify: `docs/HACKATHON_IMPLEMENTATION.md` (Phase 8 row), `IMPLEMENTATION_STATUS.md`, `README.md`, `docs/HACKATHON_SETUP.md` (how to re-run)

**Interfaces:**
- Consumes: every earlier task.

- [ ] **Step 1: Write the report**

Table per category: cases, ran, passed, and the specific rubric keys. Include the baseline-vs-pipeline comparison for the `both` cases, the exact deployment and commit, and an honest limits section (24 cases; synthetic fixture only; no human evaluation; Toloka deferred with the reason).

- [ ] **Step 2: Fill the verification matrix with real numbers**

Every number in the report is copied from `results-<date>.json`. Any cell that was not measured reads `not measured`, never an estimate.

- [ ] **Step 3: Update the docs**

Phase 8 row → Delivered; status headers → Phases 2–8; README gains the evidence link; setup doc gains the re-run recipe.

- [ ] **Step 4: Commit**

```bash
git add docs/evidence/phase8-eval-2026-10-08.md docs/HACKATHON_IMPLEMENTATION.md IMPLEMENTATION_STATUS.md README.md docs/HACKATHON_SETUP.md
git commit -m "docs: record the Phase 8 evaluation results and how to re-run them"
```

---

## Verification

1. `npm run test:unit`, `npm run typecheck`, `npm run build` green.
2. Fixture corpus seeded and queryable; all canon rows `status='CANON'`.
3. Runner produces `results-<date>.json` with 24 pipeline cases and 10 baseline cases, zero `error`.
4. The four continuity cases discriminate: at least one case where the pipeline detects an issue and the baseline does not.
5. Grader returns `null` rather than `false` for every errored observation (unit-tested).
6. LangSmith dataset holds 24 examples, or the report says repo-only with the reason.
7. No key, token, or full manuscript text appears in `results-<date>.json` or in any log.

## Deliberately deferred

- Toloka human evaluation — the contract marks it optional; n≈10 supports no statistical claim. Reason recorded in the report.
- A Studio eval panel — no UI in this phase.
- A database table for results — the JSONL/JSON files in `qa/eval` are the record.
- Repeat runs for variance — one pass per arm; the report states that no variance estimate exists.
- Playwright/E2E harness (Phase 9 per the PRD phase list).

## Risks

- The fixture prose is synthetic and short; retrieval quality on 10 single-chunk chapters is a weaker test than a long manuscript. Stated as a limit, not hidden.
- A baseline arm that produces no guardian findings at all would make `issue_detected` trivially favourable to the pipeline; Task 5's identical-detector rule plus Task 6's discrimination check guard this.
- The Vercel bypass link expires ~24h, so a re-run needs a fresh mint; recorded in the setup doc.
