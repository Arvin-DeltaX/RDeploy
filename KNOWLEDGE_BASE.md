# RDeploy - Project Knowledge Base

> Internal deployment platform for managing team projects via Docker on a single VPS.
> Last synced: 2026-04-21

---

## 1. Overview

RDeploy is a web-based internal deployment platform where teams can:

- Submit pre-standardized GitHub repositories
- Define environment variables via UI
- Deploy projects to a VPS using Docker (or Coolify as an alternative target)
- Access a live URL for each deployed project
- Scale projects with multiple replicas behind Traefik load balancing
- Set custom domains, resource limits, and auto-deploy via GitHub webhooks

**Platform URL:** `rdeploy.deltaxs.co`
**Project URLs:** `{project-slug}-{team-slug}.deltaxs.co`
**DNS:** Single wildcard `*.deltaxs.co` pointing to VPS IP

### Important: Project Standardization is External

RDeploy does NOT standardize projects. Before submitting a repo to RDeploy, dev teams must use the **Standardize Prompt** (`Documents/STANDARDIZE.md`) with an AI assistant to:
- Create a production-ready `Dockerfile`
- Create a `.env.example` with all required variables
- Add a `GET /health` endpoint returning HTTP 200
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
| Global State     | Zustand with localStorage persistence (auth token + current user) |
| Backend          | Express + TypeScript                                              |
| ORM              | Prisma                                                            |
| Database         | PostgreSQL 16                                                     |
| Auth             | Email/password + JWT (7 day expiry, no refresh tokens)            |
| GitHub           | Optional OAuth connect per user (for private repos)               |
| Deployment       | Docker CLI (managed from backend) or Coolify API                  |
| Reverse Proxy    | Traefik v3.0 (auto-discovers containers via Docker socket + labels, Let's Encrypt TLS) |
| Real-time Logs   | SSE (Server-Sent Events) during active deploy/clone operations    |
| Email            | nodemailer over SMTP (optional; gracefully disabled if unconfigured) |
| UI Theme         | Dark mode                                                         |

---

## 3. Architecture

### Single Server Deployment

```
VPS (single server)
│
├── Traefik v3.0 (reverse proxy, Let's Encrypt TLS)
│   ├── rdeploy.deltaxs.co         → RDeploy platform (frontend + /api)
│   ├── myapp-backend.deltaxs.co   → deployed project container
│   └── api.mycompany.com          → deployed project with custom domain
│
├── RDeploy Platform
│   ├── frontend (Next.js, port 3000)
│   └── backend (Express, port 5000)
│
├── PostgreSQL 16
│
└── User Project Containers (one or more per deployed project)
    └── rdeploy-{project}-{team}-{i}   (replica index suffix)
```

### Storage Layout

```
/var/rdeploy/workspaces/
├── {team-slug}/
│   └── {project-slug}/
│       ├── repo/          # Cloned GitHub repo
│       └── .env           # Written at deploy time per-replica, deleted immediately after container starts
```

Development uses `.rdeploy/workspaces/` (gitignored) instead of `/var/rdeploy/workspaces/`.

Workspace path is configurable via `RDEPLOY_WORKSPACE_DIR` env variable.

---

## 4. Data Model

### Enums

| Enum | Values |
|------|--------|
| `PlatformRole` | `owner`, `admin`, `user` |
| `TeamRole` | `leader`, `elder`, `member` |
| `ProjectStatus` | `pending`, `cloning`, `ready`, `building`, `running`, `failed`, `stopped` |
| `HealthStatus` | `healthy`, `unhealthy`, `unknown` |

### User

| Field               | Type     | Notes                                           |
|---------------------|----------|-------------------------------------------------|
| id                  | UUID     | Primary key                                     |
| email               | String   | Unique                                          |
| password            | String   | bcrypt hashed (12 rounds), never returned       |
| name                | String   |                                                 |
| avatarUrl           | String?  | Nullable                                        |
| platformRole        | Enum     | owner / admin / user. Default: user             |
| mustChangePassword  | Boolean  | Default true. Force change on first login       |
| githubId            | String?  | Nullable, unique. GitHub OAuth user ID          |
| githubUsername      | String?  | Nullable. GitHub login name                     |
| githubAccessToken   | String?  | Nullable, **AES-256-GCM encrypted**             |
| emailNotifications  | Boolean  | Default true. Receive deploy success/fail emails|
| createdAt           | DateTime |                                                 |
| updatedAt           | DateTime | Auto-updated                                    |

### Team

| Field     | Type     | Notes              |
|-----------|----------|--------------------|
| id        | UUID     | Primary key        |
| name      | String   |                    |
| slug      | String   | Globally unique    |
| createdAt | DateTime |                    |
| updatedAt | DateTime | Auto-updated       |

### TeamMember

| Field    | Type     | Notes                                             |
|----------|----------|---------------------------------------------------|
| id       | UUID     | Primary key                                       |
| userId   | UUID     | FK → User (CASCADE delete)                        |
| teamId   | UUID     | FK → Team (CASCADE delete)                        |
| role     | Enum     | leader / elder / member                           |
| joinedAt | DateTime |                                                   |

Unique constraint: `(userId, teamId)` — one membership per user per team.

### Project

| Field          | Type     | Notes                                                                  |
|----------------|----------|------------------------------------------------------------------------|
| id             | UUID     | Primary key                                                            |
| teamId         | UUID     | FK → Team (CASCADE delete)                                             |
| name           | String   |                                                                        |
| slug           | String   | Unique per team. Auto-generated, read-only after creation              |
| repoUrl        | String   | GitHub repo URL (must be https://github.com/...)                       |
| dockerfilePath | String   | Default: `"Dockerfile"`. Subdirectory path for monorepos               |
| status         | Enum     | pending / cloning / ready / building / running / failed / stopped      |
| healthStatus   | Enum     | healthy / unhealthy / unknown. Default: unknown                        |
| port           | Int?     | First replica's port (backward compat). Auto-assigned from port range  |
| containerId    | String?  | First replica's container ID (backward compat)                         |
| restartCount   | Int      | Default 0                                                              |
| exitCode       | Int?     | Last container exit code. Null if still running                        |
| deployLogs     | String?  | Last deploy output (build + run). Stored as text, capped at ~50KB      |
| webhookSecret  | String?  | HMAC-SHA256 secret for GitHub webhook auto-deploy                      |
| cpuLimit       | String?  | Docker `--cpus` value (e.g. `"0.5"`, `"1"`, `"2.0"`). Applied on next deploy |
| memoryLimit    | String?  | Docker `--memory` value (e.g. `"256m"`, `"1g"`). Applied on next deploy       |
| replicaCount   | Int      | Default 1. Range 1–5. Number of containers to run in parallel          |
| customDomain   | String?  | User-owned hostname (e.g. `"api.mycompany.com"`). Null = use default   |
| deployTarget   | String   | Default `"docker"`. Also supports `"coolify"`                          |
| coolifyAppId   | String?  | Coolify application UUID when deployTarget = "coolify"                 |
| createdAt      | DateTime |                                                                        |
| updatedAt      | DateTime | Auto-updated                                                           |

Unique constraint: `(teamId, slug)` — project slugs are unique per team.

### ProjectReplica

| Field        | Type     | Notes                                        |
|--------------|----------|----------------------------------------------|
| id           | UUID     | Primary key                                  |
| projectId    | UUID     | FK → Project (CASCADE delete)                |
| replicaIndex | Int      | 0-based index. 0 = first replica             |
| containerId  | String?  | Docker container ID for this replica         |
| port         | Int?     | Port for this replica                        |
| status       | String   | `"running"`, `"stopped"`, or `"failed"`. Default: `"stopped"` |
| createdAt    | DateTime |                                              |
| updatedAt    | DateTime | Auto-updated                                 |

Unique constraint: `(projectId, replicaIndex)`.

### ProjectAssignment

| Field      | Type     | Notes                             |
|------------|----------|-----------------------------------|
| id         | UUID     | Primary key                       |
| projectId  | UUID     | FK → Project (CASCADE delete)     |
| userId     | UUID     | FK → User (CASCADE delete)        |
| assignedAt | DateTime |                                   |

Unique constraint: `(projectId, userId)`.

### EnvVar

| Field     | Type     | Notes                                                |
|-----------|----------|------------------------------------------------------|
| id        | UUID     | Primary key                                          |
| projectId | UUID     | FK → Project (CASCADE delete)                        |
| key       | String   |                                                      |
| value     | String   | **AES-256-GCM encrypted**. Empty string if not set   |
| isSecret  | Boolean  | Default false. Controls display masking              |
| updatedAt | DateTime |                                                      |

Unique constraint: `(projectId, key)` — one value per key per project.

**isSecret behavior:**
- `isSecret: true` → value displays as `••••••` in the env vars list — never shown in plaintext after saving
- `isSecret: false` → value is visible in the list
- All values (secret or not) are always **editable**
- Users can **upload a `.env` file** to bulk-fill values — unmatched keys are ignored
- Values are always **encrypted in the DB** regardless of `isSecret`

### DeploymentHistory

| Field        | Type     | Notes                                                     |
|--------------|----------|-----------------------------------------------------------|
| id           | UUID     | Primary key                                               |
| projectId    | UUID     | FK → Project (CASCADE delete)                             |
| imageTag     | String   | Versioned Docker image tag (e.g. `rdeploy-myapp-myteam:3`) |
| deployLogs   | String?  | Logs from this specific deployment                        |
| deployedAt   | DateTime | Default: now()                                            |
| deployedBy   | UUID     | FK → User (SET DEFAULT on user delete)                    |
| isActive     | Boolean  | Default false. True for the currently running deployment  |
| deployNumber | Int      | Sequential deployment number per project (starts at 1)   |

Unique constraint: `(projectId, deployNumber)`.
History is capped at 5 records per project; oldest images are pruned via `docker rmi`.

### PlatformConfig

| Field            | Type     | Notes                                         |
|------------------|----------|-----------------------------------------------|
| id               | String   | Always `"singleton"` (one record per platform)|
| coolifyUrl       | String?  | Coolify instance URL                          |
| coolifyApiToken  | String?  | **AES-256-GCM encrypted** Coolify API token   |
| updatedAt        | DateTime | Auto-updated                                  |

Singleton pattern: only one record ever exists. Used to store platform-level Coolify configuration.

### Entity Relationships

```
User (1) ──< TeamMember >── (1) Team
User (1) ──< ProjectAssignment >── (1) Project
User (1) ──< DeploymentHistory >── (1) Project

Team (1) ──────────────────────────< Project
Project (1) ──────────────────────< EnvVar
Project (1) ──────────────────────< ProjectReplica
Project (1) ──────────────────────< DeploymentHistory

PlatformConfig  (singleton, no relations)
```

---

## 5. Roles & Permissions

### Platform Roles (on User)

| Role  | Description                                                   |
|-------|---------------------------------------------------------------|
| owner | Platform owner. Full access. Cannot be deleted by admins      |
| admin | Platform administrator. Full access. Cannot manage owners     |
| user  | Regular user. Team-scoped access                              |

### Team Roles (on TeamMember)

| Role    | Description                                                    |
|---------|----------------------------------------------------------------|
| leader  | Full project management. A team can have zero leaders          |
| elder   | Senior member. Can edit env vars                               |
| member  | Read-only. Can view projects, logs, members                    |

**Leader removal rules:**
- A team can have zero leaders — there is no forced minimum
- If a leader is removed or their user account is deleted, all their TeamMember records are removed; the team simply has no leader
- Owner/Admin can always perform leader-level actions regardless
- UI shows a warning banner on teams with no leader

### Permission Matrix

| Action                        | Owner | Admin | Leader | Elder | Member |
|-------------------------------|-------|-------|--------|-------|--------|
| Create / delete team          | ✅    | ✅    | ❌     | ❌    | ❌     |
| Add / remove team members     | ✅    | ✅    | ❌     | ❌    | ❌     |
| Add project to team           | ✅    | ✅    | ✅     | ❌    | ❌     |
| Assign members to project     | ✅    | ✅    | ✅     | ❌    | ❌     |
| Deploy / Stop / Delete        | ✅    | ✅    | ✅     | ❌    | ❌     |
| Clone repo                    | ✅    | ✅    | ✅     | ❌    | ❌     |
| Edit env vars                 | ✅    | ✅    | ✅     | ✅    | ❌     |
| Rollback deploy               | ✅    | ✅    | ✅     | ❌    | ❌     |
| Setup/delete webhook          | ✅    | ✅    | ✅     | ❌    | ❌     |
| Set custom domain             | ✅    | ✅    | ✅     | ❌    | ❌     |
| Set replicas                  | ✅    | ✅    | ✅     | ❌    | ❌     |
| Set resource limits           | ✅    | ✅    | ✅     | ✅    | ❌     |
| Change deploy target          | ✅    | ✅    | ✅     | ❌    | ❌     |
| Transfer project              | ✅    | ✅    | ❌     | ❌    | ❌     |
| View any project              | ✅    | ✅    | ✅     | ✅    | ✅     |
| View logs                     | ✅    | ✅    | ✅     | ✅    | ✅     |
| View team member list         | ✅    | ✅    | ✅     | ✅    | ✅     |
| Create users                  | ✅    | ✅    | ❌     | ❌    | ❌     |
| Promote users to admin        | ✅    | ✅    | ❌     | ❌    | ❌     |
| Configure Coolify             | ✅    | ✅    | ❌     | ❌    | ❌     |

---

## 6. Authentication

### Flow

1. No public registration — Owner/Admin creates users with email + default password (`DEFAULT_USER_PASSWORD` env var)
2. New user gets `mustChangePassword: true` — first login forces redirect to `/change-password` (frontend-enforced only, no API guard)
3. After password change, `mustChangePassword` set to `false`, normal access
4. JWT token (7 day expiry, no refresh tokens) used for all API requests via `Authorization: Bearer <token>` header

### JWT Token

**Payload:**
```json
{ "id": "uuid", "email": "user@example.com", "platformRole": "user" }
```

**Algorithm:** HS256 (HMAC-SHA256)
**Expiry:** 7 days
**Signing secret:** `JWT_SECRET` env var

### mustChangePassword Enforcement

- Flag is stored in DB and returned in login response
- **No API-level middleware** blocks requests while flag is true
- **Frontend-enforced only:** `DashboardGuard` component redirects to `/change-password` if flag is true

### Logout

Client-side only: clear JWT token and user from Zustand store, redirect to login. No server-side invalidation.

### Slug Generation

Slugs are **auto-generated** from names on creation using `slugify()`:
- `"My Team"` → `"my-team"`
- Collision: append incrementing suffix: `my-team-2`, `my-team-3`
- Slugs are read-only after creation

### GitHub Connect (optional)

- Users can link GitHub account from profile page
- Enables cloning private repos using their GitHub token
- Not required to use the platform
- If private repo is submitted without GitHub connected → helpful error shown
- OAuth state token is a short-lived JWT (10 minute expiry) containing `userId` + random nonce (CSRF protection)
- GitHub access token stored encrypted (AES-256-GCM) in `User.githubAccessToken`
- Scope requested: `"repo"` (repository access)

---

## 7. API Endpoints

### Auth (`/api/auth`)

| Method | Path                   | Auth | Authorization           | Purpose                              |
|--------|------------------------|------|-------------------------|--------------------------------------|
| POST   | `/login`               | No   | —                       | Login. Body: `{email, password}`. Returns `{token, user}` |
| GET    | `/me`                  | Yes  | Any user                | Current user profile                 |
| POST   | `/change-password`     | Yes  | Any user                | Body: `{currentPassword, newPassword (min 8)}`. Sets mustChangePassword=false |
| PUT    | `/notifications`       | Yes  | Any user                | Body: `{emailNotifications: boolean}`. Update email notification preference |
| GET    | `/github`              | Yes  | Any user                | Get GitHub OAuth authorization URL   |
| GET    | `/github/callback`     | No   | HMAC state token        | Complete GitHub OAuth link. Query: `{code, state}`. Redirects to `/profile?github=connected` |
| DELETE | `/github`              | Yes  | Any user                | Disconnect GitHub account            |

### Admin (`/api/admin`)

All require `requireAuth` + `requirePlatformRole("owner", "admin")`.

| Method | Path          | Purpose                                     | Request Body                                                 |
|--------|---------------|---------------------------------------------|--------------------------------------------------------------|
| POST   | `/users`      | Create user (201)                           | `{email, name, platformRole?}`. New user gets DEFAULT_USER_PASSWORD, mustChangePassword=true |
| GET    | `/users`      | List all users                              | —                                                            |
| PUT    | `/users/:id`  | Update user platform role                   | `{platformRole: "owner"\|"admin"\|"user"}`                   |
| DELETE | `/users/:id`  | Delete user                                 | —                                                            |
| GET    | `/coolify`    | Get Coolify config                          | Returns `{coolifyUrl, tokenIsSet}` — token never returned    |
| PUT    | `/coolify`    | Set Coolify URL + API token                 | `{coolifyUrl, coolifyApiToken}`                              |

### Teams (`/api/teams`)

| Method | Path                          | Auth | Authorization                          | Purpose                |
|--------|-------------------------------|------|----------------------------------------|------------------------|
| POST   | `/`                           | Yes  | Owner/Admin                            | Create team (201). Body: `{name}` |
| GET    | `/`                           | Yes  | Any user (filtered by membership)      | List teams             |
| GET    | `/:id`                        | Yes  | Any (non-admin must be member)         | Team detail + members  |
| DELETE | `/:id`                        | Yes  | Owner/Admin                            | Delete team            |
| POST   | `/:id/members`                | Yes  | `requireTeamRole("leader")`            | Add member (201). Body: `{userId, role}` |
| DELETE | `/:id/members/:userId`        | Yes  | `requireTeamRole("leader")`            | Remove member          |

### Projects (`/api`)

**Project creation & listing:**

| Method | Path                          | Auth | Authorization              | Purpose                |
|--------|-------------------------------|------|----------------------------|------------------------|
| POST   | `/teams/:teamId/projects`     | Yes  | `requireTeamRole("leader")`| Create project (201). Body: `{name (1-100), repoUrl (https://github.com/...), dockerfilePath?}` |
| GET    | `/teams/:teamId/projects`     | Yes  | `requireTeamRole("member")`| List team projects     |
| GET    | `/projects`                   | Yes  | Any user (filtered)        | List all visible projects |
| GET    | `/projects/:id`               | Yes  | Team member                | Project detail (includes replicas) |
| DELETE | `/projects/:id`               | Yes  | Leader (or owner/admin)    | Hard delete project    |

**Members:**

| Method | Path                              | Auth | Authorization      | Purpose                          |
|--------|-----------------------------------|------|--------------------|----------------------------------|
| POST   | `/projects/:id/members`           | Yes  | Leader             | Assign members. Body: `{userIds: UUID[]}` |
| DELETE | `/projects/:id/members/:userId`   | Yes  | Leader             | Remove member from project       |
| GET    | `/projects/:id/members`           | Yes  | Team member        | List assigned members            |

**Repository & Environment:**

| Method | Path                          | Auth | Authorization      | Purpose                                                    |
|--------|-------------------------------|------|--------------------|------------------------------------------------------------|
| POST   | `/projects/:id/clone`         | Yes  | Leader             | Clone repo, parse .env.example, parse rdeploy.yml. Returns `{project, envKeys, rdeployYml}` |
| GET    | `/projects/:id/env`           | Yes  | Team member        | List env var keys + `hasValue` (never returns actual values) |
| PUT    | `/projects/:id/env`           | Yes  | Leader or Elder    | Save env values. Body: `{vars: [{id, value, isSecret}]}`. Values encrypted before storage |
| POST   | `/projects/:id/env/upload`    | Yes  | Leader or Elder    | Upload `.env` file (max 100KB) to bulk-fill values. Multipart: `file` |

**Deployment:**

| Method | Path                              | Auth | Authorization      | Purpose                                                              |
|--------|-----------------------------------|------|--------------------|----------------------------------------------------------------------|
| POST   | `/projects/:id/deploy`            | Yes  | Leader             | Build & deploy. Body: `{confirmed?: boolean}`. May return `{warning: true, localhostKeys}` |
| POST   | `/projects/:id/redeploy`          | Yes  | Leader             | Stop + rebuild + restart. Body: `{confirmed?: boolean}`              |
| POST   | `/projects/:id/stop`              | Yes  | Leader             | Stop all containers. Status → stopped                                |
| GET    | `/projects/:id/deploys`           | Yes  | Team member        | Deployment history list                                              |
| POST   | `/projects/:id/rollback/:deployId`| Yes  | Leader             | Rollback to previous deployment image                                |

**Configuration:**

| Method | Path                              | Auth | Authorization      | Purpose                                                    |
|--------|-----------------------------------|------|--------------------|------------------------------------------------------------|
| PUT    | `/projects/:id/resource-limits`   | Yes  | Leader or Elder    | Body: `{cpuLimit?: string\|null, memoryLimit?: string\|null}`. Applied on next deploy |
| PUT    | `/projects/:id/replicas`          | Yes  | Leader             | Body: `{replicaCount: 1-5}`. Applied on next deploy        |
| PUT    | `/projects/:id/custom-domain`     | Yes  | Leader             | Body: `{customDomain: string\|null}`. If running, restarts containers immediately |
| POST   | `/projects/:id/transfer`          | Yes  | Owner/Admin only   | Body: `{targetTeamId: UUID}`. Move project to another team |
| PUT    | `/projects/:id/deploy-target`     | Yes  | Leader             | Body: `{deployTarget: "docker"\|"coolify"}`                |

**Webhooks:**

| Method | Path                              | Auth | Authorization      | Purpose                                           |
|--------|-----------------------------------|------|--------------------|---------------------------------------------------|
| POST   | `/projects/:id/webhook/setup`     | Yes  | Leader             | Generate HMAC secret + return webhook URL         |
| GET    | `/projects/:id/webhook`           | Yes  | Team member        | Get webhook URL + `{hasSecret: boolean}`          |
| DELETE | `/projects/:id/webhook`           | Yes  | Leader             | Disable webhook (clear secret)                    |

**Observability:**

| Method | Path                              | Auth | Authorization      | Purpose                                           |
|--------|-----------------------------------|------|--------------------|---------------------------------------------------|
| GET    | `/projects/:id/logs`              | Yes  | Team member        | Get persisted deploy logs (`Project.deployLogs`)  |
| GET    | `/projects/:id/logs/stream`       | Yes  | Team member        | SSE stream. Query: `?type=deploy\|app`            |
| GET    | `/projects/:id/container-status`  | Yes  | Team member        | Live docker inspect: `{running, exitCode, restartCount, startedAt}` |
| GET    | `/projects/:id/rdeploy-yml`       | Yes  | Team member        | Parsed rdeploy.yml content                        |

### Webhooks (`/api/webhooks`)

| Method | Path                    | Auth              | Purpose                                              |
|--------|-------------------------|-------------------|------------------------------------------------------|
| POST   | `/github/:projectId`    | HMAC-SHA256 only  | GitHub push event receiver. Triggers background redeploy |

- No JWT authentication — HMAC-SHA256 signature verified via `x-hub-signature-256` header using `crypto.timingSafeEqual()`
- Returns 200 immediately; deploy runs in background
- Resolves system user (owner > admin > team leader) to attach to deployment history

### Health Check

| Method | Path          | Auth | Purpose                     |
|--------|---------------|------|-----------------------------|
| GET    | `/api/health` | No   | Returns `{status: "ok"}`    |

---

## 8. Frontend Pages

| Page              | Route                       | Access                    |
|-------------------|-----------------------------|---------------------------|
| Login             | `/login`                    | Public                    |
| Change Password   | `/change-password`          | Authenticated             |
| Dashboard         | `/`                         | All users (DashboardGuard)|
| My Teams          | `/teams`                    | All users                 |
| Team Detail       | `/teams/[id]`               | All users (member check)  |
| Add Project       | `/teams/[id]/projects/new`  | Leader+                   |
| Project Detail    | `/projects/[id]`            | All users (member check)  |
| Project Members   | `/projects/[id]/members`    | Leader+                   |
| Admin Panel       | `/admin`                    | Owner/Admin               |
| Profile           | `/profile`                  | Authenticated             |

### DashboardGuard

Wraps all dashboard routes. Redirects:
- No token → `/login`
- `mustChangePassword: true` → `/change-password`

### Project Detail Page — Sections

The most complex page. Sections shown conditionally by status and permissions:

1. **Header** — name, status badge, health badge, connect repo button
2. **Container Status Bar** — uptime, restart count, exit code, port (when running, polls every 30s)
3. **Project Details** — slug, repo URL, Dockerfile path, port
4. **Live URL** — clickable link when `status === "running"`
5. **Environment Variables** — `EnvVarsForm` (hidden when pending)
6. **Logs** — tabbed: Deploy Logs + App Logs (SSE)
7. **Deploy History** — table with rollback capability
8. **Resource Limits** — CPU/memory editor (changes applied on next deploy)
9. **Deploy Target** — Docker / Coolify radio selector
10. **Replicas** — count 1–5 editor (changes applied on next deploy)
11. **Custom Domain** — hostname editor
12. **Auto Deploy (Webhook)** — GitHub webhook setup with instructions
13. **Transfer Project** — danger zone, Owner/Admin only

**Permission flags used on page:**
- `canDeploy` = owner/admin OR team leader
- `canEditEnv` = owner/admin OR team leader OR team elder
- `canManageMembers` = owner/admin OR team leader
- `canClone` = owner/admin OR team leader

---

## 9. Deployment Flow

### Connect Repo (Clone)

Status transitions: `pending/failed` → `cloning` → `ready` (or `failed`)

1. Validate user is team leader (or owner/admin)
2. Validate status is `pending` or `failed` (prevents re-clone of running project)
3. Set status → `cloning`, clear deployLogs
4. Resolve workspace path: `<RDEPLOY_WORKSPACE_DIR>/<teamSlug>/<projectSlug>/repo`
5. Validate URL: must be `https://github.com/...` (HTTPS only, GitHub only)
6. If user has GitHub token: inject into clone URL as `https://<token>@github.com/...`
7. `git clone <url> <workspacePath>` — `spawnSync`, 120s timeout. GitHub token scrubbed from any error messages
8. Validate Dockerfile exists at `dockerfilePath`. If missing → status `failed` + error message
9. Validate `.env.example` exists at repo root. If missing → status `failed` + error message
10. Parse `.env.example`: extract all `KEY=VALUE` lines (skip comments, blank lines). Delete old EnvVar records, create new ones with empty values
11. Parse `rdeploy.yml` if present (using `js-yaml`)
12. Set status → `ready`
13. Return `{project, envKeys, rdeployYml}`

---

### Deploy Flow (Docker target)

Status transitions: `ready/failed/stopped/running` → `building` → `running` (or `failed`)

**Pre-deploy validation:**
- Guard: status must not be `building` or `cloning` → 409 if true
- Guard: all env var values must be non-empty → 400 + `{missingKeys: [...]}`
- Warning: if any value contains `localhost`, `127.0.0.1`, or `0.0.0.0` and `confirmed !== true` → return `{warning: true, localhostKeys: [...]}` (user must re-submit with `confirmed: true`)
- Permission: leader required (unless webhook trigger)

**Deploy steps:**
1. Load and decrypt all env vars from DB
2. Stop and remove all existing replica containers
3. Set status → `building`, clear deployLogs
4. Validate Dockerfile path (no path traversal)
5. `docker build -t rdeploy-{projectSlug}-{teamSlug} -f {dockerfilePath} {repoDir}` — stdout/stderr streamed via SSE
6. For each replica index `i` from `0` to `replicaCount - 1`:
   a. Call `getAvailablePort()` — query DB for used ports, return lowest unused in `PORT_RANGE_START`–`PORT_RANGE_END`
   b. Write `.env` file: `PORT={replicaPort}\nKEY1=VAL1\n...`
   c. `docker run -d --name rdeploy-{projectSlug}-{teamSlug}-{i} --network <DOCKER_NETWORK> --env-file <envFilePath> -p {port}:{port} [--cpus=<cpuLimit>] [--memory=<memoryLimit>] --label traefik.enable=true --label traefik.http.routers.rdeploy-{projectSlug}-{teamSlug}.rule=Host(\`{projectSlug}-{teamSlug}.{RDEPLOY_DOMAIN}\`) --label traefik.http.services.rdeploy-{projectSlug}-{teamSlug}.loadbalancer.server.port={port} [custom domain labels if set] rdeploy-{projectSlug}-{teamSlug}`
   d. Upsert `ProjectReplica` record with `containerId`, `port`, `status: "running"`
   e. Delete `.env` file immediately (security — plaintext secrets must not persist)
7. Remove stale replicas (if `replicaCount` was reduced): stop+remove containers, delete DB records
8. Tag image: `docker tag <tag> <tag>:{deployNumber}` and `<tag>:latest`
9. Create `DeploymentHistory` record (mark previous as inactive)
10. Prune history: keep max 5 records, `docker rmi` old image tags
11. Update project: status → `running`, store first replica's containerId/port in Project
12. After 15 seconds (background): `GET http://localhost:{firstReplicaPort}/health` → update `healthStatus` to `healthy` or `unhealthy`
13. Send success emails to project members + team leaders/elders with `emailNotifications: true`

**Error handling:**
- Delete `.env` file in `finally` block
- Set status → `failed`, save logs
- Send failure emails (fire-and-forget)

---

### Deploy Flow (Coolify target)

1. Load and decrypt all env vars from DB
2. Set status → `building`, clear logs
3. If no `coolifyAppId`: Create Coolify app via `POST /api/v1/applications` with name, repoUrl, dockerfilePath
4. Store returned UUID as `project.coolifyAppId`
5. Set env vars: `POST /api/v1/applications/{appId}/envs`
6. Trigger start: `POST /api/v1/applications/{appId}/start`
7. Set status → `running`, logs → `"Deployed via Coolify."`

---

### Stop Flow

1. Stop and remove all `ProjectReplica` containers
2. Stop and remove legacy `project.containerId` container (if set)
3. Update all ProjectReplica statuses → `"stopped"`
4. Update project: status → `stopped`, healthStatus → `unknown`

---

### Delete Flow

1. Validate leader permission
2. Stop + remove all replica containers: `docker stop` + `docker rm` (errors ignored)
3. Stop + remove legacy container (if set)
4. `docker rmi rdeploy-{projectSlug}-{teamSlug}` (errors ignored)
5. Delete workspace: `fs.rmSync(<workspace>/teamSlug/projectSlug, {recursive: true, force: true})` — path traversal validated
6. `prisma.project.delete(...)` → cascades to EnvVar, ProjectReplica, ProjectAssignment, DeploymentHistory

---

### Rollback Flow

1. Validate leader permission
2. Load DeploymentHistory record for `deployId`
3. Stop current containers
4. Run new containers using the stored `imageTag` (versioned tag)
5. Update `isActive` flags: old → false, this one → true
6. Update project status → `running`

---

## 10. Pre-Deploy Validation Rules

| Check | Behavior |
|-------|----------|
| Any env var value is empty | Block deploy — return 400 + `{missingKeys: [...]}` |
| Value contains `localhost`, `127.0.0.1`, or `0.0.0.0` | Return `{warning: true, localhostKeys}` — re-submit with `confirmed: true` |
| Status is `building` or `cloning` | Return 409 "Deploy already in progress" |

---

## 11. Health Check Behavior

- Health checks make `HTTP GET http://localhost:{port}/health` (plain HTTP, no custom headers, 5s timeout)
- Target: `localhost` on the VPS (the container port is published to the host)
- Initial check: fires 15 seconds after deploy completes (background, non-blocking)
- Periodic poll: every 60 seconds for all `status: "running"` projects
- `healthStatus` values: `healthy` / `unhealthy` / `unknown` (unknown = not yet checked or container stopped)
- A project can be `status: running` with `healthStatus: unhealthy` — container is up but app is broken
- Health check failures do NOT automatically stop or redeploy the container

---

## 12. Project Validation Rules

When a repo is cloned, RDeploy checks:

| Check | Required | Error if missing |
|-------|----------|-----------------|
| Dockerfile at `dockerfilePath` | YES | "Dockerfile missing at {path}. Use the Master Prompt to standardize your project first." |
| `.env.example` at repo root | YES | ".env.example missing. Use the Master Prompt to standardize your project first." |

RDeploy does NOT generate or modify any files in the repo.

---

## 13. Multi-Service / Monorepo Projects

If a GitHub repo contains multiple services (e.g. backend + frontend), each service is submitted as a **separate project** in RDeploy, all pointing to the same repo URL but with different `dockerfilePath` values.

Example — repo `github.com/org/my-app`:

| Project name      | dockerfilePath       | URL                                          |
|-------------------|----------------------|----------------------------------------------|
| `my-app-backend`  | `backend/Dockerfile` | `my-app-backend-my-team.deltaxs.co`          |
| `my-app-frontend` | `frontend/Dockerfile`| `my-app-frontend-my-team.deltaxs.co`         |

The repo must contain a root-level `rdeploy.yml` that documents all deployable services. RDeploy **parses** this file (using `js-yaml`) and returns the service list after cloning, which is displayed in the `MonorepoSuggestions` component with pre-filled "Create Project" links.

**`rdeploy.yml` format:**
```yaml
services:
  backend:
    dockerfile: backend/Dockerfile
    description: Express API
  frontend:
    dockerfile: frontend/Dockerfile
    description: Next.js frontend
```

If file is missing or malformed, `rdeployYml.found` is `false` and no suggestions are shown.

---

## 14. Multi-Replica Support

Projects can run 1–5 identical container replicas. All replicas share the same Traefik router name, so Traefik automatically load-balances requests across them.

**Key behaviors:**
- `replicaCount` defaults to 1; set via `PUT /projects/:id/replicas`
- Changes to `replicaCount` apply on the **next deploy/redeploy**
- Each replica gets a unique port from the pool and a unique container name: `rdeploy-{project}-{team}-{i}`
- All replicas are tracked in `ProjectReplica` table (0-based index)
- `Project.containerId` and `Project.port` always reflect replica index 0 (backward compat)
- Reducing replica count: stale replicas are stopped/removed during the next deploy
- Health check is performed against replica 0's port

---

## 15. Deploy History & Rollback

- Every successful deploy creates a `DeploymentHistory` record with a versioned image tag (e.g. `rdeploy-myapp-myteam:3`)
- Max 5 history records kept per project; older records are deleted and their Docker images pruned via `docker rmi`
- `isActive: true` marks the currently running deployment
- Rollback: `POST /projects/:id/rollback/:deployId` stops current containers and runs the stored image tag
- History accessible via `GET /projects/:id/deploys`

---

## 16. GitHub Webhooks (Auto-Deploy)

Setup:
1. `POST /projects/:id/webhook/setup` — generates a random 32-byte hex `webhookSecret`, stores on project, returns webhook URL
2. User configures webhook in GitHub repo settings: payload URL, `application/json`, secret, "Push event" only

Trigger flow:
1. GitHub sends `POST /api/webhooks/github/:projectId` with `x-hub-signature-256` header
2. Backend verifies HMAC-SHA256 signature using `crypto.timingSafeEqual()` (timing-safe)
3. Returns 200 immediately; triggers background redeploy with `confirmed: true` (skips localhost warning)
4. Resolves system user (owner → admin → team leader) for `deployedBy` in history
5. Webhook deploys bypass permission checks

---

## 17. Custom Domains

- Set via `PUT /projects/:id/custom-domain` with a valid hostname (no protocol, no path, e.g. `api.mycompany.com`)
- When a custom domain is set, running containers are **restarted immediately** with updated Traefik labels
- Two Traefik routers per container: one for `{project}-{team}.deltaxs.co`, one for the custom domain (with TLS)
- Traefik handles TLS certificate issuance via Let's Encrypt automatically
- User must point their domain's A record to the VPS IP

---

## 18. Resource Limits

- CPU limit: Docker `--cpus` value (e.g. `"0.5"`, `"1"`, `"2.0"`)
- Memory limit: Docker `--memory` value (e.g. `"256m"`, `"512m"`, `"1g"`)
- Both nullable (null = no limit)
- Set via `PUT /projects/:id/resource-limits`
- **Applied on next deploy/redeploy** (not immediately to running containers)

---

## 19. Coolify Integration

Coolify is an alternative deployment target (instead of local Docker).

**Configuration (platform-wide):**
- Set once via admin panel: `PUT /api/admin/coolify` with Coolify instance URL + API token
- Token stored encrypted in `PlatformConfig.coolifyApiToken`
- Viewed via `GET /api/admin/coolify` (returns `{coolifyUrl, tokenIsSet}` — token never exposed)

**Per-project:**
- Change deploy target: `PUT /projects/:id/deploy-target` with `{deployTarget: "coolify"}`
- Requires Coolify to be configured platform-wide first (returns 400 if not)

**Coolify deploy flow:**
1. If no `coolifyAppId`: creates app via Coolify API with project slug, repo URL, dockerfile path
2. Sets env vars on the Coolify app
3. Triggers start/deploy

**Stop:** `POST /api/v1/applications/{appId}/stop`

---

## 20. Observability

### Status Badge

| Status   | Color  |
|----------|--------|
| running  | green  |
| building | yellow |
| cloning  | yellow |
| failed   | red    |
| stopped  | gray   |
| ready    | blue   |
| pending  | gray   |

### Health Badge (shown only when `status === "running"`)

| Value     | Display         | Color |
|-----------|-----------------|-------|
| healthy   | ● Healthy       | green |
| unhealthy | ● Unhealthy     | red   |
| unknown   | ● Unknown       | gray  |

### Container Status Bar

Polls `GET /projects/:id/container-status` (live docker inspect) every 30 seconds when running:
- **Uptime** — calculated from `State.StartedAt`
- **Restart count** — amber warning if > 0
- **Exit code** — shown only if container stopped
- **Port**

### Logs Viewer — Two Tabs

**Deploy Logs tab:**
- During `cloning` or `building`: connects via SSE (`EventSource` equivalent using native `fetch` with auth header) to `GET /projects/:id/logs/stream`, displays line-by-line with auto-scroll, shows "Live" badge
- When inactive: displays `Project.deployLogs` (persisted, always available)

**App Logs tab:**
- Only active when `status === "running"`
- Connects to `GET /projects/:id/logs/stream?type=app` — streams `docker logs --tail=100 --follow`
- Closes SSE on unmount or when status changes from `running`

### SSE Implementation

The frontend `useSSELogs` hook uses native `fetch` (not `EventSource`) to send the `Authorization: Bearer <token>` header, which `EventSource` does not support. The stream sends `data:` lines and ends with `data:[DONE]`.

### Container Status Polling

| Hook | Interval | Enabled When |
|------|----------|--------------|
| `useProject` | 2000ms | `status === "building" \| "cloning"` |
| `useContainerStatus` | 30000ms | enabled prop = true |

### Diagnosing Common Problems

| Symptom | Check |
|---------|-------|
| Status: failed immediately | Deploy Logs tab — build error |
| Status: running, Health: unhealthy | App Logs tab — app crash/exception |
| Restart count > 0 | App Logs tab — app keeps crashing |
| Exit code 137 | OOM killed — reduce memory or set memoryLimit |
| Exit code 1 | App error — check App Logs |
| 502 from Traefik | App not listening on PORT — check App Logs |

---

## 21. Email Notifications

- Deploy success + failure emails sent to: all project assignments + team leaders/elders with `emailNotifications: true`
- Success email: project name, team name, live URL
- Failure email: project name, team name, last 20 non-empty lines of deploy logs
- Sent via nodemailer over SMTP (fire-and-forget; errors logged but not propagated)
- **SMTP is optional** — if `SMTP_HOST` is not set, emails are silently skipped
- Users can toggle `emailNotifications` via the profile page

---

## 22. Security Rules

- Passwords stored as bcrypt hashes (12 rounds)
- Env var values encrypted in database using AES-256-GCM
- Each encrypted value uses a unique random 12-byte IV — same value stored twice produces different ciphertext
- Encryption format: `{iv_hex}:{authTag_hex}:{ciphertext_hex}` (colon-separated hex)
- Encryption key sourced from `ENCRYPTION_KEY` env var (must be exactly 64 hex chars = 32 bytes)
- GitHub access tokens encrypted in database (same AES-256-GCM)
- Coolify API token encrypted in database (same AES-256-GCM)
- `.env` files written to workspace at deploy time, **deleted in `finally` block immediately after container starts** — plaintext secrets must not persist on disk
- JWT tokens expire after 7 days — no refresh tokens
- GitHub OAuth state token is a short-lived JWT (10 min) with random nonce (CSRF protection)
- Webhook signatures use `crypto.timingSafeEqual()` (timing attack prevention)
- All Docker commands use `spawnSync`/`spawn` (not `exec`/`execSync`) to prevent shell injection
- Repo URLs validated: must be `https://github.com/...`
- All workspace paths validated against base directory (path traversal prevention)
- `ALLOWED_ORIGINS` env var controls CORS (restrictive)
- Required env vars (`JWT_SECRET`, `ENCRYPTION_KEY`) validated at startup — process exits if missing

---

## 23. Seed Data

On first run, the platform creates:

| Field              | Value                                  |
|--------------------|----------------------------------------|
| email              | arvin@thesx.co                         |
| name               | Arvin                                  |
| platformRole       | owner                                  |
| mustChangePassword | false                                  |
| password           | Set via env var `SEED_OWNER_PASSWORD`  |

---

## 24. Environment Variables (Platform Config)

### Required

| Variable              | Service          | Purpose                                                              |
|-----------------------|------------------|----------------------------------------------------------------------|
| `DATABASE_URL`        | Backend          | PostgreSQL connection string. Format: `postgresql://rdeploy:<pw>@postgres:5432/rdeploy` |
| `POSTGRES_PASSWORD`   | Docker Compose   | PostgreSQL container password                                        |
| `JWT_SECRET`          | Backend          | JWT signing secret (HS256). Process exits if missing                 |
| `ENCRYPTION_KEY`      | Backend          | AES-256-GCM key. Must be exactly 64 hex characters (32 bytes). Process exits if missing |
| `RDEPLOY_DOMAIN`      | Backend          | Base domain. Default: `deltaxs.co`                                   |
| `RDEPLOY_PLATFORM_SUBDOMAIN` | Docker Compose | Platform subdomain. Default: `rdeploy`                        |
| `RDEPLOY_PLATFORM_URL`| Backend          | Full platform URL (e.g. `https://rdeploy.deltaxs.co`)                |
| `RDEPLOY_WORKSPACE_DIR` | Backend        | Base directory for workspaces. Default: `.rdeploy/workspaces`        |
| `DOCKER_NETWORK`      | Backend          | Shared Docker network name. Default: `rdeploy-net`                   |
| `SEED_OWNER_PASSWORD` | Backend          | Initial password for the seeded owner account                        |
| `DEFAULT_USER_PASSWORD` | Backend        | Default password for admin-created users (must change on first login)|
| `ACME_EMAIL`          | Traefik          | Email for Let's Encrypt certificate notifications                    |
| `NEXT_PUBLIC_API_URL` | Frontend         | Backend API base URL. Production: `https://rdeploy.deltaxs.co`. Dev: `http://localhost:5000` |

### Optional

| Variable              | Service          | Default          | Purpose                                              |
|-----------------------|------------------|------------------|------------------------------------------------------|
| `JWT_EXPIRES_IN`      | Backend          | `7d`             | JWT token expiry                                     |
| `GITHUB_CLIENT_ID`    | Backend          | (empty)          | GitHub OAuth app client ID                           |
| `GITHUB_CLIENT_SECRET`| Backend          | (empty)          | GitHub OAuth app secret                              |
| `GITHUB_CALLBACK_URL` | Backend          | Constructed      | GitHub OAuth redirect URI                            |
| `PORT_RANGE_START`    | Backend          | `3001`           | Lowest port for deployed containers                  |
| `PORT_RANGE_END`      | Backend          | `4000`           | Highest port for deployed containers                 |
| `ALLOWED_ORIGINS`     | Backend          | (same-origin)    | CORS allowed origins (comma-separated)               |
| `PORT`                | Backend          | `5000`           | Backend HTTP port                                    |
| `SMTP_HOST`           | Backend          | (empty)          | SMTP server hostname. Empty = disable email          |
| `SMTP_PORT`           | Backend          | `587`            | SMTP port                                            |
| `SMTP_USER`           | Backend          | (empty)          | SMTP auth username                                   |
| `SMTP_PASS`           | Backend          | (empty)          | SMTP auth password                                   |
| `SMTP_FROM`           | Backend          | `RDeploy <noreply@rdeploy.deltaxs.co>` | Sender "From" address          |
| `NEXT_PUBLIC_RDEPLOY_DOMAIN` | Frontend | `deltaxs.co`    | Domain displayed for project URLs in UI              |

---

## 25. Docker Compose (Platform)

**Network:** `rdeploy-net` declared as `external: true`. Must be created manually before starting:
```bash
docker network create rdeploy-net
```

### Services

| Service             | Image/Build                   | Port | Purpose                                                      |
|---------------------|-------------------------------|------|--------------------------------------------------------------|
| `traefik`           | `traefik:v3.0`                | 80, 443 | Reverse proxy. Routes by hostname + path prefix. Let's Encrypt TLS |
| `rdeploy-postgres`  | `postgres:16-alpine`          | 5432 (internal) | Database                                            |
| `rdeploy-backend`   | Build: `./Codebase/Back-End`  | 5000 (internal) | Express API                                         |
| `rdeploy-frontend`  | Build: `./Codebase/Front-End` | 3000 (internal) | Next.js app                                         |

### Traefik Routing

| Request | Router | Target |
|---------|--------|--------|
| `rdeploy.deltaxs.co` + `PathPrefix(/api)` | backend | backend:5000 |
| `rdeploy.deltaxs.co` (all other) | frontend | frontend:3000 |
| `{project}-{team}.deltaxs.co` | auto-discovered | user container:{port} |

**TLS:** Let's Encrypt TLS Challenge. Certificate stored in `letsencrypt` named volume at `/letsencrypt/acme.json`.

### Traefik Labels on User Containers

```
traefik.enable=true
traefik.http.routers.rdeploy-{project}-{team}.rule=Host(`{project}-{team}.deltaxs.co`)
traefik.http.services.rdeploy-{project}-{team}.loadbalancer.server.port={port}
```

Custom domain (additional router):
```
traefik.http.routers.rdeploy-{project}-{team}-custom.rule=Host(`{customDomain}`)
traefik.http.routers.rdeploy-{project}-{team}-custom.entrypoints=websecure
traefik.http.routers.rdeploy-{project}-{team}-custom.tls=true
traefik.http.routers.rdeploy-{project}-{team}-custom.service=rdeploy-{project}-{team}
```

All replicas share the same Traefik router name → Traefik load-balances across them automatically.

### Docker Volumes

| Volume          | Mounted In | Purpose                           |
|-----------------|------------|-----------------------------------|
| `postgres_data` | postgres   | Persistent database files         |
| `letsencrypt`   | traefik    | Let's Encrypt certificates (ACME) |
| `/var/rdeploy/workspaces` (bind) | backend | Repository workspaces |
| `/var/run/docker.sock` (bind) | traefik (read-only), backend | Docker API |

### Port Assignment for User Containers

- Range: `PORT_RANGE_START` to `PORT_RANGE_END` (default 3001–4000, supports ~1000 projects)
- At deploy time: query DB for all used ports → pick lowest unused number in range
- Port stored on `Project.port` (and per-replica in `ProjectReplica.port`)
- Port freed when project is deleted
- If range exhausted → deploy fails with error "No available ports"

---

## 26. Background Health Poller

Runs every 60 seconds on the backend (started in `index.ts`):

For every project with `status === "running"`:
1. `docker inspect {containerId}` → check `State.Running`, `State.ExitCode`, `RestartCount`
2. If container not running → update project status → `failed`
3. If running → `GET http://localhost:{port}/health`
   - 200 → `healthStatus: "healthy"`
   - Failure → `healthStatus: "unhealthy"`
4. For replicas: checks each `ProjectReplica.containerId`, updates replica status
5. If ALL replicas failed → project status → `failed`

---

## 27. Frontend Architecture

### File Structure

```
Codebase/Front-End/src/
├── app/
│   ├── (auth)/                    # No sidebar. Auth layout.
│   │   ├── login/page.tsx
│   │   ├── change-password/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/               # With sidebar. DashboardGuard.
│   │   ├── page.tsx               # /  — Dashboard (all projects grid)
│   │   ├── teams/page.tsx         # /teams
│   │   ├── teams/[id]/page.tsx    # /teams/[id]
│   │   ├── teams/[id]/projects/new/page.tsx
│   │   ├── projects/[id]/page.tsx # /projects/[id]
│   │   ├── projects/[id]/members/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── profile/page.tsx
│   │   └── layout.tsx
│   ├── layout.tsx                 # Root layout (dark mode, Providers, Sonner)
│   └── globals.css
│
├── components/
│   ├── atoms/         Button, Badge, Input, Label, Avatar, Spinner, Select, Switch
│   ├── molecules/     FormField, StatusBadge, HealthBadge, UserAvatar, ConfirmDialog, CopyButton, EmptyState
│   ├── organisms/     Sidebar, EnvVarsForm, LogsViewer, DeployButton, ContainerStatusBar,
│   │                  CustomDomain, DeployHistory, DeployTarget, MonorepoSuggestions,
│   │                  ReplicaManager, ResourceLimits, TransferProject, WebhookSetup,
│   │                  ProjectCard, ProjectMemberList, TeamMemberList, AddMemberModal,
│   │                  AssignMemberModal, CreateTeamModal, CreateUserModal
│   ├── templates/     (layouts — AuthTemplate, DashboardTemplate)
│   └── providers/
│       ├── DashboardGuard/    Auth guard for dashboard routes
│       └── Providers/         QueryClient setup (retry: 1, staleTime: 30s)
│
├── hooks/
│   ├── useAuth.ts        login, logout, GitHub connect, change password
│   ├── useAdmin.ts       Coolify config query/mutation
│   ├── useProjects.ts    all project queries and mutations
│   ├── useTeams.ts       team queries and mutations
│   ├── useUsers.ts       user management
│   └── useSSELogs.ts     SSE streaming (native fetch with auth header)
│
├── services/             One file per resource, all use lib/api.ts
│   ├── auth.service.ts
│   ├── admin.service.ts
│   ├── projects.service.ts
│   ├── teams.service.ts
│   └── users.service.ts
│
├── store/
│   └── auth.store.ts     Zustand. Persisted to localStorage as "rdeploy-auth". {token, user, setAuth, logout}
│
├── lib/
│   ├── api.ts            Axios instance. Base URL: NEXT_PUBLIC_API_URL. JWT interceptor. 401 → logout.
│   └── utils.ts          cn(), slugify(), formatDate() (DD/MM/YYYY)
│
├── types/
│   ├── api.types.ts      ApiResponse<T>, ApiError, AxiosErrorLike
│   ├── user.types.ts     User, PlatformRole
│   ├── team.types.ts     Team, TeamMember, TeamRole
│   └── project.types.ts  Project, ProjectReplica, EnvVar, ProjectStatus, HealthStatus, RdeployYmlResult
│
└── constants/
    ├── routes.ts         All route path constants
    └── status.ts         STATUS_LABELS, STATUS_COLORS, HEALTH_COLORS
```

### Data Flow

```
page → TanStack Query hook → service function → lib/api.ts (axios) → backend
```

| Layer | Responsibility |
|-------|---------------|
| `lib/api.ts` | Axios instance: base URL, attach JWT header, 401 → logout |
| `services/` | Plain async functions: call axios, return typed data |
| `hooks/` | TanStack Query: caching, polling, invalidation, mutations |
| `store/` | Zustand: JWT token + user across page refreshes |
| Components | Props only — never fetch directly |

### TanStack Query Config

- `retry: 1`
- `staleTime: 30_000ms`
- `useProject`: auto-refetch every 2s when `status === "building" | "cloning"`
- `useContainerStatus`: auto-refetch every 30s

---

## 28. Error Handling & Validation

### API Error Response Shape

All errors:
```json
{ "error": "message here" }
```

Deploy-specific errors may include extra fields:
```json
{ "error": "Missing env var values", "missingKeys": ["DATABASE_URL", "API_KEY"] }
{ "warning": true, "localhostKeys": ["DB_HOST"] }
```

### Global Error Handler (backend)

| Error type | Status | Response |
|------------|--------|----------|
| `ZodError` | 400 | Validation messages concatenated |
| Prisma P2002 (unique violation) | 409 | "A record with that value already exists" |
| Prisma P2025 (not found) | 404 | "Record not found" |
| Error with `statusCode` property | statusCode | Error message |
| All other errors | 500 | "Internal server error" (never exposes internals) |

### HTTP Status Codes

| Code | Use |
|------|-----|
| 200  | Success (GET, some POST) |
| 201  | Resource created |
| 400  | Validation error, business logic error |
| 401  | Missing/invalid JWT, invalid webhook signature |
| 403  | Insufficient role/permission |
| 404  | Resource not found |
| 409  | Conflict (deploy in progress, unique constraint) |
| 413  | File too large (env file > 100KB) |
| 500  | Internal server error |

### Backend Zod Schemas (key examples)

| Schema | Endpoint | Key Rules |
|--------|----------|-----------|
| `loginSchema` | POST /auth/login | email: valid email, password: min 1 |
| `changePasswordSchema` | POST /auth/change-password | newPassword: min 8 |
| `createProjectSchema` | POST /teams/:id/projects | name: 1-100 chars, repoUrl: must be https://github.com/..., dockerfilePath: no `..` components |
| `updateEnvVarsSchema` | PUT /projects/:id/env | vars array min 1, value: no newlines, id: UUID |
| `resourceLimitsSchema` | PUT /projects/:id/resource-limits | cpuLimit: positive number string or null, memoryLimit: `\d+[mg]` or null |
| `replicaCountSchema` | PUT /projects/:id/replicas | integer 1–5 |
| `customDomainSchema` | PUT /projects/:id/custom-domain | RFC 1123 hostname or null |

### Frontend Form Validation (Zod)

| Form | Key Rules |
|------|-----------|
| Login | email: valid email, password: min 1 |
| Change Password | currentPassword: min 1, newPassword: min 8, confirmPassword: must match |
| New Project | name: 1-100, repoUrl: valid URL containing `github.com`, dockerfilePath: optional |
| Create Team | name: min 1, max 80 |
| Add Member | userId: required, role: enum |
| Create User | email: valid, name: min 1, platformRole: enum |

---

## 29. Backend Services Reference

| Service File | Domain | Key Functions |
|---|---|---|
| `auth.service.ts` | Auth | `login`, `getMe`, `changePassword`, `updateNotificationPreferences` |
| `admin.service.ts` | User management | `createUser`, `listUsers`, `updateUserRole`, `deleteUser` |
| `teams.service.ts` | Teams | `createTeam`, `listTeams`, `getTeam`, `deleteTeam`, `addMember`, `removeMember` |
| `projects.service.ts` | Project CRUD | `createProject`, `listTeamProjects`, `listAllProjects`, `getProject`, `deleteProject`, `assignMembers`, `removeProjectMember` |
| `deploy.service.ts` | Deployment | `runDeployFlow`, `checkLeaderPermission`, `checkMemberAccess`, `healthCheckHttp` |
| `docker.service.ts` | Docker CLI | `buildImage`, `runContainer`, `stopContainer`, `removeContainer`, `startContainer`, `removeImage`, `tagImage`, `inspectContainer`, `streamContainerLogs` |
| `git.service.ts` | Git | `cloneRepo`, `parseRdeployYml` |
| `env.service.ts` | Env vars | `getEnvVars`, `updateEnvVars` |
| `github.service.ts` | GitHub OAuth | `generateOAuthStateToken`, `verifyOAuthStateToken`, `exchangeCodeForToken`, `fetchGitHubUser`, `linkGitHubAccount`, `disconnectGitHub`, `getDecryptedGitHubToken` |
| `coolify.service.ts` | Coolify | `getCoolifyConfig`, `setCoolifyConfig`, `deployToCoolify`, `stopCoolifyApp`, `getCoolifyAppStatus` |
| `email.service.ts` | Email | `sendDeploySuccess`, `sendDeployFailure` |

| Utility File | Purpose |
|---|---|
| `utils/encryption.ts` | `encrypt(text)`, `decrypt(text)` — AES-256-GCM |
| `utils/slugify.ts` | `slugify(name)` — kebab-case |
| `utils/ports.ts` | `getAvailablePort()` — sequential scan of DB-tracked ports |
| `lib/prisma.ts` | Singleton PrismaClient instance |
