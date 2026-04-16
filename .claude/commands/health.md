---
model: claude-sonnet-4-6
---

Check the health of the local RDeploy stack. Run this to diagnose why something isn't working before assuming there's a bug.

## Checks to perform

### 1 — Environment files

Verify both `.env` files exist and required keys are non-empty:

```bash
# Backend .env
cat Codebase/Back-End/.env | grep -E "^(DATABASE_URL|JWT_SECRET|ENCRYPTION_KEY|SEED_OWNER_PASSWORD)" | grep -v "=$\|=your\|=changeme"
```

Report any missing or placeholder values as ❌. Required fields:
- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY` (must be 64 hex chars — exactly 32 bytes)
- `SEED_OWNER_PASSWORD`

Check frontend env:
```bash
cat Codebase/Front-End/.env.local 2>/dev/null || echo "MISSING: Codebase/Front-End/.env.local"
```

### 2 — Dependencies installed

```bash
[ -d Codebase/Back-End/node_modules ] && echo "✅ Backend deps installed" || echo "❌ Backend node_modules missing — run: cd Codebase/Back-End && npm install"
[ -d Codebase/Front-End/node_modules ] && echo "✅ Frontend deps installed" || echo "❌ Frontend node_modules missing — run: cd Codebase/Front-End && npm install"
```

### 3 — Prisma client generated

```bash
[ -d Codebase/Back-End/node_modules/.prisma/client ] && echo "✅ Prisma client generated" || echo "❌ Prisma client missing — run: cd Codebase/Back-End && npx prisma generate"
```

### 4 — Database reachability

```bash
cd Codebase/Back-End && npx prisma db execute --stdin <<< "SELECT 1" 2>&1 | grep -q "1" && echo "✅ Database reachable" || echo "❌ Database unreachable — check PostgreSQL is running and DATABASE_URL is correct"
```

### 5 — TypeScript — no compile errors

```bash
cd Codebase/Back-End && npx tsc --noEmit 2>&1 | head -20
cd Codebase/Front-End && npx tsc --noEmit 2>&1 | head -20
```

Report ✅ if no errors, ❌ with first error lines if any.

### 6 — Backend reachable (only if server is running)

```bash
curl -sf http://localhost:5000/api/health 2>/dev/null && echo "✅ Backend responding" || echo "⚠️  Backend not running (start with /dev)"
```

### 7 — Frontend reachable (only if server is running)

```bash
curl -sf http://localhost:3000 2>/dev/null && echo "✅ Frontend responding" || echo "⚠️  Frontend not running (start with /dev)"
```

---

## Summary format

Report results as a checklist:

```
✅ Backend deps installed
✅ Frontend deps installed
✅ Prisma client generated
✅ Database reachable
❌ ENCRYPTION_KEY is placeholder — must be 64 hex chars
⚠️  Backend not running — start with /dev
```

If any ❌ items are found, suggest the fix inline. If all checks pass, confirm the stack is healthy and ready.

If `/dev` has not been run yet, skip checks 6 and 7 and note they require the servers to be running.
