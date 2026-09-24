# Phase 1 activation evidence — 2026-09-24

Branch: `hackathon/nebius-2026`. **Phase 1 remains INCOMPLETE solely on the Indonesian prose-quality gate. Phase 2 has not started.** The editor/revision, stale-source, application LangSmith readback, and regression gates below passed. Production was not promoted and remains Gateway. Earlier dated checkpoints in this file describe what was *then* pending; the current gate status is recorded here.

## Latest checkpoint: one authorized Plan C LoRA pilot — 2026-09-24 UTC

The last successful authenticated read at approximately 14:12 UTC still showed the **same job Running at 0%, with no checkpoint and a changing last-updated timestamp**. An attempted follow-up at 15:59 UTC could not read the provider: the prior browser session had reset, the account-console browser access was blocked, and automatic review rejected an alternate Nebius console route. The terminal state, actual duration, bill, metrics and checkpoint ID therefore remain **unknown**; no failure, completion or stuck-job conclusion is justified. The [pilot monitoring log and conditional serving-cost analysis](../qa/plan-c/PILOT_V0_1.md) record the observations. No second job, cancellation/restart, inference, or endpoint was made. Read-only provider access is needed to continue monitoring this exact job; Phase 1 remains **INCOMPLETE**.

The user approved one small `gpt-oss-20b` pilot on the previously accepted cost estimate. The unchanged committed synthetic `train.nebius.jsonl` (120 records; SHA-256 `d809ffde13b3fb2031bd7a0ccffa19070af28fa69818aeb4189b9d058e9ed1f7`) was uploaded as Conversational dataset `4455edcfc0f84f728498154941093a58`, version `b2b8cfaad0b8482bbd51e02f636ec51e`. The 30 held-out records and four legacy acceptance cases were **not** included in the training or optional validation slot. One **Supervised Fine-Tuning → LoRA** job, `ftjob-48927a40e28f47ba811ed3e2ac9845d6`, was created for `unsloth/gpt-oss-20b-BF16` with one epoch, batch 8, learning rate 1e-5, rank/alpha 8/8, dropout 0.05, warmup 0.1, packing on and seed 42. The account job overview showed **$2/1M** tokens, matching the accepted approximate $0.105754 token-price component, with no all-in pre-submit bill. The job was **RUNNING** at the initial check; terminal status and actual billing are pending. [Full pilot provenance and provider evidence](../qa/plan-c/PILOT_V0_1.md) will be updated on terminal readback.

Nebius's current model list says fine-tuned inference uses **Dedicated endpoints only**; Dedicated pricing is per GPU hour, billed by minute. Its current Dedicated FAQ says custom fine-tuned weights are **beta and available on request**; account enablement and the exact supported checkpoint template remain unconfirmed. The earlier read-only base-model form quoted one H100 in `eu-north1` at **$4.05/hour or $0.0675/minute**, which is **not a checkpoint-specific or minimum-bill quote**. Provisioning before ready is unbilled under the published policy; the model's actual startup duration and any custom setup charge remain unknown. A 105-billable-minute staged evaluation would be $7.0875 **only if** the checkpoint accepts that same one-H100 rate, excluding tax and other charges. Stop after each stage, with a possible capacity loss on restart. A separate endpoint cost decision is required after job success and **before** deployment or any model evaluation. No endpoint/inference/role change has been made. The earlier reference-editorial audit was not completed; no literary quality claim is made. Phase 1 stays **INCOMPLETE**, Phase 2 blocked, Production Gateway.

## Earlier checkpoint: Plan C `gpt-oss-20b` training cost gate — 2026-09-24 UTC

Plan B was implemented as a bounded experimental adapter, then **failed** the four-case Indonesian prose gate; its full first-pass/repair evidence is in [`qa/phase1-planb-2026-09-24.md`](../qa/phase1-planb-2026-09-24.md). It was not routed into the active application. Plan C now has an **original synthetic 120-train/30-held-out corpus and validator**, described in [`qa/plan-c/README.md`](../qa/plan-c/README.md). The account's authenticated SFT console offered `gpt-oss-20b` LoRA at **$2.00 / 1M tokens for 8K**. The exact Nebius job base ID is `unsloth/gpt-oss-20b-BF16`. The checked base-model tokenizer and chat template measure **52,877 train tokens** and **13,206 sealed held-out tokens**; proposed **one epoch, no validation file** has a **$0.105754 token-price component** before tax, minimum/packing differences or other charges. The console configuration and limitations are recorded in the pilot plan. No published minimum was found in the current SFT/dataset/billing docs; absence of one is **unconfirmed**, and a visible balance is not a spending cap. A full human audit of all reference texts remained before any upload or paid pilot at this earlier checkpoint. No private novel was read, no Nebius file was uploaded, no job was created, and no model or Production setting changed **at that checkpoint**. **Phase 1 remains INCOMPLETE; Phase 2 blocked; Production Gateway.**

## Role-specialized Writer investigation — 2026-09-24 UTC

The [official Devpost rules](https://nebiusglobalaihackathon.devpost.com/rules) require a running Nebius application using *at least one* NVIDIA open-source model; they do not impose Nemotron on every text role. The repository's all-role Nemotron rule was our own extra constraint. Reasoning routes remain NVIDIA Nemotron through Nebius; only the Writer role may select a different authenticated-catalog Nebius model. The provider, privacy-preserving trace, grounding/abstention validation, and explicit no-fallback contract remain. No Writer candidate has been approved or deployed as the active model. The four-case gate remains open.

An exact-commit, read-only authenticated catalog diagnostic in Preview `dpl_6TQUug9pGyKvgPviBFssNb5tm32F` (`0cc132f`, READY) listed account model IDs with **zero inference calls**. Three actual account IDs were shortlisted: `Qwen/Qwen3-235B-A22B-Instruct-2507`, `google/gemma-3-27b-it`, and `Qwen/Qwen3.5-397B-A17B`. They were benchmarked in Writer-only, deliberately non-READY Preview diagnostic builds on commit `9fee270`, each on the *same* four synthetic cases, same Writer prompt and 260-token ceiling, no retries. Only Qwen3.5 used its model-card-documented non-thinking template flag. See [full synthetic outputs and per-case manual review](evidence/phase1-writer-routing-2026-09-24.md).

| Writer model | Diagnostic deployment | Mechanical pass | Human-accepted cases | Representative blocker |
| --- | --- | --- | --- | --- |
| Qwen3 235B Instruct | `dpl_HvAdB56jzonF5jNBPYd6RkbPncdT` | 2/4 | **0/4** | Moved key out of the radio desk drawer, displaced letter, and missed two length limits. |
| Gemma 3 27B IT | `dpl_DZa2XbwpPRMEfoXgDxKp2pHc3Stj` | 2/4 | **0/4** | Nala failed to warn Raka and the lamp only dimmed; invented actions and missed two lengths. |
| Qwen3.5 397B A17B | `dpl_BdwRQaDdPYT7FBpzGod8fajjf13V` | 1/4 | **0/4** | Three length failures; the in-range case invented other person's presence and Damar's actions. |

Total **12/12 bounded synthetic calls**, zero retries, and zero 4/4 candidates. No repeatability run was warranted; `WRITER_MODEL` was **not** set. All currently active Preview text routes still use the stable Nemotron Super baseline; this does not make it an accepted Indonesian surface Writer. The exact-commit paid toggle was set to `disabled` after the last diagnostic. Production remains Gateway. **Phase 1 stays INCOMPLETE; do not begin Phase 2.** At this checkpoint Plan B was proposed; the later bounded experiment and its failure are recorded in the latest checkpoint above. No more blind candidate sampling under this shortlist.

The diagnostic logs show the explicit `role=writer` and exact candidate model ID, but no application generation record or LangSmith run was created for these temporary build calls. The previously read-back **4/4 application LangSmith runs remain Nemotron Super**. The role/model tracing implementation and a synthetic non-Nemotron Writer metadata test assert exact `provider`, `task`, `model`, source count and `content_logging=false`; a live Writer application trace with a newly selected model remains contingent on approving a Writer candidate. Setting an explicit but empty role override now raises a configuration error rather than falling back to the shared model.

Regression on this branch after the role-specific change and benchmarks: **24/24 Node tests pass**, non-incremental TypeScript check passes, clean local Next build passes, and local signed-out HTTP Gateway/Nebius AI/Memory/history smoke passes. The diagnostic build `dpl_9FtztSg49XEUHw6YiiZwgWhYhrzY` (`9fee270`) remained READY while the three intentionally failed Writer evaluation builds did not take its alias. After the paid toggle was disabled, code/documentation commit `856d003` deployed to Preview `dpl_38oJuNpv5bZJQFcZY83rvXs5FfEV` (READY). Read-only `/api/ai` on that deployment returned HTTP 200, `provider=nebius`, Writer `model=nvidia/nemotron-3-super-120b-a12b`, `verification=configuration-only`; the same endpoint on Production returned HTTP 200, `provider=gateway`. No production promotion occurred. These status responses are configuration reports, not proof of accepted prose. The local regressions do not turn failed prose samples into acceptance.

## Current checkpoint — 2026-09-24 UTC

- Recovery-banner fix `cf15dede879c64fc76b3b93036a697f925584e5d` was present on the branch and Preview deployment `dpl_2P2nYHHWfLg32q3G48JqXMUjk417` was READY. Previous authenticated synthetic editor QA produced two sequential saves **8 → 9 → 10** without conflict. After the source revision changed, the Memory panel showed **“Sumber berubah”**, disabled approval, warned about the old revision, and **“Buka bab”** opened the latest revision. The 2026-09-24 component regression covers the same stale approval/navigation behavior without repeating live editor edits. These are the named synthetic fixtures only.
- Persisted application generation IDs `25aa05a9-682c-469e-8133-11d960d9fb57`, `ef0e7bce-3d6a-4130-a691-906bb89a79d6`, `b6c22dd3-1a29-4967-b54d-60709c2fc336`, and `389fde8a-775e-45ee-bdf9-8254da9a25b3` were read back from **their exact LangSmith run IDs** in Preview deployment `dpl_76SmPy53tGmtsXLEeMz3sx7ouUP9` (`68638e0`, READY). Its build recorded four `PHASE1_TRACE` passes and `PHASE1_READBACK {"pass":true,"applicationRuns":4,"inferenceRequests":0}`. These were application runs, not build-fixture runs. A read-only check had confirmed four `ai_generations` rows `complete`, `trace_status=sent`, provider-qualified Super model, and their recorded usage/latency.
- The readback asserted each run ID, workflow/task, `provider=nebius`, `model=nvidia/nemotron-3-super-120b-a12b`, pseudonymized project and user IDs, source count **1**, exact input/output/total tokens and latency, successful completion, and allowlisted metadata-only input/output fields. Project IDs match the two explicitly named synthetic projects below; user IDs in LangSmith are pseudonyms `0dc5222f4987485d2c70083b` and `c1576839504f5a9def9bc034`. Input contains only `input_characters`; output contains only `latency_ms`, `output_characters`, `success`, and numeric `usage`. There was no manuscript, raw prompt, or generated prose in these payloads; the checker also rejects known fixture strings. See `scripts/phase1-readback.mjs`. This validates these four runs and their schema, not every future trace.
- Local regression after readback: **23/23 Node tests**, non-incremental typecheck, Next build, and Gateway/Nebius signed-out AI/Memory/history HTTP checks passed. The additional unit case asserts stale fact approval stays disabled and “Buka bab” targets the current revision. No application inference was made for trace readback.
- The same **23/23 tests**, typecheck, clean local build and Gateway/Nebius HTTP smoke passed again after rolling back unapproved prose changes. Preview `dpl_DYBsAjqJUtBZis9Gqi3Kt2hNELKE` then reached READY on the rollback/documentation commit. No live editor QA was repeated.

### Bounded Indonesian prose evaluation (synthetic only)

The fixed corpus comprised two `continue` and two `rewrite` prompts in Indonesian with 45–70-word requested ranges, one paragraph, POV and continuity constraints. Human review checked natural diction, coherence, instruction/fact adherence and unnecessary foreign words in addition to mechanical length/completion checks. No generated text was applied to a chapter. The baseline and two candidate prompt/budget settings were tested on the same four cases on Nebius Super, without retries, and rejected when the Preview build gate failed:

| Setting / deployment | Measured output words (expected, in case order) | Result |
| --- | --- | --- |
| Baseline in `dpl_J7nydKpPwUQqKzsgkXrvJtGKW9Gm` | **82, 57, 100, 44** (55–70, 50–65, 45–60, 50–65) | Three length failures, invented key location, nonsensical phrase, fabricated word-count suffix; fail. |
| Shorter writing prompt in the same deployment | **100, 65, 97, 81** | Three length failures; foreign `Everything`, fabricated word-count suffix and continuity errors; fail. |
| Shorter prompt and output cap in `dpl_87vsgnhwbNpAKRLmYt8f6pPfbdoq` | **73, 57, 65, 58** | Two length failures. Even passing lengths had `Both`/Japanese characters or invented facts; capped samples ended mid-sentence; fail. |
| Writer thinking mode in `dpl_DE4kvZTTihCFkwJ7xcgW8tu9eHqh` | No prose sample; first `continue-radio` request returned a sanitized `DIAGNOSTIC_FAILED` | No quality result; build failed safely. Provider error details were deliberately suppressed, so the cause is unconfirmed. No automatic retry. |

All three evaluation deployments ended **ERROR** by the opt-in QA gate. Experimental writing-prompt/model-setting changes were rolled back in `bceae918e1257bd05cf4fee2932dd7f2cee91a05`, which deployed to Preview `dpl_DYBsAjqJUtBZis9Gqi3Kt2hNELKE` (**READY**). `INKRYA_VERIFY_PHASE1_COMMIT` was set to `disabled` for Preview so future builds do not make unexpected paid inference. Existing Q&A grounding, abstention validation and revision-safe Memory were not weakened. NVIDIA's Super model card does not list Indonesian among the supported languages; this is a plausible capability constraint, **not** proof that every Indonesian output fails. Do not mark prose or Phase 1 accepted from transport success or a single valid word count.

The remaining gate is a **repeatable 4-case continue/rewrite acceptance pass**, including human review of the actual synthetic prose for length, natural Indonesian, continuity and requested constraints, followed by tests/typecheck/build/HTTP and a READY Preview on the approved code. Model or prompting decisions must be measured; keep Production Gateway and defer Phase 2 until this gate passes.

### Writer-only Nemotron follow-up — 2026-09-24 UTC

After the bounded Super prompt/budget trials above, the authenticated Nebius catalog confirmed `nvidia/Nemotron-3-Ultra-550b-a55b` and `nvidia/Nemotron-3_5-Lightning`. Only the **diagnostic Writer role** changed model; the deployed application's role configuration remained on Super. The original system, JSON request, non-thinking mode, temperature 1, top-p 0.95 and 260-token ceiling were held constant for a two-case pilot (`continue-radio` and `rewrite-radio`). Ultra returned **91/24** words, Lightning **43/42**, versus requested **55–70/45–60**. Both had human-visible failures: Ultra invented a photo and used malformed words; Lightning invented a cassette, changed Damar's action, and produced nonsensical phrases. Preview `dpl_3rSJwPJnZm9sXzUhT1Wm6zYjjQHL` failed its manual-review gate as intended.

With Ultra fixed, changing only the system message to plain English instructions about Indonesian prose produced **57/28** words. The 57-word continuation passed mechanical length but moved the key to Mira's hand and included “gemeris.static”; it failed fact/language review. Adding only a sentence-count hint to the JSON request produced **47/31** words, with an invented moving antenna and a changed radio sound/new lamp. The two further Preview diagnostics `dpl_4qxwFMov8gZn8HAsGMFjhkpbNx97` and `dpl_Et6HuLwBdWtFWFUxjkvojHh6MuXh` failed by the same review gate. In total **8 bounded alternative-model calls**, zero automatic retries, seven mechanical length failures, and no human-accepted sample. No alternative reached the other two cases or a four-case acceptance run. See [the complete synthetic outputs and per-case assessment](evidence/phase1-prose-2026-09-24.md).

NVIDIA's model cards for Super, Ultra and Lightning omit Indonesian from their supported-use language lists. This helps explain the measured failures but does not establish a universal impossibility. All routes remain on the last stable Super runtime, the Preview exact-commit paid toggle was disabled after the diagnostic, and **Phase 1 stays INCOMPLETE**. A different Writer candidate would need catalog verification, the full four cases and manual factual/linguistic review before any role override; do not promote Production or begin Phase 2.

After this follow-up, **23/23 unit tests**, non-incremental typecheck, local Next build, and Gateway/Nebius signed-out AI/Memory/history HTTP smoke passed. Only the opt-in synthetic diagnostic and documentation changed; app inference, grounding/abstention, retrieval, Memory, autosave and Production configuration were not changed.

## Historical follow-up checkpoint — 2026-09-20 UTC

**Phase 1 remains INCOMPLETE. Phase 2 has not started.** The ordered editor gate is still open; do not treat the following component-test results as a complete authenticated acceptance pass.

- Start-of-session remote HEAD was `13f218043b292d7d8546e946297c92afe4e5dc6d`, with Preview `dpl_2LypzFpXbZh8NWrWQjqZwckqeBMk` READY. Production stayed on `ac0dd7de55daade78a6656025df4fd6ec8c9ee65`; no promotion or production configuration change was performed.
- Existing uncommitted editor work was preserved and tested against the remote baseline. TipTap `setEditable` emits `update` by default. The baseline failed two synthetic component tests: opening an unchanged chapter created a save, and a delayed mount save followed by Memory navigation reproduced `Konflik versi`. The first fix suppresses that event. All five initial editor tests passed, including in-flight edits and a real concurrent-revision conflict that preserves the local draft.
- Fix `fd79df06a13877c99fb233b11ce1eb75888b37d0` deployed to Preview `dpl_53V8WBP2ftBZ9qaWTFz5kAUpBXkj` (READY). The branch alias and served JavaScript both confirmed the fix. Opening the synthetic chapter, toggling history, and returning from Memory left server revision **4** and its hash unchanged.
- Live QA used only project `ef1f34a0-6b61-40d1-8d5e-38156bc49046`, chapter `ca6d18f4-83f5-41c9-b896-7c072c681f96`. The first actual edit saved revision **5** with “Mira menutup pintu ruang radio.” The next attempted edit was retained in the browser but encountered a conflict; server revision **6** contained the same text as revision 5. Later read-only database checks observed revisions **7/8**, with unchanged historical text hashes, despite no additional save action from this QA run. The origin of those extra writes is **not established**; a separate session remains a possibility, not a proven diagnosis. Never force-overwrite them.
- Follow-up editor protection compares actual document/title content against the last acknowledged save. Repeated unchanged update events, including events during a save, no longer schedule duplicate writes. Real edits remain queued against the returned revision, real conflicts keep the recovery draft, and rejected transport promises release the saving lock without dropping the draft. This follow-up needs a fresh authenticated browser acceptance run.
- The Memory UI visibly marked all three revision-2 facts `Sumber berubah`, including the previously approved fact, and disabled their approval buttons after revision 4. Read-only database verification still found all three `current=false` at revision 8. The source-detail warning and a full edit → Memory → latest-source UI round-trip remain **unverified**.
- Browser automatic approval review subsequently rejected access to the conflicted editor, including read-only UI inspection, citing possible loss of the unsaved draft on navigation. No forced reload, database repair, or alternate browser workaround was used. The exact synthetic draft is preserved in `docs/evidence/phase1-editor-recovery.json`. Resume only after the user authorizes recovery/reload of this synthetic draft; then check for other active sessions before repeating edits.
- Regression: **21/21 Node test entries passed**, including seven editor component tests; non-incremental TypeScript, Next production build, and HTTP checks for both Gateway/Nebius signed-out AI/Memory/history denial passed. Component tests mock the database and are not browser or RLS proof.
- This follow-up made **zero inference calls**. Application LangSmith IDs have still not been read back; Indonesian prose quality has not been reevaluated. Those gates remain open and must follow the editor/stale-source gate. The four build-fixture readbacks below do not substitute for application trace readback.

Next: recover only the named synthetic fixture, confirm two sequential real edits plus reload preserve the newest text, complete the stale-source UI round-trip, then continue application trace readback and the Indonesian prose acceptance work. Preserve lexical/revision-safe Memory and the documented Phase 2 implementation order.

## Preview configuration

- Provider: `nebius`; all seven text routes: `nvidia/nemotron-3-super-120b-a12b`.
- Official Nebius catalog authenticated successfully and listed Nano, Lightning, Ultra and Super. No role overrides or guessed model IDs.
- LangSmith tracing enabled; API keys stayed in Vercel and were never revealed.
- Nano/Super send `chat_template_kwargs.enable_thinking=false`; Super uses the vendor-recommended temperature 1 and top-p 0.95. Mock transport tests verify those actual request fields.
- No automatic retries or provider/model fallback. No schema change or service-role application access. Only explicitly named synthetic test projects were created/edited; private manuscripts were not opened or modified.

## Live synthetic evidence

Commit `349d9a0a0d18fe23dbd4f9ab7e16108b74f23628` produced these four runs. Model was Nemotron Super; every trace reported sent. Supported Q&A and extraction used exact source IDs/quotes checked by the production validator. The unknown question returned exactly `{"claims":[]}` after the prompt fix.

| Case | Generation / trace ID | Input / output tokens | Inference latency |
| --- | --- | --- | --- |
| Prose transport | `f989b12b-6e56-4eb7-b088-d4bd42b58fdc` | 82 / 164 | 2,113 ms |
| Grounded answer | `33596004-74c9-4ccb-a29d-e780d8b22b79` | 373 / 100 | 1,123 ms |
| Unknown evidence | `0890b3c4-c9ec-4c77-b6a7-31e85a6829b2` | 369 / 7 | 755 ms |
| Fact extraction | `343029d4-7662-4325-b59c-317a1cdfbb4c` | 296 / 194 | 1,366 ms |

The same-build LangSmith readback exceeded its two-second timeout, so that build correctly failed. A separate read-only diagnostic on commit `417e93e7b51137a8b4070b7669a9d54c328c81ac` read and validated all four existing runs with a ten-second per-read ceiling, **zero additional inference calls**, and no retries. It confirmed allowlisted input/output fields, exact usage/latency, pseudonymized project metadata, source counts and `content_logging=false`. The runtime trace-delivery timeout remains two seconds.

[Verification deployment](https://vercel.com/rivaldi-murpias-projects/inkrya/28VxBAh4ooeA9L5C7pcFH5yUvLyr) reached READY. Its build log records four `PHASE1_TRACE` passes and `PHASE1_READBACK {"pass":true,"runs":4,"inferenceRequests":0}`. The exact-commit diagnostic toggle was disabled after collecting this evidence.

## Failures and quality limits

- Initial Nano attempt (`c3a89df`) passed prose transport and supported Q&A, then failed unknown-evidence validation. Its Indonesian prose had incoherent phrases. It was not approved for the initial route.
- First Super attempt (`2971235`) returned a bare `[]` on abstention. The validator correctly rejected it. `349d9a0` clarified that every response, including abstention, must use an object with `claims`. Validation was not relaxed and no automatic output repair was added.
- Super's prose is still not production-quality: the latest sample included awkward/nonsensical phrases such as “speaker koran tua” and an unwanted word-count suffix. The mechanical prose check establishes transport/nonempty output only; it is **not** a quality pass. Further Indonesian writing evaluation and tuning are required before promotion.
- The build-time fixture runs use temporary diagnostic records, not `ai_generations`. Authenticated application checks were performed separately below. Neither set of tests proves complete quota/abuse resistance or a full RLS security audit.
- One small fixture per case is not a retrieval/grounding benchmark or evidence of robust prompt-injection resistance. LangGraph, pgvector, structured canon and Guardian are not delivered here.

## Automated and remaining checks

Fourteen unit test entries, non-incremental TypeScript, a clean local Next build and HTTP smoke checks passed. HTTP smoke checks cover both provider configurations and signed-out denial for AI, Memory and history. The final live deployment also compiled and typechecked successfully.

Preserve the production provider until the remaining quality/revision checks are resolved. Never use the owner's private manuscript for activation fixtures.

## Authenticated application checks

The browser successfully signed in to the hackathon Preview after the redirect fix. The Krya panel showed NVIDIA Nemotron via Nebius. All four application records below have `status=complete`, the exact model `nebius:nvidia/nemotron-3-super-120b-a12b`, and `token_usage.trace_status=sent`. The trace ID is the persisted generation ID. These application trace IDs have not separately been read back from LangSmith; the earlier four build-fixture traces have.

| Application case | Persisted generation ID | Input / output tokens | Latency |
| --- | --- | --- | --- |
| Continue in editor | `25aa05a9-682c-469e-8133-11d960d9fb57` | 300 / 163 | 2,200 ms |
| Ask My Story, supported | `ef0e7bce-3d6a-4130-a691-906bb89a79d6` | 375 / 99 | 1,114 ms |
| Ask My Story, unknown | `b6c22dd3-1a29-4967-b54d-60709c2fc336` | 371 / 7 | 1,062 ms |
| Memory extraction | `389fde8a-775e-45ee-bdf9-8254da9a25b3` | 568 / 194 | 1,434 ms |

- First synthetic project: `4ff67f47-b647-4880-86b7-0040809f5680`, titled `Phase 1 Smoke — Sinyal Aruna (synthetic)`. Initial autosave stored the fixture at revision 2. Opening the generated result from the history UI displayed “Hasil dari riwayat.” The original chapter remained unchanged by generation.
- Grounded Q&A displayed the correct key location with an exact quote and revision-2 citation. The unknown question completed as an abstention with no citations.
- The editor prose failed human quality review: it introduced “Ihram”, used the foreign word “inconscio”, and exceeded the requested length. No generated prose was inserted into the manuscript. This confirms an actual writing-quality issue, not merely a smoke-test format failure.
- On resuming, the user signed in with a different account. Its project list was empty, so the first account's fixture was not visible there. This is a useful UI isolation observation, not a full cross-tenant API/RLS audit.
- Second synthetic project: `ef1f34a0-6b61-40d1-8d5e-38156bc49046`, titled `Phase 1 Memory Smoke — Sinyal Aruna (synthetic)`. Indexing completed, extraction saved a summary and three exact-quote facts, all initially pending. The explicit review button was tested on the supported Damar fact, moving only that synthetic fact to approved.
- Revision test: after returning to the editor and attempting to append a sentence, the UI reported a revision conflict. Database inspection found revision 3 with the original fixture text, not the appended sentence. All three prior facts correctly had `current=false`, including the approved fact. Browser control then timed out during recovery; the stale-source UI and repeat-edit path could not be finished. No forced overwrite or direct database repair was attempted.

The two synthetic projects remain as reproducible test records. Do not delete or treat their facts as the owner's real story canon. Next bounded work: reproduce the editor conflict with one browser session, inspect the save/revision sequence, recheck stale-source UI, and evaluate Indonesian prose before any production promotion.

[Preview](https://inkrya-git-hackathon-nebius-2026-rivaldi-murpias-projects.vercel.app)

## References

- [Nebius authenticated model catalog](https://docs.tokenfactory.nebius.com/api-reference/models/list-models)
- [NVIDIA Super model card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16)
- [Nebius Super catalog](https://tokenfactory.nebius.com/models/catalog/text2text/nvidia%2Fnemotron-3-super-120b-a12b): observed public prices $0.30/M input and $0.90/M output tokens. Account credits/balance were not inspected; this is not a free-model claim or a global budget cap.

## Auth redirect follow-up

The browser's Inkrya sign-in succeeded but landed on Production, leaving Preview signed out. Source inspection found a hardcoded `RETURN_URL=https://inkrya.vercel.app/` in OAuth, signup and resend. The branch now selects the exact owned hackathon Preview origin when signing in there; other origins retain the production destination. A regression test rejects lookalike hosts and other Vercel projects.

Supabase Auth URL Configuration was inspected after secure admin sign-in. Existing project-scoped Preview redirect patterns already covered the hackathon host; no Supabase settings were changed or new wildcard added. Successful signed-in Preview navigation then verified the code fix. Production's Site URL and login behavior were preserved. See [Supabase redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls).
