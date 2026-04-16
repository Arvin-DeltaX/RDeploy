---
model: claude-haiku-4-5-20251001
---

Finish phase $ARGUMENTS:

1. Read ROADMAP.md — check all tasks in the phase are `[x]`
2. If any tasks are still `[ ]` → stop and list them, do not proceed
3. If all tasks are done:
   a. Trigger the `code-reviewer` agent to review all changes on this branch. If any 🔴 Must Fix issues are found → stop and report them, do not merge.
   b. If code review passes, trigger the `security-checker` agent. If any critical/high issues are found → stop and report them, do not merge.
   c. Delegate to the `docs-updater` agent to:
      - Update CHANGELOG.md phase status → ✅ Complete
      - Commit: `docs(changelog): mark phase {number} complete`
   d. Run: `git checkout main && git merge phase/{number}-{name}`
   e. Report what was completed and suggest the next phase to start
