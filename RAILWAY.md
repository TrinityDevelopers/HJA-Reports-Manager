# Deploying to Railway

This repository is a monorepo with separate `backend` and `frontend` applications plus a shared package (`packages/shared`). Deploy them as **independent Railway services**, each using Docker with the **repository root** as build context so `@hja/shared` is available during the image build.

Do **not** use Railpack at the repo root without a Dockerfile. The root `package.json` has no production `start` script, which causes Railpack to fail with:

> No start command detected

Each service’s `railway.toml` sets `builder = "DOCKERFILE"` so Railway uses the Dockerfile instead of Railpack.

## Architecture

| Component | Railway service | Root directory | Config file | Dockerfile |
|-----------|-----------------|----------------|-------------|------------|
| Database | Managed MySQL (or PostgreSQL) | — | — | — |
| API | Backend | `/` (repo root) | `backend/railway.toml` | `backend/Dockerfile` |
| UI | Frontend | `/` (repo root) | `frontend/railway.toml` | `frontend/Dockerfile` |

Both Dockerfiles copy `packages/shared` and build it before compiling the app. `watchPatterns` in each `railway.toml` includes `packages/shared/**` so shared changes trigger redeploys.

## Prerequisites

- A Railway project connected to this GitHub repository
- A managed database service in the same project (MySQL 8+ is the default in docs and Docker Compose; PostgreSQL is also supported via `DB_TYPE=postgres`)

## 1. Database service

Add a managed database to the project (for example, Railway’s MySQL template).

Note the service name shown on the Railway canvas — you will reference it when wiring backend environment variables (examples below use `MySQL`).

The backend container runs a bootstrap migration on startup that creates the application database if it does not exist. Set `DB_DATABASE` to the name you want (default in examples: `hja_reports`). The platform’s default database name (often `railway`) is only used if you set `DB_DATABASE` to that value.

## 2. Backend service

Create a service from the same repository (or configure an existing one) with these settings.

### Source

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (repository root) |
| **Config-as-code file** | `backend/railway.toml` |

The Dockerfile path is `backend/Dockerfile` (set in `railway.toml`). Build context must be the repo root so `packages/shared` is included.

### Networking

Generate a public domain for the API. You will need this URL when configuring the frontend.

Verify after deploy:

- `https://<backend-domain>/health` → `{"status":"ok"}`

### Environment variables

Set these on the backend service. Use Railway’s **Variable Reference** UI (`{ }` or `${{`) to link database credentials from the database service — do not hard-code hostnames or passwords.

Replace `MySQL` in the references below with your database service name if it differs.

```env
NODE_ENV=production
DB_TYPE=mysql
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_DATABASE=hja_reports
# Optional: prefer Cloudmersive for XLSX→PDF (falls back to LibreOffice if unset or API fails)
# CLOUDMERSIVE_API_KEY=your-key-here
```

For PostgreSQL, set `DB_TYPE=postgres` and use the corresponding variable names from your database plugin.

Set `CORS_ORIGIN` after the frontend service has a public domain:

```env
CORS_ORIGIN=https://${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
```

Replace `Frontend` with your frontend service name. The value must be the full origin (scheme + host, no trailing path).

Railway injects `PORT` automatically; the backend listens on that port.

### Deploy

Redeploy the backend. Build logs should show **Docker**, not Railpack. The entrypoint waits for the database, runs the bootstrap migration, then starts the API.

## 3. Frontend service

Create a second service from the same repository.

### Source

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (repository root) |
| **Config-as-code file** | `frontend/railway.toml` |

The Dockerfile path is `frontend/Dockerfile` (set in `railway.toml`). Build context must be the repo root so `packages/shared` is included.

### Environment variables

`VITE_API_URL` is embedded at **build time**. Redeploy the frontend after changing it.

```env
VITE_API_URL=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api
```

Replace `Backend` with your backend service name. The URL must include `https://` and end with `/api`.

### Networking

Generate a public domain for the frontend.

### CORS

Update the backend `CORS_ORIGIN` to the frontend’s public URL and redeploy the backend.

### Verify

Open the frontend URL in a browser and confirm API requests succeed in the network tab of developer tools.

## Monorepo layout

Create **two services** from the same repo (backend and frontend). Each service should use:

- **Root Directory**: `/` (repository root)
- **Config-as-code**: `backend/railway.toml` or `frontend/railway.toml` with `builder = "DOCKERFILE"`

If Railway created a single service at the repo root without a Dockerfile config, add the appropriate `railway.toml` or split into two services as above.

See [Railway’s monorepo guide](https://docs.railway.com/guides/deploying-a-monorepo) for platform-specific details.

## Troubleshooting

### Railpack / “No start command detected”

- **Config-as-code file** is missing or not loaded. Add `backend/railway.toml` or `frontend/railway.toml` with `builder = "DOCKERFILE"` and the correct `dockerfilePath`.
- Railway is using Railpack instead of Docker. Confirm build logs show **Docker**, not Railpack.

### Backend builds with Docker but fails on database connection

- Confirm `DB_*` variables use `${{ServiceName.VAR}}` syntax with the correct database service name.
- Check deploy logs for “Waiting for database” and “Migration attempt” messages from `docker-entrypoint.sh`.
- Ensure the database service is running in the same Railway project.

### Frontend loads but API calls fail

- `VITE_API_URL` is baked in at build time — update the variable, then redeploy the frontend.
- `CORS_ORIGIN` on the backend must exactly match the frontend origin.
- `VITE_API_URL` must point at the public backend URL and include the `/api` path.

### PDF export fails or formatting differs from Windows

PDF export prefers Cloudmersive when `CLOUDMERSIVE_API_KEY` is set on the backend service, and falls back to a headless LibreOffice process pool (installed in the backend Docker image; tune with `LIBREOFFICE_CONCURRENCY`, default 3) if the key is missing or the API call fails. XLSX export does not require either. The image includes Microsoft Core Fonts (`ttf-mscorefonts-installer`) so Arial renders correctly during LibreOffice PDF conversion.

Check deploy logs for Cloudmersive fallback warnings or LibreOffice-related errors if PDF export fails. To verify fonts in a running container: `fc-list | grep -i arial`.

## Local parity

To run the same stack locally with Docker Compose:

```bash
cp .env.docker.example .env
docker compose up --build
```

See [README.md](./README.md#-deployment) for deployment overview and [backend/README.md](./backend/README.md#-production-deployment) for backend production details.
