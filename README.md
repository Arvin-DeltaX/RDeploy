# RDeploy

Internal deployment platform for managing team projects via Docker on a single VPS. Teams submit pre-standardized GitHub repositories, configure environment variables through the UI, and get a live URL automatically.

- **Platform URL:** `rdeploy.deltaxs.co`
- **Project URLs:** `{project-slug}-{team-slug}.deltaxs.co`
- **DNS:** Single wildcard `*.deltaxs.co` pointing to the VPS IP

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Docker | 24+ |
| Docker Compose | v2 (plugin) |
| PostgreSQL | 16+ (local dev only, or use Docker) |

---

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd RDeploy

# Backend
cd Codebase/Back-End
npm install

# Frontend
cd ../Front-End
npm install
```

### 2. Configure environment

```bash
# At repo root
cp .env.example .env
```

Edit `.env` and fill in:
- `POSTGRES_PASSWORD` — any strong local password
- `DATABASE_URL` — update password to match above
- `JWT_SECRET` — any random string for local dev
- `ENCRYPTION_KEY` — 64 hex characters: `openssl rand -hex 32`
- `SEED_OWNER_PASSWORD` — password for the seed owner account
- `RDEPLOY_WORKSPACE_DIR` — leave as `.rdeploy/workspaces` for local dev

### 3. Start the database

```bash
# From repo root
docker run -d \
  --name rdeploy-postgres \
  -e POSTGRES_DB=rdeploy \
  -e POSTGRES_USER=rdeploy \
  -e POSTGRES_PASSWORD=<your-password> \
  -p 5432:5432 \
  postgres:16-alpine
```

Or use any local PostgreSQL instance.

### 4. Run migrations and seed

```bash
cd Codebase/Back-End
npx prisma migrate dev
npx prisma db seed
```

### 5. Start dev servers

```bash
# Terminal 1 — backend (http://localhost:5000)
cd Codebase/Back-End
npm run dev

# Terminal 2 — frontend (http://localhost:3000)
cd Codebase/Front-End
npm run dev
```

Log in with `arvin@thesx.co` and the password set in `SEED_OWNER_PASSWORD`.

---

## Production Deployment

See [`Documents/VPS_SETUP.md`](Documents/VPS_SETUP.md) for the full step-by-step VPS setup guide.

Quick summary:

```bash
# On the VPS
git clone <repo-url> /opt/rdeploy
cd /opt/rdeploy
cp .env.example .env
# Edit .env with production values

docker network create rdeploy-net
mkdir -p /var/rdeploy/workspaces

docker compose up -d --build

docker exec rdeploy-backend npx prisma migrate deploy
docker exec rdeploy-backend npx prisma db seed
```

---

## Architecture Overview

```
VPS
├── Traefik          — reverse proxy, TLS termination via Let's Encrypt
├── rdeploy-frontend — Next.js platform UI  (rdeploy.deltaxs.co)
├── rdeploy-backend  — Express API          (rdeploy.deltaxs.co/api)
├── rdeploy-postgres — PostgreSQL database
└── [user containers]— one per deployed project ({project}-{team}.deltaxs.co)
```

All services and user project containers share the `rdeploy-net` Docker network. Traefik auto-discovers containers via Docker socket and applies routing from labels.

### Workspace layout (VPS)

```
/var/rdeploy/workspaces/
└── {team-slug}/
    └── {project-slug}/
        ├── repo/    — cloned GitHub repo
        └── .env     — written at deploy time only, deleted after container starts
```

### Deployment flow

1. Leader adds a project (GitHub URL + optional `dockerfilePath`, default `Dockerfile`)
2. "Connect Repo" — clones the repo, validates `Dockerfile` and `.env.example`, parses env keys
3. Team fills in env var values via the UI
4. "Deploy" — builds image, writes `.env`, runs container with Traefik labels, auto-assigns port
5. Project is live at `{project-slug}-{team-slug}.deltaxs.co`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password (used by compose and DATABASE_URL) |
| `DATABASE_URL` | Yes | Full Prisma connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | No | JWT expiry (default: `7d`) |
| `ENCRYPTION_KEY` | Yes | 64 hex chars (32 bytes) for AES-256-GCM encryption |
| `RDEPLOY_WORKSPACE_DIR` | Yes | Path where repos and .env files are stored |
| `RDEPLOY_DOMAIN` | Yes | Base domain (e.g. `deltaxs.co`) |
| `RDEPLOY_PLATFORM_SUBDOMAIN` | Yes | Platform subdomain (e.g. `rdeploy`) |
| `RDEPLOY_PLATFORM_URL` | Yes | Full platform URL (e.g. `https://rdeploy.deltaxs.co`) |
| `ACME_EMAIL` | Yes | Email for Let's Encrypt certificate notifications |
| `NEXT_PUBLIC_API_URL` | Yes | Frontend → backend base URL |
| `SEED_OWNER_PASSWORD` | Yes | Password for the seed owner account (`arvin@thesx.co`) |
| `DEFAULT_USER_PASSWORD` | Yes | Default password assigned to newly created users |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app client ID (for private repos) |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app client secret |
| `GITHUB_CALLBACK_URL` | No | GitHub OAuth callback URL |
| `PORT_RANGE_START` | No | Start of port range for user containers (default: `3001`) |
| `PORT_RANGE_END` | No | End of port range for user containers (default: `4000`) |
| `DOCKER_NETWORK` | No | Docker network name (default: `rdeploy-net`) |

---

## Project Standardization

RDeploy does not generate files. Before submitting a repo, teams must use the **Master Prompt** (`Documents/MASTER_PROMPT.md`) to standardize it:

- Production-ready `Dockerfile`
- `.env.example` with all required variables
- `GET /health` endpoint returning HTTP 200

RDeploy will reject repos missing either file with a clear error message.

---

## Roles

| Platform Role | Access |
|---------------|--------|
| owner | Full platform access |
| admin | Full platform access |
| user | Team-scoped access only |

| Team Role | Access |
|-----------|--------|
| leader | Deploy, stop, delete, manage projects |
| elder | Edit environment variables |
| member | Read-only |

No public registration — owner or admin creates all user accounts.
