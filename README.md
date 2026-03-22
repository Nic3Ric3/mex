<div align="center">

```
  ███╗   ███╗███████╗██╗  ██╗
  ████╗ ████║██╔════╝╚██╗██╔╝
  ██╔████╔██║█████╗   ╚███╔╝
  ██║╚██╔╝██║██╔══╝   ██╔██╗
  ██║ ╚═╝ ██║███████╗██╔╝ ██╗
  ╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
```

**mex**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

AI agents forget everything between sessions. mex gives them permanent, navigable project memory.

Every session starts cold. The agent has no idea what it built yesterday, what conventions you agreed on, or what broke last week. Developers compensate by stuffing everything into CLAUDE.md — but that floods the context window, burns tokens, and degrades attention. Meanwhile, the project changes and nobody updates the docs. The agent's understanding drifts from reality.

mex is a structured markdown scaffold with a CLI that keeps it honest. The scaffold gives agents persistent project knowledge through navigable files — architecture, conventions, decisions, patterns. The CLI detects when those files drift from the actual codebase, and targets AI to fix only what's broken.

## Install

```bash
git clone https://github.com/theDakshJaitly/mex.git .mex
bash .mex/setup.sh
```

The setup script auto-builds the CLI, pre-scans your codebase, and runs a targeted prompt to populate the scaffold. Takes about 5 minutes.

## Drift Detection

Seven checkers validate your scaffold against the real codebase. Zero tokens, zero AI.

| Checker | What it catches |
|---------|----------------|
| **path** | Referenced file paths that don't exist on disk |
| **edges** | YAML frontmatter edge targets pointing to missing files |
| **index-sync** | `patterns/INDEX.md` out of sync with actual pattern files |
| **staleness** | Scaffold files not updated in 30+ days or 50+ commits |
| **command** | `npm run X` / `make X` referencing scripts that don't exist |
| **dependency** | Claimed dependencies missing from `package.json` |
| **cross-file** | Same dependency with different versions across files |

Scoring: starts at 100. Deducts -10 per error, -3 per warning, -1 per info.

## CLI

The CLI is built automatically during `setup.sh`. All commands run from your **project root** (not from inside `.mex/`).

```bash
# Using node directly
node .mex/dist/cli.js check

# Or link it globally for shorter commands
cd .mex && npm link && cd ..
mex check
```

If you need to rebuild manually:

```bash
cd .mex && npm install && npm run build && cd ..
```

### Commands

| Command | What it does |
|---------|-------------|
| `node .mex/dist/cli.js check` | Run all 7 checkers, output drift score and issues |
| `node .mex/dist/cli.js check --quiet` | One-liner: `mex: drift score 92/100 (1 warning)` |
| `node .mex/dist/cli.js check --json` | Full report as JSON for programmatic use |
| `node .mex/dist/cli.js init` | Pre-scan codebase, build structured brief for AI |
| `node .mex/dist/cli.js init --json` | Raw scanner brief as JSON |
| `node .mex/dist/cli.js sync` | Detect drift → build per-file prompts → AI fixes → verify |
| `node .mex/dist/cli.js sync --dry-run` | Preview targeted prompts without executing |
| `node .mex/dist/cli.js sync --warnings` | Include warning-only files in sync |
| `node .mex/dist/cli.js watch` | Install post-commit hook for automatic drift score |
| `node .mex/dist/cli.js watch --uninstall` | Remove the hook |

If you ran `npm link`, replace `node .mex/dist/cli.js` with `mex` in all commands above.

### Scripts

These run from inside `.mex/` or with the path prefix. They auto-build the CLI if needed.

```bash
bash .mex/setup.sh       # First-time setup — scan, prompt, populate
bash .mex/sync.sh        # Interactive menu — check, sync, or export prompt
bash .mex/update.sh      # Pull latest mex infrastructure, keep your content
```

## Before / After

Real output from testing mex on [Agrow](https://github.com/), an AI-powered agricultural voice helpline (Python/Flask, Twilio, multi-provider pipeline).

**Scaffold before setup:**
```markdown
## Current Project State
<!-- What is working. What is not yet built. Known issues.
     Update this section whenever significant work is completed. -->
```

**Scaffold after setup:**
```markdown
## Current Project State

**Working:**
- Voice call pipeline (Twilio → STT → LLM → TTS → response)
- Multi-provider STT (ElevenLabs, Deepgram) with configurable selection
- RAG system with Supabase pgvector for agricultural knowledge retrieval
- Streaming pipeline with barge-in support

**Not yet built:**
- Admin dashboard for call monitoring
- Automated test suite
- Multi-turn conversation memory across calls

**Known issues:**
- Sarvam AI STT bypass active — routing to ElevenLabs as fallback
```

**Patterns directory after setup:**
```
patterns/
├── add-api-client.md       # Steps, gotchas, verify checklist for new service clients
├── add-language-support.md  # How to extend the 8-language voice pipeline
├── debug-pipeline.md        # Where to look when a call fails at each stage
└── add-rag-documents.md     # How to ingest new agricultural knowledge
```

## How It Works

```
Session starts
    ↓
Agent loads CLAUDE.md (auto-loaded, lives at project root)
    ↓
CLAUDE.md says "Read .mex/ROUTER.md before doing anything"
    ↓
ROUTER.md routing table → loads relevant context file for this task
    ↓
context file → points to pattern file if task-specific guidance exists
    ↓
Agent executes with full project context, minimal token cost
```

CLAUDE.md stays at ~120 tokens. The agent navigates to only what it needs.

## File Structure

```
your-project/
├── CLAUDE.md              ← auto-loaded by tool, points to .mex/
├── .mex/
│   ├── ROUTER.md          ← routing table, session bootstrap
│   ├── AGENTS.md          ← always-loaded anchor (~150 tokens)
│   ├── context/
│   │   ├── architecture.md   # how components connect
│   │   ├── stack.md           # technology choices and reasoning
│   │   ├── conventions.md     # naming, structure, patterns
│   │   ├── decisions.md       # append-only decision log
│   │   └── setup.md           # how to run locally
│   ├── patterns/
│   │   ├── INDEX.md           # pattern registry
│   │   └── *.md               # task-specific guides with gotchas + verify checklists
│   ├── setup.sh            # first-time setup
│   ├── sync.sh             # interactive drift check + sync
│   └── update.sh           # pull latest mex without touching content
└── src/
```

## Multi-Tool Compatibility

| Tool | Config file |
|------|------------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `copilot-instructions.md` |

All config files contain identical content. `setup.sh` asks which tool you use and copies the right one.

## Contributing

Contributions welcome. Open an issue or submit a PR.

## License

[MIT](LICENSE)