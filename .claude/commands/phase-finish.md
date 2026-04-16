---
model: claude-haiku-4-5-20251001
---

Finish phase $ARGUMENTS:

1. Read ROADMAP.md — check all tasks in the phase are `[x]`
2. If any tasks are still `[ ]` → stop and list them, do not proceed
3. If all tasks are done:
   a. Run `/typecheck` — confirm zero TypeScript errors on both backend and frontend. If errors exist → stop and report them, do not merge.
   b. Trigger the `code-reviewer` agent to review all changes on this branch. If any 🔴 Must Fix issues are found → stop and report them, do not merge.
   c. If code review passes, trigger the `security-checker` agent. If any critical/high issues are found → stop and report them, do not merge.
   d. Delegate to the `docs-updater` agent to:
      - Update CHANGELOG.md phase status → ✅ Complete
      - Commit: `docs(changelog): mark phase {number} complete`
   e. **Push the phase branch to remote** (backup before merging):
      ```bash
      git push -u origin phase/{number}-{name}
      ```
      If this fails → stop and report the error. Do not merge until the branch is safely on remote.
   f. Merge into main:
      ```bash
      git checkout main && git merge phase/{number}-{name}
      ```
   g. **Push main to remote**:
      Ask the user: "Phase {number} merged to main locally. Push main to remote now? (yes / no)"
      - If yes → `git push origin main`
      - If no → remind the user to run `/push` when ready (while on main)
   h. Report what was completed and suggest the next phase to start
