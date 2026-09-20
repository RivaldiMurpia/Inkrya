# Inkrya Hackathon Demo & Evaluation Spec

Status: Hackathon demo design authority

This document defines the planned synthetic demo corpus and the minimum end-to-end story reasoning scenarios for the Inkrya Hackathon Edition. It is a design specification, not a claim that all scenarios are implemented today.

## 1. Demo goal

The demo must prove that Inkrya is more than a generic AI writing assistant.

The central demonstration is:

> A normal long-form generation can introduce contradictions or information leaks. Inkrya retrieves story state, plans, writes, checks continuity, repairs bounded issues, and presents evidence-backed results without silently mutating canon.

The demo should make the following capabilities visible:

- persistent long-form memory;
- evidence-backed retrieval;
- narrative order versus story time;
- character-specific knowledge;
- canon state;
- continuity detection;
- bounded repair loop;
- canon proposal after generation;
- citations to source chapters/scenes;
- honest unresolved-issue reporting when repair fails.

## 2. Synthetic corpus

Use an original demo story named **The Last Signal**.

Do not use the owner's private novel or private manuscript content in public demonstrations, benchmark fixtures, screenshots or videos.

### Genre

Near-future science-fiction mystery / thriller.

### Why this corpus

The story is intentionally designed to contain:

- secrets revealed at different times;
- flashbacks;
- character-specific knowledge boundaries;
- death/status changes;
- changing locations;
- relationships and trust changes;
- one or more world rules;
- apparently contradictory clues that are valid under the timeline;
- deliberately invalid generated continuations for Guardian tests.

## 3. Core cast

### Arka Vale

Role: primary protagonist.

Initial traits:

- investigator / signal engineer;
- distrusts institutions;
- trauma associated with firearms;
- avoids carrying guns unless a later canon event explicitly changes this behavior;
- knows more about Project Helios than Mira at the start of the main timeline.

### Mira Voss

Role: co-protagonist / investigator.

Initial traits:

- methodical and skeptical;
- emotionally guarded;
- has a hidden family connection to Arka;
- does not initially know Project Helios exists;
- learns major Helios information only at a defined later event.

### Dr. Elias Vale

Role: scientist tied to Project Helios.

Important state:

- alive in early chronology and flashback scenes;
- dies at a defined story-time event;
- later physical appearances are invalid unless explicitly a flashback, recording, simulation, hallucination, or other canon-supported mechanism.

### Optional supporting entity: Helios Station

A research location that can change operational/destroyed/access status over time.

## 4. World concepts

### Project Helios

A classified signal experiment central to the mystery.

World truth may become known to the reader before every character knows it.

### The Last Signal

A recurring anomalous transmission connected to Helios.

### World rule example

Helios transmissions cannot be detected without a specific receiver configuration or location constraint. This gives Guardian a non-character rule to enforce.

## 5. Ten-chapter demo skeleton

Exact prose can change, but the following information architecture should remain stable enough for tests.

### Chapter 1 — The Signal

Narrative order: 1
Main story time: 2048-03-02

Establish:

- Arka detects the anomalous Last Signal.
- Arka knows the term Project Helios but avoids explaining it.
- Mira is introduced without Helios knowledge.
- Arka avoids a weapon offered during a tense scene.

Evidence targets:

```text
Arka -> knows -> Project Helios exists
Mira -> Helios knowledge -> unestablished/unknown
Arka -> behavior -> avoids firearms
```

### Chapter 2 — The Locked Archive

Narrative order: 2
Story time: 2048-03-04

Establish:

- Mira and Arka investigate a restricted archive.
- Arka refuses to carry a pistol.
- Mira observes his discomfort but does not learn the underlying trauma details.

Potential fact:

```text
Arka avoids carrying firearms.
```

### Chapter 3 — A Name in the Noise

Narrative order: 3
Story time: 2048-03-07

Establish:

- Reader receives stronger evidence that Helios is real.
- Mira still does not know the classified project name.
- Dr. Vale is alive at this time.

This chapter creates an important distinction:

```text
Reader/world evidence != Mira knowledge
```

### Chapter 4 — Before the Silence

Narrative order: 4
Story time: 2045-08-19
Type: flashback

Establish:

- Dr. Vale working on Helios years earlier.
- Arka's earlier relationship with Dr. Vale.
- Origin of Arka's firearm trauma or an event strongly connected to it.

This chapter is the primary test that chapter order must not equal story time.

### Chapter 5 — Dead Channel

Narrative order: 5
Story time: 2048-03-11

Major event:

```text
Dr. Elias Vale dies.
```

Canonical state transition:

```text
Before: Dr. Vale.status = alive
Event: Dr. Vale dies
After: Dr. Vale.status = dead
```

### Chapter 6 — False Coordinates

Narrative order: 6
Story time: 2048-03-14

Establish:

- Mira receives misleading information.
- Mira may believe something false about Arka or Helios.
- Helios Station location/access status becomes relevant.

This chapter can support future `BELIEVED` state tests.

### Chapter 7 — The Old Laboratory

Narrative order: 7
Story time: 2045-08-20
Type: flashback

Dr. Vale appears alive legitimately because this scene occurs before Chapter 5 in story time.

Guardian must **not** flag this simply because Chapter 7 follows Chapter 5 in narrative order.

### Chapter 8 — Helios Revealed

Narrative order: 8
Story time: 2048-04-17

Major knowledge transition:

```text
Mira learns that Project Helios exists.
```

Character knowledge state transition:

```text
Before: Mira knowledge of Helios = UNKNOWN/UNESTABLISHED
Event: Arka reveals Helios to Mira
After: Mira knowledge of Helios = KNOWN
```

This is the anchor for knowledge-leak tests.

### Chapter 9 — Bloodline

Narrative order: 9
Story time: 2048-04-19

Reveal:

```text
Mira and Arka have a hidden family relationship.
```

For initial demo design, use:

```text
Mira is Arka's half-sister.
```

This fact should be represented through relationship canon and source evidence.

### Chapter 10 — The Last Signal

Narrative order: 10
Story time: 2048-04-21

Establish:

- convergence at Helios Station;
- major interpretation of the signal;
- opportunity for Writer/Guardian continuation tests;
- several stable facts that make contradictory continuations easy to generate deliberately.

## 6. Core canonical facts for fixtures

The minimum fixture set should include facts similar to:

```text
F1 Arka knows Project Helios exists before Chapter 1.
F2 Mira does not have established Helios knowledge before Chapter 8.
F3 Mira learns about Project Helios in Chapter 8 / 2048-04-17.
F4 Arka strongly avoids firearms from Chapters 1-2 evidence.
F5 Dr. Vale is alive during 2045 flashbacks.
F6 Dr. Vale dies on 2048-03-11 in Chapter 5.
F7 Chapter 7 occurs in 2045 despite its later narrative position.
F8 Mira and Arka are half-siblings, revealed in Chapter 9.
F9 Helios Station has a defined location/status relevant to Chapter 10.
F10 Project Helios has at least one world rule that generated prose can violate.
```

Some facts may begin as extracted/proposed during development, but the official demo fixture should have a known accepted canonical state for repeatable evaluation.

## 7. Signature contradiction prompt

The public demo should include a deliberately problematic continuation request similar to:

> Continue the current scene. Mira confronts Dr. Vale about Project Helios, and Arka pulls out his pistol to force him to answer.

When the current scene is before Mira's Chapter 8 discovery and after Dr. Vale's Chapter 5 death, this request contains multiple continuity hazards.

Expected Guardian findings:

### A. Character knowledge leak

Mira discusses Project Helios before her established knowledge transition.

### B. Alive/dead conflict

Dr. Vale physically appears after his death without a supported flashback/recording/simulation explanation.

### C. Character behavior inconsistency

Arka immediately uses a pistol despite strong earlier evidence of firearm avoidance. This may be lower confidence/severity than the hard timeline/knowledge contradictions unless the canon makes the behavior absolute.

The demo should show evidence references for each issue.

## 8. Expected agent workflow

Target visible workflow:

```text
User request
    ↓
Story Context Builder
    ↓
Planner
    ↓
Writer draft
    ↓
Continuity Guardian
    ↓
Issues detected
    ↓
Bounded repair
    ↓
Guardian re-check
    ↓
Critic
    ↓
Final result
    ↓
Canon Diff
```

The UI may show a simplified activity timeline, but it must not fabricate steps that did not actually execute.

## 9. Repair expectations

A valid repair could transform the problematic scene into something like:

- Mira confronts Arka using the information she actually knows at that time;
- Dr. Vale appears through a dated recording rather than physically after death;
- Arka uses another method of coercion or shows visible hesitation instead of casually brandishing a pistol.

The exact prose is model-generated and should not be hardcoded as the only answer. The invariant is that the repaired draft respects current evidence.

Repair loop must be bounded. Target maximum: two repair attempts.

If an issue remains after the budget is exhausted, surface:

```text
Unresolved continuity issue
```

instead of claiming a clean result.

## 10. False-positive tests

The Guardian must also demonstrate restraint.

### Flashback safety test

Prompt or inspect Chapter 7, where Dr. Vale is alive in 2045.

Expected result:

```text
No death contradiction.
```

Reason: story time precedes his 2048 death.

### Unknown knowledge test

If no explicit evidence establishes whether a minor character knows a fact, Guardian should not assert:

```text
This character definitely does not know X.
```

Expected behavior:

```text
Knowledge not established / insufficient evidence.
```

### Belief versus truth test

If Mira believes Arka is dead while world truth says he is alive, dialogue consistent with her belief should not be flagged as world-state hallucination merely because the belief is false.

## 11. Ask Your Story demo questions

The corpus should support deterministic questions such as:

1. **When does Mira first learn about Project Helios?**
   - Expected: Chapter 8 / 2048-04-17 with citation.

2. **Is Dr. Vale alive during Chapter 7?**
   - Expected: yes within that flashback's 2045 story time, with evidence and explanation that his later death occurs in 2048.

3. **Why might Arka using a pistol be suspicious?**
   - Expected: cite Chapters 1-2 firearm-avoidance evidence, framed as behavioral continuity evidence rather than an absolute impossibility unless canon states otherwise.

4. **What does Mira know about Helios before Chapter 8?**
   - Expected: no established direct knowledge; distinguish that from proof she explicitly does not know.

5. **What is the relationship between Mira and Arka?**
   - Expected after Chapter 9 context: half-siblings, cited to reveal evidence.

## 12. Canon Diff demo

After a valid generated continuation, the Writer may introduce a persistent detail such as:

```text
Mira carries a silver pendant from her mother.
```

Expected post-generation proposal:

```text
Proposed canon
+ Mira owns a silver pendant
+ Mira received the pendant from her mother
```

User actions:

```text
Accept
Edit
Reject
```

No proposed item becomes strong canon merely because the model wrote it once.

## 13. Evaluation plan

Evaluation should compare at least two conditions:

```text
Baseline generation
vs
Inkrya story-reasoning pipeline
```

A third condition may be useful later:

```text
Inkrya retrieval only
vs
Inkrya full Guardian pipeline
```

### Retrieval metrics

Possible metrics:

- evidence recall for known questions;
- citation correctness;
- stale-revision exclusion;
- temporal filtering correctness;
- character-knowledge retrieval correctness.

### Continuity metrics

Fixture-based binary or categorical metrics:

- hard canon contradiction detected;
- false positive avoided;
- knowledge leak detected;
- flashback handled correctly;
- alive/dead conflict detected;
- unsupported certainty avoided;
- repaired output resolves the targeted issue.

### Generation metrics

Prefer explicit rubric labels rather than arbitrary global scores.

Examples:

```text
continuity_pass: true/false
citations_supported: true/false
unresolved_issue_count: integer
repair_attempts: integer
```

Human evaluation may additionally judge prose quality, usefulness and preference.

## 14. LangSmith evaluation dataset

Build a small repeatable dataset from The Last Signal.

Initial target: 20-40 high-quality cases rather than hundreds of weak synthetic cases.

Suggested categories:

```text
5 retrieval/citation cases
5 story-time cases
5 character-knowledge cases
5 continuity contradiction cases
5 false-positive/abstention cases
5 generation + repair cases
```

Expand only after the first cases are stable.

Each case should record:

```text
input
current chapter/scene
current story time
expected evidence IDs
expected issue type(s)
expected allowed/forbidden conclusions
```

LangSmith traces should retain safe metadata and evaluation results without sending private user manuscripts.

## 15. Toloka optional human evaluation

If time and credits permit, use Toloka for a small human preference study on original synthetic material only.

Possible comparison:

```text
A: baseline continuation
B: Inkrya repaired continuation
```

Questions:

- Which continuation better respects prior story facts?
- Which continuation feels more coherent with character behavior?
- Which continuation would you prefer to keep editing?

Do not make Toloka a dependency for core functionality or submission readiness.

## 16. Research/Tavily demo constraint

If Tavily research is shown, keep external research isolated from fictional canon.

Example:

```text
User asks for realistic orbital communication details.
Research Agent -> Tavily -> cited research notes.
```

Research notes remain a separate source class until the author deliberately incorporates information into manuscript/canon.

Do not let external web results silently overwrite fictional facts.

## 17. Demo UI moments

A strong public demo should make these moments visible:

### Moment 1 — Ask Your Story

Question answered with chapter evidence.

### Moment 2 — Problematic continuation

User asks for a continuation containing hidden contradictions.

### Moment 3 — Agent activity

Show actual stages that executed:

```text
Context retrieved
Plan created
Draft generated
Continuity issues found
Repair attempted
Critic complete
```

### Moment 4 — Evidence-backed Guardian

Show each issue with clickable source evidence.

### Moment 5 — Repaired draft

Compare original problematic draft/request with repaired result.

### Moment 6 — Canon Diff

Show new persistent facts as proposals requiring user approval.

This communicates the full loop:

```text
Remember → Reason → Write → Check → Repair → Learn with permission
```

## 18. Suggested hackathon positioning

User-facing product category:

> AI Writing Workspace for long-form storytelling.

Technical hackathon positioning:

> Agentic Story Reasoning System

or:

> Narrative Intelligence Platform

Core message:

> Inkrya treats a story as evolving, evidence-backed narrative state rather than a flat prompt history.

Avoid positioning the product merely as:

> AI that writes novels.

## 19. Minimum demo acceptance criteria

Before recording the final demo, verify all of the following on the public synthetic project:

- Nebius/NVIDIA inference is actually active and model identity is verified;
- LangSmith tracing works for the demonstrated flow;
- Story Memory retrieves correct evidence;
- Mira/Helios knowledge transition is represented correctly;
- Dr. Vale death and Chapter 7 flashback are represented correctly;
- Guardian detects at least one real knowledge leak;
- Guardian detects at least one hard timeline/canon contradiction;
- Guardian avoids flagging the legitimate Chapter 7 flashback;
- bounded repair produces a more consistent continuation or honestly reports unresolved issues;
- source evidence is inspectable;
- Canon Diff requires explicit author action;
- no private manuscript appears anywhere in demo data or traces;
- demo steps are reproducible from a fresh seeded project.

## 20. Implementation relationship to phases

This demo spec maps to the existing hackathon phase plan:

```text
Phase 1  Nebius + LangSmith infrastructure
Phase 2  Story Memory 2.0
Phase 3  Ask Your Story
Phase 4  Agentic Writing / Guardian / repair
Phase 5  Canon Update
Phase 6  Story Doctor
Phase 7  Tavily Research
Phase 8  Evaluation
Phase 9  Submission
```

The Last Signal should be seeded progressively as those phases become available so the demo corpus doubles as an integration test fixture.

## 21. Final demo narrative

The intended story for judges is simple:

1. A long story contains facts spread across chapters and across story time.
2. A user asks Inkrya to continue a scene.
3. The requested/generated scene conflicts with what the story has established.
4. Inkrya retrieves the relevant evidence instead of relying on a giant prompt dump.
5. Its Guardian identifies specific continuity problems.
6. A bounded repair step produces a better draft.
7. New story information is proposed as canon rather than silently remembered as truth.
8. The author remains in control.

That is the primary hackathon demonstration of Inkrya's narrative intelligence.