---
model: claude-haiku-4-5-20251001
---

Push the current branch to the remote repository safely.

## Step 1 — Branch safety check

```bash
git branch --show-current
```

- If the current branch is `main` → **stop immediately**. Report: "Refusing to push directly to main. Switch to a phase branch first." Do not proceed.
- If the current branch is a phase branch (e.g. `phase/3-projects`) → continue.

## Step 2 — Check for unpushed commits

```bash
git log --oneline origin/$(git branch --show-current)..HEAD 2>/dev/null || git log --oneline HEAD
```

If there are no new commits → report "Nothing to push — no commits ahead of remote." and stop.

List the commits that will be pushed so the user can see what's going out.

## Step 3 — Check for uncommitted changes

```bash
git status --short
```

If there are uncommitted changes → warn the user: "You have uncommitted changes. Run `/commit` first to include them, or push without them."

Wait for the user to confirm they want to push as-is, or stop so they can commit first.

## Step 4 — Push

```bash
git push -u origin $(git branch --show-current)
```

Report success with:
- Branch name
- Number of commits pushed
- Remote URL if available (`git remote get-url origin`)

## Rules

- Never force push (`--force` / `-f`)
- Never push to `main`
- Never skip the uncommitted changes warning
