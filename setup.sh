#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# mex setup — copy scaffold files + detect project state + print setup prompt
# ─────────────────────────────────────────────────────────────

# Parse flags
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
  esac
done

# Resolve the directory where this script (and the scaffold source files) live.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The target project root is the current working directory.
PROJECT_DIR="$(pwd)"

# Don't run inside the mex repo itself.
if [ "$SCRIPT_DIR" = "$PROJECT_DIR" ]; then
  echo "Error: run this script from your project root, not from inside the mex repo."
  echo ""
  echo "Usage:"
  echo "  cd /path/to/your/project"
  echo "  /path/to/mex/setup.sh"
  echo "  # or: .mex/setup.sh  (if you cloned mex into .mex)"
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { printf "${BLUE}→${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$1"; }
header(){ printf "\n${BOLD}%s${NC}\n" "$1"; }

# Copy a file, but ask before overwriting.
safe_copy() {
  local src="$1" dest="$2"
  if [ "$DRY_RUN" -eq 1 ]; then
    if [ -f "$dest" ]; then
      warn "(dry run) Would overwrite $dest"
    else
      ok "(dry run) Would copy $dest"
    fi
    return 0
  fi
  if [ -f "$dest" ]; then
    printf "${YELLOW}!${NC} %s already exists. Overwrite? [y/N] " "$dest"
    read -r answer
    if [[ ! "$answer" =~ ^[Yy]$ ]]; then
      warn "Skipped $dest"
      return 0
    fi
  fi
  cp "$src" "$dest"
  ok "Copied $dest"
}

# Copy a directory, merging with existing. Asks before overwriting individual files.
safe_copy_dir() {
  local src_dir="$1" dest_dir="$2"
  [ "$DRY_RUN" -eq 0 ] && mkdir -p "$dest_dir"
  for file in "$src_dir"/*; do
    [ -f "$file" ] || continue
    local filename
    filename="$(basename "$file")"
    safe_copy "$file" "$dest_dir/$filename"
  done
}

# ─────────────────────────────────────────────────────────────
# Step 1 — Detect project state
# ─────────────────────────────────────────────────────────────

header "mex — Universal AI Context Scaffold"
if [ "$DRY_RUN" -eq 1 ]; then
  warn "DRY RUN — no files will be created or modified"
fi
echo ""

detect_state() {
  local source_file_count scaffold_populated

  # Count source files (not config/docs)
  source_file_count=$(find "$PROJECT_DIR" -maxdepth 4 \
    -type f \( \
      -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.tsx" \
      -o -name "*.jsx" -o -name "*.go" -o -name "*.rs" -o -name "*.java" \
      -o -name "*.kt" -o -name "*.swift" -o -name "*.rb" -o -name "*.php" \
      -o -name "*.c" -o -name "*.cpp" -o -name "*.cs" -o -name "*.ex" \
      -o -name "*.exs" -o -name "*.zig" -o -name "*.lua" -o -name "*.dart" \
      -o -name "*.scala" -o -name "*.clj" -o -name "*.erl" -o -name "*.hs" \
      -o -name "*.ml" -o -name "*.vue" -o -name "*.svelte" \
    \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.mex/*" \
    ! -path "*/.scaffold/*" \
    ! -path "*/vendor/*" \
    ! -path "*/.git/*" \
    2>/dev/null | wc -l | tr -d ' ')

  # Check if scaffold is already partially populated (annotation comments replaced)
  scaffold_populated=0
  if [ -f "$PROJECT_DIR/.mex/AGENTS.md" ]; then
    # If AGENTS.md exists and does NOT contain the placeholder, it's been populated
    if ! grep -q '\[Project Name\]' "$PROJECT_DIR/.mex/AGENTS.md" 2>/dev/null; then
      scaffold_populated=1
    fi
  fi

  if [ "$scaffold_populated" -eq 1 ] && [ "$source_file_count" -gt 0 ]; then
    echo "partial"
  elif [ "$source_file_count" -gt 3 ]; then
    echo "existing"
  else
    echo "fresh"
  fi
}

PROJECT_STATE=$(detect_state)

case "$PROJECT_STATE" in
  existing)
    info "Detected: existing codebase with source files"
    info "Mode: Option A — populate scaffold from code"
    ;;
  fresh)
    info "Detected: fresh project (no source files yet)"
    info "Mode: Option B — populate scaffold from intent"
    ;;
  partial)
    info "Detected: existing codebase with partially populated scaffold"
    info "Mode: Option A — will populate empty slots, skip what's already filled"
    ;;
esac

echo ""

# ─────────────────────────────────────────────────────────────
# Step 2 — Copy scaffold files
# ─────────────────────────────────────────────────────────────

header "Copying scaffold files into .mex/..."

[ "$DRY_RUN" -eq 0 ] && mkdir -p "$PROJECT_DIR/.mex"

# Scaffold files → .mex/
for file in AGENTS.md HANDOVER.md SETUP.md SYNC.md; do
  safe_copy "$SCRIPT_DIR/scaffold/$file" "$PROJECT_DIR/.mex/$file"
done

# context/ directory (all 5 files)
safe_copy_dir "$SCRIPT_DIR/scaffold/context" "$PROJECT_DIR/.mex/context"

# patterns/ directory (README.md only — patterns are generated during population)
[ "$DRY_RUN" -eq 0 ] && mkdir -p "$PROJECT_DIR/.mex/patterns"
safe_copy "$SCRIPT_DIR/scaffold/patterns/README.md" "$PROJECT_DIR/.mex/patterns/README.md"

echo ""

# ─────────────────────────────────────────────────────────────
# Step 3 — Tool config selection
# ─────────────────────────────────────────────────────────────

header "Which AI tool(s) do you use?"
echo ""
echo "  1) Claude Code"
echo "  2) Cursor"
echo "  3) Windsurf"
echo "  4) GitHub Copilot"
echo "  5) Multiple (select next)"
echo "  6) None / other (skip)"
echo ""
printf "Choice [1-6]: "
read -r tool_choice

copy_tool_config() {
  case "$1" in
    1)
      safe_copy "$SCRIPT_DIR/.tool-configs/CLAUDE.md" "$PROJECT_DIR/CLAUDE.md"
      ;;
    2)
      safe_copy "$SCRIPT_DIR/.tool-configs/.cursorrules" "$PROJECT_DIR/.cursorrules"
      ;;
    3)
      safe_copy "$SCRIPT_DIR/.tool-configs/.windsurfrules" "$PROJECT_DIR/.windsurfrules"
      ;;
    4)
      [ "$DRY_RUN" -eq 0 ] && mkdir -p "$PROJECT_DIR/.github"
      safe_copy "$SCRIPT_DIR/.tool-configs/copilot-instructions.md" "$PROJECT_DIR/.github/copilot-instructions.md"
      ;;
  esac
}

case "$tool_choice" in
  1|2|3|4)
    copy_tool_config "$tool_choice"
    ;;
  5)
    echo ""
    printf "Enter tool numbers separated by spaces (e.g. 1 2 4): "
    read -r multi_choices
    for choice in $multi_choices; do
      copy_tool_config "$choice"
    done
    ;;
  6|"")
    info "Skipped tool config — .mex/AGENTS.md works with any tool that can read files"
    ;;
  *)
    warn "Unknown choice, skipping tool config"
    ;;
esac

echo ""

# ─────────────────────────────────────────────────────────────
# Step 4 — Print the setup prompt
# ─────────────────────────────────────────────────────────────

header "Setup complete. Now populate the scaffold."
echo ""
echo "Open your AI agent and paste the prompt below."
echo "The agent will read your codebase and fill every scaffold file."
echo ""
echo "─────────────────── COPY BELOW THIS LINE ───────────────────"
echo ""

if [ "$PROJECT_STATE" = "fresh" ]; then
  cat <<'PROMPT'
You are going to populate an AI context scaffold for a project that
is just starting. Nothing is built yet.

Read the following files in order before doing anything else:
1. .mex/HANDOVER.md — understand the scaffold structure
2. All files in .mex/context/ — read the annotation comments in each

Then ask me the following questions one section at a time.
Wait for my answer before moving to the next section:

1. What does this project do? (one sentence)
2. What are the hard rules — things that must never happen in this codebase?
3. What is the tech stack? (language, framework, database, key libraries)
4. Why did you choose this stack over alternatives?
5. How will the major pieces connect? Describe the flow of a typical request/action.
6. What patterns do you want to enforce from day one?
7. What are you deliberately NOT building or using?

After I answer, populate the .mex/context/ files based on my answers.
For any slot you cannot fill yet, write "[TO BE DETERMINED]" and note
what needs to be decided before it can be filled.

Update .mex/HANDOVER.md current state to reflect that this is a new project.
Update .mex/AGENTS.md with the project name, description, non-negotiables, and commands.

Then read .mex/patterns/README.md for the format and category annotations.
Based on the stack and architecture you just documented, generate 2-5
starter pattern files in .mex/patterns/ with the gotchas, verify steps, and
debug guidance you can anticipate for this stack. These won't be as
detailed as patterns from an existing codebase — populate what you can,
mark unknowns with "[VERIFY AFTER FIRST IMPLEMENTATION]".
PROMPT
else
  # Option A for both "existing" and "partial"
  cat <<'PROMPT'
You are going to populate an AI context scaffold for this project.
The scaffold lives in the .mex/ directory.

Read the following files in order before doing anything else:
1. .mex/HANDOVER.md — understand the scaffold structure
2. .mex/context/architecture.md — read the annotation comments to understand what belongs there
3. .mex/context/stack.md — same
4. .mex/context/conventions.md — same
5. .mex/context/decisions.md — same
6. .mex/context/setup.md — same

Then explore this codebase:
- Read the main entry point(s)
- Read the folder structure
- Read 2-3 representative files from each major layer
- Read any existing README or documentation

PASS 1 — Populate knowledge files:

Populate each .mex/context/ file by replacing the annotation comments
with real content from this codebase. Follow the annotation instructions exactly.
For each slot:
- Use the actual names, patterns, and structures from this codebase
- Do not use generic examples
- Do not leave any slot empty — if you cannot determine the answer,
  write "[TO DETERMINE]" and explain what information is needed
- Keep length within the guidance given in each annotation

After populating .mex/context/ files, update .mex/HANDOVER.md:
- Fill in the Current Project State section based on what you found
- Verify the routing table covers the main task types for this project

Update .mex/AGENTS.md:
- Fill in the project name, one-line description, non-negotiables, and commands

PASS 2 — Generate starter patterns:

Now read the .mex/context/ files you just populated — especially architecture.md,
stack.md, and conventions.md. Then read .mex/patterns/README.md for the format
and the category annotations.

Generate 2-5 starter pattern files in .mex/patterns/ based on this project's
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
PROMPT
fi

echo ""
echo "─────────────────── COPY ABOVE THIS LINE ───────────────────"
echo ""

# ─────────────────────────────────────────────────────────────
# After-setup reminder
# ─────────────────────────────────────────────────────────────

if [ "$tool_choice" = "1" ]; then
  echo ""
  info "Claude Code reminder: after the agent populates .mex/AGENTS.md,"
  info "copy its content into your root CLAUDE.md so Claude Code auto-loads it."
fi

echo ""
ok "Done. Paste the prompt above into your agent to populate the scaffold."
