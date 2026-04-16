---
model: claude-sonnet-4-6
---

Delegate this task to the appropriate agent based on what needs to be built:

- If it involves backend code (routes, services, middleware, Prisma) → use the `backend-builder` agent
- If it involves frontend code (pages, components, hooks, store) → use the `frontend-builder` agent
- If it involves both → use both agents, backend first then frontend
- If it involves Docker or deployment logic → use the `docker-engineer` agent
- If it involves Prisma schema or migrations → use the `db-designer` agent

After the feature is built, automatically trigger the `docs-updater` agent to mark the task done in ROADMAP.md and add an entry to CHANGELOG.md. Pass it the task description: "$ARGUMENTS"

Then trigger the `security-checker` agent if the feature touches auth, env vars, or Docker.

Task to build: $ARGUMENTS
