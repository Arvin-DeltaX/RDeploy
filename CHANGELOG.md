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
> Status: 🔲 Not Started

### Added
- (tasks will be logged here as they complete)

---

## [Phase 4] - Repo Connection & Env Vars
> Status: 🔲 Not Started

### Added
- (tasks will be logged here as they complete)

---

## [Phase 5] - Deployment
> Status: 🔲 Not Started

### Added
- (tasks will be logged here as they complete)

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
