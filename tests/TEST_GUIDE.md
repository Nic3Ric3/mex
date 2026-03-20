# Test Guide — For You, Not the Agent

How to run each test. Read this before testing. Do not put this file in the test project.

---

## Test 1 — Setup

1. Copy scaffold files into the target project
2. Open a fresh agent session in that project
3. Paste the SETUP.md Option A prompt
4. Copy `TEST_REPORT_TEMPLATE.md` into the project as `TEST_REPORT.md`
5. After setup completes, tell the agent: "Now fill in Test 1 of TEST_REPORT.md based on what you just did"
6. Review what it wrote — add your own notes where it's wrong or incomplete

---

## Test 2 — Cold Bootstrap

This tests whether a fresh agent follows the scaffold routing without being told to.

1. Start a **completely new session** — no prior context
2. Give the agent a real task that needs project context. Good examples:
   - "Add a new API client for [some service]"
   - "The pipeline is timing out on long audio files, debug it"
   - "Add support for [language X]"
   - "Refactor [component] to handle [edge case]"
3. **Do not mention the scaffold, context files, or patterns.** Just give the task.
4. Watch what happens:
   - Does the agent read CLAUDE.md / AGENTS.md? (Claude Code auto-loads CLAUDE.md)
   - Does it follow the "read HANDOVER.md first" instruction?
   - Does it navigate to the right context/ file?
   - Does it find and use a relevant pattern file?
5. After the task, ask the agent: "What files did you read before starting this task? List them in order."
6. **You fill in Test 2** of the test report based on what you observed.

### Good tasks for cold bootstrap testing
Pick something where the scaffold should meaningfully help:
- A task that touches the architecture (would benefit from architecture.md)
- A task that requires knowing conventions (would benefit from conventions.md)
- A task that has a pattern file (would benefit from patterns/)

---

## Test 3 — Sync

1. Make a real change to the codebase. Good examples:
   - Add or swap a dependency
   - Change an architectural pattern
   - Add a new module or entry point
2. Start a new session (or continue if the agent has no memory of the scaffold being set up)
3. Paste the SYNC.md prompt
4. Tell the agent: "Now fill in Test 3 of TEST_REPORT.md based on what you just did"
5. Review — check that decisions.md was appended to, not overwritten
