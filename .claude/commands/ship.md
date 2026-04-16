---
model: claude-sonnet-4-6
---

Commit all changes and push to remote in one step. Chains `/commit` then `/push`.

## Step 1 — Commit

Run the full `/commit` flow:
1. TypeScript check — stop if errors exist
2. Show diff summary
3. Generate conventional commit message, confirm with user
4. Stage and commit

If the commit step fails or the user cancels → stop. Do not push.

## Step 2 — Push

Run the full `/push` flow:
1. Confirm not on `main`
2. List commits being pushed
3. Push to remote

## When to use

- Use `/ship` when you're done with a chunk of work and want it committed and pushed immediately.
- Use `/commit` + `/push` separately when you want to commit now but push later (e.g. you plan more commits first).

## Optional: pass a commit message

If `$ARGUMENTS` is provided, skip the message generation step and use it directly as the commit message (still runs the TypeScript check first).

Example: `/ship feat(projects): add project listing endpoint`
