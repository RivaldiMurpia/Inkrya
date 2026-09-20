# Inkrya Story Memory 2.0 — Architecture Contract

Status: Hackathon design authority

This document records the agreed Story Memory 2.0 direction for the Inkrya Hackathon Edition. It is an implementation contract, not a claim that every component below is already delivered.

## 1. Product thesis

Inkrya is not positioned as a generic AI writing assistant. The hackathon edition is an **agentic story reasoning system / narrative intelligence platform** for long-form fiction.

Its core promise is that generated prose should be grounded in persistent story evidence, structured narrative state, temporal context, and character knowledge rather than only the most recent prompt window.

The system should be able to:

- retrieve evidence from long manuscripts;
- represent persistent story facts and events;
- distinguish reader/world truth from character knowledge;
- reason across narrative order and story time;
- detect continuity problems before presenting a final draft;
- propose new canon without silently mutating accepted canon;
- preserve citations and revision lineage for every important memory claim.

## 2. Two-layer memory model

Story Memory is split into two complementary layers.

### 2.1 Evidence Memory

Evidence Memory answers: **Where is the textual evidence?**

It contains revision-safe manuscript material such as:

- chapter chunks;
- source chapter and revision;
- source offsets;
- lexical text;
- embeddings when enabled;
- chunk summaries where useful;
- citation metadata.

Evidence Memory is the grounding layer. Structured memory must remain traceable to evidence whenever the source is manuscript-derived.

### 2.2 Narrative Memory

Narrative Memory answers: **What is currently established in the story world?**

It contains structured representations such as:

- entities;
- atomic facts;
- events;
- relationships;
- character knowledge;
- story-time intervals;
- canon lifecycle state;
- narrative/world state relevant to a scene.

Narrative Memory must not replace Evidence Memory. It is a reasoned index over evidence.

## 3. Core design principles

1. **Evidence before assertion.** Important story claims should carry source chapter, source revision and evidence references.
2. **No silent canon mutation.** AI-generated information is proposed before it becomes canon unless the accepted-manuscript workflow explicitly documents automatic derivation.
3. **Narrative order is not story time.** Flashbacks, flash-forwards and parallel chronology must be representable without relying on chapter number.
4. **Absence is not negation.** Missing character knowledge means unknown/unestablished, not proof that the character does not know something.
5. **Revision safety is mandatory.** Invalidated source revisions remain history but must not be treated as current active evidence.
6. **Retrieval is multi-signal.** Semantic similarity is only one signal alongside lexical match, entity match, canon state and temporal constraints.
7. **Agents consume controlled context.** Planner, Writer, Guardian and Critic should receive a normalized Story Context package rather than unrestricted raw database access.
8. **Human agency remains central.** Suggestions, repairs and canon proposals are reviewable; the system must not silently overwrite manuscript or accepted canon.

## 4. Entity model

Use a deliberately small first-class entity vocabulary for the hackathon implementation:

- `character`
- `location`
- `organization`
- `object`
- `concept`
- `event` may be represented through the event model rather than duplicated as a generic entity when unnecessary.

Suggested logical structure:

```text
story_entities
- id
- project_id
- entity_type
- canonical_name
- aliases
- description
- metadata
- created_at
- updated_at
```

The implementation should prefer one generic entity table over many specialized tables unless a specialized table is justified by behavior, indexing or integrity requirements.

## 5. Atomic facts

A **fact** is the primary structured unit of Narrative Memory.

Examples:

```text
Arka  -- sibling_of --> Mira
Arka  -- age ---------> 29
Mira  -- owns --------> Silver Pendant
```

Suggested logical structure:

```text
story_facts
- id
- project_id
- subject_entity_id
- predicate
- object_entity_id nullable
- object_value nullable
- fact_type
- canon_state
- valid_from nullable
- valid_until nullable
- introduced_at_story_time nullable
- revealed_in_chapter_id nullable
- source_chunk_id nullable
- source_revision nullable
- confidence nullable
- created_at
- updated_at
```

`object_entity_id` and `object_value` coexist because some facts relate two entities while others attach scalar/textual values.

## 6. Canon lifecycle

Do not reduce canon state to a boolean `approved` flag.

The target lifecycle is:

```text
PROPOSED
CANON
RETRACTED
CONFLICTED
```

### PROPOSED

New information suggested by generation, extraction or a canon-diff step but not yet accepted as hard canon.

### CANON

Accepted story truth that may be used as strong continuity evidence.

### RETRACTED

Previously accepted information that is no longer active because the manuscript or author intent changed. Retractions remain historical records.

### CONFLICTED

Two or more active claims cannot safely be reconciled. The system should preserve the conflict and surface it instead of silently picking one claim.

Example:

```text
Mira born in 2024
Mira born in 2026
```

If both have credible current evidence, mark the conflict for review.

## 7. Events as first-class memory

Events represent changes that occur in story time.

Suggested logical structure:

```text
story_events
- id
- project_id
- title
- description
- story_time_start nullable
- story_time_end nullable
- chapter_id nullable
- source_chunk_id nullable
- source_revision nullable
- canon_state
- metadata
```

Participant relationships can be represented by a join table:

```text
event_entities
- event_id
- entity_id
- role
```

Events can imply facts.

Example:

```text
Event: Dr. Vale dies
story_time: 2048-03-11

Derived state:
Dr. Vale -- status --> dead
valid_from: 2048-03-11
```

This supports time-aware checks such as a supposedly dead character appearing later without an explicit resurrection, flashback or alternate-state explanation.

## 8. Narrative order versus story time

Inkrya must maintain two distinct axes:

```text
Narrative order = when the reader encounters the material.
Story time       = when the event occurs inside the fictional world.
```

Example:

```text
Chapter 6 -> 2050
Chapter 7 -> flashback to 2045
Chapter 8 -> 2050
```

A later chapter number must never be treated as proof that the contained event happens later in-world.

A logical representation may include:

```text
story_time_ranges
- id
- project_id
- chapter_id
- scene_key nullable
- narrative_position
- story_time_start nullable
- story_time_end nullable
- time_certainty
- source_revision
```

The schema should allow partially known or relative chronology when exact calendar dates are unavailable.

## 9. Character knowledge

Character knowledge is a major differentiator for Inkrya.

World truth and character truth are not the same thing.

Example:

```text
World truth:
Project Helios exists.

Character state before Chapter 8:
Mira has no established knowledge of Project Helios.

Chapter 8 event:
Mira learns about Project Helios.
```

Suggested logical structure:

```text
character_knowledge
- id
- project_id
- character_entity_id
- fact_id nullable
- proposition
- knowledge_state
- learned_at_story_time nullable
- learned_in_event_id nullable
- source_chunk_id nullable
- source_revision nullable
- canon_state
- metadata
```

For the hackathon MVP, support at least:

```text
KNOWN
BELIEVED
```

Missing rows remain **UNKNOWN / UNESTABLISHED**, not `DOES_NOT_KNOW`.

Future states may include:

```text
EXPLICITLY_UNKNOWN
DISBELIEVED
MISINFORMED
FORGOTTEN
```

A belief may intentionally differ from world truth.

Example:

```text
World truth: Arka is alive.
Mira belief: Arka is dead.
```

## 10. Narrative State

A Narrative State is a time-scoped scene context assembled from active memory.

Example:

```text
Narrative State @ scene T

Arka:
  location = Helios Station
  status = alive
  trusts_mira = false
  knows_project_helios = true

Mira:
  location = Neo Jakarta
  knows_project_helios = false
  believes_arka_dead = true

Dr. Vale:
  status = dead
```

The hackathon implementation does not need to persist a full materialized state snapshot after every paragraph. It may compute state on demand from events, facts, temporal bounds and current evidence.

Conceptually, each meaningful scene is a state transition:

```text
STATE BEFORE
    ↓
  EVENT
    ↓
STATE AFTER
```

This is the foundation for time-aware continuity reasoning.

## 11. Story Context Builder

Agents should not independently query arbitrary storage. Introduce a Story Context Builder that accepts inputs such as:

```text
project
current chapter/scene
current story time
active characters
user intent
retrieval query
```

and returns a bounded package such as:

```json
{
  "scene": {},
  "characters": [],
  "canon": [],
  "knowledge": [],
  "recent_events": [],
  "evidence": [],
  "unresolved_conflicts": []
}
```

Benefits:

- consistent grounding across agents;
- easier evaluation;
- easier tracing;
- bounded context size;
- centralized temporal/canon filtering;
- less accidental leakage of future story knowledge.

## 12. Hybrid retrieval

Target retrieval pipeline:

```text
Query / agent intent
        │
        ├── lexical retrieval
        ├── vector retrieval
        ├── entity retrieval
        └── temporal + canon filters
                    │
                    ▼
                  rerank
                    │
                    ▼
             evidence package
```

Vector retrieval is an upgrade to the existing revision-safe lexical memory, not a replacement for it.

The implementation must not label keyword-only retrieval as semantic search. Embedding model and vector dimension must be verified before schema lock-in.

## 13. Agent architecture

Keep the hackathon graph intentionally small.

Primary reasoning/generation agents:

```text
Planner
Writer
Continuity Guardian
Critic
```

Prefer deterministic nodes/tools for:

```text
Router
Memory retrieval
Context assembly
Canon extraction
Research orchestration
Persistence
```

Target graph:

```text
START
  │
  ▼
Retrieve / Build Story Context
  │
  ▼
Planner
  │
  ▼
Writer
  │
  ▼
Continuity Guardian
  │
  ├── no issue ──────────────► Critic
  │
  └── repairable issue
           │
           ▼
       Repair Writer
           │
           ▼
       Guardian re-check
           │
           ▼
         Critic
           │
           ▼
          END
```

Repair loops must be bounded. Hackathon default target: maximum two repair passes. If issues remain, surface them honestly instead of claiming success.

## 14. Continuity Guardian checks

Guardian should use an explicit rubric rather than a vague "find problems" prompt.

Initial checks:

- canon contradiction;
- timeline contradiction;
- character knowledge leak;
- location impossibility;
- alive/dead status conflict;
- relationship inconsistency;
- world-rule violation;
- strong character-behavior inconsistency where evidence exists.

Suggested structured output:

```json
{
  "issues": [
    {
      "type": "knowledge_leak",
      "severity": "high",
      "claim": "Mira mentions Project Helios before learning it",
      "evidence_ids": ["fact_123", "chunk_456"],
      "explanation": "...",
      "repair_hint": "..."
    }
  ]
}
```

Prefer evidence-backed severity classes over arbitrary quality scores:

```text
critical
high
medium
low
```

Do not invent a synthetic "story quality 87/100" score unless a future evaluation method gives that number a defensible meaning.

## 15. Canon Diff after generation

Generated prose may introduce persistent information.

Example draft:

```text
Mira still carried the silver pendant her mother gave her.
```

Possible proposed canon:

```text
+ Mira owns a silver pendant
+ Mira received the pendant from her mother
```

UI actions:

```text
Accept
Edit
Reject
```

Accepted items become `CANON`; rejected items never silently enter strong memory. The manuscript itself remains user-controlled.

## 16. Processing lifecycle

Do not run expensive extraction/embedding on every keystroke.

Preferred lifecycle:

```text
User edits
   ↓
autosave / revision
   ↓
stable revision or explicit chapter checkpoint
   ↓
background memory processing
   ├── chunk
   ├── embed
   ├── extract/update entities
   ├── extract events
   ├── extract facts
   ├── update character knowledge
   └── produce canon proposals/conflicts
```

A job table may track resumable processing:

```text
memory_processing_jobs
- id
- project_id
- chapter_id
- source_revision
- status
- stage
- attempts
- error_code nullable
- started_at
- completed_at nullable
```

Exact retry behavior must remain bounded and idempotent.

## 17. Initial database surface

Keep the first implementation narrow. The target Story Memory 2.0 database surface is roughly:

```text
story_chunks
story_entities
story_facts
story_events
event_entities
character_knowledge
story_time_ranges
canon_proposals
memory_processing_jobs
```

Do not create a large ontology prematurely.

## 18. Migration from current Inkrya Memory

Existing Memory capabilities are valuable and must not be discarded:

- revision-aware chunks;
- lexical search;
- source-backed Ask My Story;
- reviewed facts;
- background indexing;
- source revision constraints.

Upgrade incrementally:

```text
CURRENT
revision-safe chunks
+ lexical retrieval
+ reviewed facts

        ↓

STORY MEMORY 2.0
existing evidence layer
+ embeddings
+ entities
+ atomic facts
+ events
+ character knowledge
+ temporal state
+ hybrid retrieval
```

The existing `approved` fact model is historical alpha functionality. It must not be silently renamed into the new canon lifecycle without an explicit migration and semantic review.

## 19. Recommended Phase 2 implementation order

Do not begin Phase 2 by only adding embeddings.

Recommended order:

1. define and migrate `story_entities`;
2. define and migrate `story_facts` with canon lifecycle and evidence lineage;
3. define and migrate `story_events` + event participants;
4. add story-time representation;
5. choose and verify embedding model + dimension;
6. add pgvector to revision-safe evidence chunks;
7. implement hybrid retrieval;
8. implement character knowledge;
9. build Story Context Builder;
10. expose the resulting context to Ask Your Story and later LangGraph agents;
11. add canon proposal/review workflow;
12. add Narrative State/continuity checks incrementally.

## 20. Architecture summary

```text
                         INKRYA
                            │
                    Manuscript Layer
                            │
                    Evidence Memory
                            │
                    Story Knowledge
               ┌────────────┼────────────┐
               ▼            ▼            ▼
            Entities      Events        Facts
               │            │            │
               └────── Narrative State ──┘
                            │
                   Character Knowledge
                            │
                   Story Context Builder
                            │
               ┌────────────┼────────────┐
               ▼            ▼            ▼
            Planner       Writer       Guardian
               │            │            │
               └────────────┴────────────┘
                            │
                          Critic
                            │
                       Final Draft
                            │
                       Canon Diff
                            │
                     Human Acceptance
```

## 21. Definition of success

Story Memory 2.0 is successful for the hackathon when the system can demonstrate, on an original synthetic corpus:

- evidence-grounded retrieval across long-form text;
- source citations that survive revision rules;
- structured canon and event retrieval;
- story-time-aware reasoning;
- at least one character-knowledge leak detected correctly;
- at least one timeline/canon contradiction detected correctly;
- bounded repair of a generated draft;
- human-reviewed canon proposal after generation;
- no claim of certainty where memory is absent or conflicted.

The technical differentiator is not "we use a vector database." The differentiator is that Inkrya models a story as evolving, evidence-backed narrative state and gives its agents controlled access to that state.