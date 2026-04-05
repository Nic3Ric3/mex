# Tool Configuration Files

These files make the scaffold work with specific AI coding tools.
All contain the same content — a pointer to `.mex/ROUTER.md`.

## Which file does your tool use?

| Tool | File to use |
|------|-------------|
| Claude Code | `CLAUDE.md` → copy or symlink to project root |
| Cursor | `.cursorrules` → copy or symlink to project root |
| Windsurf | `.windsurfrules` → copy or symlink to project root |
| GitHub Copilot | `copilot-instructions.md` → copy to `.github/` in project root |
| OpenCode | `opencode.json` → copy to `.opencode/` in project root |
| Codex (OpenAI) | Copy `CLAUDE.md` as `AGENTS.md` to project root |
| Any other tool | Point agent to `.mex/AGENTS.md` |

## Setup

Copy the relevant file to the correct location in your project root:

```bash
# Claude Code
cp .tool-configs/CLAUDE.md ./CLAUDE.md

# Cursor
cp .tool-configs/.cursorrules ./.cursorrules

# Windsurf
cp .tool-configs/.windsurfrules ./.windsurfrules

# Copilot
mkdir -p .github && cp .tool-configs/copilot-instructions.md ./.github/copilot-instructions.md

# OpenCode
mkdir -p .opencode && cp .tool-configs/opencode.json ./.opencode/opencode.json

# Codex (OpenAI)
cp .tool-configs/CLAUDE.md ./AGENTS.md
```

## If your tool is not listed

Add "Read .mex/ROUTER.md before starting any task" to your tool's system prompt
or paste it at the start of each session. The scaffold works identically.

## Content

All files contain identical content — the Circle 1 anchor from `.mex/AGENTS.md`.
`.mex/AGENTS.md` is the source of truth. If you update it, update your root tool config too.
