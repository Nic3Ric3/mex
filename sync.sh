#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# mex sync — detect drift and build targeted prompts to fix it
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse flags
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
  esac
done

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'
ROYAL='\033[38;2;25;68;241m'

info()  { printf "${BLUE}→${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$1"; }
err()   { printf "${RED}✗${NC} %s\n" "$1"; }
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
  printf "  ${BOLD}sync${NC}\n"
}

# ─────────────────────────────────────────────────────────────
# Resolve mex CLI
# ─────────────────────────────────────────────────────────────

MEX_CMD=""
if command -v mex &>/dev/null; then
  MEX_CMD="mex"
elif [ -f "$SCRIPT_DIR/dist/cli.js" ]; then
  MEX_CMD="node $SCRIPT_DIR/dist/cli.js"
fi

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

banner
echo ""

if [ "$DRY_RUN" -eq 1 ]; then
  warn "DRY RUN — will show what needs fixing without executing"
  echo ""
fi

# ─────────────────────────────────────────────────────────────
# Step 1 — Drift detection
# ─────────────────────────────────────────────────────────────

if [ -n "$MEX_CMD" ]; then
  header "Running drift detection..."
  echo ""

  # Get the quiet summary first
  cd "$PROJECT_DIR"
  DRIFT_QUIET=$($MEX_CMD check --quiet 2>&1) || true
  info "$DRIFT_QUIET"
  echo ""

  # Check if there are actual issues
  DRIFT_JSON=$($MEX_CMD check --json 2>&1) || true
  ISSUE_COUNT=$(echo "$DRIFT_JSON" | grep -c '"code"' 2>/dev/null || echo "0")

  if [ "$ISSUE_COUNT" -eq 0 ]; then
    ok "No drift detected. Scaffold is in sync with codebase."
    echo ""
    exit 0
  fi

  # Show full report
  $MEX_CMD check 2>&1 || true
  echo ""

  # ─────────────────────────────────────────────────────────────
  # Step 2 — Targeted sync
  # ─────────────────────────────────────────────────────────────

  if [ "$DRY_RUN" -eq 1 ]; then
    header "Targeted fix prompts (dry run)..."
    echo ""
    $MEX_CMD sync --dry-run 2>&1 || true
    echo ""
    ok "Done (dry run). Run without --dry-run to execute."
    exit 0
  fi

  header "How do you want to fix the drift?"
  echo ""
  echo "  1) Targeted sync — AI fixes only the flagged files (recommended)"
  echo "  2) Full resync — AI re-reads everything and updates all scaffold files"
  echo "  3) Show me the prompts — I'll paste them manually"
  echo "  4) Exit — I'll fix it myself"
  echo ""
  printf "Choice [1-4]: "
  read -r sync_choice

  case "$sync_choice" in
    1)
      header "Running targeted sync..."
      echo ""
      $MEX_CMD sync 2>&1 || true
      ;;
    2)
      # Full resync — use the SYNC.md prompt
      header "Running full resync..."
      echo ""
      SYNC_PROMPT='You are going to resync the AI context scaffold for this project.
The scaffold may be out of date — the codebase has changed since it was last populated.

First, read all files in context/ to understand the current scaffold state.
Then explore what has changed in the codebase since the scaffold was last updated.
Check the last_updated dates in the YAML frontmatter of each file.

For each context/ file:
1. Compare the current scaffold content to the actual codebase
2. Identify what has changed, been added, or been removed
3. Update the file to reflect the current state

Critical rules for updating:
- Use surgical, targeted edits — NOT full file rewrites. Read the existing content,
  identify what changed, and update only those sections.
- PRESERVE YAML frontmatter structure. Never delete or rewrite the entire frontmatter block.
  Edit individual fields only. The edges, triggers, name, and description fields must
  survive every sync. If you need to update edges, add or remove individual entries —
  do not replace the entire array.
- In context/decisions.md: NEVER delete existing decisions.
  If a decision has changed, mark the old entry as "Superseded by [new decision title]"
  and add the new decision above it with today'"'"'s date.
- In all other files: update content to reflect current reality
- Update last_updated in the YAML frontmatter of every file you change
- After updating each file, update ROUTER.md Current Project State

When done, report:
- Which files were updated and what changed
- Any decisions that were superseded
- Any slots that could not be filled with confidence'

      if command -v claude &>/dev/null; then
        claude "$SYNC_PROMPT"
        echo ""
        ok "Full resync complete. Running verification..."
        echo ""
        $MEX_CMD check 2>&1 || true
      else
        echo ""
        echo "─────────────────── COPY BELOW THIS LINE ───────────────────"
        echo ""
        echo "$SYNC_PROMPT"
        echo ""
        echo "─────────────────── COPY ABOVE THIS LINE ───────────────────"
        echo ""
        info "Paste the prompt above into your AI tool."
      fi
      ;;
    3)
      header "Targeted fix prompts..."
      echo ""
      $MEX_CMD sync --dry-run 2>&1 || true
      echo ""
      ok "Copy the prompts above and paste into your AI tool."
      ;;
    4)
      ok "Exiting. Run mex check anytime to re-check."
      ;;
    *)
      warn "Unknown choice, exiting."
      ;;
  esac

else
  # ─────────────────────────────────────────────────────────────
  # Fallback — no mex CLI available, use SYNC.md prompt
  # ─────────────────────────────────────────────────────────────

  warn "mex CLI not available — falling back to full resync prompt"
  echo ""
  info "To get targeted sync, build the CLI first:"
  echo "  cd $SCRIPT_DIR && npm install && npm run build"
  echo ""

  header "Full resync prompt"
  echo ""
  info "Paste the following into your AI tool:"
  echo ""
  echo "─────────────────── COPY BELOW THIS LINE ───────────────────"
  echo ""
  cat <<'PROMPT'
You are going to resync the AI context scaffold for this project.
The scaffold may be out of date — the codebase has changed since it was last populated.

First, read all files in context/ to understand the current scaffold state.
Then explore what has changed in the codebase since the scaffold was last updated.
Check the last_updated dates in the YAML frontmatter of each file.

For each context/ file:
1. Compare the current scaffold content to the actual codebase
2. Identify what has changed, been added, or been removed
3. Update the file to reflect the current state

Critical rules for updating:
- Use surgical, targeted edits — NOT full file rewrites. Read the existing content,
  identify what changed, and update only those sections.
- PRESERVE YAML frontmatter structure. Never delete or rewrite the entire frontmatter block.
  Edit individual fields only. The edges, triggers, name, and description fields must
  survive every sync. If you need to update edges, add or remove individual entries —
  do not replace the entire array.
- In context/decisions.md: NEVER delete existing decisions.
  If a decision has changed, mark the old entry as "Superseded by [new decision title]"
  and add the new decision above it with today's date.
- In all other files: update content to reflect current reality
- Update last_updated in the YAML frontmatter of every file you change
- After updating each file, update ROUTER.md Current Project State

When done, report:
- Which files were updated and what changed
- Any decisions that were superseded
- Any slots that could not be filled with confidence
PROMPT
  echo ""
  echo "─────────────────── COPY ABOVE THIS LINE ───────────────────"
  echo ""
fi

echo ""
ok "Done."
