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

### Local Development

| Command | Model | Use For |
|---------|-------|---------|
| `/setup` | sonnet | **First-time setup** — install deps, copy .env, run migrations, seed DB |
| `/dev` | — | Start backend + frontend dev servers with troubleshooting guide |
| `/health` | sonnet | Diagnose local stack — env vars, deps, DB, TypeScript, server reachability |
| `/typecheck` | haiku | Run `tsc --noEmit` on backend + frontend, list all errors |
| `/build` | — | Production build for both apps |
| `/db` | — | Prisma commands — migrate, generate, seed, studio |

### Git

| Command | Model | Use For |
|---------|-------|---------|
| `/commit` | sonnet | TypeCheck → show diff → auto-generate conventional commit message → confirm → commit |
| `/push` | haiku | Safety-check branch (blocks main) → list commits → push to remote |
| `/ship` | sonnet | `/commit` + `/push` in one step. Optionally pass a message: `/ship feat(x): desc` |

### Feature Development

| Command | Model | Use For |
|---------|-------|---------|
| `/next` | haiku | Find next uncompleted task, describe it, ask for confirmation before starting |
| `/build-phase` | opus | **Run an entire phase end-to-end** — branch, build all tasks, docs, review, merge |
| `/architect` | opus | Design decisions, system planning, complex logic |
| `/check` | opus | **Check if a feature exists** → guide to it, OR add to roadmap + spec if missing |
| `/build-feature` | sonnet | Implementing a single feature, endpoint, or component |
| `/fix` | sonnet | Bug fixes, debugging, error handling |
| `/restyle` | sonnet | Change component styles — respects atomic layers, ripple-checks dependents |
| `/review` | sonnet | Code review, convention checks |
| `/update-docs` | haiku | Mark tasks done, update ROADMAP + CHANGELOG |
| `/kb-sync` | opus | **Full KB audit** — reads actual codebase and updates KNOWLEDGE_BASE.md to match reality |
| `/phase-start` | haiku | Create phase branch, set status to In Progress |
| `/phase-finish` | haiku | Verify phase complete, merge to main |

## Sub-Agents (Claude Triggers These Automatically)

| Agent | Model | Triggered When |
|-------|-------|----------------|
| `backend-builder` | sonnet | Any backend code — routes, services, middleware |
| `frontend-builder` | sonnet | Any frontend code — pages, components, hooks |
| `db-designer` | opus | Schema changes, Prisma models, migrations |
| `docker-engineer` | sonnet | Docker, Traefik, deployment logic |
| `debugger` | sonnet | Something is broken or throwing errors (also used by `/fix` and `/health`) |
| `code-reviewer` | sonnet | Before committing or merging a phase |
| `docs-updater` | haiku | After any task completes |
| `security-checker` | sonnet | Auth, env vars, Docker, deployment code |

### When to Use Which

```
Fresh clone / first time running?  → /setup (you trigger)
Something seems broken locally?    → /health (you trigger) — diagnoses env, DB, TS, servers
TypeScript errors before commit?   → /typecheck (you trigger)
Start dev servers?                 → /dev (you trigger — read the guide)
Save work with a commit?           → /commit (typecheck → diff → auto message → confirm → commit)
Push branch to remote?             → /push (branch safety check → push)
Commit + push in one shot?         → /ship (chains /commit then /push, optional message arg)
Build an entire phase hands-free?  → /build-phase {number} (you trigger)
  └── branch → all tasks in order → docs → review → security → merge
Designing something new?           → /architect (you trigger)
Is this feature already built?     → /check {feature description} (you trigger)
  └── found: shows you exactly where it is
  └── in spec but not built: offers to run /build-feature
  └── not in spec: runs /architect → updates KNOWLEDGE_BASE.md + ROADMAP.md
Building a single task?            → /build-feature (you trigger)
  └── spawns backend-builder, frontend-builder, db-designer, or docker-engineer as needed
Changing how a component looks?    → /restyle {component + what to change} (you trigger)
  └── reads component first, checks atomic layer rules, ripple-checks all dependents
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
| KNOWLEDGE_BASE.md | Updated if task changed any API, data model, permission rule, deployment flow, platform requirement, or auth behavior |
| Commit message | Follows `type(scope): description` |

### When Must KNOWLEDGE_BASE.md Be Updated?

| Changed | Update KB? |
|---------|-----------|
| New or modified API endpoint | YES |
| Prisma schema change (model, field, enum) | YES |
| Permission rule change | YES |
| Deployment flow step added or changed | YES |
| Platform requirement changed (Dockerfile, .env.example, health check) | YES |
| Auth behavior changed (JWT, mustChangePassword, GitHub connect) | YES |
| UI-only change (styles, layout, copy) | NO |
| Refactor with no behavior change | NO |
| Bug fix that restores documented behavior | NO |
