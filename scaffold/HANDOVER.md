---
name: handover
description: Session bootstrap and navigation hub. Read at the start of every session before any task. Contains project state, routing table, and behavioural contract.
edges:
  - target: context/architecture.md
    condition: when working on system design, integrations, or understanding how components connect
  - target: context/stack.md
    condition: when working with specific technologies, libraries, or making tech decisions
  - target: context/conventions.md
    condition: when writing new code, reviewing code, or unsure about project patterns
  - target: context/decisions.md
    condition: when making architectural choices or understanding why something is built a certain way
  - target: context/setup.md
    condition: when setting up the dev environment or running the project for the first time
  - target: patterns/
    condition: when starting a task — check if a pattern file exists for this task type
last_updated: [YYYY-MM-DD]
---

# Session Bootstrap

If you haven't already read `AGENTS.md`, read it now — it contains the project identity, non-negotiables, and commands.

Then read this file fully before doing anything else in this session.

## Current Project State
<!-- What is working. What is not yet built. Known issues.
     Update this section whenever significant work is completed.
     This is the primary drift prevention mechanism — it re-grounds the agent every session.
     Length: 3 sections (Working / Not Built / Known Issues), 3-7 items each.
     Example:
     **Working:**
     - User authentication and session management
     - Core CRUD operations for all main entities

     **Not yet built:**
     - Email notification system
     - Admin dashboard

     **Known issues:**
     - Pagination breaks on filtered queries with more than 1000 results -->

## Routing Table

Load the relevant file based on the current task. Always load `context/architecture.md` first if not already in context this session.

| Task type | Load |
|-----------|------|
| Understanding how the system works | `context/architecture.md` |
| Working with a specific technology | `context/stack.md` |
| Writing or reviewing code | `context/conventions.md` |
| Making a design decision | `context/decisions.md` |
| Setting up or running the project | `context/setup.md` |
| Any specific task | Check `patterns/` for a matching pattern file |

## Behavioural Contract

These rules apply in every session, for every task:

1. **Narrate navigation.** When you load a context file, say so explicitly: "Loading architecture context..." This keeps the developer informed and prevents silent context gaps.
2. **Check patterns first.** Before starting any task, check if a pattern file exists in `patterns/` for this task type. If it exists, follow it.
3. **Show verification.** After completing a task, explicitly check your output against `context/conventions.md`. State what you checked.
4. **Flag deviations.** If you are about to do something that deviates from an established pattern in this codebase, say so before writing any code. State the deviation and why.
5. **Update state.** When significant work completes, update the "Current Project State" section above.
