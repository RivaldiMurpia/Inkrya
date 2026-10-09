# Phase 1 prose gate — few-shot experiment (2026-10-09)

**Hypothesis:** the recorded failures (length misses, foreign words, word-count suffixes,
continuity breaks) are a zero-shot condition problem. An in-context example of accepted
Indonesian prose plus reduced sampling (temperature 0.6 from 1) holds the model inside the
corridor. Public Nebius endpoint only, local `NEBIUS_API_KEY`, no deploy, no product change.

**Cases:** the standing four from `scripts/phase1-writer-cases.mjs` (continue-radio
55–70, rewrite-radio 45–60, continue-menara 50–65, rewrite-surat 50–65).
**Configurations:** A = few-shot 1 example, temp 1; B = same + temp 0.6;
C = `openai/gpt-oss-120b` few-shot temp 0.6 (catalog model, base of the Plan C LoRA donor);
D = Super few-shot temp 0.2; E = gpt-oss-120b few-shot temp 0.6 with maxOutputTokens 1200;
E2/F = E repeated and E + sentence-count length hint; G/H/I = gpt-oss-120b at temp 0.2 /
with a second example / with reasoning_effort low (all few-shot, cap 1200);
J/K = DeepSeek-V4-Flash-0731 and Qwen3-30B-A3B-Instruct-2507 under config G.
Sampling elsewhere unchanged from the app: top-p 0.95, non-thinking, 260-token ceiling,
zero retries, per-call timeout 35s.

## Round 1 — A (few-shot, temp 1) / B (few-shot, temp 0.6) / C (gpt-oss-120b, cap 260)

Raw: `qa/phase1-fewshot/run-2026-10-09.jsonl` (12 observations, public endpoint, zero retries).

- **A and B: lengths WORSE, not better** — 139/120/124/120 (A) and 142/89/145/90 (B) words
  against targets 55–70/45–60/50–65/50–65. Output A-1 hit the 260-token cap. A-1 prose kept
  morphological hallucinations ("berlargon", "melayuh", "gegerakan") and moved the key from
  the drawer to a "kotak kayu"; A-3 leaked English ("realization"); A-4 carried a fabricated
  word-count suffix "(62 kata)". The few-shot example did not hold the corridor — it appears
  to have licensed longer output, and vendor-recommended temperature 1 keeps producing
  invented morphology.
- **C: an empty-text artifact, not a model failure** — all four rows returned
  `outputTokens=260` (the cap) with zero text: gpt-oss always emits its analysis channel
  first, so a 260-token budget dies before the final channel. The donor family of the
  successful Plan C LoRA has not actually been evaluated yet.

**Round 2 (untested variables):** D = Super few-shot at temperature 0.2; E = gpt-oss-120b
few-shot at temp 0.6 with maxOutputTokens 1200 so the analysis channel does not exhaust the
budget. Same cases, same filters, zero retries.

## Round 2 — D (Super few-shot, temp 0.2) / E (gpt-oss-120b few-shot, cap 1200)

Raw: `qa/phase1-fewshot/round2-2026-10-09.jsonl` (8 observations).

- **D: temperature does not fix Super** — 144/147/143/129 words (targets 45–70). Temp 0.2,
  0.6 and 1.0 all fail length. Super's Indonesian prose gate is closed across every tested
  sampling condition.
- **E: the breakthrough configuration** — gpt-oss-120b with a 1200-token budget returned
  **65/43/52/52 words** (3/4 in range, one case 2 words short), zero foreign-word leakage,
  zero invented morphology, all seven objective filters clean. With budget for its analysis
  channel, gpt-oss-120b writes compliant, natural Indonesian prose under the same prompt the
  Super runs failed.

## Round 3 — E repeated (stability) and F (E + sentence-count hint)

Raw: `qa/phase1-fewshot/round3-2026-10-09.jsonl` (8 observations). **Mechanical screen 8/8**
— both configurations pass every objective filter on every case, lengths
61/46/51/51 (E2) and 66/49/52/54 (F) against 55–70/45–60/50–65/50–65.

### Operator quality review (not the human gate)

Best Indonesian prose of any candidate measured in this project — no invented morphology, no
foreign leakage, sentence rhythm natural. Remaining defects are beat/logic, not language:

- E2 `continue-menara` — invents "Raka memeriksa lampu ketiga" and ends on illogical
  relighting logic; `rewrite-radio` borderline ("tergenggam dalam saku" awkward).
- F `rewrite-radio` — final sentence semantically truncated ("takut apa yang akan terungkap
  dari."); `continue-menara` — Raka watching docked ships is an invented event and the
  tell-Raka beat resolves as failure (forbidden change).
- E2/F `rewrite-surat` and both `continue-radio` runs: facts held, near-acceptable prose.

**Honest verdict: 0/4 cases fully clean under strict fact review, but the class of failure
changed** — from language competence (Super: invented words, foreign leakage, wild lengths)
to individual beat/logic slips. The historical candidates (Super/Ultra/Lightning/Qwen/Gemma)
scored mechanical 1–2/4 AND 0/4 human; gpt-oss-120b scores mechanical 4/4 and ~2/4
operator-acceptable. The human review gate remains the owner's.

## Round 4 — the three untested variables (G/H/I), 12/12 mechanical pass

Raw: `qa/phase1-fewshot/round4-2026-10-09.jsonl`. Lengths: G 60/48/50/64, H 69/48/55/52,
I 58/47/57/51 — every case inside range in all three configs.

### Operator review

- **G (gpt-oss-120b, few-shot, temp 0.2) — the leader.** `continue-radio`, `rewrite-radio`,
  `rewrite-surat` clean: facts held, no leaks, natural rhythm. `continue-menara` borderline —
  Nala's attempt beat is performed but Raka still hasn't registered the light; arguably
  compliant with "berusaha memberi tahu", strictly reviewed it may fail.
- **H (second beat-strict example) did not help and hurt once:** `continue-radio` leaked
  **"remote"** (a lowercase English loan the leakage filter cannot see — filter lesson) and
  implied an invented "misi"; `continue-menara` again invents Raka inspecting another lamp.
  `rewrite-surat` is clean and good.
- **I (reasoning_effort low) — worst:** invented props ("lampu neon", "senter", "kabut"),
  a redundant "tegang di udara yang tegang", one semantically garbled closing sentence.

**Round-4 verdict:** G is the first configuration in the project's history with
three of four cases operator-acceptable and zero language defects. The failure class is
now a single borderline beat resolution (and one 2-word miss in round 2's E), not language
competence. No candidate is formally accepted — the gate remains the owner's human review
over the recorded prose, and each run so far is a single pass per config (no variance claim).

## Round 5 — two untested cheap candidates under config G (J/K)

Raw: `qa/phase1-fewshot/round5-2026-10-09.jsonl`. Both priced below/at gpt-oss-120b
(J: $0.14/$0.28 — cheapest output in the catalog; K: $0.10/$0.30). 8 calls, sen-scale.

- **J (deepseek-ai/DeepSeek-V4-Flash-0731): mechanical 4/4, all-clean** — lengths
  61/60/55/51, every objective filter passes on every case, no leaks, natural rhythm.
  Operator review: facts held in all four cases (key in drawer, Damar uninformed, letter
  untouched); `rewrite-radio` ends slightly sentimental but compliant; `continue-menara`
  invents "Raka memeriksa peta" (a background action, less severe than prior rewrites).
  **Comparable to G, at roughly half the output price.**
- **K (Qwen/Qwen3-30B-A3B-Instruct-2507): mechanical 2/4** — two length failures
  (63/69 vs 45–60 and 50–65). Prose itself is clean and restrained; the beat discipline
  is better than the failed Qwen3-235B/397B runs, but the config G length control does not
  transfer to this model. Not a leader.

**Round-5 verdict:** two viable writer candidates now exist — G (gpt-oss-120b, temp 0.2)
and J (DeepSeek-V4-Flash, temp 0.2). Both need the owner's human review on recorded prose;
neither is formally accepted. J's one 4/4 all-clean mechanical run is a single pass (no
variance claim).

## Round 6 — stability repeats of G and J (G2/J2)

Raw: `qa/phase1-fewshot/round6-2026-10-09.jsonl`. **Mechanical 8/8** — G2 lengths
62/46/50/51, J2 67/53/56/51, every filter clean in both.

- **gpt-oss-120b config is stable on the objective screen:** two runs, 4/4 then 4/4.
  Prose quality consistent; `continue-menara` again resolves the tell-Raka beat (Nala taps
  his shoulder and repeats the warning) — same borderline pattern as run 1.
- **DeepSeek-V4-Flash config is stable too:** two runs, 4/4 all-clean both times.
  Run-2 notes: `continue-radio` ends with a forward-leaning motivation clause; the recurring
  invented background action persists (`memeriksa teropong` this run vs `memeriksa peta`
  in run 1) — the same beat class as G's borderline case.

### Token economics (recorded usage, this experiment)

| Config | Avg output tokens / call | Output $/M | Output cost / write case |
|---|---|---|---|
| G/G2 gpt-oss-120b | 656–749 (analysis channel billed) | $0.60 | ~$0.0004 |
| J/J2 DeepSeek-V4-Flash | ~110–114 | $0.28 | ~$0.00003 |

At real prompt sizes (~2–4K input tokens in the write graph) both stay fractions of a cent
per generation. J is structurally ~5–6× cheaper on output; G's analysis-channel tokens are
billed as output even when the final text is 60 words.

**Standing state after six rounds:** two stable writer configurations — G (gpt-oss-120b
temp 0.2) and J (DeepSeek-V4-Flash temp 0.2) — mechanically perfect at n=2 runs each;
failure class for both is one recurring background-action beat, not language. Formal Phase 1
acceptance remains the owner's human review over the recorded prose in
`qa/phase1-fewshot/round4/5/6-2026-10-09.jsonl` plus the app-level 4-case pass once a
writer role is wired.

## App-level pass — live Preview `/api/ai`, both accepted models (2026-10-09)

Deployment `inkrya-oqtbo0t5j` (commit `e344755`, the writer-model-choice feature).
Script: `scripts/phase1-app-pass.mjs`; raw: `qa/phase1-fewshot/app-pass-2026-10-09.jsonl`
(8 live calls through the real application route with the standing test account and the
fixture project — the same API a user's browser calls). 7/8 inside range; every
`ai_generations` row persisted with its generation id.

- **gpt-oss-120b via app: 4/4 mechanical** — 61/46/63/52 words. Prose intact, no leaks.
  Note the fixture chapter context (a lab-radio scene) colors word choice ("monitor",
  "laboratorium") — that is the product's real context flow working, not a defect; the
  length/leak/sentence filters all pass.
- **DeepSeek-V4-Flash via app: 3/4 mechanical** — `app-continue-radio` overshot at 73
  words (limit 70); its other three cases pass. Prose carries the same quality class as
  the offline runs (one invented "akademi"/"kode" backstory element, recorded honestly).

**Interpretation:** both accepted models work end-to-end through the live application,
including the writer-model selector, allowlist, sampling, few-shot injection and budgets.
The remaining variance (one overshoot by 3 words) is within the class already documented
in the offline rounds; the standing Phase 1 prose gate now has an app-level artifact for
the owner's formal human review.

## Human review

Pending — mechanical output is a screen only; the gate is a human pass on the prose.
