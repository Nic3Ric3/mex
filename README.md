# Universal AI Context Scaffold

A structured context system for AI coding agents. Clone it into your project, run the setup prompt, and your agent gets persistent project knowledge, structured navigation, and drift prevention — for any codebase, any stack.

## The Problem

AI coding agents have three failure modes:

1. **Session amnesia** — every session starts cold. The agent forgets past decisions, conventions, and context.
2. **Context flooding** — to compensate, developers dump everything into CLAUDE.md or system prompts. Token costs explode, attention degrades.
3. **Drift** — over time, the agent's understanding of your codebase diverges from reality. Small deviations compound.

## How This Is Different

CLAUDE.md and AGENTS.md solve context injection — getting information into the agent. This scaffold solves context **navigation** — the agent traverses a structured graph to find exactly what it needs for each task, instead of loading everything or missing things entirely.

AGENTS.md is one section of this scaffold. We extend the standard, not replace it.

## Getting Started

### 1. Clone into your project

```bash
# From your project root
git clone <repo-url> .scaffold
cp -r .scaffold/AGENTS.md .scaffold/HANDOVER.md .scaffold/SETUP.md .scaffold/SYNC.md .
cp -r .scaffold/context .scaffold/patterns .
```

### 2. Copy your tool config (optional)

```bash
# Claude Code
cp .scaffold/.tool-configs/CLAUDE.md ./CLAUDE.md

# Cursor
cp .scaffold/.tool-configs/.cursorrules ./.cursorrules

# Windsurf
cp .scaffold/.tool-configs/.windsurfrules ./.windsurfrules

# Copilot
mkdir -p .github && cp .scaffold/.tool-configs/copilot-instructions.md ./.github/copilot-instructions.md
```

### 3. Populate

Open `SETUP.md`, copy the setup prompt, paste it into your agent. The agent reads your codebase and fills every scaffold file with project-specific content.

### 4. Verify

Ask your agent: "Read HANDOVER.md and tell me what you know about this project."

## How It Works

```
Session starts
    ↓
Agent loads AGENTS.md (auto-loaded by tool, or pasted by developer)
    ↓
AGENTS.md → "Read HANDOVER.md at session start"
    ↓
HANDOVER.md → routing table → loads relevant context/ file for this task
    ↓
context/ file → points to patterns/ if task-specific wisdom exists
    ↓
Agent executes with full project context
```

## File Types

### Type 1 — Knowledge Files (`context/`)

Facts about the project. Architecture, stack, conventions, decisions, setup. Populated by the agent reading your codebase. Updated via `SYNC.md` when things change.

| File | Contains |
|------|----------|
| `architecture.md` | How the major pieces connect and flow |
| `stack.md` | Technology choices and reasoning |
| `conventions.md` | How code is written here — naming, structure, patterns |
| `decisions.md` | Key decisions with reasoning (event clock, never overwritten) |
| `setup.md` | How to run this project locally |

### Type 2 — Pattern Files (`patterns/`)

The things you would tell your agent if you were sitting next to it. Gotchas, verify checklists, debug trees. Added by you over time as patterns emerge. See `patterns/README.md` for the format.

### Root Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Always-loaded anchor (~150 tokens) |
| `HANDOVER.md` | Session bootstrap, routing table, behavioural contract |
| `SETUP.md` | Population prompt — how to fill the scaffold |
| `SYNC.md` | Resync prompt — how to realign after drift |

## Multi-Tool Compatibility

| Tool | File |
|------|------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `copilot-instructions.md` |
| Any tool / generic | `AGENTS.md` (root) |

All tool-config files contain identical content. See `.tool-configs/README.md`.

## Keeping It Current

When your codebase changes significantly, open `SYNC.md`, copy the sync prompt, paste it into your agent. The agent compares the scaffold to the current codebase and updates what has drifted. Decisions are never deleted — superseded entries preserve the reasoning history.

## Design Principles

- **Minimal always-loaded surface** — AGENTS.md stays under 150 tokens. Everything else is navigated to on demand.
- **Structured navigation over context dumping** — the agent traverses a graph, not a wall of text.
- **Drift prevention built in** — SYNC.md keeps the scaffold aligned with reality. Decisions are append-only.
- **Tool-agnostic** — works with any AI coding tool. No vendor lock-in.
- **No tech-stack assumptions** — every file works for any project type.
