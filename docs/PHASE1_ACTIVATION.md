# Phase 1 activation evidence — 2026-09-20

Branch: `hackathon/nebius-2026`. Infrastructure activation and authenticated generation/Memory checks passed. **Release acceptance remains incomplete**: Indonesian prose quality and an observed revision-conflict path need follow-up. Production was not promoted and remains Gateway.

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
