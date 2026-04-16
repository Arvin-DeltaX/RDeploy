---
model: claude-sonnet-4-6
---

Delegate this task to the `debugger` agent to diagnose and fix the issue.

After the fix is applied:
1. Trigger the `code-reviewer` agent to verify the fix is clean and didn't introduce new issues.
2. Trigger the `docs-updater` agent to mark the fixed task done in ROADMAP.md and add an entry to CHANGELOG.md. Pass it the issue description: "$ARGUMENTS"
3. If the fix touches auth, env vars, or Docker → also trigger the `security-checker` agent.

Issue to fix: $ARGUMENTS
