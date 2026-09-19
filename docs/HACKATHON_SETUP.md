# Hackathon Phase 1 activation

Do not paste keys into chat, source files, screenshots or public repository commits. Store them in Vercel project environment variables (start with Preview) and optionally a local ignored `.env.local`.

## 1. Obtain and configure credentials

Required now: `NEBIUS_API_KEY`, `LANGSMITH_API_KEY`. Optional for organization-scoped LangSmith keys: `LANGSMITH_WORKSPACE_ID`. `TAVILY_API_KEY` is needed for Phase 7, not this release. No additional chat plugin is required to call these application APIs.

Use `NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1`. Alternate arbitrary endpoints are deliberately rejected. Never use a `NEXT_PUBLIC_` prefix for these keys.

## 2. Verify catalog before selecting models

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

The deployed runtime reports Gateway selected and tracing disabled. The owner has reported adding API keys, but remote secret values/scopes were not inspected. Set the provider/model/tracing configuration described above in the intended environment and redeploy before the authenticated acceptance checks. Do not infer integration success from build success or key presence alone.

Use `hackathon/nebius-2026` for subsequent implementation and Preview verification. The connected direct deploy operation returned `Tool deploy_to_vercel not found`; the Git integration is the available publishing path. Do not extract or repurpose connector credentials or fabricate deployment URLs. Record actual build and inference results before declaring this checkpoint released.

## Verified reference interfaces

- [Nebius quickstart](https://docs.tokenfactory.nebius.com/quickstart): official endpoint and OpenAI-compatible API.
- [Nebius model catalog](https://docs.tokenfactory.nebius.com/api-reference/models/list-models): authenticated list of available models.
- [LangSmith manual instrumentation](https://docs.langchain.com/langsmith/annotate-code): explicit trace control. This implementation uses Client APIs and allowlisted metadata, not raw auto-tracing.

Installed package source/types were checked for AI SDK generation, compatible-provider configuration and LangSmith Client methods. Pinned dependencies and the lockfile are required.
