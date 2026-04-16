# Workflow Protocol

## Branching

One branch per phase. Commit directly to the phase branch. Merge to `main` when phase is complete.

```
phase/1-foundation
phase/2-users-teams
phase/3-projects
phase/4-repo-env
phase/5-deployment
phase/6-github-connect
phase/7-polish
```

```bash
# Start a phase
git checkout main && git checkout -b phase/1-foundation

# Finish a phase
git checkout main && git merge phase/1-foundation
```

## Commit Format

```
type(scope): short description
```

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Config, deps, tooling |
| `docs` | ROADMAP, CHANGELOG, README |
| `refactor` | Restructure, no behavior change |
| `style` | Formatting, UI tweaks |

Common scopes: `auth` `users` `teams` `projects` `docker` `env` `ui` `db` `roadmap`

## After Every Completed Task

The `docs-updater` agent handles this automatically when triggered by `/build-feature`, `/fix`, or `/architect`.

If you completed work outside those commands, run `/update-docs` manually:
1. Mark `[x]` in `ROADMAP.md`
2. Add entry to `CHANGELOG.md` under current phase
3. Commit:
   ```
   docs(roadmap): mark [task name] complete
   ```

## Phase Status in CHANGELOG.md

🔲 Not Started → 🟡 In Progress → ✅ Complete

## Slash Commands (You Trigger These)

| Command | Model | Use For |
|---------|-------|---------|
| `/next` | haiku | Find next uncompleted task, describe it, ask for confirmation before starting |
| `/build-phase` | opus | **Run an entire phase end-to-end** — branch, build all tasks, docs, review, merge |
| `/architect` | opus | Design decisions, system planning, complex logic |
| `/build-feature` | sonnet | Implementing a single feature, endpoint, or component |
| `/fix` | sonnet | Bug fixes, debugging, error handling |
| `/review` | sonnet | Code review, convention checks |
| `/update-docs` | haiku | Mark tasks done, update ROADMAP + CHANGELOG |
| `/phase-start` | haiku | Create phase branch, set status to In Progress |
| `/phase-finish` | haiku | Verify phase complete, merge to main |

## Sub-Agents (Claude Triggers These Automatically)

| Agent | Model | Triggered When |
|-------|-------|----------------|
| `backend-builder` | sonnet | Any backend code — routes, services, middleware |
| `frontend-builder` | sonnet | Any frontend code — pages, components, hooks |
| `db-designer` | opus | Schema changes, Prisma models, migrations |
| `docker-engineer` | sonnet | Docker, Traefik, deployment logic |
| `debugger` | sonnet | Something is broken or throwing errors |
| `code-reviewer` | sonnet | Before committing or merging a phase |
| `docs-updater` | haiku | After any task completes |
| `security-checker` | sonnet | Auth, env vars, Docker, deployment code |

### When to Use Which

```
Build an entire phase hands-free?  → /build-phase {number} (you trigger)
  └── branch → all tasks in order → docs → review → security → merge
Designing something new?           → /architect (you trigger)
Building a single task?            → /build-feature (you trigger)
  └── spawns backend-builder, frontend-builder, db-designer, or docker-engineer as needed
Something is broken?               → /fix (you trigger) or debugger (auto)
Want a code check?                 → /review (you trigger)
Task done, need docs updated?      → docs-updater (auto after each task)
Touching auth or Docker?           → security-checker (auto)
Schema change needed?              → db-designer (auto)
Starting a new phase?              → /phase-start (you trigger)
Phase all done?                    → /phase-finish (you trigger)
```

## Definition of Done

| Check | Requirement |
|-------|-------------|
| Feature works | As described in KNOWLEDGE_BASE.md |
| No TS errors | `tsc --noEmit` passes |
| App starts | No broken imports or runtime errors |
| ROADMAP.md | Task marked `[x]` |
| CHANGELOG.md | Entry added under current phase |
| Commit message | Follows `type(scope): description` |
