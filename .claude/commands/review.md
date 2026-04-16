---
model: claude-sonnet-4-6
---

Delegate this task to the `code-reviewer` agent to review recent changes.

If any security-sensitive code is found (auth, env vars, Docker, deployment) → also trigger the `security-checker` agent.

Report all findings grouped by severity:
- 🔴 Must Fix
- 🟡 Should Fix  
- 🟢 Good

$ARGUMENTS
