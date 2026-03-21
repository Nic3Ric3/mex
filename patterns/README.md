# Patterns

This folder contains task-specific guidance — the things you would tell your agent if you were sitting next to it. Not generic instructions. Project-specific accumulated wisdom.

## How patterns get created

**During setup:** After the context/ files are populated, the agent generates starter patterns based on the project's actual stack, architecture, and conventions. These are stack-specific — a Flask API project gets different patterns than a React SPA or a CLI tool.

**Over time:** You or your agent add patterns as they emerge from real work — when something breaks, when a task has a non-obvious gotcha, when you've explained the same thing twice.

## What belongs here

A pattern file is worth creating when:
- A task type is common in this project and has a repeatable workflow
- There are integration gotchas between components that aren't obvious from code
- Something broke and you want to prevent it from breaking the same way again
- A verify checklist specific to one type of task would catch mistakes early

## What does NOT belong here

- Generic programming advice the agent already knows
- Things already covered in `context/conventions.md`
- Step-by-step instructions for things that are obvious from the code
- Patterns that don't apply to this project's stack

## Format

Every pattern file follows this structure:

```markdown
---
name: [pattern-name]
description: [one line — what this pattern covers and when to use it]
triggers:
  - "[keyword that should trigger loading this file]"
last_updated: [YYYY-MM-DD]
---

# [Pattern Name]

## Context
[What to load or know before starting this task type]

## Steps
[The workflow — what to do, in what order]

## Gotchas
[The things that go wrong. What to watch out for.]

## Verify
[Checklist to run after completing this task type]

## Debug
[What to check when this task type breaks]
```

## Pattern categories to consider

<!-- The setup agent uses these categories to decide which starter patterns to generate.
     Not every project needs all of these. Generate only what applies to THIS project's
     stack and architecture. Aim for 2-5 starter patterns.

     Category 1 — Common task patterns
     The repeatable tasks in this project. What does a developer do most often?
     Examples by project type:
     - API: "add new endpoint", "add new model/entity"
     - Frontend: "add new page/route", "add new component"
     - CLI: "add new command", "add new flag/option"
     - Pipeline: "add new pipeline stage", "add new data source"
     Derive from: context/architecture.md (what are the major components?) and
     context/conventions.md (what patterns exist for extending them?)

     Category 2 — Integration patterns
     How to work with the external dependencies in this project.
     Every entry in context/stack.md "Key Libraries" or architecture.md "External Dependencies"
     that has non-obvious setup, gotchas, or failure modes deserves a pattern.
     Examples: "calling the payments API", "running database migrations",
     "adding a new third-party service client"

     Category 3 — Debug/diagnosis patterns
     When something breaks, where do you look? Derive from the architecture flow —
     each boundary between components is a potential failure point.
     Examples: "debug webhook failures", "debug pipeline stage failures",
     "diagnose auth/permission issues"

     Category 4 — Deploy/release patterns
     If the project has deployment steps that aren't fully automated or have gotchas.
     Only generate if context/setup.md reveals non-trivial deployment.
     Examples: "deploy to staging", "rollback a release", "update environment config" -->
