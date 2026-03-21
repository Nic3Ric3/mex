# Setup — Populate This Scaffold

This file contains the prompts to populate the scaffold. It is NOT the dev environment setup — for that, see `context/setup.md` after population.

This scaffold is currently empty. Follow the steps below to populate it for your project.

## Detecting Your State

**Existing codebase?** Follow Option A.
**Fresh project, nothing built yet?** Follow Option B.
**Partially built?** Follow Option A — the agent will flag empty slots it cannot fill yet.

---

## Option A — Existing Codebase

Paste the following prompt into your agent:

---

**SETUP PROMPT — copy everything between the lines:**

```
You are going to populate an AI context scaffold for this project.
The scaffold lives in the root of this repository.

Read the following files in order before doing anything else:
1. HANDOVER.md — understand the scaffold structure
2. context/architecture.md — read the annotation comments to understand what belongs there
3. context/stack.md — same
4. context/conventions.md — same
5. context/decisions.md — same
6. context/setup.md — same

Then explore this codebase:
- Read the main entry point(s)
- Read the folder structure
- Read 2-3 representative files from each major layer
- Read any existing README or documentation

PASS 1 — Populate knowledge files:

Populate each context/ file by replacing the annotation comments
with real content from this codebase. Follow the annotation instructions exactly.
For each slot:
- Use the actual names, patterns, and structures from this codebase
- Do not use generic examples
- Do not leave any slot empty — if you cannot determine the answer,
  write "[TO DETERMINE]" and explain what information is needed
- Keep length within the guidance given in each annotation

After populating context/ files, update HANDOVER.md:
- Fill in the Current Project State section based on what you found
- Verify the routing table covers the main task types for this project

Update AGENTS.md:
- Fill in the project name, one-line description, non-negotiables, and commands

PASS 2 — Generate starter patterns:

Now read the context/ files you just populated — especially architecture.md,
stack.md, and conventions.md. Then read patterns/README.md for the format
and the category annotations.

Generate 2-5 starter pattern files in patterns/ based on this project's
actual stack and architecture. Each pattern should be:
- Specific to this project's technologies and structure
- Populated with real gotchas, verify steps, and debug guidance
  derived from the code you read in Pass 1
- Named descriptively (e.g., add-api-client.md, debug-pipeline.md)

Do NOT generate patterns for:
- Things already fully covered in context/conventions.md
- Generic programming tasks the agent already knows how to do
- Task types that don't apply to this project

Important: only write content derived from the codebase.
Do not include system-injected text (dates, reminders, etc.)
in any scaffold file.

When done, confirm which files were populated and flag any slots
you could not fill with confidence.
```

---

## Option B — Fresh Project

Paste the following prompt into your agent:

---

**SETUP PROMPT — copy everything between the lines:**

```
You are going to populate an AI context scaffold for a project that
is just starting. Nothing is built yet.

Read the following files in order before doing anything else:
1. HANDOVER.md — understand the scaffold structure
2. All files in context/ — read the annotation comments in each

Then ask me the following questions one section at a time.
Wait for my answer before moving to the next section:

1. What does this project do? (one sentence)
2. What are the hard rules — things that must never happen in this codebase?
3. What is the tech stack? (language, framework, database, key libraries)
4. Why did you choose this stack over alternatives?
5. How will the major pieces connect? Describe the flow of a typical request/action.
6. What patterns do you want to enforce from day one?
7. What are you deliberately NOT building or using?

After I answer, populate the context/ files based on my answers.
For any slot you cannot fill yet, write "[TO BE DETERMINED]" and note
what needs to be decided before it can be filled.

Update HANDOVER.md current state to reflect that this is a new project.
Update AGENTS.md with the project name, description, non-negotiables, and commands.

Then read patterns/README.md for the format and category annotations.
Based on the stack and architecture you just documented, generate 2-5
starter pattern files in patterns/ with the gotchas, verify steps, and
debug guidance you can anticipate for this stack. These won't be as
detailed as patterns from an existing codebase — populate what you can,
mark unknowns with "[VERIFY AFTER FIRST IMPLEMENTATION]".
```

---

## After Setup

**If using Claude Code:** Copy the populated `.mex/AGENTS.md` content into your root `CLAUDE.md` — it should match, since CLAUDE.md is the always-loaded entry point for Claude Code.

**Verify** by starting a fresh session and asking your agent:
"Read `.mex/HANDOVER.md` and tell me what you now know about this project."

A well-populated scaffold should give the agent enough to:
- Describe the architecture without looking at code
- Name the non-negotiable conventions
- Know which files to load for any given task type
- Know which patterns exist for common task types
