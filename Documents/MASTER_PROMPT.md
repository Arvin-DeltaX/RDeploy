# RDeploy Master Prompt

> Give this prompt to any AI assistant (Claude, ChatGPT, etc.) along with your project.
> The AI will fully standardize your project so it is ready to be deployed on RDeploy.

---

## How to Use

1. Open your AI assistant (Claude, ChatGPT, etc.)
2. Copy the prompt below
3. Paste it along with your project files (or describe your project to the AI)
4. The AI will make all necessary changes
5. Review the changes
6. Push to your GitHub repository
7. Your project is now ready for RDeploy

---

## The Prompt

```
You are a DevOps engineer specializing in Dockerizing and standardizing web applications for deployment.

Your task is to fully standardize this project so it is ready to be deployed on our internal deployment platform (RDeploy).

---

## REQUIREMENTS

### 1. Dockerfile
- Create a production-ready Dockerfile at the root of the project
- Use an appropriate base image for this project type (Node.js, Python, Go, etc.)
- Use multi-stage builds where applicable to keep the image small
- Ensure the app runs on a configurable PORT (read from environment variable, default to 3000)
- Include only what is needed for production (no dev dependencies)
- The container must start with a single command

### 2. Environment Variables
- Identify ALL environment variables used anywhere in the project:
  - Database URLs
  - API keys
  - Secret keys
  - Service URLs
  - Ports
  - Feature flags
  - Any hardcoded values that should be configurable
- Create a single `.env.example` file at the root of the project
- Every variable must have:
  - A clear, descriptive name in UPPER_SNAKE_CASE
  - A placeholder or example value (never real secrets)
  - A comment above it explaining what it is
- Example format:
  ```
  # Database connection URL
  DATABASE_URL=postgresql://user:password@localhost:5432/mydb

  # Secret key for JWT signing (min 32 characters)
  JWT_SECRET=your-secret-key-here

  # Port the app will run on
  PORT=3000
  ```
- Replace ALL hardcoded values in the source code with references to these environment variables
- NEVER put real secrets in .env.example

### 3. Configuration File
- Create a single `config.ts` (or `config.js`, `config.py`, `config.go` etc. depending on language) file
- This file must:
  - Be the single source of truth for all configuration
  - Read every value from environment variables
  - Provide sensible defaults where safe to do so
  - Export a typed config object
  - All other files in the project must import config from this file — no direct process.env calls elsewhere
- Example (Node.js/TypeScript):
  ```typescript
  export const config = {
    port: process.env.PORT || 3000,
    databaseUrl: process.env.DATABASE_URL!,
    jwtSecret: process.env.JWT_SECRET!,
  }
  ```

### 4. .gitignore
- Ensure the following are in .gitignore:
  - .env
  - .env.local
  - node_modules/ (or equivalent)
  - build/dist/output directories
  - Any IDE or OS files

### 5. Health Check Endpoint
- Add a simple health check endpoint at GET /health
- It must return HTTP 200 with a JSON response:
  ```json
  { "status": "ok" }
  ```
- This is used by the deployment platform to verify the container is running

### 6. README Update
- Update (or create) README.md with:
  - Short project description
  - How to set up locally (copy .env.example to .env, fill values, run)
  - List of all environment variables with descriptions

### 7. Multi-Service Projects (Monorepos)

If this project contains **more than one deployable service** (e.g. a backend AND a frontend, or multiple microservices):

**Each service must have its own Dockerfile** inside its subdirectory:
```
my-app/
├── backend/
│   └── Dockerfile        ← builds only the backend
├── frontend/
│   └── Dockerfile        ← builds only the frontend
└── rdeploy.yml           ← root config listing all services (see below)
```

**Create a root-level `rdeploy.yml`** that documents every deployable service:
```yaml
# RDeploy multi-service config
# Each entry below = one project to create in RDeploy
services:
  backend:
    dockerfile: backend/Dockerfile
    description: Express API server
  frontend:
    dockerfile: frontend/Dockerfile
    description: Next.js web application
```

**The `.env.example` at the root must include variables for ALL services combined.** Group them by service using comments:
```
# ── Backend ──────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-secret-key-here

# ── Frontend ─────────────────────────────
NEXT_PUBLIC_API_URL=https://my-app-backend-my-team.deltaxs.co
```

**Do NOT create a root-level Dockerfile** for multi-service repos. Each service has its own.

When the team leader submits this repo to RDeploy, they create one project per service and enter the correct `dockerfilePath` for each (e.g. `backend/Dockerfile`, `frontend/Dockerfile`).

---

## RULES

- Do NOT change business logic, only infrastructure and configuration
- Do NOT add unnecessary dependencies
- Do NOT store real secrets anywhere in the repository
- All environment variable names must be consistent across .env.example, config file, and source code
- The app must read PORT from environment and listen on it
- The project must build and run using only: docker build + docker run

---

## OUTPUT

After completing the changes, provide:

1. A list of all files you created or modified
2. The complete .env.example file
3. Any important notes about the project setup
4. Confirmation that the project is ready for RDeploy deployment
```

---

## What RDeploy Expects After Standardization

When you submit your GitHub repo to RDeploy, the platform expects:

| File | Required | Purpose |
|------|----------|---------|
| `Dockerfile` | **YES** | Platform uses this to build your container |
| `.env.example` | **YES** | Platform reads this to generate the env vars form |
| `GET /health` endpoint | **YES** | Platform uses this to check if your app is running |
| `.gitignore` (with .env) | **YES** | Ensures secrets are never committed |
| `config.*` file | Recommended | Clean config management in your codebase |

If `Dockerfile` or `.env.example` are missing, RDeploy will reject the project with an error.

---

## After Standardization Checklist

**Single-service project:**
- [ ] `Dockerfile` exists at project root
- [ ] `docker build .` runs without errors
- [ ] `docker run` starts the app correctly
- [ ] `.env.example` exists at project root with all variables documented
- [ ] No real secrets in `.env.example`
- [ ] `.env` is in `.gitignore`
- [ ] App reads `PORT` from environment
- [ ] `GET /health` returns `{ "status": "ok" }`
- [ ] All hardcoded config values replaced with env variable references

**Multi-service project (monorepo) — additional checks:**
- [ ] Each service has its own `Dockerfile` inside its subdirectory
- [ ] No `Dockerfile` at repo root
- [ ] `rdeploy.yml` exists at repo root listing all services with their `dockerfile` paths
- [ ] `.env.example` at root contains variables for ALL services, grouped by service with comments
- [ ] Each service's `docker build -f {service}/Dockerfile .` runs without errors from the repo root
