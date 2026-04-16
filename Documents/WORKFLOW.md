# RDeploy - Workflow Protocol

---

## Branching Strategy

One branch per phase. Commit directly to that branch, then merge to `main` when the phase is complete.

```
main
├── phase/1-foundation
├── phase/2-users-teams
├── phase/3-projects
├── phase/4-repo-env
├── phase/5-deployment
├── phase/6-github-connect
└── phase/7-polish
```

### Start a Phase
```bash
git checkout main
git pull
git checkout -b phase/1-foundation
```

### End a Phase (merge to main)
```bash
git checkout main
git merge phase/1-foundation
git push origin main
```

---

## Commit Message Convention

Format: `type(scope): short description`

```
feat(auth): add login endpoint with JWT
fix(projects): handle missing Dockerfile error
chore(deps): update prisma to v5
docs(roadmap): mark phase 1 complete
refactor(docker): extract port assignment to utility
```

### Types
| Type | Use for |
|------|---------|
| `feat` | New feature or endpoint |
| `fix` | Bug fix |
| `chore` | Config, deps, tooling |
| `docs` | ROADMAP, CHANGELOG, README updates |
| `refactor` | Code restructure, no behavior change |
| `style` | Formatting, UI tweaks |
| `test` | Tests |

### Scopes
`auth` `users` `teams` `projects` `docker` `env` `ui` `db` `deps` `roadmap`

---

## Task Flow (per task inside a phase)

When working with Claude Code, steps 4–6 are handled automatically by the agent system.

**With Claude Code (automated):**
```
1. Pick next unchecked task from ROADMAP.md
2. Run: /build-feature [task description]
   → builds the feature, updates ROADMAP.md + CHANGELOG.md, commits docs
```

**Manual flow:**
```
1. Pick next unchecked task from ROADMAP.md
2. Build it
3. Commit: feat(scope): description
4. Mark task as [x] in ROADMAP.md
5. Add entry to CHANGELOG.md under current phase
6. Commit: docs(roadmap): mark [task name] complete
```

**Available slash commands:**

| Command | Use For |
|---------|---------|
| `/build-feature` | Build a feature — auto-updates docs after |
| `/fix` | Fix a bug — auto-updates docs after |
| `/architect` | Design decisions before building |
| `/review` | Code review |
| `/phase-start` | Create phase branch + mark In Progress |
| `/phase-finish` | Verify done + review + merge to main |
| `/update-docs` | Manually update ROADMAP + CHANGELOG |

---

## After Each Phase Completes

1. All tasks in phase are `[x]` in ROADMAP.md
2. CHANGELOG.md phase section is filled with what was added
3. Update phase status in CHANGELOG.md:
   - 🔲 Not Started → 🟡 In Progress → ✅ Complete
4. Merge phase branch to main
5. Start next phase branch from main

---

## Definition of Done (per task)

| Check | Requirement |
|-------|-------------|
| Feature works | Functions as described in KNOWLEDGE_BASE.md |
| No TypeScript errors | `tsc --noEmit` passes |
| App starts | No broken imports or runtime errors |
| ROADMAP.md updated | Task marked `[x]` |
| CHANGELOG.md updated | Entry added under current phase |
| Commit message correct | Follows `type(scope): description` format |

---

## File Update Rules

| File | When to update |
|------|----------------|
| `ROADMAP.md` | After every completed task — mark `[x]` |
| `CHANGELOG.md` | After every completed task — add entry to phase section |
| `KNOWLEDGE_BASE.md` | Only when a design decision changes |
| `CLAUDE.md` | Only when architecture or conventions change |
| `Documents/WORKFLOW.md` | Only when the workflow itself changes |

---

## Phase Status Legend

| Icon | Meaning |
|------|---------|
| 🔲 | Not Started |
| 🟡 | In Progress |
| ✅ | Complete |
