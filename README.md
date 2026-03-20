# mex — Universal AI Context Scaffold

A structured context system for AI coding agents. Clone it into your project, run the setup prompt, and your agent gets persistent project knowledge, structured navigation, and drift prevention — for any codebase, any stack.

## The Problem

AI coding agents have three failure modes:

1. **Session amnesia** — every session starts cold. The agent forgets past decisions, conventions, and context.
2. **Context flooding** — to compensate, developers dump everything into CLAUDE.md or system prompts. Token costs explode, attention degrades.
3. **Drift** — over time, the agent's understanding of your codebase diverges from reality. Small deviations compound.

Most solutions address one of these. CLAUDE.md fixes amnesia but creates flooding. RAG systems fix flooding but don't prevent drift. Nothing connects them.

## Pave the Road

Think of your codebase as a city and your AI agent as a new driver.

**Without a scaffold**, you hand the driver a 50-page document every trip. It contains every street name, every speed limit, every construction zone, every local custom. The driver reads the whole thing before turning the key. Most of it is irrelevant to today's route. Some of it is out of date.

**With CLAUDE.md alone**, you highlight the important parts. Better — but it's still one document, and when the road changes, nobody updates the map.

**With mex**, you pave actual roads. The driver starts at a known intersection (HANDOVER.md), checks the routing table for today's destination, and follows signs to the relevant context. The roads exist whether or not the driver has been here before. When construction happens, SYNC.md resurfaces the roads.

The scaffold isn't documentation. It's infrastructure.

## How This Is Different

CLAUDE.md and AGENTS.md solve **context injection** — getting information into the agent. mex solves **context navigation** — the agent traverses a structured graph to find exactly what it needs for each task, instead of loading everything or guessing.

| | CLAUDE.md alone | mex |
|---|---|---|
| **What the agent knows at session start** | Everything in the file (or nothing) | A 120-token anchor that says "read HANDOVER.md" |
| **How context scales** | File grows until attention degrades | Agent navigates to only the context it needs |
| **What happens after a refactor** | Manual edits or stale docs | Run SYNC.md — agent detects and fixes drift |
| **Task-specific guidance** | Generic rules for all tasks | Pattern files loaded per task type |
| **Decision history** | Overwritten or forgotten | Append-only log with reasoning preserved |

AGENTS.md is one section of this scaffold. We extend the standard, not replace it.

## Before / After

Real output from testing mex on [Agrow](https://github.com/), an AI-powered agricultural voice helpline (Python/Flask, Twilio, multi-provider AI pipeline).

### HANDOVER.md — empty scaffold vs. populated

**Before** (what you clone):
```markdown
## Current Project State
<!-- What is working. What is not yet built. Known issues.
     Update this section whenever significant work is completed. -->
```

**After** (what the agent writes after reading your codebase):
```markdown
## Current Project State

**Working:**
- Voice call pipeline (Twilio → STT → LLM → TTS → response)
- Multi-provider STT (ElevenLabs, Deepgram) with configurable selection
- RAG system with Supabase pgvector for agricultural knowledge retrieval
- Streaming pipeline with barge-in support
- Location capture and soil test agency lookup

**Not yet built:**
- Admin dashboard for call monitoring
- Automated test suite
- Multi-turn conversation memory across calls

**Known issues:**
- Sarvam AI STT bypass active — routing to ElevenLabs as fallback
```

### patterns/ — empty scaffold vs. populated

**Before:** An empty directory with a format guide.

**After** (agent generates starter patterns from your actual stack):
```
patterns/
├── add-api-client.md      # Steps, gotchas, verify checklist for adding a new service client
├── add-language-support.md # How to extend the 8-language voice pipeline
├── debug-pipeline.md       # Where to look when a call fails at each pipeline stage
└── add-rag-documents.md    # How to ingest new agricultural knowledge into pgvector
```

### Cold bootstrap — what actually happens

We gave a fresh agent (no prior context) this task: *"Add a new API client for Deepgram batch transcription."*

**Without mex:** Agent reads some files, writes a client that works but doesn't match existing patterns, misses config injection, skips rate limiting.

**With mex:** Agent automatically reads HANDOVER.md → routes to `context/conventions.md` → finds `patterns/add-api-client.md` → follows the step-by-step → produces a client that matches existing structure, uses `AppConfig` injection, includes rate limit config, and passes the conventions verify checklist.

The agent read 11 files in the right order. The pattern file told it exactly what to do. Zero guidance from the developer.

## Getting Started

### Option A — Setup script (recommended)

```bash
# From your project root
git clone <repo-url> .mex
.mex/setup.sh
```

The script detects your project state (existing/fresh/partial), copies scaffold files, asks which AI tool you use, and prints the exact prompt to paste into your agent.

### Option B — Manual setup

```bash
# From your project root
git clone <repo-url> .mex
cp -r .mex/AGENTS.md .mex/HANDOVER.md .mex/SETUP.md .mex/SYNC.md .
cp -r .mex/context .mex/patterns .

# Copy your tool config
cp .mex/.tool-configs/CLAUDE.md ./CLAUDE.md          # Claude Code
cp .mex/.tool-configs/.cursorrules ./.cursorrules      # Cursor
cp .mex/.tool-configs/.windsurfrules ./.windsurfrules  # Windsurf
```

Then open `SETUP.md`, copy the setup prompt, paste it into your agent.

### Verify

Ask your agent: *"Read HANDOVER.md and tell me what you know about this project."*

If it can describe your architecture, name your services, and explain your conventions — the scaffold is working.

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
Agent executes with full project context, minimal token cost
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

## FAQ

### Why not just use CLAUDE.md?

CLAUDE.md is great — we use it. It's the entry point. But it has a scaling problem.

Small project? CLAUDE.md is all you need. Put your conventions in there, done.

But once your project has 10+ services, multiple API clients, a deployment pipeline, and conventions that vary by layer — you hit a wall. Either CLAUDE.md becomes a 2000-line doc that burns tokens and dilutes attention, or you keep it short and the agent misses things.

mex keeps CLAUDE.md short (~120 tokens) and turns it into a *pointer*: "Read HANDOVER.md before doing anything." From there, the agent navigates to only the context it needs. Your CLAUDE.md stays lean. Your agent stays informed.

**Use CLAUDE.md alone when:** your project is small, conventions are simple, one file covers it.

**Add mex when:** your agent keeps forgetting things, your CLAUDE.md is getting long, or you're tired of re-explaining the same context every session.

### Does this work with tools other than Claude Code?

Yes. The scaffold is tool-agnostic. The core files (AGENTS.md, HANDOVER.md, context/, patterns/) work with any agent that can read files. Tool-specific config files (`.cursorrules`, `.windsurfrules`, `copilot-instructions.md`) are provided in `.tool-configs/` — they all contain the same content.

### How much setup time?

About 5 minutes. Clone, copy files, paste the setup prompt. The agent does the rest.

### What if my codebase changes?

Run the SYNC.md prompt. The agent compares the scaffold to the current codebase and updates what has drifted. Decisions are never deleted — superseded entries preserve the reasoning history.

## Multi-Tool Compatibility

| Tool | File |
|------|------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `copilot-instructions.md` |
| Any tool / generic | `AGENTS.md` (root) |

All tool-config files contain identical content. See `.tool-configs/README.md`.

## Design Principles

- **Minimal always-loaded surface** — AGENTS.md stays under 150 tokens. Everything else is navigated to on demand.
- **Structured navigation over context dumping** — the agent traverses a graph, not a wall of text.
- **Drift prevention built in** — SYNC.md keeps the scaffold aligned with reality. Decisions are append-only.
- **Tool-agnostic** — works with any AI coding tool. No vendor lock-in.
- **No tech-stack assumptions** — every file works for any project type.
