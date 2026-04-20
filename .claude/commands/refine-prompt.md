---
model: claude-sonnet-4-6
---

You are running a multi-pass review of `Documents/STANDARDIZE.md` — the prompt that teams give to an AI assistant to prepare their project for RDeploy deployment.

Your job is to run **5 sequential review passes**, each using a fresh Agent with no shared context. Each agent stress-tests the prompt against a specific project type, identifies any gaps or failures, patches the prompt directly, and **reports what it changed**.

---

## Before You Start

1. Read `KNOWLEDGE_BASE.md` fully — this is the authoritative source of what RDeploy requires from submitted projects. Extract the platform requirements (Dockerfile, .env.example, health check, PORT, rdeploy.yml, deployment flow) — you will pass these to each agent instead of using hardcoded summaries.
2. Read `Documents/STANDARDIZE.md` fully so you understand the current state before pass 1.

Store the list of changes from each agent as you go — you'll use them in the final summary.

---

## The 5 Passes

Run these one at a time. Wait for each agent to finish and **record its reported changes** before starting the next.

---

### Pass 1 — Single-service Node.js / TypeScript app

Spawn an Agent with this prompt:

```
You are reviewing Documents/STANDARDIZE.md in the RDeploy project.

This file is a prompt that teams give to an AI assistant to prepare their project for deployment on RDeploy. RDeploy is a Docker-based internal deployment platform.

First, read KNOWLEDGE_BASE.md to understand the full platform requirements — use that as your source of truth for what RDeploy expects from a submitted project.

Your scenario: A single-service Node.js / TypeScript Express app. One repo, one Dockerfile, one service.

Task:
1. Read Documents/STANDARDIZE.md
2. Mentally simulate giving this prompt to an AI assistant along with a standard Node.js/TypeScript Express project
3. Find any gaps, ambiguities, or failure points — things the AI might get wrong, miss, or misinterpret for this scenario
4. Patch Documents/STANDARDIZE.md directly to fix what you found
5. Do not break what already works — only improve

Be surgical. Only change what is actually wrong or missing for this scenario.

After patching, output a bullet list of every change you made (or "No changes needed" if nothing required fixing).
```

Record the reported changes from this agent as **Pass 1 changes**.

---

### Pass 2 — Single-service non-Node project (Python, Go, or Ruby)

Spawn an Agent with this prompt:

```
You are reviewing Documents/STANDARDIZE.md in the RDeploy project.

This file is a prompt that teams give to an AI assistant to prepare their project for deployment on RDeploy. RDeploy is a Docker-based internal deployment platform.

First, read KNOWLEDGE_BASE.md to understand the full platform requirements — use that as your source of truth for what RDeploy expects from a submitted project.

Your scenario: A single-service project in a non-Node language — Python (Flask/FastAPI/Django), Go, or Ruby on Rails. Not JavaScript.

Task:
1. Read Documents/STANDARDIZE.md
2. Mentally simulate giving this prompt to an AI assistant along with a Python, Go, or Ruby project
3. Find any gaps — does the prompt assume Node.js too much? Does it handle other languages' config patterns (e.g. Python dotenv, Go os.Getenv, config.py instead of config.ts)?
4. Patch Documents/STANDARDIZE.md directly to fix what you found
5. Do not break what already works — only improve

Be surgical. Only change what is actually wrong or missing for this scenario.

After patching, output a bullet list of every change you made (or "No changes needed" if nothing required fixing).
```

Record the reported changes from this agent as **Pass 2 changes**.

---

### Pass 3 — Monorepo with backend + frontend (2 services)

Spawn an Agent with this prompt:

```
You are reviewing Documents/STANDARDIZE.md in the RDeploy project.

This file is a prompt that teams give to an AI assistant to prepare their project for deployment on RDeploy. RDeploy is a Docker-based internal deployment platform.

First, read KNOWLEDGE_BASE.md to understand the full platform requirements — use that as your source of truth for what RDeploy expects from a submitted project.

Your scenario: A monorepo with exactly 2 services — a backend API (Node/Python/Go) and a frontend (Next.js or React).

IMPORTANT — frontend health check rules you must verify the prompt addresses:
- A Next.js or React app served by a Node server (e.g. `next start`) DOES need a GET /health endpoint
- A purely static site (pre-built HTML/CSS/JS served by nginx/caddy) does NOT need /health — the server itself proves liveness
- The prompt must make this distinction explicit so the AI assistant handles both cases correctly

Task:
1. Read Documents/STANDARDIZE.md
2. Mentally simulate giving this prompt to an AI assistant along with a 2-service monorepo
3. Find any gaps — is the monorepo section clear enough? Does it explain where each Dockerfile goes? Does it correctly distinguish between Node-served frontends (need /health) and static-served frontends (no /health needed)?
4. Patch Documents/STANDARDIZE.md directly to fix what you found
5. Do not break what already works — only improve

Be surgical. Only change what is actually wrong or missing for this scenario.

After patching, output a bullet list of every change you made (or "No changes needed" if nothing required fixing).
```

Record the reported changes from this agent as **Pass 3 changes**.

---

### Pass 4 — Monorepo with 3+ microservices

Spawn an Agent with this prompt:

```
You are reviewing Documents/STANDARDIZE.md in the RDeploy project.

This file is a prompt that teams give to an AI assistant to prepare their project for deployment on RDeploy. RDeploy is a Docker-based internal deployment platform.

First, read KNOWLEDGE_BASE.md to understand the full platform requirements — use that as your source of truth for what RDeploy expects from a submitted project.

Your scenario: A monorepo with 3 or more microservices — for example: api-gateway, auth-service, notification-service, and a frontend dashboard.

Task:
1. Read Documents/STANDARDIZE.md
2. Mentally simulate giving this prompt to an AI assistant along with a 3+ service monorepo
3. Find any gaps — does the prompt scale well? Is rdeploy.yml format clear for many services? Are there shared dependencies handled? Does the .env.example grouping guidance hold up for many services?
4. Patch Documents/STANDARDIZE.md directly to fix what you found
5. Do not break what already works — only improve

Be surgical. Only change what is actually wrong or missing for this scenario.

After patching, output a bullet list of every change you made (or "No changes needed" if nothing required fixing).
```

Record the reported changes from this agent as **Pass 4 changes**.

---

### Pass 5 — Edge cases and tricky projects

Spawn an Agent with this prompt:

```
You are reviewing Documents/STANDARDIZE.md in the RDeploy project.

This file is a prompt that teams give to an AI assistant to prepare their project for deployment on RDeploy. RDeploy is a Docker-based internal deployment platform.

Your scenario: Edge cases — projects that don't fit the clean happy path:
- A project with zero environment variables (no .env at all)
- A project that already has a Dockerfile but it's wrong or incomplete
- A static site (HTML/CSS/JS only, no server)
- A project using Docker Compose internally (which RDeploy does not use)
- A project with a database migration step that must run before the app starts
- A project with a non-standard PORT setup (hardcoded, or using multiple ports)

IMPORTANT: Do not re-address anything already covered in the file. Only add guidance that is genuinely absent for these specific edge cases. Read the file carefully before making any changes.

Task:
1. Read Documents/STANDARDIZE.md
2. For each edge case above, check if the prompt handles it correctly or leaves the AI assistant confused
3. Patch Documents/STANDARDIZE.md directly to add clear handling or guidance for any edge cases that are missing or ambiguous
4. Do not break what already works — only improve

Be surgical. Only add what is genuinely missing.

After patching, output a bullet list of every change you made (or "No changes needed" if nothing required fixing).
```

Record the reported changes from this agent as **Pass 5 changes**.

---

## Integrity Check

After all 5 passes, spawn one final Agent with this prompt:

```
You are doing a structural integrity check on Documents/STANDARDIZE.md in the RDeploy project.

This file has just been patched by 5 sequential review agents. Your job is NOT to add new content — only to verify the file is still structurally sound.

Check that the file still contains ALL of the following sections (by heading or presence):
1. "How to Use" section (the instructions for teams)
2. "The Prompt" section (the main prompt block teams give to the AI)
3. Inside the prompt: Requirements covering Dockerfile, Environment Variables, Config File, .gitignore, Health Check, README, Multi-Service Projects
4. Inside the prompt: RULES section
5. Inside the prompt: OUTPUT section
6. "What RDeploy Expects After Standardization" table
7. "After Standardization Checklist" with single-service and multi-service checklists

If any section is missing or was accidentally truncated, restore it to its last known good state by reading the surrounding context and inferring what should be there.

Report: either "All sections present — file is intact" or a list of what was missing and what you restored.
```

---

## After All Passes + Integrity Check

Once everything is done:

1. Read the final state of `Documents/STANDARDIZE.md`
2. Report a summary using the recorded changes from each pass:
   - **Pass 1 changes:** (list)
   - **Pass 2 changes:** (list)
   - **Pass 3 changes:** (list)
   - **Pass 4 changes:** (list)
   - **Pass 5 changes:** (list)
   - **Integrity check result:** (pass/fail + what was fixed if anything)
   - **Overall confidence** that the prompt now handles all project types correctly
3. Ask the user: "Want me to commit these changes?"
