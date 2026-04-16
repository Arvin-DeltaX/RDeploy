# RDeploy - Project Knowledge Base

> Internal deployment platform for managing team projects via Docker on a single VPS.

---

## 1. Overview

RDeploy is a web-based internal deployment platform where teams can:

- Submit pre-standardized GitHub repositories
- Define environment variables via UI
- Deploy projects to a VPS using Docker
- Access a live URL for each deployed project

**Platform URL:** `rdeploy.deltaxs.co`
**Project URLs:** `{project-slug}-{team-slug}.deltaxs.co`
**DNS:** Single wildcard `*.deltaxs.co` pointing to VPS IP

### Important: Project Standardization is External

RDeploy does NOT standardize projects. Before submitting a repo to RDeploy, dev teams must use the **Master Prompt** (see `Documents/MASTER_PROMPT.md`) with an AI assistant to:
- Create a production-ready `Dockerfile`
- Create a `.env.example` with all required variables
- Add a `GET /health` endpoint
- Manage all config through environment variables

If a repo is missing `Dockerfile` or `.env.example`, RDeploy will reject it with a clear error message.

---

## 2. Tech Stack

| Layer            | Technology                                                        |
|------------------|-------------------------------------------------------------------|
| Frontend         | Next.js + TypeScript + Tailwind CSS + shadcn/ui                   |
| HTTP Client      | Axios (configured instance with JWT interceptors)                 |
| Server State     | TanStack Query (caching, polling, mutations, invalidation)        |
| Forms            | react-hook-form + zod (validation schemas)                        |
| Notifications    | sonner (toast notifications)                                      |
| Global State     | Zustand (auth token + current user)                               |
| Backend          | Express + TypeScript                                              |
| ORM              | Prisma                                                            |
| Database         | PostgreSQL                                                        |
| Auth             | Email/password + JWT (7 day expiry, no refresh tokens)            |
| GitHub           | Optional OAuth connect per user                                   |
| Deployment       | Docker CLI (managed from backend)                                 |
| Reverse Proxy    | Traefik (auto-discovers containers via Docker socket + labels)    |
| Real-time Logs   | SSE (Server-Sent Events) during active deploy/clone operations    |
| UI Theme         | Dark mode                                                         |
| Logo             | Placeholder (to be provided later)                                |

---

## 3. Architecture

### Single Server Deployment

```
VPS (single server)
│
├── Traefik (reverse proxy)
│   ├── rdeploy.deltaxs.co        → RDeploy platform
│   ├── myapp-backend.deltaxs.co  → deployed project container
│   └── ...
│
├── RDeploy Platform
│   ├── frontend (Next.js)
│   └── backend (Express)
│
├── PostgreSQL
│
└── User Project Containers (one per deployed project)
```

### Storage Layout

```
/var/rdeploy/
├── workspaces/
│   └── {team-slug}/
│       └── {project-slug}/
│           ├── repo/          # Cloned GitHub repo (already standardized)
│           └── .env           # Written at deploy time only, never committed
├── traefik/
│   └── traefik.yml
└── data/                      # PostgreSQL volume
```

Development uses `.rdeploy/workspaces/` (gitignored) instead of `/var/rdeploy/`.

Workspace path is configurable via `RDEPLOY_WORKSPACE_DIR` env variable.

---

## 4. Data Model

### User

| Field              | Type     | Notes                                      |
|--------------------|----------|--------------------------------------------|
| id                 | UUID     | Primary key                                |
| email              | String   | Unique                                     |
| password           | String   | Bcrypt hashed                              |
| name               | String   |                                            |
| avatarUrl          | String?  | Nullable                                   |
| platformRole       | Enum     | owner / admin / user                       |
| mustChangePassword | Boolean  | Default true, forced change on first login |
| githubId           | String?  | Nullable, unique                           |
| githubUsername     | String?  | Nullable                                   |
| githubAccessToken  | String?  | Nullable, encrypted                        |
| createdAt          | DateTime |                                            |
| updatedAt          | DateTime | Auto-updated                               |

### Team

| Field     | Type     | Notes        |
|-----------|----------|--------------|
| id        | UUID     | Primary key  |
| name      | String   |              |
| slug      | String   | Unique       |
| createdAt | DateTime |              |
| updatedAt | DateTime | Auto-updated |

### TeamMember

| Field    | Type     | Notes                   |
|----------|----------|-------------------------|
| id       | UUID     | Primary key             |
| userId   | UUID     | FK → User               |
| teamId   | UUID     | FK → Team               |
| role     | Enum     | leader / elder / member |
| joinedAt | DateTime |                         |

Constraint: Each team has exactly one leader.

### Project

| Field          | Type     | Notes                                                             |
|----------------|----------|-------------------------------------------------------------------|
| id             | UUID     | Primary key                                                       |
| teamId         | UUID     | FK → Team                                                         |
| name           | String   |                                                                   |
| slug           | String   | Unique per team                                                   |
| repoUrl        | String   | GitHub repo URL                                                   |
| dockerfilePath | String   | Default: `"Dockerfile"`. Use `"backend/Dockerfile"` etc. for monorepos |
| status         | Enum     | pending / cloning / ready / building / running / failed / stopped |
| healthStatus   | Enum     | healthy / unhealthy / unknown. Updated by periodic health check.  |
| port           | Int?     | Auto-assigned from port range                                     |
| containerId    | String?  | Docker container ID                                               |
| restartCount   | Int      | Default 0. Incremented each time container exits unexpectedly.    |
| exitCode       | Int?     | Last container exit code. Null if still running.                  |
| deployLogs     | String?  | Last deploy output (build + run). Stored as text, max ~50KB.      |
| createdAt      | DateTime |                                                                   |
| updatedAt      | DateTime | Auto-updated                                                      |

### ProjectAssignment

| Field      | Type     | Notes        |
|------------|----------|--------------|
| id         | UUID     | Primary key  |
| projectId  | UUID     | FK → Project |
| userId     | UUID     | FK → User    |
| assignedAt | DateTime |              |

### EnvVar

| Field     | Type     | Notes                    |
|-----------|----------|--------------------------|
| id        | UUID     | Primary key              |
| projectId | UUID     | FK → Project             |
| key       | String   |                          |
| value     | String   | Encrypted                |
| isSecret  | Boolean  | Default false            |
| updatedAt | DateTime |                          |

**isSecret behavior:**
- `isSecret: true` → value displays as `••••••` in the env vars list — never shown in plaintext after saving
- `isSecret: false` → value is visible in the list
- All values (secret or not) are always **editable** — click the field to update
- Users can **upload a `.env` file** to bulk-fill values — the upload parses the file and maps each key to an existing EnvVar record (unmatched keys are ignored)
- Values are always stored encrypted in the DB regardless of `isSecret`

---

## 5. Roles & Permissions

### Platform Roles

| Role  | Description            |
|-------|------------------------|
| Owner | Platform owner (Arvin) |
| Admin | Platform administrator |
| User  | Regular user           |

### Team Roles

| Role    | Description                                             |
|---------|---------------------------------------------------------|
| Leader  | Full project management. Team can have zero leaders.    |
| Elder   | Senior member. Can edit env vars.                       |
| Member  | Read-only viewer.                                       |

**Leader removal rules:**
- A team can have zero leaders — there is no forced minimum
- If a leader is removed from the team or their user account is deleted, all their TeamMember records are removed; the team simply has no leader
- Owner/Admin can always perform leader-level actions regardless
- UI shows a warning banner on teams with no leader

### Permission Matrix

| Action                    | Owner | Admin | Team Leader | Elder | Member |
|---------------------------|-------|-------|-------------|-------|--------|
| Create a team             | yes   | yes   | no          | no    | no     |
| Delete a team             | yes   | yes   | no          | no    | no     |
| Add user to team          | yes   | yes   | no          | no    | no     |
| Remove user from team     | yes   | yes   | no          | no    | no     |
| Add project to team       | yes   | yes   | yes         | no    | no     |
| Assign members to project | yes   | yes   | yes         | no    | no     |
| Deploy / Stop / Delete    | yes   | yes   | yes         | no    | no     |
| Edit env vars             | yes   | yes   | yes         | yes   | no     |
| View any project          | yes   | yes   | yes         | yes   | yes    |
| View logs                 | yes   | yes   | yes         | yes   | yes    |
| View team member list     | yes   | yes   | yes         | yes   | yes    |
| Create users              | yes   | yes   | no          | no    | no     |
| Promote users to admin    | yes   | yes   | no          | no    | no     |

---

## 6. Authentication

### Flow

1. No public registration — Owner/Admin creates users with email + default password `"changeme123"`
2. New user gets `mustChangePassword: true` — first login forces redirect to `/change-password`
3. After password change, `mustChangePassword` set to `false`, normal access
4. JWT token (7 day expiry, no refresh tokens) used for all API requests

### Slug Generation

Slugs are **auto-generated** from the name on creation using `slugify()`:
- `"My Team"` → `"my-team"`
- `"Backend API v2"` → `"backend-api-v2"`

If a slug already exists (collision), append an incrementing suffix: `my-team-2`, `my-team-3`.
Slugs are read-only after creation — cannot be changed.

### GitHub Connect (optional)

- Users can link GitHub account from profile page
- Enables cloning private repos using their GitHub token
- Not required to use the platform
- If private repo is submitted without GitHub connected → clear error shown

---

## 7. API Endpoints

### Auth

| Method | Endpoint                    | Purpose              |
|--------|-----------------------------|----------------------|
| POST   | `/api/auth/login`           | Login, get JWT       |
| POST   | `/api/auth/change-password` | Change password      |
| GET    | `/api/auth/me`              | Current user profile |
| GET    | `/api/auth/github`          | Start GitHub OAuth   |
| GET    | `/api/auth/github/callback` | Complete GitHub link |
| DELETE | `/api/auth/github`          | Disconnect GitHub    |

### Admin

| Method | Endpoint               | Purpose          |
|--------|------------------------|------------------|
| POST   | `/api/admin/users`     | Create user      |
| GET    | `/api/admin/users`     | List all users   |
| PUT    | `/api/admin/users/:id` | Update user role |
| DELETE | `/api/admin/users/:id` | Delete user      |

### Teams

| Method | Endpoint                         | Purpose       |
|--------|----------------------------------|---------------|
| POST   | `/api/teams`                     | Create team   |
| GET    | `/api/teams`                     | List my teams |
| GET    | `/api/teams/:id`                 | Team detail   |
| DELETE | `/api/teams/:id`                 | Delete team   |
| POST   | `/api/teams/:id/members`         | Add member    |
| DELETE | `/api/teams/:id/members/:userId` | Remove member |

### Projects

| Method | Endpoint                            | Purpose                  |
|--------|-------------------------------------|--------------------------|
| POST   | `/api/teams/:teamId/projects`       | Create project           |
| GET    | `/api/teams/:teamId/projects`       | List team projects       |
| GET    | `/api/projects`                     | List ALL projects        |
| GET    | `/api/projects/:id`                 | Project detail           |
| DELETE | `/api/projects/:id`                 | Hard delete project      |
| POST   | `/api/projects/:id/clone`           | Clone repo + read env    |
| GET    | `/api/projects/:id/env`             | Get env keys + whether value is set |
| PUT    | `/api/projects/:id/env`             | Save env values          |
| POST   | `/api/projects/:id/env/upload`      | Upload `.env` file to bulk-fill values |
| POST   | `/api/projects/:id/deploy`          | Build & deploy           |
| POST   | `/api/projects/:id/redeploy`        | Stop + rebuild + restart (atomic) |
| POST   | `/api/projects/:id/stop`            | Stop container           |
| GET    | `/api/projects/:id/logs`            | Persisted deploy logs snapshot (from Project.deployLogs) |
| GET    | `/api/projects/:id/logs/stream`     | SSE — live output during deploy/clone and from running container |
| GET    | `/api/projects/:id/container-status` | Real-time container state from Docker inspect (Running, ExitCode, RestartCount, StartedAt) |
| POST   | `/api/projects/:id/members`         | Assign members           |
| DELETE | `/api/projects/:id/members/:userId` | Remove member            |
| GET    | `/api/projects/:id/members`         | List assigned members    |

---

## 8. Frontend Pages

| Page            | Route                      | Access        |
|-----------------|----------------------------|---------------|
| Login           | `/login`                   | Public        |
| Change Password | `/change-password`         | Authenticated |
| Dashboard       | `/`                        | All users     |
| My Teams        | `/teams`                   | All users     |
| Team Detail     | `/teams/[id]`              | All users     |
| Add Project     | `/teams/[id]/projects/new` | Leader+       |
| Project Detail  | `/projects/[id]`           | All users     |
| Project Members | `/projects/[id]/members`   | Leader+       |
| Admin Panel     | `/admin`                   | Owner/Admin   |
| Profile         | `/profile`                 | Authenticated |

---

## 9. Deployment Flow

```
1. Team leader adds project (name + GitHub URL)

2. Click "Connect Repo"
   → Backend clones the repo to workspace
   → Validates: Dockerfile exists? .env.example exists?
   → If missing either → status: "failed" + error message shown
   → If valid → reads .env.example, extracts keys, saves to DB
   → Status: pending → cloning → ready (or failed)
   → Clone failure reason stored in deployLogs field for display

3. User fills in env var values via the generated form on project page

4. Click "Deploy"
   → Guard: if project status is "building" or "cloning" → reject with 409 (deploy already in progress)
   → Pre-deploy validation:
      - Check all env var keys have non-empty values → if any missing, return error listing the empty keys
      - Scan values for localhost/127.0.0.1/0.0.0.0 → return warning (non-blocking, user must confirm)
   → If project already has a running container → stop and remove it first (atomic redeploy)
   → Auto-inject PORT={assigned-port} into the .env file (in addition to user-defined vars)
   → Backend writes .env file from decrypted DB values to workspace
   → Builds Docker image: docker build -t rdeploy-{project}-{team} -f {dockerfilePath} {workspace}/repo/
   → Scans DB for used ports → assigns lowest free port in PORT_START–PORT_END range
   → Runs container with --network rdeploy-net + Traefik labels for routing
   → Stores container ID + port in DB
   → Deletes .env file from workspace immediately after docker run starts
   → Stores full build + run output in Project.deployLogs (capped at ~50KB, truncate from top if exceeded)
   → Status: ready → building → running (or failed)
   → Build output streamed live to UI via SSE (GET /api/projects/:id/logs/stream)
   → After container starts: wait 15 seconds → hit GET http://{container-ip}:{port}/health
      - 200 response → healthStatus: healthy
      - Timeout / non-200 → healthStatus: unhealthy (status stays "running", warning shown in UI)

5. Project is live at {project-slug}-{team-slug}.deltaxs.co

6. Health check polling (background, every 60 seconds)
   → For every project with status "running":
      - docker inspect {containerId} → check State.Running, State.ExitCode, RestartCount
      - If container not running → update status: failed, store exitCode
      - If running → hit GET http://{container-ip}:{port}/health
        - 200 → healthStatus: healthy
        - Failure → healthStatus: unhealthy

7. Delete project
   → Stop & remove Docker container
   → Remove Docker image (docker rmi rdeploy-{project}-{team})
   → Delete workspace folder
   → Delete all DB records (project, env vars, assignments)
```

### Pre-Deploy Validation Rules

| Check | Behavior |
|-------|----------|
| Any env var value is empty | Block deploy — return error listing empty keys |
| Value contains `localhost`, `127.0.0.1`, or `0.0.0.0` | Return warning — user must confirm before deploy proceeds |
| Project status is `building` or `cloning` | Block deploy — return 409 "Deploy already in progress" |

### Health Check Behavior

- Health checks require the container to expose `GET /health` returning HTTP 200
- The Master Prompt enforces this — all standardized repos must include this endpoint
- `healthStatus` values: `healthy` / `unhealthy` / `unknown` (unknown = not yet checked or container stopped)
- A project can be `status: running` with `healthStatus: unhealthy` — container is up but app is broken
- Health check failures do NOT automatically stop or redeploy the container — the team must investigate

---

## 10. Project Validation Rules

When a repo is cloned, RDeploy checks:

| Check | Required | Error if missing |
|-------|----------|-----------------|
| Dockerfile exists at `dockerfilePath` | YES | "Dockerfile missing at {path}. Use the Master Prompt to standardize your project first." |
| `.env.example` exists at repo root | YES | ".env.example missing. Use the Master Prompt to standardize your project first." |

`dockerfilePath` defaults to `"Dockerfile"` (repo root). For monorepos, it can be set to a subdirectory path like `"backend/Dockerfile"` when creating the project.

RDeploy does NOT generate or modify any files in the repo.

## 10a. Multi-Service / Monorepo Projects

If a GitHub repo contains multiple services (e.g. backend + frontend), each service is submitted as a **separate project** in RDeploy, all pointing to the same repo URL but with different `dockerfilePath` values.

Example — repo `github.com/org/my-app`:

| Project name | dockerfilePath | URL |
|---|---|---|
| `my-app-backend` | `backend/Dockerfile` | `my-app-backend-my-team.deltaxs.co` |
| `my-app-frontend` | `frontend/Dockerfile` | `my-app-frontend-my-team.deltaxs.co` |

The repo must contain a root-level `rdeploy.yml` that documents all deployable services. RDeploy does not parse this file — it exists as a guide for the team leader when setting up projects.

**`rdeploy.yml` format:**
```yaml
# RDeploy multi-service config
# Each entry maps to one project you create in RDeploy
services:
  backend:
    dockerfile: backend/Dockerfile
    description: Express API
  frontend:
    dockerfile: frontend/Dockerfile
    description: Next.js frontend
```

The `.env.example` at repo root must contain variables for **all services combined**. RDeploy uses one env form per project — each project gets its own subset of env vars filled in.

---

## 11. Observability

### Project Page — What the Team Sees

The project detail page surfaces all signals needed to diagnose issues without needing SSH access:

```
┌──────────────────────────────────────────────────────┐
│ my-api                              ● Unhealthy       │
│ Status: running  |  Up 2h 14m  |  3 restarts         │
│ Exit code: —  (container still running)               │
│                                                        │
│ [ View App Logs ]  [ View Deploy Logs ]  [ Redeploy ] │
└──────────────────────────────────────────────────────┘
```

#### Status Badge

Shows `Project.status` (pending / cloning / ready / building / running / failed / stopped) with color:

| Status   | Color  |
|----------|--------|
| running  | green  |
| building | yellow |
| cloning  | yellow |
| failed   | red    |
| stopped  | gray   |
| ready    | blue   |
| pending  | gray   |

#### Health Badge (separate from status badge)

Shows `Project.healthStatus`:

| Value     | Display             | Color  |
|-----------|---------------------|--------|
| healthy   | ● Healthy           | green  |
| unhealthy | ● Unhealthy         | red    |
| unknown   | ● Unknown           | gray   |

Only shown when `status === "running"`.

#### Container Info Row

Pulled from `GET /api/projects/:id/container-status` (docker inspect, live):

| Field          | Source                        | Display                         |
|----------------|-------------------------------|---------------------------------|
| Uptime         | State.StartedAt               | "Up 2h 14m"                     |
| Restart count  | RestartCount                  | "3 restarts" (warning if > 0)   |
| Exit code      | State.ExitCode                | Shown only if container stopped |

Frontend polls this endpoint every 30 seconds when status is `running`.

#### Logs Viewer — Two Tabs

```
[ Deploy Logs ]   [ App Logs ]
```

**Deploy Logs tab:**
- Shows `Project.deployLogs` (stored text from last build + run)
- Always available — persisted to DB during deploy
- Useful even when container is stopped or deleted

**App Logs tab:**
- Streams live `docker logs --follow {containerId}` via SSE
- Same `GET /api/projects/:id/logs/stream` endpoint, with `?type=app` query param
- Only works while container is running
- Shows last 100 lines on connect, then streams new output

### Diagnosing Common Problems

| Symptom | Check |
|---------|-------|
| Status: failed immediately | Deploy Logs tab — build error |
| Status: running, Health: unhealthy | App Logs tab — app crash/exception |
| Restart count > 0 | App Logs tab — app keeps crashing on start |
| Exit code 137 | App was OOM killed — reduce memory usage |
| Exit code 1 | App error — check App Logs |
| 502 from Traefik | App not listening on PORT — check App Logs |

---

## 12. Security Rules

- Passwords stored as bcrypt hashes
- Env var values encrypted in database using AES-256-GCM (Node `crypto` built-in, no extra dependency)
- Each encrypted value uses a unique random IV — same value stored twice produces different ciphertext
- Encryption key sourced from `ENCRYPTION_KEY` env var (must be 32 bytes)
- GitHub access tokens encrypted in database (same AES-256-GCM approach)
- `.env` files written to workspace at deploy time, **deleted immediately after `docker run` starts** — plaintext secrets must not persist on disk; the DB (encrypted) is the source of truth
- Users edit env vars through the RDeploy UI, never by editing files on the VPS
- JWT tokens expire after 7 days — no refresh tokens (internal tool, simplicity over convenience)
- No secrets in source code
- `.rdeploy/` directory gitignored

---

## 13. Seed Data

On first run, the platform creates:

| Field              | Value                                 |
|--------------------|---------------------------------------|
| email              | arvin@thesx.co                        |
| name               | Arvin                                 |
| platformRole       | owner                                 |
| mustChangePassword | false                                 |
| password           | Set via env var `SEED_OWNER_PASSWORD` |

---

## 14. Environment Variables (Platform Config)

```env
# Database
DATABASE_URL=postgresql://rdeploy:password@localhost:5432/rdeploy

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# GitHub OAuth (for optional GitHub connect)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=https://rdeploy.deltaxs.co/api/auth/github/callback

# Workspace
RDEPLOY_WORKSPACE_DIR=/var/rdeploy/workspaces

# Domain
RDEPLOY_DOMAIN=deltaxs.co
RDEPLOY_PLATFORM_URL=https://rdeploy.deltaxs.co

# Frontend → Backend API URL
# In production: https://rdeploy.deltaxs.co (Traefik routes /api/* to backend)
# In development: http://localhost:5000
NEXT_PUBLIC_API_URL=https://rdeploy.deltaxs.co

# Seed
SEED_OWNER_PASSWORD=changeme

# Encryption — AES-256-GCM via Node crypto (must be exactly 32 bytes)
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Port range for deployed project containers
# Sequential scan: lowest free port in range is assigned at deploy time
PORT_RANGE_START=3001
PORT_RANGE_END=4000

# Docker network — all platform services and user containers join this network
# Traefik auto-discovers containers on this network via Docker socket + labels
DOCKER_NETWORK=rdeploy-net
```

---

## 15. Docker Compose (Platform)

Services:
- `traefik` — reverse proxy, handles all routing
- `frontend` — Next.js app
- `backend` — Express API
- `postgres` — PostgreSQL database

All services join the shared Docker network `rdeploy-net`.

User project containers are managed directly via Docker CLI from the backend, NOT via docker-compose.
Every user container is started with `--network rdeploy-net` so Traefik can discover and route to it automatically.

### Docker Network

```
Network: rdeploy-net (bridge)
│
├── traefik       ← watches Docker socket for containers joining this network
├── frontend      ← rdeploy.deltaxs.co
├── backend       ← internal API
├── postgres      ← internal DB
└── [user containers]  ← each joined at deploy time via --network rdeploy-net
```

Traefik uses Docker labels on each user container to know the hostname to route:
```
traefik.enable=true
traefik.http.routers.{name}.rule=Host(`{project-slug}-{team-slug}.deltaxs.co`)
traefik.http.services.{name}.loadbalancer.server.port={assigned-port}
```

### Port Assignment

- Port range: `PORT_RANGE_START` to `PORT_RANGE_END` (default 3001–4000)
- At deploy time: query DB for all used ports → pick lowest number in range not already taken
- Port stored on `Project.port` column
- Port freed when project is deleted (DB record removed)
- If range exhausted → deploy fails with error "No available ports"

---

## 16. Project Structure

```
RDeploy/
├── Codebase/
│   ├── Front-End/
│   │   ├── src/
│   │   │   ├── app/                          # Next.js App Router
│   │   │   │   ├── (auth)/                   # Auth route group (no sidebar)
│   │   │   │   │   ├── login/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── change-password/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx            # Auth layout (centered card)
│   │   │   │   ├── (dashboard)/              # App route group (with sidebar)
│   │   │   │   │   ├── page.tsx              # / Dashboard
│   │   │   │   │   ├── teams/
│   │   │   │   │   │   ├── page.tsx          # /teams
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       ├── page.tsx      # /teams/[id]
│   │   │   │   │   │       └── projects/
│   │   │   │   │   │           └── new/
│   │   │   │   │   │               └── page.tsx
│   │   │   │   │   ├── projects/
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       ├── page.tsx      # /projects/[id]
│   │   │   │   │   │       └── members/
│   │   │   │   │   │           └── page.tsx
│   │   │   │   │   ├── admin/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── profile/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx            # Dashboard layout (sidebar + topbar)
│   │   │   │   ├── layout.tsx                # Root layout
│   │   │   │   └── globals.css
│   │   │   │
│   │   │   ├── components/                   # Atomic Design
│   │   │   │   ├── atoms/                    # Smallest building blocks
│   │   │   │   │   ├── Button/
│   │   │   │   │   ├── Badge/
│   │   │   │   │   ├── Input/
│   │   │   │   │   ├── Label/
│   │   │   │   │   ├── Avatar/
│   │   │   │   │   ├── Spinner/
│   │   │   │   │   ├── Separator/
│   │   │   │   │   └── Logo/
│   │   │   │   ├── molecules/                # Combinations of atoms
│   │   │   │   │   ├── FormField/            # Label + Input + error message
│   │   │   │   │   ├── StatusBadge/          # Badge with color by project status
│   │   │   │   │   ├── UserAvatar/           # Avatar + name
│   │   │   │   │   ├── SearchInput/          # Input with search icon
│   │   │   │   │   ├── ConfirmDialog/        # Reusable confirm modal
│   │   │   │   │   ├── CopyButton/           # Button that copies text
│   │   │   │   │   └── EmptyState/           # Empty list placeholder
│   │   │   │   ├── organisms/                # Complex UI sections
│   │   │   │   │   ├── Sidebar/              # App sidebar with nav links
│   │   │   │   │   ├── Topbar/               # Top navigation bar
│   │   │   │   │   ├── ProjectCard/          # Project card for dashboard
│   │   │   │   │   ├── ProjectTable/         # Project list table
│   │   │   │   │   ├── EnvVarsForm/          # Dynamic env var input form
│   │   │   │   │   ├── LogsViewer/           # Deploy Logs + App Logs tabs (SSE stream)
│   │   │   │   │   ├── TeamMemberList/       # Team members table
│   │   │   │   │   ├── AddMemberModal/       # Modal to add team member
│   │   │   │   │   ├── CreateTeamModal/      # Modal to create a team
│   │   │   │   │   ├── CreateUserModal/      # Modal to create a user (admin)
│   │   │   │   │   ├── DeployButton/         # Deploy/stop button with confirm
│   │   │   │   │   └── ContainerStatusBar/   # Uptime, restart count, exit code, health badge
│   │   │   │   ├── templates/                # Page layout templates
│   │   │   │   │   ├── AuthTemplate/         # Centered card layout for auth pages
│   │   │   │   │   └── DashboardTemplate/    # Sidebar + content layout
│   │   │   │   └── providers/               # React context providers
│   │   │   │       └── AuthProvider/         # Auth context (current user, JWT)
│   │   │   │
│   │   │   ├── hooks/                        # Custom React hooks
│   │   │   │   ├── useAuth.ts               # Auth state + login/logout
│   │   │   │   ├── useProjects.ts           # Projects data fetching
│   │   │   │   ├── useTeams.ts              # Teams data fetching
│   │   │   │   └── useDebounce.ts           # Debounce utility hook
│   │   │   │
│   │   │   ├── services/                    # API call functions (per resource)
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   ├── teams.service.ts
│   │   │   │   └── projects.service.ts
│   │   │   │
│   │   │   ├── store/                       # Global state (Zustand)
│   │   │   │   └── auth.store.ts            # Auth state store
│   │   │   │
│   │   │   ├── lib/                         # Pure utilities
│   │   │   │   ├── api.ts                   # Axios instance — base URL + JWT interceptor + 401 handler
│   │   │   │   └── utils.ts                 # cn(), slugify(), formatDate() — format: DD/MM/YYYY
│   │   │   │
│   │   │   ├── types/                       # TypeScript types & interfaces
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── team.types.ts
│   │   │   │   ├── project.types.ts
│   │   │   │   └── api.types.ts             # API response shapes
│   │   │   │
│   │   │   └── constants/                   # App-wide constants
│   │   │       ├── routes.ts                # Route path constants
│   │   │       └── status.ts                # Project status labels/colors
│   │   │
│   │   ├── public/
│   │   │   └── logo-placeholder.svg
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── Back-End/
│       ├── src/
│       │   ├── routes/          # Express route handlers
│       │   │   ├── auth.routes.ts
│       │   │   ├── admin.routes.ts
│       │   │   ├── teams.routes.ts
│       │   │   └── projects.routes.ts
│       │   ├── middleware/      # Express middleware
│       │   │   ├── requireAuth.ts       # JWT guard
│       │   │   ├── requirePlatformRole.ts
│       │   │   └── requireTeamRole.ts
│       │   ├── services/        # Business logic
│       │   │   ├── auth.service.ts
│       │   │   ├── docker.service.ts    # Docker CLI interactions
│       │   │   ├── git.service.ts       # Repo cloning
│       │   │   └── env.service.ts       # .env.example parsing + encryption
│       │   ├── utils/           # Pure helpers
│       │   │   ├── encryption.ts        # Encrypt/decrypt env values
│       │   │   ├── slugify.ts
│       │   │   └── ports.ts             # Auto-assign available port
│       │   └── index.ts         # Entry point
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
├── Documents/
│   ├── MASTER_PROMPT.md
│   └── WORKFLOW.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── ROADMAP.md
├── KNOWLEDGE_BASE.md
├── CLAUDE.md
└── README.md
```

---

## 17. Frontend Component Rules (Atomic Design)

### Atoms
Single-purpose, no business logic. Wrap or extend shadcn/ui primitives.
- Examples: Button, Badge, Input, Label, Avatar, Spinner, Logo

### Molecules
Combine 2–3 atoms into a reusable UI pattern. Still no business logic.
- Examples: FormField (Label + Input + error), StatusBadge (Badge + color logic), ConfirmDialog

### Organisms
Complex sections with their own internal state or data props. No direct API calls.
- Examples: EnvVarsForm, LogsViewer, Sidebar, ProjectCard, TeamMemberList

### Templates
Page layout shells. Define structure (sidebar, content area, header). No data.
- Examples: AuthTemplate, DashboardTemplate

### Providers
React context wrappers. Handle global state like auth.
- Examples: AuthProvider

### Rules
- Each component lives in its own folder: `ComponentName/index.tsx`
- Co-locate styles and sub-components inside the folder if needed
- No API calls inside components — use hooks or pass data as props
- Hooks (`hooks/`) handle data fetching via service functions
- Services (`services/`) contain all API call logic
- Store (`store/`) for global state that persists across pages (auth)

---

## 18. Frontend Data Flow

```
page → TanStack Query hook → service function → lib/api.ts (axios) → backend
```

### Layer Responsibilities

| Layer | Tool | Responsibility |
|-------|------|---------------|
| `lib/api.ts` | Axios instance | Base URL, attach JWT header via interceptor, handle 401 → logout |
| `services/` | Plain async functions | Call axios, return typed data — one file per resource |
| `hooks/` | TanStack Query | Caching, loading/error state, polling, invalidation |
| `store/` | Zustand | JWT token + current user — persisted across pages |
| Components | Props only | Receive data as props, never fetch directly |

### TanStack Query Patterns

```typescript
// Polling during active deploy (status changes)
useQuery({
  queryKey: ['project', id],
  queryFn: () => getProject(id),
  refetchInterval: (data) => data?.status === 'building' ? 2000 : false,
})

// Invalidate after mutation
useMutation({
  mutationFn: deployProject,
  onSuccess: () => queryClient.invalidateQueries(['project', id]),
})
```

### SSE (Live Logs)

**Deploy Logs tab:**
- During `cloning` or `building`: connects to `GET /api/projects/:id/logs/stream` via `EventSource`, displays output line-by-line with auto-scroll, shows a "Live" badge
- When not actively deploying: displays `Project.deployLogs` (persisted text) via `GET /api/projects/:id/logs`
- Always available — even after container is gone

**App Logs tab:**
- Only active when `status === "running"`
- Connects to `GET /api/projects/:id/logs/stream?type=app` via `EventSource` — streams `docker logs --follow`
- Shows last 100 lines on connect, then streams new output live
- Shows "Live" badge while connected; closes `EventSource` on unmount or when status changes away from `running`
