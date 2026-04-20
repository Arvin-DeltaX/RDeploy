---
model: claude-opus-4-6
---

You are doing a full KNOWLEDGE_BASE.md sync for RDeploy. The codebase has been developed significantly and the KB may be stale or incomplete. Your job is to read the actual code — every layer — and produce a KB that is so comprehensive that any developer or AI agent can fully understand the platform without reading the source code.

This is a read-the-code-first operation. Do not guess. Do not preserve stale content just because it was already there. Ground truth is the code.

---

## Step 1 — Read the KB and project structure first

1. Read `KNOWLEDGE_BASE.md` fully — note its current sections and what's missing or vague
2. Run a directory listing of the full project to understand what exists:
   - `Codebase/Back-End/src/` — all subdirectories
   - `Codebase/Front-End/src/` — all subdirectories
   - `Codebase/Back-End/prisma/` — schema + migrations

---

## Step 2 — Spawn all audit agents IN PARALLEL

Launch all 8 agents at once. Each reads a specific area and returns a detailed findings report. They do NOT edit anything — only report.

---

### Audit Agent A — API Endpoints (exhaustive)

```
You are doing an exhaustive audit of every API endpoint in the RDeploy backend.

1. Find and read ALL route files under Codebase/Back-End/src/routes/ — use Glob to find them all, do not miss any
2. Read Codebase/Back-End/src/app.ts (or index.ts) to see how routes are mounted and what global middleware runs
3. For EVERY endpoint, document:
   - HTTP method + full path (e.g. POST /api/auth/login)
   - Purpose (what it does, 1-2 sentences)
   - Authentication required? (yes/no, how enforced)
   - Authorization required? (exact role check — platformRole, teamRole, or both)
   - Request: headers, params, query params, body (field name + type + required/optional)
   - Response success: status code + full shape with field names and types
   - Response errors: all possible error status codes + error messages
   - Side effects: what DB records are created/updated/deleted, what files are written, what Docker commands run
4. Note all middleware applied at router level vs route level
5. Note any rate limiting, validation libraries used (zod schemas), or special headers

Return a comprehensive markdown report organized by route file. Do not edit any files.
```

---

### Audit Agent B — Database Schema (exhaustive)

```
You are doing an exhaustive audit of the RDeploy database schema.

1. Read Codebase/Back-End/prisma/schema.prisma fully
2. List all migrations in Codebase/Back-End/prisma/migrations/ — note what each one added/changed
3. Read Codebase/Back-End/prisma/seed.ts (or seed.js) — document exactly what seed data is created
4. For EVERY Prisma model, document:
   - Model name and corresponding DB table name
   - Every field: name, type, modifiers (@id, @unique, @default, @relation, ?, [])
   - All relations: related model, relation name, cardinality (1-1, 1-many, many-many)
   - All indexes defined (@@index, @@unique)
   - Any @@map or @map aliases
5. For EVERY enum, list all values
6. Document the full entity relationship: draw it out as a text diagram showing how models connect
7. Note any fields that are encrypted at the application layer (env var values, tokens, etc.)

Return a comprehensive markdown report. Do not edit any files.
```

---

### Audit Agent C — Auth, Permissions & Security (exhaustive)

```
You are doing an exhaustive audit of the RDeploy auth and permission system.

1. Read ALL middleware files under Codebase/Back-End/src/middleware/ — use Glob to find them all
2. Read Codebase/Back-End/src/services/auth.service.ts
3. Read Codebase/Back-End/src/utils/encryption.ts (or wherever encryption lives)
4. Read any GitHub OAuth related service or route files
5. Document in full detail:

   AUTH FLOW:
   - Exact login flow: what fields accepted, how password is verified, what token is issued
   - JWT payload: what fields are in the token, expiry, signing algorithm
   - How the token is validated on protected routes (middleware name, what it extracts and attaches to req)
   - mustChangePassword: when it is set, how it is enforced (what middleware/check), what happens if violated
   - Logout: how it works (client-side only, or server-side invalidation?)

   PLATFORM ROLES (on User model):
   - List every platformRole value
   - For each role: what actions are permitted, what are blocked
   - How role checks are implemented (middleware function names and logic)

   TEAM ROLES (on TeamMember model):
   - List every teamRole value
   - For each role: what actions are permitted, what are blocked
   - How team role checks work — how does the backend know the user's role on a specific team?

   PERMISSION MATRIX:
   - Produce a complete table: action × role showing permitted/denied

   GITHUB CONNECT:
   - Is it implemented? If yes, exact OAuth flow, what is stored, how it's used for private repos

   ENCRYPTION:
   - What algorithm is used, what fields are encrypted, where encryption/decryption happens

Return a comprehensive markdown report. Do not edit any files.
```

---

### Audit Agent D — Deployment & Docker Engine (exhaustive)

```
You are doing an exhaustive audit of the RDeploy deployment engine.

1. Use Glob to find all service files related to deployment, Docker, projects, and repos under Codebase/Back-End/src/
2. Read each one fully
3. Document in full detail:

   CONNECT REPO FLOW:
   - Exact sequence of steps (numbered)
   - Git clone command used (flags, where it clones to)
   - Validation checks performed (Dockerfile exists? .env.example exists? rdeploy.yml parsed?)
   - How .env.example is parsed and saved to DB
   - Project status transitions with exact status values at each step
   - Error conditions: what errors are thrown and when
   - SSE log streaming: how it works for this operation

   DEPLOY FLOW:
   - Exact sequence of steps (numbered)
   - How env vars are decrypted and written to .env file
   - Exact `docker build` command with all flags
   - Exact `docker run` command with all flags, labels, port mapping, network, volume mounts
   - Traefik labels used (exact label names and value patterns)
   - Container naming convention
   - Port assignment: how ports are allocated, tracked, avoided conflicts
   - Project status transitions with exact status values
   - Error conditions and how they're handled
   - SSE log streaming: how it works during build and run

   STOP FLOW:
   - Exact docker commands run
   - Status transitions

   DELETE FLOW:
   - Exact sequence: container stop/remove, workspace deletion, DB record cleanup order

   WORKSPACE:
   - Exact directory structure on disk
   - Path patterns (how team slug and project slug are used)
   - Configurable via which env var
   - Local dev vs production differences

   RDEPLOY.YML:
   - Is parsing implemented? How does it work? What does it do with the parsed data?

Return a comprehensive markdown report. Do not edit any files.
```

---

### Audit Agent E — Frontend Pages, Components & State (exhaustive)

```
You are doing an exhaustive audit of the RDeploy frontend.

1. Use Glob to map the full file tree under Codebase/Front-End/src/
2. Read the app router structure under Codebase/Front-End/src/app/ fully
3. Read all files under Codebase/Front-End/src/services/
4. Read all files under Codebase/Front-End/src/hooks/
5. Read Codebase/Front-End/src/store/ fully
6. Read Codebase/Front-End/src/lib/ fully
7. Read Codebase/Front-End/src/constants/ fully
8. Read Codebase/Front-End/src/types/ fully
9. Skim the components tree — note major organisms and their purpose

Document in full detail:

   PAGES & ROUTES:
   - Every page that exists: full URL path, what it shows, auth required?
   - Route groups and their layouts
   - Any redirects or guards implemented

   SERVICES:
   - Every service file: what resource it covers, every function with its API call and params

   HOOKS:
   - Every hook: what query/mutation it wraps, polling intervals, cache keys, invalidation targets

   STATE MANAGEMENT:
   - Zustand store: what is stored, actions, persistence

   API CLIENT:
   - lib/api.ts: base URL config, JWT interceptor behavior, 401 handling

   TYPES:
   - All TypeScript interfaces/types defined — field names and types

   CONSTANTS:
   - All route constants, status constants, any other constants

   KEY BEHAVIORS:
   - How SSE log streaming is consumed on the frontend
   - How mustChangePassword redirect works
   - How GitHub connect flow works on frontend (if implemented)

Return a comprehensive markdown report. Do not edit any files.
```

---

### Audit Agent F — Configuration, Environment & Infrastructure

```
You are auditing the RDeploy project configuration, environment variables, and infrastructure setup.

1. Read .env.example at the project root
2. Read Codebase/Back-End/src/config/ or wherever backend config is defined
3. Read docker-compose.yml at the project root
4. Read any Dockerfile at the project root or in Codebase/
5. Read Codebase/Front-End/next.config.mjs (or next.config.ts)
6. Use Glob to find any .env.example files in subdirectories

Document in full detail:

   ENVIRONMENT VARIABLES:
   - Every env var: name, what it controls, required/optional, default value, which service uses it
   - Group by: backend-only, frontend-only, shared, infrastructure

   DOCKER COMPOSE:
   - Every service defined: image/build, ports, volumes, networks, depends_on, env vars
   - Network definitions
   - Volume definitions

   BACKEND CONFIG:
   - How config is loaded (dotenv, direct process.env, config module)
   - Any config validation on startup

   FRONTEND CONFIG:
   - next.config settings
   - Any NEXT_PUBLIC_ vars and what they control

   TRAEFIK:
   - How Traefik is configured (static config, dynamic config, or labels only)
   - Entrypoints, networks, any TLS/HTTPS setup

Return a comprehensive markdown report. Do not edit any files.
```

---

### Audit Agent G — Backend Services & Business Logic

```
You are auditing the RDeploy backend services layer — the business logic that sits between routes and the database.

1. Use Glob to find ALL service files under Codebase/Back-End/src/services/
2. Use Glob to find ALL utility files under Codebase/Back-End/src/utils/
3. Read each one fully
4. For each service file, document:
   - What resource/domain it covers
   - Every exported function: name, parameters, return value, what it does
   - Any complex business rules implemented (e.g. slug generation, status machine, validation logic)
   - Any calls to external systems (GitHub API, Docker CLI, filesystem)
   - Any encryption/decryption operations
5. For each utility file, document:
   - Purpose
   - Every exported function with signature and behavior

Pay special attention to:
- How slugs are generated and guaranteed unique
- How project status transitions are managed (what triggers each status)
- How GitHub API calls are made (auth, endpoints used)
- Any retry logic, error wrapping, or custom error types

Return a comprehensive markdown report. Do not edit any files.
```

---

### Audit Agent H — Error Handling, Edge Cases & Validations

```
You are auditing the RDeploy codebase for error handling patterns, input validation, and edge case coverage.

1. Read all zod schemas defined in route files or a schemas/ directory under Codebase/Back-End/src/
2. Read the global error handler in Codebase/Back-End/src/app.ts or middleware/
3. Grep for custom error classes or error type definitions
4. Read how validation errors are returned to the client
5. Document:

   VALIDATION:
   - Every zod schema: which endpoint it covers, what fields are validated, what constraints
   - Any custom validation beyond zod (manual checks in services)

   ERROR HANDLING:
   - Global error handler: what it catches, what it returns
   - Custom error types/classes defined
   - How async errors are caught (try/catch, asyncHandler wrapper, etc.)
   - Consistent error response shape (confirm: { error: "message" })

   EDGE CASES HANDLED:
   - Duplicate slug handling
   - What happens if Docker daemon is unreachable
   - What happens if GitHub repo is private and no token
   - What happens if .env.example is missing or malformed
   - What happens if a container fails to start
   - Concurrent deploy attempts on same project

   FRONTEND VALIDATION:
   - Zod schemas used in forms (react-hook-form)
   - Client-side validation rules per form

Return a comprehensive markdown report. Do not edit any files.
```

---

## Step 3 — Synthesize and rewrite the KB

Once all 8 audit agents have returned their reports, do the following:

Read `KNOWLEDGE_BASE.md` one more time, then update it section by section using the audit findings.

The goal is a KB so complete that:
- Any new developer can fully understand the platform without reading source code
- Any AI agent can make correct architectural decisions using only the KB
- Every API endpoint, model field, permission rule, env var, and flow is documented

### What to update in each KB section:

| Section | Source audit(s) |
|---------|----------------|
| Overview / tech stack | F |
| Data models / schema | B |
| API endpoints | A |
| Auth & permissions | C |
| Deployment flow | D |
| Frontend pages & routes | E |
| Frontend services & hooks | E |
| Environment variables | F |
| Business logic & services | G |
| Error handling & validation | H |
| Docker / infrastructure | D + F |

### Rules for writing:
- Add new top-level sections if audit found entire areas not covered in current KB
- Use tables where lists of things have consistent attributes (endpoints, models, env vars)
- Use numbered steps for flows (deploy, connect repo, etc.)
- Include exact values where they matter (status strings, label names, command flags)
- Do not pad — every sentence must convey information not inferable elsewhere
- Keep existing sections that are already accurate, expand what is incomplete

---

## Step 4 — Final report

After the KB is updated:

**Sections added:** (new top-level sections that didn't exist before)

**Sections expanded:** (existing sections that got significant new content)

**Sections corrected:** (things that were wrong and are now fixed)

**Sections removed:** (stale content deleted)

**Coverage confidence:** Rate each area 1-5 on how thoroughly the audit was able to document it, and flag any areas where source code was missing or ambiguous.

Then ask: "Want me to commit the updated KNOWLEDGE_BASE.md?"
