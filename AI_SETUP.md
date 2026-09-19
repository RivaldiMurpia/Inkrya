# Krya AI activation

## Selected free configuration (2026-09-14)

Krya now uses `inclusionai/ling-3.0-flash-vl-free` exclusively. Both input and output rates were verified zero in the live Gateway model catalog. Each request rechecks zero pricing before generation; no paid model fallback is configured. Free availability and rate limits may change.

Vercel OIDC successfully authenticated a synthetic generation during deployment. With `reasoning: 'none'`, the model returned coherent Indonesian opening prose (67 output tokens, 98 input tokens). This smoke test is not a comprehensive quality evaluation or full authenticated browser workflow test.

Authentication presence now uses `getVercelOidcToken()` so runtime request-context tokens are supported. A separate API key is optional. `KRYA_MODEL` is no longer used; the explicit free model is in lib/krya-model.ts. Future deployments should use ordinary `npm run build`; the smoke script is manual QA only.

References: https://vercel.com/ai-gateway/models/ling-3.0-flash-vl-free and https://vercel.com/docs/ai-gateway/pricing.

The current release implements a bounded-context writing assistant, not full novel RAG. It does not insert or overwrite manuscript text. Authors review and copy suggestions.

## Owner setup

In Vercel → inkrya → Settings → Environment Variables (Production), set:

- Model: already fixed to the selected free variant in code; no model variable required.
- `AI_GATEWAY_API_KEY`: a Gateway key stored as a sensitive server-only value. Vercel OIDC may be used instead when configured and authorized.

Redeploy after setting variables. GET /api/ai reports configuration presence, not credit availability or successful generation. Check Gateway spending limits and credits in the owner dashboard; the app does not purchase credits or enable automatic top-ups.

Never paste API keys into chat, source files or NEXT_PUBLIC variables. Azure is not yet connected; using Azure instead requires its endpoint/deployment configuration and provider adapter.

## Implemented safeguards

- Server validates Supabase user token and reads project context under user RLS.
- Optional current saved chapter, Bible, opted-in characters and opted-in notes. Archived records excluded. No automatic chat-history context.
- Context limited to 22,000 characters total / 12,000 per source, up to 20 characters and 10 notes. Continue uses the final 12,000 chapter characters. Limits are visible in UI; this is not exhaustive retrieval.
- Prompt max 2,000 characters; rewrite text max 4,000. Output max 1,400 tokens; 45 second model timeout; automatic model retries disabled.
- Persistent request reservation before model call; 20 attempts per rolling 24 hours across projects and 10 second spacing. Failures consume allowance. No deletion privilege; project deletion retains the quota ledger with project_id null.
- Each request has a UUID, stored model/status/context source labels/token usage. GET /api/ai/[id] requires a valid Bearer token and owner access.
- Cost field remains null until trustworthy per-model pricing is configured; never treat null as zero.
- If saving generated output fails, return output and a warning so the author can copy it. Model failures return sanitized errors. No secret or manuscript logging.
- History is owner-editable via limited RLS column grants and is not an authoritative billing ledger. Usage reservations and timestamps cannot be changed by clients.

## Still pending

Real provider generation test after activation; authenticated browser QA; streaming, multi-turn conversations, semantic retrieval/embeddings, citation verification, automatic inline Accept/Discard with selection anchors, durable retries and independent usage billing.

## Smoke test after activation

1. Create a test character and Bible; opt a note out. Ask a factual question with these context switches enabled. Inspect listed context and confirm opted-out note is absent.
2. Request rewrite of a copied paragraph; inspect output, copy and paste manually. Original chapter must be unchanged until paste.
3. Request continuation with the active chapter enabled; reload and reopen latest history.
4. Try a second request within ten seconds, then check another user's request UUID is inaccessible.
