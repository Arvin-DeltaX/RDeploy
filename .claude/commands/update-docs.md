---
model: claude-haiku-4-5-20251001
---

Delegate this task to the `docs-updater` agent.

Update ROADMAP.md and CHANGELOG.md based on what was completed:
- Mark completed tasks as `[x]` in ROADMAP.md
- Add entries to CHANGELOG.md under the current phase
- Update phase status if needed: 🔲 → 🟡 → ✅

Then check if KNOWLEDGE_BASE.md needs updating. Ask: did this task change any of the following?
- API endpoints (new routes, changed request/response shape, removed endpoints)
- Data models (Prisma schema, field names, relationships, enums)
- Permission rules (who can do what)
- Deployment flow (clone → build → run steps)
- Platform requirements (what RDeploy expects from submitted repos)
- Auth behavior (JWT, mustChangePassword, GitHub connect)

If YES to any → update the relevant section(s) in KNOWLEDGE_BASE.md to reflect the current behavior.
If NO → skip KNOWLEDGE_BASE.md.

Do not rewrite sections that are already accurate. Be surgical — only update what changed.

$ARGUMENTS
