---
model: claude-opus-4-6
---

Build all tasks for phase $ARGUMENTS end-to-end, fully automated.

## Step 1 — Branch Setup

Run `/phase-start $ARGUMENTS` to create the phase branch and mark it In Progress.

## Step 2 — Read the Phase Tasks

Read `ROADMAP.md` and extract every `[ ]` task under the phase $ARGUMENTS section. If no unchecked tasks exist, report "Phase $ARGUMENTS is already complete" and stop.

## Step 3 — Classify and Delegate Each Task

For each unchecked task, determine which agent(s) to use:

| Task involves | Agent to use |
|---|---|
| Prisma schema, migrations, seed | `db-designer` |
| Express routes, middleware, services, utils | `backend-builder` |
| Next.js pages, components, hooks, store | `frontend-builder` |
| Docker, docker-compose, Traefik | `docker-engineer` |
| Both backend + frontend | `backend-builder` first, then `frontend-builder` |
| Schema + backend | `db-designer` first, then `backend-builder` |

Run tasks **sequentially** — do not start the next task until the current one is confirmed complete. Tasks within the same agent type that are independent may be batched into a single agent call for efficiency.

## Step 4 — After Each Task

After each task completes:
1. Trigger `docs-updater` agent — pass the task description so it marks `[x]` in ROADMAP.md and adds a CHANGELOG entry.
2. If the task touches auth, env vars, or Docker → trigger `security-checker` agent.
3. Confirm the task is marked `[x]` before moving to the next one.

## Step 5 — Phase Complete

After all tasks are done:
1. Run `/typecheck` — confirm zero TypeScript errors on both backend and frontend before merging.
2. Run `/phase-finish $ARGUMENTS` — this triggers:
   - Code review + security check
   - Push phase branch to remote (backup)
   - Merge to main locally
   - Prompt to push main to remote
3. Report a summary of everything built.

## Rules

- Never skip a task
- Never mark a task done without the agent actually implementing it
- If an agent fails or reports a blocker, stop and report it to the user — do not proceed past a broken task
- Always read `KNOWLEDGE_BASE.md` before delegating — pass relevant sections to each agent so it has full context
- Pass the exact task description from ROADMAP.md to each agent, not a paraphrase
