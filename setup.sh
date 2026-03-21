#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# mex setup — detect project state, copy tool config, populate scaffold
# ─────────────────────────────────────────────────────────────

# Parse flags
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
  esac
done

# Resolve the directory where this script (and the scaffold files) live.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The target project root is the current working directory.
PROJECT_DIR="$(pwd)"

# Don't run inside the mex repo itself.
if [ "$SCRIPT_DIR" = "$PROJECT_DIR" ]; then
  echo "Error: run this script from your project root, not from inside the mex repo."
  echo ""
  echo "Usage:"
  echo "  cd /path/to/your/project"
  echo "  .mex/setup.sh"
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
# Royal blue #1944F1 = RGB(25, 68, 241)
ROYAL='\033[38;2;25;68;241m'

info()  { printf "${BLUE}→${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$1"; }
header(){ printf "\n${BOLD}%s${NC}\n" "$1"; }

banner() {
  printf "${ROYAL}"
  cat <<'ART'

  ███╗   ███╗███████╗██╗  ██╗
  ████╗ ████║██╔════╝╚██╗██╔╝
  ██╔████╔██║█████╗   ╚███╔╝
  ██║╚██╔╝██║██╔══╝   ██╔██╗
  ██║ ╚═╝ ██║███████╗██╔╝ ██╗
  ╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝

ART
  printf "${NC}"
  printf "  ${BOLD}universal ai context scaffold${NC}\n"
}

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

# ─────────────────────────────────────────────────────────────
# Step 1 — Detect project state
# ─────────────────────────────────────────────────────────────

banner
echo ""
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
    ! -path "*/vendor/*" \
    ! -path "*/.git/*" \
    2>/dev/null | wc -l | tr -d ' ')

  # Check if scaffold is already partially populated (annotation comments replaced)
  scaffold_populated=0
  if [ -f "$PROJECT_DIR/.mex/AGENTS.md" ]; then
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
    info "Mode: populate scaffold from code"
    ;;
  fresh)
    info "Detected: fresh project (no source files yet)"
    info "Mode: populate scaffold from intent"
    ;;
  partial)
    info "Detected: existing codebase with partially populated scaffold"
    info "Mode: will populate empty slots, skip what's already filled"
    ;;
esac

echo ""

# ─────────────────────────────────────────────────────────────
# Step 2 — Tool config selection (copy to project root)
# ─────────────────────────────────────────────────────────────

header "Which AI tool do you use?"
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

SELECTED_CLAUDE=0

copy_tool_config() {
  case "$1" in
    1)
      safe_copy "$SCRIPT_DIR/.tool-configs/CLAUDE.md" "$PROJECT_DIR/CLAUDE.md"
      SELECTED_CLAUDE=1
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
    info "Skipped tool config — AGENTS.md in .mex/ works with any tool that can read files"
    ;;
  *)
    warn "Unknown choice, skipping tool config"
    ;;
esac

echo ""

# ─────────────────────────────────────────────────────────────
# Step 3 — Build the setup prompt
# ─────────────────────────────────────────────────────────────

if [ "$PROJECT_STATE" = "fresh" ]; then
  SETUP_PROMPT='You are going to populate an AI context scaffold for a project that
is just starting. Nothing is built yet.

Read the following files in order before doing anything else:
1. .mex/ROUTER.md — understand the scaffold structure
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

Then assess: based on my answers, does this project have domains complex
enough that cramming them into architecture.md would make it too long
or too shallow? If yes, create additional domain-specific context files
in .mex/context/. Examples: a project with a complex auth system gets
.mex/context/auth.md. A data pipeline gets .mex/context/ingestion.md.
A project with Stripe gets .mex/context/payments.md. Use the same YAML
frontmatter format (name, description, triggers, edges, last_updated).
Only create these for domains that have real depth — not for simple
integrations that fit in a few lines of architecture.md. For fresh
projects, mark domain-specific unknowns with "[TO BE DETERMINED —
populate after first implementation]".

Update .mex/ROUTER.md current state to reflect that this is a new project.
Add rows to the routing table for any domain-specific context files you created.
Update .mex/AGENTS.md with the project name, description, non-negotiables, and commands.

Read .mex/patterns/README.md for the format and categories.

Generate 2-3 starter patterns for the most obvious task types you can
anticipate for this stack. Focus on the tasks a developer will do first.
Mark unknowns with "[VERIFY AFTER FIRST IMPLEMENTATION]".

Do NOT try to anticipate every possible pattern. The scaffold grows
incrementally — the behavioural contract (step 5: GROW) will create
new patterns from real work as the project evolves. Setup just seeds
the most critical ones.

After generating patterns, update .mex/patterns/INDEX.md with a row for each
pattern file you created.

PASS 3 — Wire the web:

Re-read every file you just wrote (.mex/context/ files, pattern files, .mex/ROUTER.md).
For each file, add or update the edges array in the YAML frontmatter.
Each edge should point to another scaffold file that is meaningfully related,
with a condition explaining when an agent should follow that edge.

Rules for edges:
- Every context/ file should have at least 2 edges
- Every pattern file should have at least 1 edge
- Edges should be bidirectional where it makes sense
- Use relative paths (e.g., context/stack.md, patterns/add-endpoint.md)

Important: only write content derived from the codebase or from my answers.
Do not include system-injected text (dates, reminders, etc.) in any scaffold file.'
else
  SETUP_PROMPT='You are going to populate an AI context scaffold for this project.
The scaffold lives in the .mex/ directory.

Read the following files in order before doing anything else:
1. .mex/ROUTER.md — understand the scaffold structure
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

Then assess: does this project have domains complex enough that cramming
them into architecture.md would make it too long or too shallow?
If yes, create additional domain-specific context files in .mex/context/.
Examples: a project with a complex auth system gets .mex/context/auth.md.
A data pipeline gets .mex/context/ingestion.md. A project with Stripe gets
.mex/context/payments.md. Use the same YAML frontmatter format (name,
description, triggers, edges, last_updated). Only create these for
domains that have real depth — not for simple integrations that fit
in a few lines of architecture.md.

After populating .mex/context/ files, update .mex/ROUTER.md:
- Fill in the Current Project State section based on what you found
- Add rows to the routing table for any domain-specific context files you created

Update .mex/AGENTS.md:
- Fill in the project name, one-line description, non-negotiables, and commands

PASS 2 — Generate starter patterns:

Read .mex/patterns/README.md for the format and categories.

Generate 3-5 starter patterns for the most common and most dangerous task
types in this project. Focus on:
- The 1-2 tasks a developer does most often (e.g., add endpoint, add component)
- The 1-2 integrations with the most non-obvious gotchas
- 1 debug pattern for the most common failure boundary

Each pattern should be specific to this project — real file paths, real gotchas,
real verify steps derived from the code you read in Pass 1.
Use the format in .mex/patterns/README.md. Name descriptively (e.g., add-endpoint.md).

Do NOT try to generate a pattern for every possible task type. The scaffold
grows incrementally — the behavioural contract (step 5: GROW) will create
new patterns from real work as the project evolves. Setup just seeds the most
critical ones.

After generating patterns, update .mex/patterns/INDEX.md with a row for each
pattern file you created. For multi-section patterns, add one row per task
section using anchor links (see INDEX.md annotation for format).

PASS 3 — Wire the web:

Re-read every file you just wrote (.mex/context/ files, pattern files, .mex/ROUTER.md).
For each file, add or update the edges array in the YAML frontmatter.
Each edge should point to another scaffold file that is meaningfully related,
with a condition explaining when an agent should follow that edge.

Rules for edges:
- Every context/ file should have at least 2 edges
- Every pattern file should have at least 1 edge (usually to the relevant context file)
- Edges should be bidirectional where it makes sense (if A links to B, consider B linking to A)
- Use relative paths (e.g., context/stack.md, patterns/add-endpoint.md)
- Pattern files can edge to other patterns (e.g., debug pattern → related task pattern)

Important: only write content derived from the codebase.
Do not include system-injected text (dates, reminders, etc.)
in any scaffold file.

When done, confirm which files were populated and flag any slots
you could not fill with confidence.'
fi

# ─────────────────────────────────────────────────────────────
# Step 4 — Run or print the setup prompt
# ─────────────────────────────────────────────────────────────

if [ "$DRY_RUN" -eq 1 ]; then
  header "Would run population prompt (dry run — skipping)"
  echo ""
  ok "Done (dry run)."
  exit 0
fi

# Try to invoke Claude Code CLI directly
if [ "$SELECTED_CLAUDE" -eq 1 ] && command -v claude &>/dev/null; then
  header "Launching Claude Code to populate the scaffold..."
  echo ""
  info "An interactive Claude Code session will open with the population prompt."
  info "You'll see the agent working in real-time."
  echo ""

  # Use interactive mode (not -p) so the user sees progress
  claude "$SETUP_PROMPT"

  echo ""
  ok "Done. Verify by starting a fresh session and asking:"
  info "  \"Read .mex/ROUTER.md and tell me what you know about this project.\""

else
  # Fallback — print the prompt for manual use
  header "Almost done. One more step — populate the scaffold."
  echo ""

  if command -v claude &>/dev/null; then
    # They have Claude CLI but chose a different tool
    info "You can run this directly with Claude Code:"
    echo ""
    echo "  claude -p '<the prompt below>'"
    echo ""
    info "Or paste the prompt below into your AI tool."
  else
    info "Paste the prompt below into your AI tool."
    info "The agent will read your codebase and fill every scaffold file."
  fi

  echo ""
  echo "─────────────────── COPY BELOW THIS LINE ───────────────────"
  echo ""
  echo "$SETUP_PROMPT"
  echo ""
  echo "─────────────────── COPY ABOVE THIS LINE ───────────────────"
  echo ""
  ok "Done. Paste the prompt above into your agent to populate the scaffold."
fi
