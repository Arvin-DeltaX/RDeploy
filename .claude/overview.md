# Overview

RDeploy is an internal company deployment platform. Teams submit pre-standardized GitHub repositories, configure environment variables via UI, and deploy to a single VPS via Docker. Every deployed project gets a live URL automatically.

- **Platform URL:** `rdeploy.deltaxs.co`
- **Project URLs:** `{project-slug}-{team-slug}.deltaxs.co`
- **DNS:** Single wildcard `*.deltaxs.co` → VPS IP

## Tech Stack

| Layer         | Technology                                                     |
|---------------|----------------------------------------------------------------|
| Frontend      | Next.js + TypeScript + Tailwind CSS + shadcn/ui                |
| HTTP Client   | Axios (JWT interceptors) + TanStack Query (server state)       |
| Forms         | react-hook-form + zod                                          |
| Notifications | sonner                                                         |
| Global State  | Zustand                                                        |
| Backend       | Express + TypeScript + Prisma                                  |
| Database      | PostgreSQL                                                     |
| Auth          | Email/password + JWT (7 day expiry, no refresh tokens)         |
| Encryption    | AES-256-GCM via Node crypto (env vars + GitHub tokens)         |
| GitHub        | Optional OAuth connect per user (profile page)                 |
| Deployment    | Docker CLI managed from backend                                |
| Reverse Proxy | Traefik (auto-discovers containers via labels on rdeploy-net)  |
| Real-time     | SSE for live deploy/clone log streaming                        |
| UI Theme      | Dark mode                                                      |

## Project Layout

```
RDeploy/
├── Codebase/
│   ├── Front-End/       # Next.js app
│   └── Back-End/        # Express API
├── Documents/           # STANDARDIZE.md, WORKFLOW.md
├── docker-compose.yml
├── .env.example
├── KNOWLEDGE_BASE.md    # Full spec (data model, API, permissions)
├── ROADMAP.md           # Phase-by-phase task list
└── CHANGELOG.md         # Completed work log per phase
```

## Key Reference Files

- Full spec → `KNOWLEDGE_BASE.md`
- Task list → `ROADMAP.md`
- Completed work → `CHANGELOG.md`
- Workflow rules → `Documents/WORKFLOW.md`
- AI standardization prompt → `Documents/STANDARDIZE.md`
