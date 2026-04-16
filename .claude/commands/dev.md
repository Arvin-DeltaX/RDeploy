# Dev

Start the full local development stack.

## Pre-flight check

Before starting, verify the environment is ready:
- `.env` file exists at `Codebase/Back-End/.env` with real values (not placeholders)
- `.env.local` exists at `Codebase/Front-End/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000`
- `node_modules` installed in both directories
- Prisma client generated and migrations applied

If unsure, run `/setup` first (first time) or `/health` to diagnose issues.

## Start servers

Open **two terminals** and run one command in each:

**Terminal 1 — Backend** (`http://localhost:5000`):
```bash
cd Codebase/Back-End && npm run dev
```

**Terminal 2 — Frontend** (`http://localhost:3000`):
```bash
cd Codebase/Front-End && npm run dev
```

## Or run both in one terminal (background backend)

```bash
cd Codebase/Back-End && npm run dev &
cd Codebase/Front-End && npm run dev
```

Note: With this approach, backend logs will be interleaved with frontend output. Use two terminals for cleaner output.

## Ports

| Service  | URL                      |
|----------|--------------------------|
| Frontend | http://localhost:3000     |
| Backend  | http://localhost:5000     |
| Prisma Studio | `npx prisma studio` (run from `Codebase/Back-End`) |

## Login credentials (local seed)

| Field    | Value                              |
|----------|------------------------------------|
| Email    | arvin@thesx.co                     |
| Password | value of `SEED_OWNER_PASSWORD` in `Codebase/Back-End/.env` |

## Common issues

| Symptom | Fix |
|---------|-----|
| Backend crashes on start | Check `.env` values — likely missing `DATABASE_URL` or `ENCRYPTION_KEY` |
| `Cannot find module '@prisma/client'` | Run: `cd Codebase/Back-End && npx prisma generate` |
| `prisma migrate dev` fails | PostgreSQL not running, or `DATABASE_URL` wrong |
| Frontend shows network errors | Confirm `NEXT_PUBLIC_API_URL=http://localhost:5000` in `Codebase/Front-End/.env.local` |
| Port 5000 or 3000 already in use | Kill existing process or change port in `.env` |

Run `/health` to automatically diagnose any of the above.
