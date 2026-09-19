# INKRYA — Hackathon Edition

## Product Requirements Document

**Project:** Inkrya
**Hackathon:** Nebius x NVIDIA Global AI Hackathon
**Primary Track:** Best Apps and Agents
**Secondary Alignment:** Personal AI
**Bonus Target:** Best Use of Tavily
**Document Status:** v1.0
**Target Submission:** October 30, 2026
**Product Type:** Agentic AI Writing Workspace
**Primary Runtime:** Nebius Token Factory
**Primary Model Family:** NVIDIA Nemotron
**Frontend:** Next.js
**Deployment:** Vercel
**Database:** Supabase PostgreSQL + pgvector
**Agent Orchestration:** LangGraph
**Observability & Evaluation:** LangSmith
**Live Research:** Tavily
**Human Evaluation:** Toloka

---

# 1. Executive Summary

Inkrya is an AI-native writing workspace for long-form fiction.

The Hackathon Edition transforms Inkrya from an AI-assisted writing application into an **agentic story intelligence system capable of understanding, reasoning about, maintaining, and extending an entire fictional universe**.

Instead of treating each AI interaction as an isolated prompt, Inkrya maintains structured and semantic knowledge about:

* characters,
* relationships,
* locations,
* story events,
* timelines,
* world rules,
* character knowledge,
* unresolved plot threads,
* emotional states,
* chapter history,
* narrative point of view,
* and established canon.

The primary product promise is:

> **Write the next chapter without breaking your story.**

Krya AI, Inkrya's writing partner, will operate through specialized reasoning workflows that retrieve relevant story memory, build a writing plan, detect continuity conflicts, perform optional research, generate the draft, review the output, and update story canon only after user approval.

Inkrya Hackathon Edition will use NVIDIA Nemotron models through Nebius Token Factory as its core reasoning and generation infrastructure.

---

# 2. Product Vision

## 2.1 Long-Term Vision

Inkrya should become an AI-native operating system for storytelling.

The system should not only help users write text.

It should understand:

* what has happened,
* why it happened,
* who knows what,
* what each character wants,
* what rules exist in the fictional world,
* what narrative promises remain unresolved,
* and what consequences a new scene creates.

Inkrya should eventually act as:

* writing partner,
* story architect,
* continuity editor,
* research assistant,
* lore keeper,
* developmental editor,
* and long-term memory layer.

---

# 3. Problem Statement

Traditional AI writing assistants perform well on short context but become increasingly unreliable when working with long-form projects.

A novel may contain:

* 50–150 chapters,
* hundreds of scenes,
* dozens of characters,
* multiple timelines,
* changing relationships,
* evolving character knowledge,
* fictional rules,
* locations,
* unresolved plot threads,
* and more than 100,000 words of context.

Writers cannot reliably send the entire manuscript to an LLM every time they request assistance.

This creates several problems.

### Context Loss

The AI forgets events that occurred many chapters earlier.

### Continuity Errors

The AI may create contradictions such as:

* resurrecting dead characters,
* moving characters to impossible locations,
* revealing information a character should not know,
* changing physical characteristics,
* altering relationships without cause,
* contradicting world rules,
* or breaking the story timeline.

### Character Drift

Characters gradually lose their established:

* personality,
* motivations,
* speaking style,
* emotional trajectory,
* and relationship dynamics.

### Expensive Context Windows

Sending an entire manuscript repeatedly increases:

* token usage,
* latency,
* inference cost,
* and noise inside the context.

### Manual Story Management

Writers often maintain separate:

* spreadsheets,
* notes,
* character sheets,
* timelines,
* research documents,
* and outlines.

The AI rarely understands all of these sources as one coherent system.

---

# 4. Proposed Solution

Inkrya introduces a persistent **Story Intelligence Layer**.

Instead of sending the whole novel to an LLM, Inkrya converts the manuscript into structured and semantic memory.

The AI retrieves only information relevant to the current task.

Core pipeline:

```text
User Request

      ↓

Intent Analysis

      ↓

Story Memory Retrieval

      ↓

Planning

      ↓

Optional Research

      ↓

Draft Generation

      ↓

Continuity Verification

      ↓

Revision / Repair

      ↓

Critique

      ↓

User Review

      ↓

Canon Update
```

This architecture allows Inkrya to reason over stories much larger than a single model context window.

---

# 5. Hackathon Positioning

## Primary Track

**Best Apps and Agents**

Inkrya is designed as a complete product that real writers can use rather than a standalone AI demo.

The application combines:

* agent orchestration,
* persistent memory,
* semantic retrieval,
* structured story state,
* research tools,
* human approval,
* and long-form text generation.

## Secondary Alignment

**Personal AI**

Krya behaves as a persistent personal creative assistant that remembers a user's project and works with user-controlled information.

## Bonus Target

**Best Use of Tavily**

Tavily will be integrated as Inkrya's live research layer.

The integration must be functional and useful to the actual writing workflow rather than existing purely for prize eligibility.

---

# 6. Target Users

## Primary User

Long-form fiction writers.

Examples:

* novelists,
* web novel writers,
* serial fiction writers,
* fan-fiction writers,
* screenplay writers,
* story-focused content creators.

## Secondary Users

* writing teams,
* narrative designers,
* game writers,
* role-playing campaign creators,
* editors,
* story development teams.

---

# 7. Core User Jobs

Users should be able to ask Inkrya to:

### Continue a Story

> Write the next chapter using everything established in the story.

### Ask Questions About Their Story

> Why does Aurel still hesitate to trust Kenan?

### Detect Problems

> Find continuity problems across this manuscript.

### Plan Future Events

> Plan the next five chapters without resolving the main conflict too early.

### Research Real-World Information

> Research Bandung public transportation in 2010 before writing this scene.

### Understand Characters

> What does Kenan currently know about Aurel?

### Analyze Plot Threads

> Which plot threads have not been resolved?

---

# 8. Product Principles

## 8.1 Memory Before Generation

The system must retrieve story context before generating long-form content.

## 8.2 Canon Is Explicit

Accepted story facts must be represented separately from temporary AI drafts.

## 8.3 Humans Control Canon

AI-generated information must not automatically become story canon.

Canon updates occur only after:

* user acceptance,
* explicit save action,
* or an equivalent approved workflow.

## 8.4 Agents Must Be Observable

Important agent operations should be traceable.

The system should make it possible to understand:

* which model was used,
* what memory was retrieved,
* which tools were called,
* how long execution took,
* and where failure occurred.

## 8.5 Tool Use Must Be Intentional

Krya must not perform web research for every request.

Research is triggered only when external knowledge would materially improve the output.

## 8.6 Retrieval Must Minimize Context

Only relevant story memory should be sent into inference.

## 8.7 Product Experience Matters

Agent complexity must not make Inkrya feel like a developer tool.

The UI should remain writer-focused.

---

# 9. Core Hackathon Features

The Hackathon Edition will focus on four primary capabilities.

---

# 9.1 Ask Your Story

Users can ask natural-language questions about their manuscript.

Example:

> When did Kenan first start trusting Aurel again?

Inkrya retrieves:

* relevant chapters,
* events,
* relationship states,
* story facts,
* and timeline entries.

Example output:

```text
Kenan's trust begins rebuilding during their conversations
early in Ramadan.

Relevant story context:

• Chapter 18 — communication becomes more regular.
• Chapter 21 — Kenan begins sharing personal concerns.
• Chapter 24 — Aurel responds more openly.
```

## Requirements

The answer should:

* use retrieved project information,
* avoid inventing unsupported facts,
* cite chapters/scenes when possible,
* indicate uncertainty when relevant.

---

# 9.2 Write Next Chapter

Primary hackathon killer workflow.

User requests:

> Write Chapter 27.

Inkrya performs:

```text
Retrieve current story state
      ↓
Identify active characters
      ↓
Retrieve unresolved plot threads
      ↓
Retrieve timeline state
      ↓
Retrieve relevant character knowledge
      ↓
Build chapter plan
      ↓
Check plan against canon
      ↓
Generate draft
      ↓
Continuity review
      ↓
Critic review
      ↓
Present draft
```

The UI should expose a lightweight execution status.

Example:

```text
Understanding your story...

✓ 8 relevant events found
✓ 3 active plot threads
✓ 4 character states loaded
✓ Timeline checked
✓ Chapter plan created

Writing chapter...
```

The objective is to make the agentic process understandable without exposing raw internal reasoning.

---

# 9.3 Continuity Guardian

Continuity Guardian detects contradictions between a proposed scene and established story canon.

Example canon:

```text
Aurel resigned from her job.

Kenan has not been told about the resignation.
```

User asks:

> Write a scene where Kenan asks Aurel why she resigned.

Inkrya detects:

```text
Potential continuity conflict

Kenan has not yet learned that Aurel resigned.

Suggested approaches:

1. Have Aurel reveal the resignation first.
2. Add an earlier event where Kenan learns about it.
3. Rewrite the conversation without Kenan knowing.
```

Categories of continuity checks:

* character knowledge,
* character status,
* relationships,
* timeline,
* location,
* world rules,
* physical characteristics,
* story facts,
* unresolved events.

---

# 9.4 Story Doctor

Story Doctor performs a wider manuscript analysis.

It should identify issues such as:

### Plot Holes

Events that conflict with previous events.

### Forgotten Characters

Important characters who disappear unexpectedly.

### Timeline Conflicts

Events that cannot occur in their stated order.

### Character Knowledge Errors

A character acts on information never revealed to them.

### Relationship Drift

Relationships change without sufficient narrative cause.

### World Rule Violations

A scene contradicts fictional rules.

### POV Problems

A scene reveals information unavailable to the point-of-view character.

### Unresolved Story Threads

Narrative setups that have not yet received meaningful continuation.

Example:

```text
STORY DOCTOR

3 continuity issues
2 unresolved plot threads
1 timeline concern
4 character opportunities

High Priority

Chapter 18:
Kenan refers to information only revealed to Aurel.

Chapter 24:
Travel time conflicts with the established timeline.
```

---

# 10. Research Mode

Inkrya should support live research through Tavily.

Research should only activate when external knowledge is necessary.

Example:

> Write a scene in Bandung during Ramadan in 2010.

Research Agent may query:

* transportation,
* weather patterns,
* local environment,
* technology available at the time,
* cultural context,
* relevant historical facts.

Pipeline:

```text
Story Request

     ↓

Research Requirement Detector

     ↓

Research Planner

     ↓

Tavily Search

     ↓

Source Selection

     ↓

Research Notes

     ↓

Story Generation
```

Research results should be separated from story canon.

External facts must not silently modify fictional canon.

---

# 11. Agent Architecture

Krya will use controlled agent orchestration rather than unrestricted multi-agent conversation.

Recommended implementation:

**LangGraph JS**

Primary graph:

```text
START

  ↓

Intent Router

  ↓

Memory Retriever

  ↓

Context Builder

  ↓

Story Planner

  ↓

Research Required?
  │
  ├── Yes → Research Agent → Context Builder
  │
  └── No
       ↓

Writer

  ↓

Continuity Guardian

  ↓

Conflict?
  │
  ├── Yes → Repair
  │            ↓
  └──────── Writer
  │
  └── No

  ↓

Critic

  ↓

Final Draft

  ↓

USER REVIEW

  ↓

Accepted?

  ├── No → Editing workflow
  │
  └── Yes

  ↓

Canon Extractor

  ↓

Memory Update

  ↓

END
```

---

# 12. Agent Responsibilities

## 12.1 Intent Router

Determines the type of request.

Possible intents:

```text
WRITE
REWRITE
ASK_STORY
PLAN
RESEARCH
CONTINUITY_CHECK
STORY_DOCTOR
CHARACTER_ANALYSIS
TIMELINE_ANALYSIS
```

Recommended model:

Lightweight Nemotron.

---

# 12.2 Memory Retriever

Retrieves relevant:

* story facts,
* chapters,
* scenes,
* events,
* characters,
* relationships,
* timeline entries,
* plot threads,
* world rules.

Uses a hybrid retrieval approach.

---

# 12.3 Story Planner

Produces a structured plan before long-form generation.

Example output schema:

```json
{
  "goal": "",
  "characters": [],
  "requiredEvents": [],
  "activePlotThreads": [],
  "constraints": [],
  "scenePlan": [],
  "continuityRisks": []
}
```

Recommended model:

Nemotron 3 Super or equivalent reasoning model available through Token Factory.

---

# 12.4 Research Agent

Responsible for:

* determining search queries,
* calling Tavily,
* selecting relevant sources,
* summarizing findings,
* passing evidence to the writing workflow.

The agent may not modify story canon.

---

# 12.5 Writer Agent

Produces the actual prose.

Input:

* user instruction,
* story plan,
* retrieved story context,
* style instructions,
* research notes when applicable.

The Writer must not directly write into the canonical database.

---

# 12.6 Continuity Guardian

Compares generated content against canonical story state.

Output:

```json
{
  "valid": false,
  "issues": [
    {
      "type": "CHARACTER_KNOWLEDGE",
      "severity": "high",
      "description": "",
      "relatedFactIds": []
    }
  ]
}
```

---

# 12.7 Repair Agent

Receives:

* draft,
* continuity issue,
* canonical evidence.

Repairs only the conflicting parts when possible.

---

# 12.8 Critic Agent

Evaluates:

* pacing,
* narrative consistency,
* character voice,
* instruction adherence,
* repetition,
* prose quality.

Critic should suggest improvements without altering canon.

---

# 12.9 Canon Extractor

Runs only after approved content.

Extracts:

* new events,
* new relationships,
* new facts,
* character state changes,
* character knowledge,
* plot thread changes,
* timeline entries.

The user-approved manuscript remains the ultimate source of truth.

---

# 13. Story Memory Architecture

Inkrya Memory should use multiple forms of memory.

---

# 13.1 Structured Memory

Stored in PostgreSQL.

Proposed entities:

```text
projects

characters
character_aliases
character_states
character_knowledge

relationships
relationship_states

locations

chapters
scenes

events

story_facts

plot_threads

timeline_events

world_rules

chapter_summaries

research_notes
```

---

# 13.2 Semantic Memory

Use:

**Supabase pgvector**

Store embeddings for:

* chapter chunks,
* scenes,
* dialogue,
* story facts,
* character profiles,
* event descriptions,
* worldbuilding material.

Example table:

```text
story_embeddings

id
project_id
source_type
source_id
content
embedding
metadata
created_at
```

---

# 13.3 Canon Memory

Canonical facts receive explicit state.

Example:

```text
story_fact

id
project_id
subject
predicate
object
status
source_chapter
confidence
created_at
```

Possible states:

```text
CANON
PROPOSED
RETRACTED
CONFLICTED
```

---

# 13.4 Character Knowledge Graph

One of Inkrya's primary differentiators.

The system should track not only what is true, but:

> Which character knows which fact?

Example:

```text
Fact:
Aurel has resigned.

Knowledge:

Aurel    → KNOWN
Rio      → KNOWN
Kenan    → UNKNOWN
```

This allows Inkrya to catch sophisticated continuity errors.

---

# 14. Hybrid Retrieval

Story retrieval should combine several methods.

## Vector Similarity

Good for semantic relevance.

## Structured Filtering

Examples:

```text
character = Kenan
timeline <= Chapter 26
fact_status = CANON
location = Bandung
```

## Recency

Recent events may receive additional weight.

## Story Importance

Major story facts should be prioritized over minor scene details.

Example scoring concept:

```text
final_score =
semantic_similarity
+ story_importance
+ recency_weight
+ entity_relevance
```

---

# 15. AI Infrastructure

Primary requirement:

NVIDIA open-source model served through Nebius Token Factory.

Recommended routing:

## Fast / Low-Cost Tasks

Use smaller Nemotron model where available.

Tasks:

* classification,
* extraction,
* tagging,
* summarization,
* intent routing,
* metadata generation.

## Reasoning Tasks

Use Nemotron 3 Super or suitable reasoning-tier Nemotron.

Tasks:

* story planning,
* continuity reasoning,
* Story Doctor,
* conflict resolution,
* complex character analysis.

## Heavy Reasoning

Only use the largest appropriate model when materially beneficial.

Avoid sending all requests to the most expensive model.

---

# 16. Model Gateway

Current Inkrya Vercel AI SDK architecture should remain where practical.

Proposed flow:

```text
Inkrya
   ↓
Vercel AI SDK
   ↓
OpenAI-Compatible Provider
   ↓
Nebius Token Factory
   ↓
NVIDIA Nemotron
```

Create an abstraction layer:

```text
lib/ai/
```

Suggested structure:

```text
providers.ts
models.ts
router.ts
generate.ts
embed.ts
```

This avoids coupling application code directly to one model name.

---

# 17. Model Routing

Example configuration:

```ts
ROUTER_MODEL
MEMORY_MODEL
PLANNER_MODEL
WRITER_MODEL
CONTINUITY_MODEL
CRITIC_MODEL
EMBEDDING_MODEL
```

Routing should allow model changes without rewriting agents.

---

# 18. LangSmith Integration

LangSmith will provide AI observability.

Every Krya execution should have a trace.

Recommended metadata:

```text
project_id
user_id
workflow
model
latency
token_usage
retrieved_memory_count
tool_calls
continuity_issue_count
success
```

Trace structure example:

```text
Krya Write Chapter

├─ classifyIntent
├─ retrieveMemory
├─ buildContext
├─ planStory
├─ tavilySearch
├─ generateDraft
├─ continuityCheck
├─ repair
└─ critique
```

---

# 19. AI Evaluation

The product should include measurable evaluation.

Evaluation should not rely entirely on subjective claims.

Create a benchmark dataset.

Example test:

```text
Canon:

Aurel resigned in Chapter 20.

Kenan has not been informed.

Prompt:

Write Kenan asking why Aurel resigned.

Expected:

The system must detect that Kenan should not
already possess this information.
```

Evaluation categories:

```text
Canon Grounding
Continuity Accuracy
Character Knowledge Accuracy
Retrieval Relevance
Instruction Adherence
Tool Selection
Research Citation Quality
```

---

# 20. Human Evaluation

Toloka can be used for optional human evaluation.

Compare:

```text
Baseline Inkrya

vs.

Agentic Inkrya
```

Human evaluators can rate:

```text
Character consistency
Naturalness
Narrative coherence
Continuity
Instruction adherence
Writing quality
```

This evaluation should be conducted after the core product works.

Toloka must not become a dependency for runtime.

---

# 21. User Experience

The UI should hide unnecessary agent complexity.

Writers should feel they are interacting with one product:

**Krya AI**

not seven separate bots.

Possible activity panel:

```text
Krya is working...

✓ Read story memory
✓ Checked 4 character states
✓ Found 2 relevant plot threads
✓ Researched historical context
✓ Built chapter plan
✓ Checked continuity

Writing...
```

Do not expose raw chain-of-thought.

---

# 22. Story Doctor Interface

Recommended layout:

```text
Story Health

Continuity        92%
Characters        88%
Timeline          96%
Plot Threads      74%

Issues

HIGH
Kenan knows information never revealed to him.

MEDIUM
A secondary character has not appeared for
eight chapters.

LOW
Two scenes repeat similar information.
```

Scores shown in the UI should reflect real defined checks rather than arbitrary model confidence.

---

# 23. Demo Project

Create a fictional demo manuscript specifically for judging.

Do not depend on the user's private novel.

Working title:

**The Last Signal**

Suggested dataset:

```text
15 chapters

8 major characters

30+ events

10+ relationships

20+ canonical facts

multiple locations

multiple unresolved plot threads
```

Create intentional continuity traps.

Example:

```text
Character Elias dies in Chapter 6.

Later test prompt:

"Write Elias walking into the control room
in Chapter 11."
```

Expected Inkrya response:

```text
Continuity conflict detected.

Elias died in Chapter 6.

Would you like to:

• use a flashback,
• replace Elias,
• or revise the earlier canon?
```

---

# 24. Killer Demo Flow

The hackathon demo should demonstrate one clear story.

## Scene 1

Open an existing Inkrya project.

Show:

```text
15 chapters
8 characters
33 events
5 active plot threads
```

---

## Scene 2

Ask:

> What does Maya currently know about Elias?

Inkrya retrieves story memory.

---

## Scene 3

Ask:

> Write the next chapter where Elias meets Maya.

Inkrya detects:

```text
Continuity conflict

Elias died in Chapter 6.
```

---

## Scene 4

Change instruction:

> Use a flashback.

Krya:

```text
Planning chapter...
Checking timeline...
Writing...
```

Draft appears.

---

## Scene 5

Accept chapter.

Inkrya shows:

```text
Story Memory Updated

+ 3 events
+ 2 character states
+ 1 timeline entry
+ 1 plot thread updated
```

---

## Scene 6

Open Story Doctor.

Show cross-manuscript analysis.

---

## Scene 7

Ask for a historically grounded scene.

Tavily performs real research.

Show source-backed research briefly.

---

# 25. Success Metrics

Hackathon MVP will be successful if:

### Product

* user can create/open a project,
* story content can be indexed,
* Ask Your Story works,
* Write Next Chapter works,
* continuity conflicts are detected,
* accepted chapters update memory,
* Story Doctor returns meaningful issues,
* Tavily performs real runtime research.

### Infrastructure

* Nemotron is called through Nebius,
* LangSmith traces agent execution,
* Supabase stores story memory,
* pgvector supports semantic retrieval.

### Reliability

* demo workflow works repeatedly,
* no hardcoded demo output,
* app gracefully handles model/tool failures,
* secrets remain server-side.

---

# 26. Non-Goals

The hackathon version will NOT attempt to become:

* a full publishing platform,
* a marketplace,
* a social network,
* a collaborative Google Docs replacement,
* an AI image generation suite,
* an audiobook generator,
* a screenplay production suite,
* a full grammar checker,
* a translation platform.

These may be future Inkrya capabilities.

---

# 27. Scope Priorities

## P0 — Required

Must work before submission.

```text
Nebius Token Factory
NVIDIA Nemotron
Story Memory
pgvector retrieval
Ask Your Story
Write Next Chapter
Continuity Guardian
Human-approved canon update
public demo
public repo
README
license
```

## P1 — Strongly Recommended

```text
Story Doctor
Tavily Research
LangSmith tracing
model routing
evaluation dataset
Playwright E2E tests
```

## P2 — Stretch

```text
Toloka human evaluation
advanced relationship graph
automatic world-rule extraction
visual timeline
Tandem authority layer
multi-agent collaboration visualization
```

P2 must never delay P0.

---

# 28. Technical Stack

```text
Frontend
Next.js
React
TypeScript

Editor
Tiptap

AI
Vercel AI SDK
Nebius Token Factory
NVIDIA Nemotron

Agents
LangGraph JS

Database
Supabase
PostgreSQL
pgvector

Research
Tavily

Observability
LangSmith

Human Evaluation
Toloka

Deployment
Vercel

Repository
GitHub

Testing
Vitest
Playwright
```

---

# 29. Repository Structure

Recommended:

```text
inkrya/

app/

components/

agents/
  orchestrator.ts
  router.ts
  planner.ts
  writer.ts
  continuity.ts
  critic.ts
  researcher.ts
  canon.ts

memory/
  retrieve.ts
  index.ts
  extract.ts
  context.ts

lib/
  ai/
    provider.ts
    models.ts
    router.ts

  nebius/

  tavily/

  langsmith/

  supabase/

evals/
  datasets/
  evaluators/
  continuity/
  retrieval/

tests/

docs/
  architecture.md
  memory.md
  agent-system.md
  evaluation.md

README.md

LICENSE

.env.example
```

---

# 30. Environment Variables

```env
# Nebius
NEBIUS_API_KEY=
NEBIUS_BASE_URL=

# Tavily
TAVILY_API_KEY=

# LangSmith
LANGSMITH_API_KEY=
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=inkrya-hackathon

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Evaluation
TOLOKA_API_KEY=

# Optional
TANDEM_API_TOKEN=
```

Secrets must never be committed.

---

# 31. Significant Hackathon Update

Because Inkrya existed before the hackathon, the project must clearly document the work completed during the hackathon period.

## Inkrya Before

```text
AI writing workspace

Basic project editor

Simple AI assistant

Existing story/project memory

Basic writing workflow
```

## Inkrya Hackathon Edition

```text
Nebius Token Factory integration

NVIDIA Nemotron model integration

Agent orchestration

Hybrid story retrieval

Vector memory

Structured canon

Character knowledge tracking

Continuity Guardian

Story Doctor

Research Agent

Tavily integration

LangSmith tracing

AI benchmark evaluation

Human-approved canon updates
```

Development history should be visible through:

* Git commits,
* pull requests,
* changelog,
* documentation,
* release notes.

---

# 32. Git Strategy

Create development branch:

```text
hackathon/nebius-2026
```

Recommended commit style:

```text
feat(memory): add semantic story retrieval

feat(agent): implement continuity guardian

feat(nebius): add Nemotron provider

feat(research): integrate Tavily agent

feat(eval): add continuity benchmark

docs(hackathon): document significant updates
```

---

# 33. README Requirements

README should include:

```text
What Inkrya is

Problem

Solution

Architecture

Screenshots

Demo URL

Demo video

Nebius usage

NVIDIA model usage

Tavily usage

Agent architecture

Story memory system

Installation

Environment variables

Running locally

Evaluation

Significant Hackathon Updates

License
```

---

# 34. Submission Requirements

Before submission verify:

```text
[ ] working hosted demo

[ ] public source repository

[ ] open-source license

[ ] complete README

[ ] setup instructions

[ ] architecture documentation

[ ] NVIDIA model usage documented

[ ] Nebius usage documented

[ ] Tavily usage documented

[ ] significant-update explanation

[ ] feedback section completed

[ ] demo video ≤ 3 minutes

[ ] public YouTube video

[ ] Devpost description

[ ] project track selected

[ ] application accessible to judges
```

---

# 35. Demo Video Structure

Maximum target:

**2 minutes 45 seconds**

Suggested structure:

## 0:00–0:15

Problem.

> AI writing assistants forget long stories.

## 0:15–0:30

Introduce Inkrya.

> Inkrya gives AI persistent story memory.

## 0:30–1:25

Killer workflow.

* Ask Your Story
* request impossible scene
* Continuity Guardian catches it
* regenerate correctly

## 1:25–1:50

Show:

* Story Doctor,
* memory,
* character knowledge,
* canon update.

## 1:50–2:10

Show Tavily research.

## 2:10–2:30

Show architecture.

```text
Nemotron
Nebius
LangGraph
Supabase
Tavily
LangSmith
```

## 2:30–2:45

Closing.

> Inkrya lets writers build worlds their AI can actually remember.

---

# 36. Judging Strategy

The project should intentionally address all four judging dimensions.

## Technological Implementation

Demonstrate:

* Nemotron integration,
* Nebius runtime,
* agent orchestration,
* structured memory,
* vector retrieval,
* continuity reasoning,
* tool usage,
* evaluation.

## Design

Demonstrate:

* cohesive writing workspace,
* clear AI interaction,
* understandable agent status,
* useful conflict UI,
* human control over canon.

## Potential Impact

Explain:

Long-form writers currently spend substantial effort manually tracking increasingly complex projects.

Inkrya helps AI remain useful as those projects grow.

## Quality of Idea

Key differentiator:

Inkrya does not simply provide more context to an LLM.

It models story state.

Especially:

```text
What is true?

What happened?

When did it happen?

Who knows it?

Who does not know it?

What remains unresolved?
```

---

# 37. Core Differentiator

Most AI writing tools treat the manuscript as text.

Inkrya treats the manuscript as a **living stateful world**.

This is the core technical and product idea.

---

# 38. Hackathon Narrative

The submission should tell one clear story:

> Large language models are powerful writers, but novels exceed their reliable working memory.

> Inkrya converts a manuscript into persistent structured and semantic memory.

> NVIDIA Nemotron reasons over this story state through Nebius Token Factory.

> Krya AI can then plan, research, write, verify continuity, and update canon while keeping the writer in control.

---

# 39. Suggested Tagline

**Inkrya**

### Turn ideas into worlds.

Hackathon product line:

> **AI that remembers the world you're writing.**

Alternative technical positioning:

> **Agentic memory and reasoning for long-form storytelling.**

---

# 40. Implementation Order

Development should proceed in this order:

## Phase 1 — Infrastructure

```text
Nebius integration
Nemotron test call
model routing
LangSmith tracing
```

## Phase 2 — Memory Foundation

```text
pgvector
story embeddings
structured canon
hybrid retrieval
```

## Phase 3 — Ask Your Story

```text
retrieval
context builder
grounded QA
story citations
```

## Phase 4 — Agentic Writing

```text
planner
writer
continuity guardian
repair
critic
```

## Phase 5 — Canon Update

```text
memory extraction
user approval
canon write
re-indexing
```

## Phase 6 — Story Doctor

```text
cross-story analysis
continuity checks
plot thread analysis
timeline analysis
```

## Phase 7 — Tavily Research

```text
research detection
query planning
runtime search
source selection
research context
```

## Phase 8 — Evaluation

```text
LangSmith datasets
continuity tests
retrieval tests
baseline comparison
Toloka evaluation if time permits
```

## Phase 9 — Submission Polish

```text
demo project
UX polish
README
architecture docs
public deployment
Playwright tests
video
Devpost submission
```

---

# 41. Definition of Done

Inkrya Hackathon Edition is considered ready when a judge can:

1. Open the public application.
2. Load the demo story.
3. Ask a story question.
4. Receive a grounded answer.
5. Request a new chapter.
6. Observe Inkrya retrieve story context.
7. Trigger a deliberate continuity conflict.
8. See Inkrya detect and explain the conflict.
9. Generate a canon-safe alternative.
10. Accept the chapter.
11. Observe story memory update.
12. Run Story Doctor.
13. Trigger live Tavily research.
14. Verify the public repository.
15. Understand how NVIDIA Nemotron and Nebius power the system.

---

# 42. Final MVP

The final hackathon MVP is:

> **Inkrya is an AI writing workspace where Krya AI can remember an entire story, reason over its characters and timeline, research external facts, write new chapters, detect contradictions, and maintain canon across long-form projects.**

Its central demonstration is:

> **Write the next chapter without breaking the story.**

Everything that does not materially strengthen this promise is secondary during the hackathon.
