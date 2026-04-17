# VPS Setup Guide

Step-by-step instructions for deploying RDeploy on a fresh VPS.

---

## 1. Server Requirements

| Requirement | Minimum |
|-------------|---------|
| OS | Ubuntu 22.04 LTS or newer |
| RAM | 2 GB (4 GB recommended) |
| Disk | 20 GB |
| CPU | 1 vCPU (2+ recommended) |
| Network | Public IP address |

Ports 80 and 443 must be open in the firewall/security group.

---

## 2. Install Docker and Docker Compose

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker using the official script
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (log out and back in after this)
sudo usermod -aG docker $USER

# Verify Docker is running
docker --version
docker compose version
```

Docker Compose v2 is bundled with Docker Engine — no separate install needed.

---

## 3. Set Up Wildcard DNS

In your DNS provider, create one A record:

| Name | Type | Value |
|------|------|-------|
| `*.deltaxs.co` | A | `<your-vps-ip>` |

This single wildcard routes all subdomains — `rdeploy.deltaxs.co`, and every `{project}-{team}.deltaxs.co` — to the VPS. Traefik handles routing from there.

DNS propagation can take a few minutes to a few hours. You can verify with:

```bash
dig rdeploy.deltaxs.co +short
```

---

## 4. Clone the Repo

```bash
git clone <repo-url> /opt/rdeploy
cd /opt/rdeploy
```

---

## 5. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in every value. Key variables to set for production:

```env
# Use a strong random password
POSTGRES_PASSWORD=<strong-random-password>
DATABASE_URL=postgresql://rdeploy:<strong-random-password>@postgres:5432/rdeploy

# Generate: openssl rand -base64 48
JWT_SECRET=<random-secret>

# Generate: openssl rand -hex 32
ENCRYPTION_KEY=<64-hex-chars>

# Your domain and Let's Encrypt email
RDEPLOY_DOMAIN=deltaxs.co
RDEPLOY_PLATFORM_SUBDOMAIN=rdeploy
RDEPLOY_PLATFORM_URL=https://rdeploy.deltaxs.co
ACME_EMAIL=admin@deltaxs.co

# Frontend points to platform root; Traefik routes /api/* to backend
NEXT_PUBLIC_API_URL=https://rdeploy.deltaxs.co

# Initial owner account password
SEED_OWNER_PASSWORD=<strong-password>
DEFAULT_USER_PASSWORD=<initial-user-password>

# GitHub OAuth (optional — only needed for private repos)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=https://rdeploy.deltaxs.co/api/auth/github/callback

# Port range for user project containers
PORT_RANGE_START=3001
PORT_RANGE_END=4000

# Workspace path (must match the volume mount in docker-compose.yml)
RDEPLOY_WORKSPACE_DIR=/var/rdeploy/workspaces
```

---

## 6. Create the Docker Network

The `rdeploy-net` network is declared `external` in `docker-compose.yml` so that user project containers deployed via the backend's Docker CLI can also join it. Create it once manually before starting the platform:

```bash
docker network create rdeploy-net
```

---

## 7. Create the Workspace Directory

```bash
sudo mkdir -p /var/rdeploy/workspaces
sudo chown -R $USER:$USER /var/rdeploy
```

This directory is bind-mounted into the backend container. Cloned repos and temporary `.env` files are written here at deploy time.

---

## 8. Build and Start the Platform

```bash
cd /opt/rdeploy
docker compose up -d --build
```

This starts:
- `traefik` — reverse proxy on ports 80 and 443
- `rdeploy-postgres` — PostgreSQL database
- `rdeploy-backend` — Express API
- `rdeploy-frontend` — Next.js frontend

The `--build` flag rebuilds images from the Dockerfiles. On subsequent restarts you can use `docker compose up -d` without `--build` unless the code has changed.

---

## 9. Run Database Migration and Seed

Wait a few seconds for the backend container to be healthy, then run:

```bash
docker exec rdeploy-backend npx prisma migrate deploy
docker exec rdeploy-backend npx prisma db seed
```

`migrate deploy` applies all pending migrations. `db seed` creates the owner account (`arvin@thesx.co`) using the `SEED_OWNER_PASSWORD` from `.env`.

---

## 10. Verify Services Are Running

```bash
# Check all containers are up
docker compose ps

# Check backend logs
docker logs rdeploy-backend --tail 50

# Check frontend logs
docker logs rdeploy-frontend --tail 50

# Check Traefik logs
docker logs traefik --tail 50
```

All four services should show `running` (or `healthy` for postgres and backend).

You can also hit the backend health endpoint:

```bash
curl https://rdeploy.deltaxs.co/api/health
```

---

## 11. TLS Certificates

Traefik automatically provisions Let's Encrypt TLS certificates on the first HTTPS request to each subdomain. No manual certificate management is needed.

Certificates are stored in the `letsencrypt` Docker volume and renewed automatically before expiry.

If a certificate fails to provision, check:
- DNS A record is pointing to the correct VPS IP
- Ports 80 and 443 are open in the firewall
- `ACME_EMAIL` is set to a valid email address in `.env`

---

## 12. Updating the Platform

To deploy a new version:

```bash
cd /opt/rdeploy
git pull
docker compose up -d --build
docker exec rdeploy-backend npx prisma migrate deploy
```

---

## 13. Useful Commands

```bash
# View all running containers (platform + user projects)
docker ps

# Restart a specific service
docker compose restart backend

# Stop everything
docker compose down

# Stop everything and remove volumes (destroys database)
docker compose down -v

# View resource usage
docker stats
```

---

## GitHub OAuth Setup (Optional)

GitHub OAuth is only required for deploying **private repositories**.

1. Go to GitHub Settings > Developer settings > OAuth Apps > New OAuth App
2. Set **Homepage URL** to `https://rdeploy.deltaxs.co`
3. Set **Authorization callback URL** to `https://rdeploy.deltaxs.co/api/auth/github/callback`
4. Copy the Client ID and Client Secret into `.env`
5. Restart the backend: `docker compose restart backend`

Users then connect their GitHub account from their profile page in the RDeploy UI.
