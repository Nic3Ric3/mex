# Patterns

This folder contains task-specific guidance — the things you would tell your agent if you were sitting next to it. Not generic instructions. Project-specific accumulated wisdom.

## What belongs here

A pattern file is worth creating when:
- You've explained the same thing to your agent more than twice
- A task has a gotcha that isn't obvious from the codebase
- Something broke and you want to prevent it from breaking the same way again
- There's a verify checklist specific to one type of task

## What does NOT belong here

- Generic programming advice the agent already knows
- Things already covered in `context/conventions.md`
- Step-by-step instructions for things that are obvious from the code

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

## Gotchas
[The things that go wrong. What to watch out for.]

## Verify
[Checklist to run after completing this task type]

## Debug
[What to check when this task type breaks]
```

## Example pattern files

- `add-api-endpoint.md` — conventions for new endpoints, required middleware, response format
- `database-migration.md` — how to write migrations safely, rollback strategy
- `debug-auth.md` — diagnosis tree for authentication issues
- `write-test.md` — testing conventions, what to mock, what not to mock
