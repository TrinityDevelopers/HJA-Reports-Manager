# Windows Server production

Run this app on Windows so PDF export uses the server's LibreOffice installation. Leave `CLOUDMERSIVE_API_KEY` unset. The API then converts XLSX files with `soffice.com`.

This path does not use Docker. Railway and Docker Compose setups in [RAILWAY.md](./RAILWAY.md) and [README.md](./README.md) stay available for other environments.

A published GitHub Release deploys to the server. You can also start the same deploy by hand from the Actions tab. The self-hosted runner on the server calls GitHub outbound only, so the office firewall does not need an inbound webhook.

## What runs on the server

| Piece | How it runs |
|-------|-------------|
| MySQL 8 | Windows service from the MySQL installer |
| API | Windows service `HJAReportsBackend` (NSSM runs `node dist\src\index.js`) |
| UI | IIS site `HJAReports` on port 8080, serving `frontend\dist` |
| PDF | LibreOffice, via `LIBREOFFICE_PATH` |

Default install directory: `C:\HJA\reports-manager`.

The API working directory is `backend`. `dotenv` loads `backend\.env` from that directory, and report schemas, Excel templates, and the LibreOffice profile directory are resolved from there.

The UI keeps its page in memory, so IIS only needs to serve `index.html` and the built assets. [frontend/public/web.config](frontend/public/web.config) sets that default document and is copied into `frontend\dist` by the Vite build.

## Prerequisites

- Windows Server with an elevated PowerShell session for the one-time setup
- Node.js 20 on the system PATH
- MySQL 8 installed as a Windows service (the service name is often `MySQL80` or `MySQL84`)
- LibreOffice, installed for all users
- [NSSM](https://nssm.cc/download) 2.24 (`nssm.exe` on PATH, or pass `-NssmPath`)
- Git, if you clone the repo on the server
- A GitHub account that can add a self-hosted runner and publish releases

The database user in `backend\.env` must be allowed to create a database. On startup the deploy script runs the same bootstrap migration as the Docker entrypoint, which creates `DB_DATABASE` if it is missing. Table changes still apply when the API starts (`DB_SYNCHRONIZE` defaults to on).

## One-time setup

### 1. Service account

Create a dedicated Windows user for the API. Do not run the service as Local System.

```powershell
net user hja-reports "replace-with-a-long-password" /add
```

Log on once interactively as that user, then log off. LibreOffice needs a user profile. NSSM grants the account "Log on as a service" when the service is installed.

Confirm LibreOffice's console launcher exists. The API must call `soffice.com`, which waits until conversion finishes. `soffice.exe` returns immediately and will not work.

```text
C:\Program Files\LibreOffice\program\soffice.com
```

### 2. Clone the repo

```powershell
git clone <repository-url> C:\HJA\reports-manager
```

### 3. Create `backend\.env`

Create `C:\HJA\reports-manager\backend\.env` on the server. Deploy never overwrites this file. Do not add `CLOUDMERSIVE_API_KEY`.

Replace the host name below with the name browsers use to reach this server. `CORS_ORIGIN` is the IIS site origin with no path. It must match exactly, including `http` or `https` and the port.

```env
NODE_ENV=production
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=replace-me
DB_DATABASE=hja_reports

PORT=5000
CORS_ORIGIN=http://hja-server:8080

LIBREOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.com
LIBREOFFICE_CONCURRENCY=1
```

Use `LIBREOFFICE_CONCURRENCY=1` on a small server. Raise it only when overlapping PDF exports need more LibreOffice processes.

A Windows service does not inherit a desktop PATH, so `LIBREOFFICE_PATH` must be the full path to `soffice.com`.

### 4. Register the API service

From an elevated PowerShell, in the repo:

```powershell
cd C:\HJA\reports-manager
.\scripts\windows\install-service.ps1 `
  -ServiceUser ".\hja-reports" `
  -ServicePassword "replace-with-a-long-password"
```

Optional parameters: `-InstallDir`, `-MysqlServiceName` (default `MySQL80`), `-NssmPath`, `-NodePath`, `-LogDir` (default `C:\HJA\logs`).

The service is Automatic and depends on the MySQL service. If `backend\dist\src\index.js` does not exist yet, the script leaves the service stopped. The first deploy starts it.

### 5. Create the IIS site

From an elevated PowerShell:

```powershell
.\scripts\windows\install-iis-site.ps1
```

This enables IIS if needed and creates site `HJAReports` on port 8080, pointed at `C:\HJA\reports-manager\frontend\dist`. Port 8080 avoids taking over an existing Default Web Site. Pass `-Port` if 8080 is already in use, and use that same origin in `CORS_ORIGIN`.

If the script reports that the WebAdministration module is missing, close the window, open a new elevated PowerShell, and run it again.

### 6. First deploy from the server

Set `VITE_API_URL` to the API URL browsers will call. It must end with `/api`. This value is baked into the frontend at build time. Changing it later requires another deploy.

```powershell
$env:VITE_API_URL = "http://hja-server:5000/api"
.\scripts\windows\deploy.ps1
```

When the script is run from the install directory, it builds in place. It installs dependencies, builds, runs `npm run migration:run:prod` in `backend`, starts `HJAReportsBackend`, and requests `http://127.0.0.1:5000/health`.

Confirm in a browser:

- UI: `http://hja-server:8080`
- API: `http://hja-server:5000/health` returns `{"status":"ok"}`

If other computers on the LAN need access, allow inbound TCP 8080 and 5000 in Windows Firewall.

### 7. GitHub Actions runner

On the server, install a self-hosted runner from the repository's **Settings > Actions > Runners > New self-hosted runner**, and choose Windows.

Keep the default labels and add `hja-reports`. The deploy workflow asks for `self-hosted`, `windows`, and `hja-reports`.

Install the runner as a Windows service so it stays online after logoff. The runner account must be able to write `C:\HJA\reports-manager` and start and stop `HJAReportsBackend`. On this server, an administrator account is the straightforward choice.

In the repository's **Settings > Secrets and variables > Actions > Variables**, add:

| Variable | Example | Required |
|----------|---------|----------|
| `VITE_API_URL` | `http://hja-server:5000/api` | Yes |
| `HJA_INSTALL_DIR` | `C:\HJA\reports-manager` | No. The script uses this path when the variable is empty. |

The workflow file is [.github/workflows/deploy-windows.yml](.github/workflows/deploy-windows.yml). It runs only when a release is published or when someone starts the workflow by hand. Do not add this runner to pull-request workflows.

## Shipping an update

1. Merge the changes you want to ship.
2. Publish a GitHub Release on that commit.
3. The runner checks out that commit, copies it into `C:\HJA\reports-manager` (leaving `backend\.env` in place), rebuilds, runs the bootstrap migration, and restarts the API.

To redeploy the current workflow file's branch without a new release, open **Actions > Deploy Windows > Run workflow**.

A failed build or migration leaves the API service stopped. Fix the cause and run the workflow again. The script prints the last lines of `C:\HJA\logs\HJAReportsBackend.err.log` when `/health` does not succeed.

You can deploy by hand from the install directory with the same script. Set `VITE_API_URL` first, as in the first-deploy step. That run skips the file copy because the source and install directories are the same.

## Operations

- Health: `http://127.0.0.1:5000/health` (or whatever `PORT` is set to in `backend\.env`).
- API logs: `C:\HJA\logs\HJAReportsBackend.out.log` and `HJAReportsBackend.err.log`. NSSM rotates each file at about 10 MB.
- Restart the API: `Restart-Service HJAReportsBackend`
- IIS serves files already in `frontend\dist`. A deploy rebuilds that folder. The site does not need a restart for a normal frontend update.
- Back up MySQL. Reports live in the `hja_reports` database. A scheduled `mysqldump` of that database is enough. Redeploying does not replace the database.
- Templates and schemas ship in `backend\data\` and are reloaded when the API starts. A deploy that changes those files picks them up on the service start that follows the build.

PDF export calls the `LIBREOFFICE_PATH` executable with a separate LibreOffice profile under `backend\temp\lo-profiles` for each worker. Those profiles are created on first use. The service account needs permission to write `backend\temp`. `install-service.ps1` grants the service user modify access on the install directory.
