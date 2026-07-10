# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **HJA Reports Manager** monorepo (geotechnical/soil-lab report management). It has three runtime pieces:

| Service | Dir | Dev command | Port |
|---------|-----|-------------|------|
| Database (MySQL 8) | — | `sudo service mysql start` | 3306 |
| Backend (Express + TypeORM) | `backend/` | `npm run backend:dev` (from root) | 5000 |
| Frontend (React + Vite) | `frontend/` | `npm run frontend:dev` (from root) | 3000 |

Standard lint/test/build/run commands and full setup details are in `README.md`; only the non-obvious, cloud-specific caveats are captured below.

### Database (MySQL) — required, must be started manually
- The backend fails to start without a reachable DB (`initializeDatabase()` runs before `app.listen`). Tables are auto-created on startup via TypeORM `synchronize`.
- MySQL is installed in the VM snapshot but is **not** auto-started on boot. Start it each session with `sudo service mysql start` (systemd is not available; use the SysV `service` command).
- The `root` MySQL user is configured with `mysql_native_password` and password `hja_dev_password`, and the `hja_reports` database already exists.
- Non-root shells cannot reach the unix socket (`/var/run/mysqld/mysqld.sock` is permission-restricted). Connect over TCP instead: `mysql -u root -phja_dev_password -h 127.0.0.1`. Use `sudo mysql` if you need socket/admin access.
- `backend/.env` (gitignored) is already configured for local dev with `DB_HOST=127.0.0.1` and the credentials above. If it is ever missing, recreate it from `backend/.env.example` using `DB_HOST=127.0.0.1`, `DB_USERNAME=root`, `DB_PASSWORD=hja_dev_password`, `DB_DATABASE=hja_reports`.
- First-time DB creation is handled by `cd backend && npm run migration:run` (creates the `hja_reports` database if absent). The DB persists in the snapshot, so this normally does not need re-running.

### Running / testing notes
- Run both dev servers together with `npm run dev:both`, or separately (`npm run backend:dev`, `npm run frontend:dev`). Frontend defaults `VITE_API_URL` to `http://localhost:5000/api`.
- Lint (`npm run lint`) and tests (`npm run test`, i.e. backend Vitest) run from the repo root. The backend `package.json` has **no** `lint` script despite some docs referencing one — lint is configured only at the root.
- Backend tests do not require a running MySQL server (they run in-memory / against fixtures).
- LibreOffice is only needed for optional PDF export; XLSX export and everything else work without it.
