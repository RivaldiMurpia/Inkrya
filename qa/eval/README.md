# Last Signal evaluation dataset

`last-signal-eval.jsonl` — 24 cases, one JSON object per line, over the synthetic fixture
corpus `Eval Fixture — The Last Signal` (project `bbbbbbbb-bbbb-4bbb-8bbb-000000000001`,
seeded by `database/eval-fixture-phase8.sql` + `eval-fixture-phase8-canon.sql`).

## Fields

- `id` — stable case id.
- `category` — one of `retrieval | story-time | knowledge | continuity | false-positive | abstention | generation-repair`.
  (Demo spec §14's six groups map: retrieval+citation → `retrieval`, generation+repair → `generation-repair`, false-positive and abstention kept separate.)
- `arm` — `pipeline` (pipeline arm only) or `both` (also runs the baseline arm).
- `input` — `{question}` for ask cases, `{instruction}` for write cases.
- `expected` — the rubric the deterministic grader checks:
  - `status` — expected AnswerStatus (`ANSWERED` / `NOT_ESTABLISHED`).
  - `chapters` — expected chapter titles among the citations.
  - `mustMention` — substrings the answer text must contain.
  - `answerMustNotContain` — substrings the answer must not contain (over-claim guard).
  - `issue_types` — Guardian issue types a continuity case may surface: the rubric passes when
    **any** of the listed types appears (`issue_type_match` = any-of), while `issue_detected`
    requires ≥1 finding at all. Flagging only unrelated types still fails the case.
  - `forbidden_issue_types` — types that must NOT appear (false-positive guard).
  - `max_repair_attempts` — repair budget (always 2, the graph's own bound).
- `note` — why the case exists (demo-spec section references).

## What each category measures

| Category | Cases | Measures |
|---|---|---|
| retrieval | 6 | evidence recall + citation correctness for known questions |
| story-time | 4 | flashback safety, chronology vs narrative order, exact dates |
| knowledge | 4 | character-knowledge transitions and honest abstention |
| continuity | 4 | planted contradiction detection (signature prompt, firearms, death, world rule) |
| false-positive | 3 | restraint: legitimate scenes must NOT be flagged |
| abstention | 1 | unknown-answer questions must abstain, not invent |
| generation-repair | 2 | repair budget on the contradiction prompts |

## Honest note

This dataset measures the **synthetic fixture only** — ten short single-chunk chapters.
It does not measure behaviour on a long manuscript, and no human evaluation is included
(Toloka deferred; see the Phase 8 report). Re-run via `scripts/eval-runner.mjs`.
