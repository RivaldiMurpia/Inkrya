# Phase 1 activation evidence — 2026-09-20

Branch: `hackathon/nebius-2026`. Infrastructure live checks passed; **Phase 1 acceptance remains incomplete** until authenticated application/history/autosave/Memory review and writing-quality checks pass. Production was not promoted and remains Gateway.

## Preview configuration

- Provider: `nebius`; all seven text routes: `nvidia/nemotron-3-super-120b-a12b`.
- Official Nebius catalog authenticated successfully and listed Nano, Lightning, Ultra and Super. No role overrides or guessed model IDs.
- LangSmith tracing enabled; API keys stayed in Vercel and were never revealed.
- Nano/Super send `chat_template_kwargs.enable_thinking=false`; Super uses the vendor-recommended temperature 1 and top-p 0.95. Mock transport tests verify those actual request fields.
- No automatic retries or provider/model fallback. No schema change, service-role use, or manuscript modification.

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
- Synthetic fixture runs use temporary diagnostic records, not `ai_generations` in the application database. They do not prove authenticated persistence, quota, RLS, autosave or Memory review.
- One small fixture per case is not a retrieval/grounding benchmark or evidence of robust prompt-injection resistance. LangGraph, pgvector, structured canon and Guardian are not delivered here.

## Automated and remaining checks

Fourteen unit test entries, non-incremental TypeScript, a clean local Next build and HTTP smoke checks passed. HTTP smoke checks cover both provider configurations and signed-out denial for AI, Memory and history. The final live deployment also compiled and typechecked successfully.

The Preview application currently presents a login screen in the verification browser. Next: authenticate securely, create/use a synthetic test project, generate through Krya, inspect the persisted generation and correlated trace, then exercise Ask My Story, extraction, autosave and human review. Preserve the production provider until those checks and prose quality are acceptable. Never use the owner's private manuscript for activation fixtures.

[Preview](https://inkrya-git-hackathon-nebius-2026-rivaldi-murpias-projects.vercel.app)

## References

- [Nebius authenticated model catalog](https://docs.tokenfactory.nebius.com/api-reference/models/list-models)
- [NVIDIA Super model card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16)
- [Nebius Super catalog](https://tokenfactory.nebius.com/models/catalog/text2text/nvidia%2Fnemotron-3-super-120b-a12b): observed public prices $0.30/M input and $0.90/M output tokens. Account credits/balance were not inspected; this is not a free-model claim or a global budget cap.

## Auth redirect follow-up

The browser's Inkrya sign-in succeeded but landed on Production, leaving Preview signed out. Source inspection found a hardcoded `RETURN_URL=https://inkrya.vercel.app/` in OAuth, signup and resend. The branch now selects the exact owned hackathon Preview origin when signing in there; other origins retain the production destination. A regression test rejects lookalike hosts and other Vercel projects.

The exact Preview root URL must also be allowed in Supabase Auth URL Configuration; its remote allowlist has not yet been verified because the dashboard requires a separate sign-in. Keep the production Site URL as is. Do not add broad Vercel wildcards. See [Supabase redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls). No authenticated Preview AI call has been made yet.
