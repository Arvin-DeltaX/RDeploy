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
   
   **KB Consistency Check** — before committing, spawn an Agent with this prompt:
   ```
   You are doing a KNOWLEDGE_BASE.md consistency check before merging a phase branch.

   1. Read KNOWLEDGE_BASE.md
   2. Read CHANGELOG.md — find all entries added during this phase
   3. For each changelog entry, ask: does KNOWLEDGE_BASE.md accurately reflect this change?
      Check these areas only:
      - API endpoints (new routes, changed request/response shape, removed endpoints)
      - Data models (Prisma schema, field names, relationships, enums)
      - Permission rules (who can do what)
      - Deployment flow steps
      - Platform requirements (Dockerfile, .env.example, health check, etc.)
      - Auth behavior

   4. If KNOWLEDGE_BASE.md is already accurate → report "KB is up to date" and stop.
   5. If anything is missing or stale → update KNOWLEDGE_BASE.md directly to reflect current behavior. Be surgical — only fix what is inaccurate or absent.

   After finishing, report: what you updated (or "KB is up to date — no changes needed").
   ```
   If the agent reports updates → include them in the phase commit.
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
