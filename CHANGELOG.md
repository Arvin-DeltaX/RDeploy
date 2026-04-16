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
> Status: 🔲 Not Started

### Added
- (tasks will be logged here as they complete)

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
