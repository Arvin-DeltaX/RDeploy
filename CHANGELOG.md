# RDeploy - Changelog

All notable changes are documented here, organized by phase.

---

## [Phase 1] - Foundation
> Status: ✅ Complete

### Backend
- Initialized Express + TypeScript backend project with full project structure
- Defined Prisma schema: User, Team, TeamMember, Project, ProjectAssignment, EnvVar with all enums and relationships
- Implemented AES-256-GCM encryption utility for env vars and tokens
- Implemented slugify utility
- Built auth system: POST /api/auth/login, GET /api/auth/me, POST /api/auth/change-password
- Built requireAuth and requirePlatformRole middleware
- Created seed file for owner account (arvin@thesx.co)

### Frontend
- Initialized Next.js 14 + TypeScript + Tailwind CSS with dark mode (shadcn/ui CSS variables)
- Configured TanStack Query provider, sonner Toaster in root layout
- Built Axios instance (lib/api.ts) with JWT Bearer interceptor and 401 → logout handler
- Built Zustand auth store (token + user, persisted to localStorage)
- Built DashboardGuard route guard — redirects unauthenticated users to /login, mustChangePassword users to /change-password
- Built /login page with react-hook-form + zod validation
- Built /change-password page with confirm field and forced redirect logic
- Created auth service, useAuth hook (useLogin, useLogout, useChangePassword mutations)
- Created type definitions: User, Team, Project, ApiResponse
- Created constants: ROUTES, STATUS_LABELS, STATUS_COLORS, HEALTH_COLORS

---

## [Phase 3] - Projects
> Status: ✅ Complete

### Backend
- Built projects service with full CRUD: createProject, listTeamProjects, listAllProjects, getProject, deleteProject
- Implemented project slug auto-generation with collision handling (per-team unique slugs)
- Built POST /api/teams/:teamId/projects with requireTeamRole("leader") guard, optional dockerfilePath field (default "Dockerfile")
- Built GET /api/teams/:teamId/projects with team member permission check
- Built GET /api/projects (company-wide feed) with team-scoped filtering for regular users
- Built GET /api/projects/:id with team member access control
- Built DELETE /api/projects/:id with atomic cleanup: stop + remove Docker container, remove image, delete workspace directory, cascade DB delete
- Built project member assignment: POST /api/projects/:id/members, DELETE /api/projects/:id/members/:userId, GET /api/projects/:id/members
- All endpoints return consistent { data: {...} } / { error: "message" } shapes
- Proper error handling with appropriate HTTP status codes (400/403/404/500)
- All project operations require appropriate team role or platform role permissions

---

## [Phase 2] - Users & Teams
> Status: ✅ Complete

### Added
- Built admin user management API: POST/GET/PUT/DELETE /api/admin/users with zod validation and platform role guards
- Built teams API: POST/GET/DELETE /api/teams, GET /api/teams/:id with members, POST/DELETE /api/teams/:id/members
- Implemented requireTeamRole middleware with role hierarchy (leader > elder > member) and owner/admin bypass
- Auto-generates team slugs from name with collision handling
- Built /admin page: user list with inline role editing, create user modal (owner/admin only)
- Built /teams page: team cards grid with create team modal and delete support
- Built /teams/[id] page: member list, no-leader warning banner, add/remove member modal (add/remove owner/admin only)
- Built AddMemberModal, CreateTeamModal, CreateUserModal, TeamMemberList organisms
- Built atoms: Button, Badge, Input, Label, Avatar, Spinner, Select
- Built molecules: FormField, EmptyState, ConfirmDialog, UserAvatar, StatusBadge
- Built Sidebar organism with role-gated Admin link
- Built useUsers and useTeams hooks with full CRUD; users.service.ts and teams.service.ts
- Built /profile page (display-only — no PUT /api/auth/me endpoint yet)

---

## [Phase 3] - Projects
> Status: ✅ Complete

### Added
- Built projects.service.ts with listAllProjects, listTeamProjects, getProject, createProject, deleteProject, listProjectMembers, assignProjectMembers, removeProjectMember
- Built useProjects.ts hook with useAllProjects, useTeamProjects, useProject, useCreateProject, useDeleteProject, useProjectMembers, useAssignProjectMembers, useRemoveProjectMember (TanStack Query + sonner toasts)
- Built / dashboard page — company-wide projects feed, status badges, health badges, team labels, loading/error/empty states
- Built /teams/[id]/projects/new page — create project form with name, GitHub URL, optional Dockerfile path, zod validation, leader/admin permission guard, redirects to project detail on success
- Built /projects/[id] page — project detail shell showing name, status badge, health badge, repo URL, Dockerfile path, live URL (when running), deploy logs snapshot
- Built /projects/[id]/members page — list assigned members, assign/remove with leader/admin permission guard
- Built ProjectCard organism — clickable card with status badge, health indicator, team label, repo URL
- Built HealthBadge molecule — colored dot + label for healthy/unhealthy/unknown
- Built AssignMemberModal organism — select user from available team members and assign to project
- Built ProjectMemberList organism — table of assigned members with remove action
- Updated /teams/[id] page — added "New Project" button for leaders and admins

---

## [Phase 4] - Repo Connection & Env Vars
> Status: ✅ Complete

### Backend
- Added POST /api/projects/:id/clone — clones GitHub repo to workspace, validates Dockerfile and .env.example, parses env keys, saves to DB, handles status transitions
- Added GET /api/projects/:id/env — returns all env var keys with indicators for which have values set
- Added PUT /api/projects/:id/env — saves encrypted env var values to database

### Frontend
- Added "Connect Repo" button on project detail page — initiates clone operation with async handling
- Added status feedback during cloning — spinner + "Connecting repository..." text displayed during operation
- Added error banner for missing Dockerfile or .env.example — displays clear validation error messages from backend
- Added env vars form with dynamic generation from parsed .env.example keys
- Added secret toggle per variable — marks value as isSecret and displays as •••••• after save
- Added inline editing for all env var values — editable regardless of isSecret flag
- Added save env vars button — commits all env values to database via PUT /api/projects/:id/env
- Added upload .env file button — parses uploaded file and bulk-fills matching env var keys

---

## [Phase 5] - Deployment
> Status: 🟡 In Progress

### Backend
- Added POST /api/projects/:id/deploy — full Docker build + run flow with 409 guard for active status, missing env var validation, localhost warning confirmation, port auto-assignment, .env write + immediate delete, deploy logs capped at 50KB, 15s background health check
- Added POST /api/projects/:id/redeploy — atomic stop + rebuild + restart, same logic as deploy
- Added POST /api/projects/:id/stop — stops and removes container, sets status to stopped
- Added GET /api/projects/:id/logs — returns persisted deploy logs snapshot from Project.deployLogs
- Added GET /api/projects/:id/container-status — live docker inspect: Running, ExitCode, RestartCount, StartedAt
- Added POST /api/projects/:id/env/upload — multer file upload, parses .env file, bulk-fills matching EnvVar records with encryption
- Added GET /api/projects/:id/logs/stream — SSE endpoint: ?type=deploy streams live build output during active deploys; ?type=app streams docker logs --follow from running container; 30s keepalive
- Added background health check poller — every 60s, inspects all running containers, updates healthStatus/restartCount/exitCode, marks failed if container is gone
- Created src/services/docker.service.ts — all Docker CLI operations (build, run, stop, remove, inspect, stream logs)
- Created src/utils/ports.ts — port auto-assignment scanning DB for used ports in PORT_RANGE_START–PORT_RANGE_END range

### Docker + Traefik
- Created docker-compose.yml with traefik, frontend, backend, and postgres services on rdeploy-net external bridge network
- Traefik v3.0 configured with Docker provider, Let's Encrypt TLS (ACME), entrypoints on 80/443
- rdeploy-net declared as external network so user containers can join it independently via Docker CLI
- Backend Traefik labels route /api traffic; frontend labels route root domain
- User container label pattern documented in docker-compose.yml comments: rdeploy-{project-slug}-{team-slug} on rdeploy-net with dynamic Traefik host rules
- Created Codebase/Back-End/Dockerfile — 3-stage Node 20 Alpine build (deps → builder → runner)
- Created Codebase/Front-End/Dockerfile — 3-stage Node 20 Alpine standalone build
- Added output: "standalone" to next.config.ts for frontend Docker build
- Updated .env.example with POSTGRES_PASSWORD, RDEPLOY_PLATFORM_SUBDOMAIN, ACME_EMAIL

---

## [Phase 6] - GitHub Connect
> Status: 🔲 Not Started

### Added
- (tasks will be logged here as they complete)

---

## [Phase 7] - Polish & Production Ready
> Status: 🔲 Not Started

### Added
- (tasks will be logged here as they complete)
