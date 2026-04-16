# Rules

## Always

- Read `KNOWLEDGE_BASE.md` before making any architectural decision
- Follow atomic design — place components in the correct layer
- Update `ROADMAP.md` and `CHANGELOG.md` after every completed task
- Use phase branches — never commit features directly to `main`
- Return consistent API response shapes (`{ data }` / `{ error }`)
- Encrypt env var values before storing in DB
- Write `.env` files only at deploy time, never commit them

## Never

- Use `any` type in TypeScript
- Call the API directly inside a component — use hooks + services
- Generate or modify files inside cloned repos — validate only
- Auto-generate Dockerfile or `.env.example` — reject with clear error instead
- Store secrets in source code or `.env.example`
- Skip error handling on API endpoints
- Add features not in `KNOWLEDGE_BASE.md` without discussion
- Over-engineer — build exactly what the task requires, nothing more
- Commit directly to `main`
- Mark a task `[x]` in ROADMAP without adding an entry to CHANGELOG
