---
model: claude-haiku-4-5-20251001
---

Start phase $ARGUMENTS:

1. Read ROADMAP.md — confirm the phase number and name
2. Run: `git checkout main && git checkout -b phase/{number}-{name}`
3. Delegate to the `docs-updater` agent to:
   - Update CHANGELOG.md phase status: 🔲 Not Started → 🟡 In Progress
   - Commit: `chore(phase): start phase {number} - {name}`
4. List all tasks for this phase from ROADMAP.md
