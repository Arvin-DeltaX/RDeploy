# Architecture

## Single Server Layout

```
VPS
├── Traefik              → routes *.deltaxs.co traffic
├── frontend             → Next.js (rdeploy.deltaxs.co)
├── backend              → Express API
├── postgres             → PostgreSQL database
└── [user containers]    → one Docker container per deployed project
```

User project containers are managed via Docker CLI from the backend — NOT via docker-compose.

## Storage

```
/var/rdeploy/workspaces/{team-slug}/{project-slug}/
  ├── repo/     ← cloned GitHub repo
  └── .env      ← written at deploy time only, never committed
```

Local dev uses `.rdeploy/workspaces/` (gitignored). Configurable via `RDEPLOY_WORKSPACE_DIR`.

## Deployment Flow

```
1. Leader adds project (name + GitHub URL + optional dockerfilePath, default "Dockerfile")
2. Click "Connect Repo"
   → Clone repo to workspace
   → Check Dockerfile exists at dockerfilePath → error if missing
   → Check .env.example exists at repo root → error if missing
   → Parse .env.example → save keys to DB
   → Status: pending → cloning → ready
3. Fill env var values in UI form
4. Click "Deploy"
   → Write .env from decrypted DB values
   → docker build -t rdeploy-{project}-{team} -f {dockerfilePath} {workspace}/repo/
   → docker run with Traefik labels + auto-assigned port
   → Status: ready → building → running (or failed)
5. Live at {project-slug}-{team-slug}.deltaxs.co
6. Delete = stop container + remove workspace + delete all DB records
```

## Project Validation

RDeploy does NOT generate files. It only validates:

| File | Required | Error if missing |
|------|----------|-----------------|
| Dockerfile at `dockerfilePath` | YES | "Use the Master Prompt to standardize first." |
| `.env.example` at repo root | YES | "Use the Master Prompt to standardize first." |

## Monorepo Support

A repo with multiple services (backend + frontend) is submitted as **separate projects**, each pointing to the same repo URL with a different `dockerfilePath`. The repo must have an `rdeploy.yml` at root listing all services as a guide for the team leader.

## Seed Data

| Field | Value |
|-------|-------|
| email | arvin@thesx.co |
| name | Arvin |
| platformRole | owner |
| mustChangePassword | false |
| password | `SEED_OWNER_PASSWORD` env var |
