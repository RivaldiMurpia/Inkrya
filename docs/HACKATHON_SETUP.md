# Hackathon Phase 1 activation

Do not paste keys into chat, source files, screenshots or public repository commits. Store them in Vercel project environment variables (start with Preview) and optionally a local ignored `.env.local`.

## 0. Database migrations

The live Inkrya project (`ecurjotykfqiejrpczdm`) already has every migration applied. For a FRESH database only, apply these as named Supabase migrations in order — never reapply on an existing project:

1. `database/foundation.sql` — projects, chapters, versions, `create_story`, `save_chapter`.
2. `database/krya.sql` — `ai_generations`, quota trigger.
3. `database/story-planning.sql` — Characters, Story Bible, Outline, Notes.
4. `database/memory.sql`, `database/memory-phase2.sql`, `database/memory-hybrid-retrieval.sql`, `database/memory-phase3.sql`, `database/memory-phase3-retrieval.sql` — chunks, insights, facts, embeddings, retrieval RPCs.
5. `database/agent-writing.sql` — `ai_generations.action` gains `'write'`.
6. `database/memory-phase5.sql` — `canon_proposals` + canon RPCs (`canon_update_phase5`).
7. `database/doctor-phase6.sql` — `ai_generations.action` gains `'doctor'` (`doctor_action_phase6`).
8. `database/phase7-research.sql` — `ai_generations.action` gains `'research'` (`research_action_phase7`) and the Tavily credit meter RPC (`research_credit_usage_phase7`).
9. `database/eval-fixture-phase8.sql` then `database/eval-fixture-phase8-canon.sql` — the synthetic evaluation fixture corpus (Phase 8). **Three-step apply, in order:** apply the base file (`eval_fixture_phase8_base`), call `public.process_memory(<fixture id>)` as the owner until it returns `processed:false` (this is the real chunking path), then apply the canon file (`eval_fixture_phase8_canon`). The canon file's joins require the chunk rows the middle step creates.

Steps 5, 7 and 8 discover and replace the auto-named action CHECK constraint; on a fresh database run them in this order or the later one finds the constraint the earlier one already widened (idempotent outcome either way). Check RLS advisors after applying.

## Evaluation (Phase 8) — how to re-run

The fixture project id is `bbbbbbbb-bbbb-4bbb-8bbb-000000000001` (`Eval Fixture — The Last Signal`), owned by the standing test account. Every step below uses that account; nothing here touches the owner's own projects.

```bash
npm ci
# .env.local needs NEBIUS_API_KEY (baseline arm) and EVAL_PASSWORD (test account).
source .e2e_eval_env.sh        # INKRYA_PREVIEW_URL, EVAL_PASSWORD, VERCEL_BYPASS_SECRET
node --env-file=.env.local scripts/eval-build-context.mjs   # refresh the guardian context
node --env-file=.env.local --experimental-strip-types scripts/eval-runner.mjs \
  --arm both --bypass "$VERCEL_BYPASS_SECRET"
```

The runner writes `qa/eval/results-<date>-both.json`. Upload the dataset to LangSmith with
`node --env-file=.env.local scripts/eval-upload-langsmith.mjs` (exits `SKIPPED_NO_KEY` when
`LANGSMITH_API_KEY` is absent — the report then records repo-only).

A Vercel bypass link expires after ~24 hours: mint a fresh one, fetch the preview root with
`?_vercel_share=<token>` once, and save the `_vercel_jwt` cookie. The runner sends it as a
`Cookie` header. Without it every request is intercepted by deployment protection.

## 1. Obtain and configure credentials

Required now: `NEBIUS_API_KEY`, `LANGSMITH_API_KEY`. Optional for organization-scoped LangSmith keys: `LANGSMITH_WORKSPACE_ID`. `TAVILY_API_KEY` powers the Phase 7 research panel (it fails closed with 503 without it); `TAVILY_DAILY_CREDITS_PER_USER` (default 24) and `TAVILY_MONTHLY_CREDITS` (default 500) tune the separate Tavily credit meter — these are not the 20/24h LLM quota. No additional chat plugin is required to call these application APIs.

Use `NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1`. Alternate arbitrary endpoints are deliberately rejected. Never use a `NEXT_PUBLIC_` prefix for these keys.

## 2. Verify catalog before selecting models

When keys are write-only secrets in Vercel, enable `INKRYA_VERIFY_NEBIUS_BUILD=true` for Preview. The `prebuild` hook runs the catalog-only script inside Vercel and prints the available Nemotron IDs, never the key. A failed check stops that build; a successful catalog check is not inference verification. Keep this optional flag scoped to Preview during activation.

With Node.js 22.18+ and the private local environment file:

```bash
npm ci
node --env-file=.env.local --experimental-strip-types scripts/nebius-preflight.mjs --list-models
```

This lists NVIDIA Nemotron IDs actually visible to the configured key. It sends no manuscript and makes no inference request. Choose a model available under your Nebius account/credits; verify its current price and reasoning behavior in the Nebius console. Do not copy the synthetic model IDs from tests.

Set `NEBIUS_TEXT_MODEL` to the exact selected ID as a common initial route. Optional role overrides: `ROUTER_MODEL`, `MEMORY_MODEL`, `PLANNER_MODEL`, `WRITER_MODEL`, `CONTINUITY_MODEL`, `CRITIC_MODEL`, `QA_MODEL`. Future embeddings use a separately selected `EMBEDDING_MODEL`; not implemented yet.

```bash
node --env-file=.env.local --experimental-strip-types scripts/nebius-preflight.mjs
```

## 3. Opt in on Preview

Set `INKRYA_AI_PROVIDER=nebius`, `LANGSMITH_TRACING=true`, `LANGSMITH_PROJECT=inkrya-hackathon`. LangSmith default region is `https://api.smith.langchain.com`; EU endpoint is also allowed. Redeploy after environment changes. Existing production is not automatically switched by adding a key alone.

Using Nebius is a change from the previous zero-price Gateway model: it may consume hackathon credits and can incur charges. Set available provider-side budget limits and keep activation controlled. This release has request/token bounds and existing per-user quotas, not a global dollar cap.

## 4. Acceptance checks (authenticated, synthetic story only)

1. `/api/ai` reports provider `nebius`, configured true, expected model. This is configuration status only.
2. Submit one short Krya request on a synthetic project. Confirm the visible output is usable prose with no reasoning text.
3. Inspect the same `ai_generations` record: model starts with `nebius:`, output persisted, usage/latency present, `trace_status=sent` when tracing is enabled. UI quota still applies.
4. Check the correlated LangSmith run ID equals generation ID. Confirm there are counts and pseudonymized IDs, but no manuscript/prompt/output content.
5. Run Ask My Story and extraction on synthetic evidence; validate citations and revision behavior. Trace success alone is not evidence of grounding.
6. Verify bad credentials/unavailable model stop with a safe error; no silent Gateway substitution. Do not test by consuming large outputs.
7. Confirm signed-out generation and history remain denied; retest login, autosave and Memory review in a browser.
8. Only promote after these checks. Rollback provider by setting `INKRYA_AI_PROVIDER=gateway` and redeploying; existing Gateway zero-price guard remains.

## Automated verification (no paid calls)

```bash
npm run test:unit
npm run typecheck
npm run build
npm run test:http
```

The transport tests mock Nebius and LangSmith; they do not prove real credentials, credits or model capability. Unit tests are currently Node's built-in runner. Vitest and Playwright remain later PRD test-harness work.

## Publishing this checkpoint

The repository is `https://github.com/RivaldiMurpia/Inkrya`. Vercel's Git integration is confirmed. The initial README-only deployment failed with `missing_pages_app`. Complete source commit `d829eca98259fff4d791f023664d418068850ed6` resolved that error: deployment `dpl_4zPCcZ9SQ3LVPAVmWoS38ffnE1uy` is READY on `https://inkrya.vercel.app` (verified 2026-09-19).

Activation continued on 2026-09-20: Preview now selects Nebius with `nvidia/nemotron-3-super-120b-a12b` for all seven text roles and enables LangSmith tracing. Production remains Gateway. Credentials were used inside Vercel without exposing their values. See `PHASE1_ACTIVATION.md` for live evidence and remaining acceptance gates. Do not infer integration success from build success or key presence alone.

Use `hackathon/nebius-2026` for subsequent implementation and Preview verification. The connected direct deploy operation returned `Tool deploy_to_vercel not found`; the Git integration is the available publishing path. Do not extract or repurpose connector credentials or fabricate deployment URLs. Record actual build and inference results before declaring this checkpoint released.

## Verified reference interfaces

- [Nebius quickstart](https://docs.tokenfactory.nebius.com/quickstart): official endpoint and OpenAI-compatible API.
- [Nebius model catalog](https://docs.tokenfactory.nebius.com/api-reference/models/list-models): authenticated list of available models.
- [LangSmith manual instrumentation](https://docs.langchain.com/langsmith/annotate-code): explicit trace control. This implementation uses Client APIs and allowlisted metadata, not raw auto-tracing.

Installed package source/types were checked for AI SDK generation, compatible-provider configuration and LangSmith Client methods. Pinned dependencies and the lockfile are required.

## Bounded live diagnostics

`scripts/phase1-smoke.mjs --allow-credit-usage` makes at most four sequential model calls (1,750 output tokens maximum in total; no automatic retries) against fixed synthetic prose, grounded Q&A, abstention and extraction fixtures. It uses production provider/generation/prompt/validation modules. Synthetic output is deliberately logged for human quality review; application prompts and manuscript contents remain excluded from logs and traces. A mechanical prose pass is not a writing-quality benchmark.

For a Vercel build, set `INKRYA_VERIFY_PHASE1_COMMIT` to one exact commit SHA on the hackathon Preview branch. Read-only verification of the recorded runs is the default. Set `INKRYA_VERIFY_PHASE1_MODE=smoke` only to explicitly request new inference. Redeploying the same opted-in SHA in smoke mode repeats those calls. Clear/disable the SHA after collecting evidence. The historical `phase1-readback.mjs` fixture checks the four runs from commit `349d9a0`; it is not a general benchmark or proof about a later model change.

The runtime keeps a two-second trace-delivery timeout; the read-only administrative diagnostic permits ten seconds per run. Neither changes the application's inference timeout or retries. The diagnostics do not log in, reserve an application database generation, exercise RLS or verify autosave. Those gates still need an authenticated browser session.
