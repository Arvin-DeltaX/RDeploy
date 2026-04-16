---
model: claude-sonnet-4-6
---

Stage and commit all current changes with a conventional commit message.

## Step 1 — TypeScript check

Run TypeScript on both apps before committing:

```bash
cd Codebase/Back-End && npx tsc --noEmit 2>&1
cd Codebase/Front-End && npx tsc --noEmit 2>&1
```

If any errors are found → **stop**. Do not proceed. Report the errors and tell the user to fix them first or run `/fix` with the error output.

## Step 2 — Show what changed

Run and display:

```bash
git status
git diff --stat HEAD
```

Summarize what was changed in plain English (e.g. "3 files changed: added project routes, updated service layer, fixed type error in middleware").

## Step 3 — Generate commit message

Read the full diff:

```bash
git diff HEAD
git diff --cached
```

Craft a commit message following the project convention exactly:

```
type(scope): short description
```

**Types:** `feat` `fix` `chore` `docs` `refactor` `style`

**Scopes:** `auth` `users` `teams` `projects` `docker` `env` `ui` `db` `roadmap`

Rules:
- Description is lowercase, no period at end
- Max 72 characters total
- If multiple scopes apply, pick the most dominant one
- If the change is purely docs (ROADMAP/CHANGELOG), use `docs(roadmap)`

Show the proposed message to the user:

```
Proposed commit message:
  feat(projects): add project creation endpoint and service layer

Confirm? (yes / edit the message)
```

Wait for confirmation before proceeding. If the user provides an alternative message, use theirs exactly.

## Step 4 — Stage and commit

```bash
git add -A
git commit -m "your confirmed message here"
```

Report success with the commit hash. Remind the user to run `/push` when ready to push, or `/ship` to commit + push in one step.

## Rules

- Never commit if TypeScript errors exist
- Never commit directly to `main` — if on main, stop and warn the user
- Never use `--no-verify`
- Never commit `.env` files, secrets, or `node_modules`
- If `git add -A` would stage sensitive files, list them and ask for confirmation first
