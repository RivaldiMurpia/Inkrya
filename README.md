# Inkrya — Hackathon Edition in development

Current product authority: [Hackathon PRD](docs/INKRYA_HACKATHON_PRD.md). The existing writing alpha is being upgraded incrementally; it is not the completed hackathon MVP.

Start with [implementation status and phase map](docs/HACKATHON_IMPLEMENTATION.md) and [Nebius/LangSmith setup](docs/HACKATHON_SETUP.md). New Phase 1 code adds Nebius-compatible model routing and privacy-preserving trace support. Activation awaits verified credentials/model IDs; existing Gateway remains the default. No LangGraph, semantic retrieval, Guardian, Tavily or Story Doctor is claimed yet.

## Implemented source

- Next.js App Router and React, Indonesian responsive UI.
- Supabase email/password sign-in and registration (email confirmation required).
- Project list, title search and atomic project + first chapter creation.
- Tiptap rich text editor, chapter creation and navigation.
- Debounced autosave, browser recovery drafts scoped to user/chapter, optimistic revision checks.
- Conflict blocks automatic overwrites; download local text for manual recovery.
- Markdown manuscript export from server records.
- Project content search across chapters, Characters, Story Bible, Notes and Outline; excerpts, pagination and record navigation. Applied live migration: literal_project_search (database/project-search.sql).
- Memory alpha: per-revision chapter chunks, lexical Ask My Story with source links, per-chunk summaries and pending facts with review. Read MEMORY_STATUS.md for verification and remaining Phase 4 requirements.
- Krya AI is configured through Vercel AI Gateway with a zero-price model guard, bounded context, request history and usage limits. User confirmed production AI works. See AI_SETUP.md for setup history.
- Memory indexing runs through database Cron every minute even with the browser closed. Approved current facts help keyword retrieval; pending, ignored and stale facts are excluded.

## Setup

1. Install with `npm ci` using Node.js 22+.
2. Link to the approved Vercel project and verify Supabase connection.
3. The connected Inkrya project already has `inkrya_foundation` applied. Do not reapply it. For a fresh project only, apply `database/foundation.sql` as a named migration, then check RLS advisors.
4. Add the final deployment URL to Supabase Auth Site URL and allowed redirect URLs.
5. `npm run typecheck`, `npm run build`, then run the app and verify authentication and saving.

The project URL and publishable key in lib/supabase.ts identify this specific Inkrya backend. They are public client configuration, not privileged credentials. No service-role key is used. Database authorization relies on RLS, not UI checks.

## Required verification before release

- Run two-user isolation tests against all tables and RPCs.
- Create project, save chapter, reopen and compare JSON and text.
- Race two saves with the same revision: exactly one must succeed.
- Simulate offline editing, reload and recover local draft.
- Test save response loss and local draft recovery.
- Verify signup email redirects and logout.
- Check desktop/mobile layout and keyboard/modal accessibility.

## Known limitations

- Only foundation alpha, not PRD V1 acceptance-complete.
- Single application route; deep-linked project routes remain pending.
- No password recovery UI yet.
- No chapter reorder, deletion, archive or duplication yet.
- Local recovery uses localStorage, not a full offline queue; never treat this as a production backup.
- Version history UI is available from the editor's Riwayat button: comparison, TXT download and restore as a new revision. Browser interaction QA remains pending.
- Full chapter list fetch will need optimization before long-form scale tests.
- Characters, Story Bible, flat Outline and Notes are implemented with manual save, revision checks and archive/restore (except Bible). Apply database/story-planning.sql only on fresh databases after foundation; live Inkrya already has this migration.
- No outline hierarchy/board, RAG or DOCX export yet. AI generation code exists but real provider generation has not been verified.
- Native confirmation dialogs; custom accessible dialog behavior still needs hardening.
- No billing or analytics configured.

Continue with data safety verification before adding AI features. Do not claim deployed or database-ready until verified.
