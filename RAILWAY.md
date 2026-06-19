# Deploying to Railway

This repo is a monorepo. Railway must **not** build from the repository root — that root `package.json` has no `start` script, which causes the Railpack error:

> No start command detected

Deploy **separate services** for the backend and frontend, each with its own root directory and Dockerfile.

## Architecture

| Service | Root directory | Config file | Dockerfile |
|---------|----------------|-------------|------------|
| MySQL | (Railway template) | — | — |
| Backend | `/backend` | `/backend/railway.toml` | `backend/Dockerfile` |
| Frontend | `/frontend` | `/frontend/railway.toml` | `frontend/Dockerfile` |

## 1. Fix the backend service (do this first)

Open your **backend** GitHub-connected service in Railway.

### Settings → Source

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Config-as-code file** | `/backend/railway.toml` |

Root Directory tells Railway to build from `backend/` (where the Dockerfile and `start` script live). The config file forces the **Dockerfile** builder instead of Railpack.

### Settings → Networking

Click **Generate Domain** so the API gets a public URL (needed for the frontend later).

### Variables

Add these on the **backend** service. Replace `MySQL` with your MySQL service name if it differs (check the canvas label).

```env
NODE_ENV=production
DB_TYPE=mysql
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_DATABASE=hja_reports
```

Use the **Variable Reference** UI (click `{ }` or type `${{`) to pick variables from the MySQL service — do not paste literal hostnames.

`DB_DATABASE=hja_reports` is intentional: the container entrypoint runs a bootstrap migration that creates this database if it is missing. Railway’s default MySQL database name (`railway`) is not used unless you set `DB_DATABASE=railway`.

Set `CORS_ORIGIN` after the frontend has a domain:

```env
CORS_ORIGIN=https://${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
```

Or use the full URL with `https://` prefix manually.

### Deploy

Redeploy the backend service. The build log should show **Docker** (not Railpack). On success:

- `https://<backend-domain>/health` → `{"status":"ok"}`

## 2. Add the frontend service

1. **+ Create** → **Empty Service** (or **GitHub Repo** → same repo).
2. **Settings → Source**
   - Root Directory: `frontend`
   - Config-as-code file: `/frontend/railway.toml`
3. **Variables** (build-time — redeploy after changing):

   ```env
   VITE_API_URL=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api
   ```

   Replace `Backend` with your backend service name. The URL must include `https://` and end with `/api`.

4. **Generate Domain** for the frontend.
5. Update backend `CORS_ORIGIN` to the frontend public URL and redeploy backend.
6. Deploy frontend.

Open the frontend domain in a browser and verify API calls in DevTools.

## 3. If you only imported the repo once

Railway may have created a single service pointing at `/`. Either:

- **Recommended:** Configure that service as the backend (root `backend`, config `/backend/railway.toml`), then add a second service for the frontend, **or**
- Delete the misconfigured service and create two empty services connected to the same repo (see [Railway monorepo guide](https://docs.railway.com/guides/deploying-a-monorepo)).

## Troubleshooting

### Railpack / “No start command detected”

- Root Directory is still `/` (repo root). Set it to `backend` or `frontend`.
- Config file not set — add `/backend/railway.toml` with `builder = "DOCKERFILE"`.

### Backend build uses Docker but crashes on DB

- Confirm MySQL variables use `${{MySQL.MYSQLHOST}}` syntax with the correct service name.
- Check deploy logs for “Waiting for database” / “Migration attempt” messages from `docker-entrypoint.sh`.
- Ensure MySQL service is running in the same Railway project.

### Frontend loads but API calls fail

- `VITE_API_URL` is baked in at **build** time — change the variable, then **redeploy** frontend.
- `CORS_ORIGIN` on the backend must exactly match the frontend origin (scheme + host, no trailing path).
- Backend domain must be public and include `/api` in `VITE_API_URL`.

### PDF export fails

LibreOffice is installed in the backend Docker image. If PDF still fails, check deploy logs for LibreOffice errors; XLSX export does not require LibreOffice.

## Local parity

To run the same stack locally:

```bash
cp .env.docker.example .env
docker compose up --build
```

See [README.md](./README.md#-deployment) for more context.
