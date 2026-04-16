---
model: claude-sonnet-4-6
---

First-time local setup for RDeploy. Run this after a fresh clone or when the environment needs to be rebuilt.

## Step 1 — Install dependencies

```bash
cd Codebase/Back-End && npm install
cd Codebase/Front-End && npm install
```

## Step 2 — Copy environment files

Check if `.env` files exist. If not, copy from `.env.example`:

```bash
# Backend
[ -f Codebase/Back-End/.env ] || cp Codebase/Back-End/.env.example Codebase/Back-End/.env

# Frontend (if it has its own .env)
[ -f Codebase/Front-End/.env.local ] || echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > Codebase/Front-End/.env.local
```

Then remind the user to fill in the required values in `Codebase/Back-End/.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — any random string
- `ENCRYPTION_KEY` — exactly 64 hex characters. Generate with: `openssl rand -hex 32`
- `SEED_OWNER_PASSWORD` — password for the owner seed account

## Step 3 — Generate Prisma client

```bash
cd Codebase/Back-End && npx prisma generate
```

## Step 4 — Run database migrations

```bash
cd Codebase/Back-End && npx prisma migrate dev
```

If this fails, the database is not running or `DATABASE_URL` is wrong. Check PostgreSQL is up and the credentials match.

## Step 5 — Seed the database

```bash
cd Codebase/Back-End && npm run db:seed
```

This creates the owner account: `arvin@thesx.co` with the password set in `SEED_OWNER_PASSWORD`.

## Step 6 — Verify setup

Run `/health` to confirm everything is connected and working before starting development.

---

After setup is complete, start development with `/dev`.
