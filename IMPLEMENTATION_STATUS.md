# Inkrya implementation checkpoint

## Hackathon upgrade — 2026-09-19 (current authority)

The supplied Hackathon PRD supersedes the older roadmap. Phase 1 provider/routing/metadata-tracing code is implemented; live Nebius/Nemotron inference and LangSmith activation remain unverified. Gateway stays default. Read docs/HACKATHON_IMPLEMENTATION.md for the exact delivered scope, phase map and remaining gates, and docs/HACKATHON_SETUP.md for private credential setup. Earlier entries below are chronological history, not current completion claims. No new database migration in this increment.

Verification: 12 Node test entries, clean typecheck, production build and local unauthenticated HTTP smoke checks PASS. Preview deploy was not created because the Vercel connector returned `Tool deploy_to_vercel not found`; live alpha unchanged. No credentials were requested in chat or embedded in code. This checkpoint is source-only pending deployment access and runtime configuration.

## Inkrya Memory alpha — latest work

- Latest follow-up deployment dpl_E5kez4ZFYbxpiAFVeEvzBCiURySf is READY at https://inkrya.vercel.app. Autonomous indexing and approved-fact keyword retrieval are active. The deployment below is the preceding Memory release.
- Final deployment dpl_9r87s8C84hgHqKBvANVpXSeQ7aW2 verified READY at https://inkrya.vercel.app with normal npm run build. Prior dpl_DUoFPhax1jc4RXgFFb5HeRPMTVLT ran and passed the three live model smoke cases. Final typecheck passed.

- Revision-safe durable indexing, lexical Ask My Story with validated source references, per-chunk summaries and pending fact review implemented. See MEMORY_STATUS.md for exact scope, tests and outstanding Phase 4 requirements.
- Integration suite passed on synthetic 100k+ words, stale-revision exclusion, exact offsets and cross-user/project isolation. Live model smoke tests passed for known question, unknown-question abstention and fact extraction.
- Follow-up: database Cron now indexes up to five due chapters every minute while the browser is closed. Approved current facts add keyword matches; answers still cite original text. Additional integration checks passed for fact status filtering, private-core RLS and scheduler dispatch. See MEMORY_STATUS.md.
- No free Gateway embedding model found; semantic embeddings/hybrid retrieval not activated. Do not mark Phase 4 complete.

## Literal project search — latest release

- Deployment dpl_BaXoccZ6GJH8G5PgQBFZ22w9qgZM verified READY at https://inkrya.vercel.app.

- New sidebar action Cari isi proyek. Case-insensitive literal phrase search across current chapters, character fields/aliases, Story Bible, Notes and Outline. Archived planning entries and chapter versions excluded.
- RPC search_project uses SECURITY INVOKER plus explicit project ownership and table RLS. Query length 2–100 characters. No wildcard interpretation or AI calls. Returns excerpts only, 20 displayed results per page plus lookahead.
- Search results open the matching chapter or selected planning entry. Search navigates to the record, not an exact highlighted editor position. Unsaved navigation confirmation remains in place.
- Database migration literal_project_search applied. Tests passed for five source types, phrase matching, literal percent, archive exclusion, same-user project isolation, pagination and cross-user denial. Synthetic fixtures rolled back.
- Build/TypeScript passed. Browser interaction and long-manuscript performance tests remain pending. Current search scans authorized project text using strpos; it is not semantic/vector retrieval.
- Next: chunking, retrieval and source-backed Ask My Story. Do not call this full Story Memory.

## Chapter version history — newest release

- Production deployment dpl_9fWbLyo75g9ZHLcpE4gsmX1obMvi verified READY at https://inkrya.vercel.app.

- User confirmed Krya AI is working. Next delivered slice: chapter version review and restoration.
- Editor toolbar now opens Riwayat. Fetches 25 historical metadata rows per page, then the selected full snapshot only.
- Side-by-side plain-text comparison with current saved chapter; TXT download; confirmation before restore.
- Restore reuses save_chapter under RLS and row lock, creating a new revision while preserving current contents as a snapshot. Rich-text JSON is restored intact.
- Pending/local-recovery/conflicted drafts block history opening. Editor is read-only while history is displayed. Restore uses expected current revision to reject stale tabs.
- Backend transaction tests PASS: rich text/title restore, revision increment, previous current version preserved, stale restore rejection, cross-user history and restoration denied. Synthetic fixtures rolled back.
- Production build/TypeScript passed. Full authenticated browser interactions still not independently verified.
- No new schema migration needed for this slice.

## Free Gateway activation — newest update

- Final deployment dpl_6uhEQsuG221SSGdVBawi2mG9BiHb READY; production GET /api/ai verified configured:true and selected free model. Build/TypeScript and free-price guard tests passed. Full signed-in UI generation remains untested by agent.

- User selected Vercel AI Gateway free model. Chosen inclusionai/ling-3.0-flash-vl-free, input/output price zero verified in live catalog.
- Live Gateway synthetic test via Vercel build OIDC succeeded. Initial output contained reasoning; setting reasoning none produced direct Indonesian prose. No manuscript data used in QA.
- Per-request free pricing guard rejects nonzero, missing or unavailable catalog data; no paid fallback.
- Runtime token detection corrected to getVercelOidcToken; build and runtime tokens have different access mechanisms.
- Earlier KRYA_MODEL requirement below is superseded. Build QA script should not be run automatically in future deployments.

## Krya assistant backend — latest checkpoint

- Added AI SDK 7.0.99 (lockfile), POST /api/ai, GET configuration status, owner-authenticated GET /api/ai/[id].
- Krya panel: chat questions, pasted-text rewrite, chapter continuation and brainstorm. Explicit context switches; results reviewed and manually copied to manuscript. History saved per project, last 20 shown. No automatic manuscript mutation.
- Migration krya_generations applied. Request reservations, daily/rate limits and limited update grants enforce quota persistence.
- Tests PASS: context size/truncation, record create/result update, rate limit, immutable timestamp and deletion denial, cross-user history isolation. Fixtures rolled back. Build and TypeScript passed.
- Real model activation remains blocked on KRYA_MODEL and valid Gateway credentials/authorized Vercel OIDC. No local AI credentials found. See AI_SETUP.md.
- Deployment dpl_A1tBH7gHcaNaCxGkMdtaJPHDjavp verified READY at https://inkrya.vercel.app.
- Local HTTP checks passed: unauthenticated generation and history return 401; unconfigured status returns false. Supabase advisor reports one existing Auth warning (leaked password protection disabled), no database security findings.
- Still no full RAG, streaming, multi-turn context, inline accept, confirmed generation pricing or live provider test. Do not claim Krya is generating until activated and tested.

## Current release — story planning alpha

- Login confirmed working by owner after OAuth provider and redirect configuration.
- Google and GitHub provider availability was verified enabled. Historical duplicate email signup error has no independent retest of the email/password duplicate case.
- Added Characters, Story Bible, Outline and Notes with real Supabase persistence per project.
- Characters: aliases, role, description, appearance, personality, background, goals, fears, arc and future AI context preference.
- Story Bible: premise, synopsis, themes, tone, style instructions and world rules.
- Outline: flat ordered list, item type, drafting status and optional chapter link. Position is entered manually; no hierarchy, drag-and-drop or board yet.
- Notes: title, category, body; AI context opt-in defaults off.
- Archive/restore for Characters, Notes and Outline. Optimistic revision checks protect existing records. Navigation and page-close warning for unsaved forms. Planning forms require manual Save and have no offline recovery.
- Migration inkrya_story_planning applied (20260914000301). Existing manuscript/auth records preserved.
- Database transaction tests PASS: inserts in all four tables, revision trigger, stale update rejection, cross-user reads and unauthorized writes. Test fixtures rolled back.
- Production build/TypeScript passed. Browser interaction verification still pending; previous browser runtime unavailable.
- Deployment dpl_bhdBnL2CqTDnXcx2koaa2YQj6f6a verified READY, production alias https://inkrya.vercel.app.

## Infrastructure

- Supabase project: ecurjotykfqiejrpczdm, Singapore.
- Vercel project: prj_eGIp5munlVHlLafyRUzSqKK5OeGq.
- Vercel team: team_TxKmQ8NNnLqQmZCoRrHfvF3X.
- Canonical URL: https://inkrya.vercel.app.
- Connected Vercel tools deploy successfully; CLI auth is separate.
- Foundation migration inkrya_foundation already applied. Never reapply existing migrations.

## Existing foundation

Project creation, first chapter, Tiptap editor, autosave, chapter snapshots, stale-save rejection, local draft recovery and Markdown export are implemented. Prior database transaction tests passed.

## Next work

1. Authenticated browser verification: create/edit/reload/archive/restore each planning module; unsaved navigation; concurrent edits; mobile layout.
2. Version review/restore, editor recovery hardening and password recovery.
3. Configure approved AI provider, then Krya AI chat/rewrite/continue and RAG with context consent enforced.
4. Complete remaining PRD gates: full outline hierarchy/board, DOCX, project routes and long manuscript scale tests.

This is an incremental alpha, not a completed PRD MVP. Do not claim AI generation or memory is active.
