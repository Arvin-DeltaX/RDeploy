# RDeploy - Roadmap

---

## Phase 1 — Foundation

### Backend Setup
- [x] Initialize Express + TypeScript project
- [x] Setup Prisma + PostgreSQL connection
- [x] Define full Prisma schema (User, Team, TeamMember, Project, ProjectAssignment, EnvVar)
  - [x] Project includes: healthStatus (healthy/unhealthy/unknown), restartCount, exitCode, deployLogs
- [x] Run initial migration
- [x] Seed owner account (arvin@thesx.co)

### Auth System
- [x] POST /api/auth/login (email + password + JWT)
- [x] GET /api/auth/me
- [x] POST /api/auth/change-password
- [x] Middleware: requireAuth (JWT guard)
- [x] Middleware: requirePlatformRole (owner/admin check)
- [x] Force password change on first login (mustChangePassword flag)

### Frontend Setup
- [x] Initialize Next.js + TypeScript + Tailwind
- [x] Install and configure shadcn/ui (dark mode)
- [x] Install axios, TanStack Query, react-hook-form, zod, sonner, zustand
- [x] Setup lib/api.ts — axios instance with JWT interceptor + 401 → logout handler
- [x] Setup TanStack Query provider (QueryClientProvider in root layout)
- [x] Setup sonner Toaster in root layout
- [x] Auth store (Zustand) — JWT token + current user
- [x] Route guard (redirect to /login if not authenticated)
- [x] Forced redirect to /change-password if mustChangePassword is true

### Auth Pages
- [x] /login page
- [x] /change-password page

---

## Phase 2 — Users & Teams

### Backend
- [x] POST /api/admin/users (create user with default password)
- [x] GET /api/admin/users (list all users)
- [x] PUT /api/admin/users/:id (update platform role)
- [x] DELETE /api/admin/users/:id
- [x] POST /api/teams (owner/admin only)
- [x] GET /api/teams (my teams)
- [x] GET /api/teams/:id (team detail + members list)
- [x] DELETE /api/teams/:id
- [x] POST /api/teams/:id/members (add member with role)
- [x] DELETE /api/teams/:id/members/:userId
- [x] Middleware: requireTeamRole (leader/elder/member check)

### Frontend
- [ ] /admin page (user list + create user form + role management)
- [ ] /teams page (list my teams + create team button)
- [ ] /teams/[id] page (team detail, member list, projects list)
- [ ] Add member to team modal (select user + assign role)
- [ ] /profile page (view/edit name, avatar)

---

## Phase 3 — Projects

### Backend
- [ ] POST /api/teams/:teamId/projects (create project — include optional `dockerfilePath` field, default `"Dockerfile"`)
- [ ] GET /api/teams/:teamId/projects
- [ ] GET /api/projects (all projects — company-wide feed)
- [ ] GET /api/projects/:id
- [ ] DELETE /api/projects/:id (hard delete: stop container + remove workspace + delete DB records)
- [ ] POST /api/projects/:id/members (assign members)
- [ ] DELETE /api/projects/:id/members/:userId
- [ ] GET /api/projects/:id/members

### Frontend
- [ ] / dashboard (all projects feed with status badges + team labels)
- [ ] /teams/[id]/projects/new page (name + GitHub URL + optional Dockerfile path form)
- [ ] /projects/[id] page (project detail shell)
- [ ] /projects/[id]/members page (assign/remove members)

---

## Phase 4 — Repo Connection & Env Vars

### Backend
- [ ] POST /api/projects/:id/clone
  - [ ] Clone GitHub repo to workspace/{team}/{project}/repo/
  - [ ] Validate Dockerfile exists at `dockerfilePath` → error if missing
  - [ ] Validate .env.example exists → error if missing
  - [ ] Parse .env.example → extract all keys
  - [ ] Save keys to EnvVar table (no values yet)
  - [ ] Update project status: pending → cloning → ready (or failed)
- [ ] GET /api/projects/:id/env (return keys + whether value is set)
- [ ] PUT /api/projects/:id/env (save encrypted env values)

### Frontend
- [ ] "Connect Repo" button on project detail page
- [ ] Status feedback during cloning
- [ ] Clear error message if Dockerfile or .env.example is missing
- [ ] Env vars form (dynamically generated from parsed keys)
- [ ] Secret toggle per variable (marks value as isSecret — shown as •••••• after save)
- [ ] All values editable inline regardless of isSecret flag
- [ ] Save env vars button
- [ ] Upload .env file button — parses file and bulk-fills matching keys

---

## Phase 5 — Deployment

### Backend
- [ ] POST /api/projects/:id/deploy
  - [ ] Guard: reject with 409 if project status is "building" or "cloning"
  - [ ] Pre-deploy: check all env var values are non-empty → return error listing missing keys
  - [ ] Pre-deploy: scan env values for localhost/127.0.0.1/0.0.0.0 → return warning payload (frontend confirms before proceeding)
  - [ ] If project has existing container → stop and remove it first
  - [ ] Auto-inject PORT={assigned-port} into .env alongside user-defined vars
  - [ ] Write .env file from decrypted DB values to workspace
  - [ ] Build Docker image using project's `dockerfilePath`: `docker build -t rdeploy-{project}-{team} -f {dockerfilePath} {workspace}/repo/`
  - [ ] Auto-assign port: scan DB for used ports → pick lowest free in PORT_RANGE_START–PORT_RANGE_END range
  - [ ] Run container with --network rdeploy-net + Traefik labels for routing
  - [ ] Store container ID + port in DB
  - [ ] Delete .env file from workspace immediately after docker run starts
  - [ ] Persist all build + run output to Project.deployLogs (cap at ~50KB, truncate from top if exceeded)
  - [ ] Update project status: ready → building → running (or failed)
  - [ ] Post-deploy health check: wait 15s → GET /health on container → set Project.healthStatus
- [ ] POST /api/projects/:id/redeploy (same logic as deploy, same guards)
- [ ] POST /api/projects/:id/stop
  - [ ] Stop and remove container
  - [ ] Update status to stopped, healthStatus to unknown
- [ ] GET /api/projects/:id/logs
  - [ ] Return Project.deployLogs (persisted text from last deploy, not live docker logs)
- [ ] GET /api/projects/:id/container-status
  - [ ] docker inspect containerId → return Running, ExitCode, RestartCount, StartedAt
  - [ ] Return 404 with message if no container
- [ ] POST /api/projects/:id/env/upload (parse uploaded .env file → bulk-fill matching EnvVar records)
- [ ] GET /api/projects/:id/logs/stream
  - [ ] SSE endpoint — ?type=deploy (default): stream live build + run output during active deploy/clone
  - [ ] ?type=app: stream docker logs --tail=100 --follow from running container
  - [ ] Send status-change events so frontend badge updates without polling
  - [ ] Close connection when operation completes, fails, or client disconnects
- [ ] Background health check poller (interval in backend process, every 60s)
  - [ ] For all projects with status "running": docker inspect + GET /health on container
  - [ ] Update Project.healthStatus, restartCount, exitCode
  - [ ] If container no longer exists → set status to "failed", healthStatus to "unknown"

### Docker + Traefik
- [ ] docker-compose.yml (traefik, frontend, backend, postgres — all on rdeploy-net)
- [ ] Define rdeploy-net bridge network in docker-compose.yml
- [ ] Traefik static config (wildcard *.deltaxs.co, watch Docker socket on rdeploy-net)
- [ ] Docker labels on user containers for dynamic routing
- [ ] Container naming: rdeploy-{project-slug}-{team-slug}
- [ ] URL pattern: {project-slug}-{team-slug}.deltaxs.co

### Frontend
- [ ] "Deploy" button (with confirm dialog) — leader/admin/owner only
  - [ ] If backend returns localhost warning → show confirmation dialog before proceeding
  - [ ] If backend returns missing env vars error → show list of empty keys, block deploy
- [ ] "Stop" button — leader/admin/owner only
- [ ] Status badge (pending / cloning / ready / building / running / failed / stopped)
- [ ] Health badge (● Healthy / ● Unhealthy / ● Unknown) — shown only when status is "running"
- [ ] ContainerStatusBar organism — shows uptime, restart count (warning color if > 0), exit code
  - [ ] Polls GET /api/projects/:id/container-status every 30s when status is "running"
- [ ] Live URL link when status is running
- [ ] LogsViewer with two tabs: Deploy Logs and App Logs
  - [ ] Deploy Logs tab: SSE stream during active deploy/clone; falls back to GET /api/projects/:id/logs (persisted) otherwise
  - [ ] App Logs tab: SSE stream from running container (?type=app); only active when status is "running"
  - [ ] "Live" indicator badge on active SSE streams
- [ ] Redeploy button (calls POST /redeploy — single atomic action)

---

## Phase 6 — GitHub Connect

### Backend
- [ ] GET /api/auth/github (start OAuth flow)
- [ ] GET /api/auth/github/callback (link GitHub account to user)
- [ ] DELETE /api/auth/github (disconnect)
- [ ] Use user's GitHub token when cloning private repos
- [ ] Show clear error if private repo is submitted without GitHub connected

### Frontend
- [ ] "Connect GitHub" button on /profile (if not connected)
- [ ] "Disconnect GitHub" option (if connected)
- [ ] Display GitHub username + avatar when connected

---

## Phase 7 — Polish & Production Ready

- [ ] Dockerfiles for frontend and backend
- [ ] docker-compose.yml finalized and tested
- [ ] .env.example complete and documented
- [ ] README.md with full setup + run instructions
- [ ] VPS setup guide (DNS wildcard, Docker install, first run)
- [ ] Error handling on all API endpoints (validation, 4xx/5xx responses)
- [ ] Loading states and error states on all frontend pages
- [ ] Form validation (client + server side)
- [ ] Responsive UI
- [ ] Empty states (no teams, no projects, etc.)

---

## Bonus (Post-MVP)

### Reliability
- [ ] Auto-redeploy on crash — detect container exit (non-zero) in poller, auto-restart once, mark failed if second crash
- [ ] Deploy history + rollback to previous build
- [ ] Redeploy on git push (webhook trigger)

### Operations
- [ ] Resource limits per container (CPU/memory flags on `docker run`)
- [ ] Multiple replicas per project
- [ ] Custom domain per project
- [ ] Email notifications on deploy success/failure
- [ ] Project transfer between teams

### Platform
- [ ] Coolify integration as alternative deployment target
- [ ] `rdeploy.yml` auto-parsing — when leader submits a monorepo, suggest services from `rdeploy.yml` instead of manual entry
