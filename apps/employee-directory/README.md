# Employee Asset Automation Service

This project provides a lightweight Flask application for tracking employees, their hardware and software, and coordinating onboarding/offboarding workflows. It consolidates Microsoft 365 data with manual records, generates Excel exports for finance, and exposes automation commands for IT.

## Features

- REST API for managing employees, hardware, software, directory groups, and lifecycle events.
- SQLite-backed persistence (no external database required).
- Microsoft 365 sync service (users, devices, license assignments) via Microsoft Graph.
- Local Active Directory sync with staff OU scoping and duplicate-safe matching.
- One-click employee provisioning into Local AD and Microsoft 365 directly from the dashboard.
- Edit employee profiles directly from the dashboard and push changes to Local AD and Microsoft 365.
- Reset employee passwords in Local AD and Microsoft 365 from the dashboard in one step.
- Refresh button now triggers Local AD + Microsoft 365 sync so the UI mirrors directory changes and removes stale directory entries.
- Disable or delete employees from the UI—actions ripple through Local AD, Microsoft 365, and the SQLite database (with delete exporting the latest inventory snapshot automatically).
- Provisioning without an initial password generates a random Microsoft 365 password and keeps the new account blocked until you set credentials manually.
- Employee list supports sorting by first name, last name, or newest created date.
- Automated onboarding/offboarding task lists with CLI helpers.
- Excel export of current inventory snapshots (employees, hardware, software, directory groups, lifecycle tasks) for leadership reviews.
- Offboarding checklist generator with hardware, software, Microsoft 365, and directory group steps.
- Session-based admin login with configurable credentials stored in environment variables.

## Getting Started

1. **Install dependencies**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # PowerShell
   pip install -r requirements.txt
   ```

2. **Configure environment**  
   Create a `.env` file in the project root with at least the following values (update with your own secrets/domains):
   ```
   # Flask & admin access
   SECRET_KEY=change-me
   APP_ADMIN_USERS=admin:pbkdf2:sha256:260000$...

   # Local Active Directory
   LOCAL_AD_SERVER=dc01.example.com
   LOCAL_AD_BASE_DN=DC=example,DC=com
   LOCAL_AD_USER=EXAMPLE\\SyncUser
   LOCAL_AD_PASSWORD=StrongPassword!
   # Optional: separate write account for provisioning (if different from above)
   LOCAL_AD_PROVISION_USER=EXAMPLE\\ProvisionUser
   LOCAL_AD_PROVISION_PASSWORD=AnotherStrongPassword!
   LOCAL_AD_SSL=false
   LOCAL_AD_AUTH=NTLM
   LOCAL_AD_STAFF_OU=OU=Staff
   LOCAL_AD_MATCH_BY=NAME

   # Microsoft Graph (optional until ready)
   GRAPH_TENANT_ID=
   GRAPH_CLIENT_ID=
   GRAPH_CLIENT_SECRET=
   GRAPH_SCOPE=https://graph.microsoft.com/.default
   ```
   Generate password hashes for `APP_ADMIN_USERS` with:
   ```powershell
   python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('SuperSecret!'))"
   ```
   Add multiple admins by separating entries with commas, e.g. `APP_ADMIN_USERS=alice:hash,bob:hash`.

3. **Initialize the database**
   ```bash
   flask --app manage.py init-db
   ```

4. **Run the development server**
   ```bash
   flask --app manage.py run --debug
   ```

## 24/7 Deployment On A Windows File Server

The steps below assume you are installing everything on a Windows Server that stays online. Paths use PowerShell syntax—adjust them if your environment differs.

### Backend API (Flask)

1. **Create a virtual environment (run once)**
   ```powershell
   cd C:\path\to\employee_tech_documentation
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

2. **Set environment variables (run once per server)**
   ```powershell
   setx FLASK_APP "manage.py"
   setx FLASK_ENV "production"
   ```
   Make sure your `.env` file with database and Graph/AD secrets is in the project root.

3. **Start the API with Waitress (foreground test)**
   ```powershell
   .\.venv\Scripts\Activate.ps1
   waitress-serve --listen=0.0.0.0:8000 manage:app
   ```
   Hit `http://<server>:8000/api/health` from another machine to confirm it returns `{"status": "ok"}`.

4. **Install as a Windows service (runs 24/7)**

   - Download [NSSM](https://nssm.cc/download) and place `nssm.exe` on the server.
   - Register the service:
     ```powershell
     nssm install EmployeeAssetApi `
       "C:\path\to\employee_tech_documentation\.venv\Scripts\python.exe" `
       "-m" "waitress" "--listen=0.0.0.0:8000" "manage:app"
     ```
   - Optional: set the working directory to the project root in NSSM so the `.env` file is picked up.
   - Start and verify:
     ```powershell
     nssm start EmployeeAssetApi
     ```

### Frontend (React dashboard)

1. **Build the static bundle**
   ```powershell
   cd C:\path\to\employee_tech_documentation\frontend
   npm install
   npm run build
   ```
   This outputs a production build in `frontend\dist`.

2. **Serve the bundle (quick test)**
   ```powershell
   npx serve -s dist -l 4173
   ```
   Visit `http://<server>:4173` to confirm the UI loads and can reach the API at `http://<server>:8000`.

3. **Keep the UI running 24/7**

   - Install `serve` globally (optional):
     ```powershell
     npm install --global serve
     ```
   - Register another Windows service with NSSM:
     ```powershell
     nssm install EmployeeAssetFrontend `
       "C:\Program Files\nodejs\node.exe" `
       "C:\Users\<you>\AppData\Roaming\npm\node_modules\serve\build\main.js" `
       "-s" "C:\path\to\employee_tech_documentation\frontend\dist" "-l" "4173"
     ```
   - Start the service:
     ```powershell
     nssm start EmployeeAssetFrontend
     ```

4. **(Optional) Use IIS, Nginx, or Apache**

   If your file server already runs IIS/Apache/Nginx, point it at the `dist` directory (as a static site) and proxy API requests to `http://localhost:8000`.

### Keeping the Services Healthy

- **Updates**: pull the latest code, reactivate the virtualenv, reinstall requirements, rebuild the frontend, then restart both Windows services (`nssm restart …`).
- **Logs**: configure NSSM “I/O” settings to capture stdout/stderr to log files for troubleshooting.
- **Backups**: schedule regular copies of `employee_assets.db` (or your production database if you change backends).

## Key CLI Commands

- `flask --app manage.py sync-m365`  
  Synchronizes Microsoft 365 users, registered devices, and license assignments.

- `flask --app manage.py onboard user@example.com`  
  Generates onboarding tasks for the employee with the given email.

- `flask --app manage.py offboard user@example.com`  
  Generates offboarding tasks.

- `flask --app manage.py export-excel`  
  Creates an Excel workbook in `exports/` summarizing employees, hardware, software, and lifecycle tasks.

- `python scripts/sync_local_ad_groups.py --server YOUR_DC --base-dn \"DC=corp,DC=local\" --user \"DOMAIN\\SyncUser\" --password \"secret\"`  
  Imports directory group memberships from your on-prem Active Directory (supports SIMPLE or NTLM auth). Use `--ssl` for LDAPS.

## Resetting Passwords

1. Select an employee and click **Reset Password**.
2. Choose to enter a password (minimum 8 characters) or enable automatic generation for a random strong value.
3. Decide whether to force a password change at next sign-in and whether to re-enable Local AD or Microsoft 365 access.
4. Submit the form—the UI will display the new password once. Copy it immediately and share it securely with the employee.

## API Highlights

- `GET /api/employees/`  
  List employees with associated hardware, software, directory groups, and lifecycle events.

- `POST /api/hardware/`  
  Create or assign hardware assets.

- `POST /api/subscriptions/`  
  Manage software subscriptions and license assignments.

- `POST /api/directory-groups/`  
  Record directory group memberships (local AD or Entra ID) for employees.

- `POST /api/automation/onboarding/<employee_id>`  
  Trigger onboarding events through the API.

All endpoints return JSON responses suitable for building a simple frontend or integrating with other systems.

## Roadmap

- Tie onboarding/offboarding scripts into HR or ticketing system triggers.
- Support fine-grained authorization (role-based access) on top of the new login system.
- Switch from SQLite to a managed database (Oracle, PostgreSQL) when ready.
- Expand Microsoft 365 coverage (e.g., Intune device properties, mailbox stats).

## Adding a New Admin User

1. Open a Python prompt:
   ```powershell
   python
   ```
2. Generate and verify the hash (replace the sample password with your own):
   ```python
   >>> from werkzeug.security import generate_password_hash, check_password_hash
   >>> password = "ChooseAStrongPassword!"
   >>> hashed = generate_password_hash(password, method="pbkdf2:sha256")
   >>> hashed
   'pbkdf2:sha256:260000$example$hash'
   >>> check_password_hash(hashed, password)
   True
   ```
3. Update `.env`:
   ```
   APP_ADMIN_USERS=current_admin_hashes,...,newadmin:pbkdf2:sha256:260000$example$hash
   ```
4. Restart the Flask backend so the new credentials load.
5. Log in with the new username and the plain-text password you used in step 2.

## Docker Deployment

The app ships with a Dockerfile and `docker-compose.yml` for self-contained deployment. The container runs waitress on port 5065, bind-mounts the SQLite DB and exports directory, and auto-starts on reboot.

### Prerequisites

- Docker Engine + Compose plugin (`docker.io` + `docker-compose-v2` on Debian/Ubuntu)
- Your user in the `docker` group (`sudo usermod -aG docker $USER` + re-login), or run commands with `sudo`

### First-time deploy on a fresh host

1. **Clone the repo**
   ```bash
   git clone https://github.com/Neuron89/employee_tech_documentation.git
   cd employee_tech_documentation
   ```

2. **Configure `.env`**
   The repo includes a `.env` template at the root. Edit it in place with your secrets (Graph client IDs, AD credentials, admin hashes, Unifi token). See the "Configure environment" section above for required keys.

3. **Seed the SQLite DB** (optional — skip for an empty start)
   ```bash
   mkdir -p data
   cp /path/to/backup/employee_assets.db data/
   ```
   If `data/employee_assets.db` doesn't exist, the container will create a fresh one on first boot.

4. **Build and start**
   ```bash
   docker compose up -d --build
   ```
   First build takes ~2–3 minutes (frontend + pip install). Subsequent rebuilds are faster.

5. **Verify**
   ```bash
   curl http://localhost:5065/api/health
   # {"status":"ok"}
   ```
   Browse to `http://<host>:5065` and log in with your admin credentials from `.env`.

### Day-to-day operations

| Task | Command |
| --- | --- |
| View logs | `docker compose logs -f` |
| Restart | `docker compose restart` |
| Rebuild after code change | `docker compose up -d --build` |
| Stop | `docker compose down` |
| Shell into container | `docker compose exec employee-tech-doc bash` |
| Run a CLI command | `docker compose exec employee-tech-doc python manage.py <cmd>` |

### Data & volumes

- `./data/` — SQLite DB (persists across rebuilds). Back this up.
- `./exports/` — generated Excel files.
- `./.env` — secrets, mounted read-only.

### How `.env` is loaded (important)

The compose file bind-mounts `.env` into the container rather than using `env_file:`. This is intentional: docker-compose's `env_file:` directive performs shell-style interpolation on values, which silently mangles secrets containing `$` characters (e.g. pbkdf2 hashes in `APP_ADMIN_USERS`). The bind-mount lets python-dotenv read the file directly with `$` preserved.

### Upgrading from the old systemd/waitress setup

If you previously ran this app via `~/bin/start-webapps.sh` or a systemd service on the host:

1. Stop the old process and free port 5065.
2. Remove the entry from any startup script (already done for `~/bin/start-webapps.sh` on debian-MOC).
3. Copy the existing `employee_assets.db` into `data/` before `docker compose up`.
4. Confirm no old process is listening on 5065 before starting the container: `ss -tlnp | grep 5065`.


