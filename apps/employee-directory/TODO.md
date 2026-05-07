## Local AD Sync Checklist

1. **Install requirements**
   - Activate your Python virtual environment.
   - Run `pip install -r requirements.txt` to ensure `ldap3` is installed.

2. **Gather Active Directory credentials**
   - Domain controller hostname or IP.
   - Base DN for user lookup (e.g., `DC=example,DC=local`).
   - Service account (`DOMAIN\user` or full DN) with read access to users/groups.
   - Password for the service account.
   - (Optional) Separate provisioning account with write privileges (`LOCAL_AD_PROVISION_USER` / `LOCAL_AD_PROVISION_PASSWORD`).
   - Staff OU distinguished name (e.g., `OU=Staff`) so only those users sync.
   - Decide whether to use LDAP (`389`) or LDAPS (`636`). If LDAPS, ensure certificates are trusted on this machine.

3. **Populate directory groups without syncing**
   - Manually add at least one directory group in the UI to confirm the UI path works.
   - Verify the `Directory Groups` card renders and that offboarding checklist notes include the group.

4. **Test LDAP connectivity**
   - From PowerShell, run:
     ```
     Test-NetConnection your-dc.example.local -Port 389
     ```
     (Replace with 636 for LDAPS). Ensure the port is reachable from this machine.

5. **Dry-run the sync script**
   - Navigate to the project root.
   - Run the script with credentials (using LDAP first):
     ```
     python scripts/sync_local_ad_groups.py ^
       --server your-dc.example.local ^
       --base-dn "DC=example,DC=local" ^
       --user "DOMAIN\SyncUser" ^
       --password "secret" ^
       --staff-ou "OU=Staff" ^
       --match-strategy NAME ^
       --log-level DEBUG
     ```
   - Observe output for each employee; confirm group counts make sense.

6. **Verify data in the app**
   - Restart the Flask dev server if needed.
   - Refresh the React dashboard; confirm groups appear under each employee.
   - Generate an offboarding checklist and confirm orphan-group warnings show when expected.
   - Use the **Test AD Bind** button to confirm credentials before running a full sync if needed.

7. **Switch to LDAPS (optional)**
   - Re-run the script with `--ssl` once certificates are trusted:
     ```
     python scripts/sync_local_ad_groups.py ... --ssl
     ```

8. **Schedule or document ongoing sync**
   - Decide whether to run the script manually before audits or automate via Task Scheduler / cron.
   - Document credential storage (e.g., use Windows Credential Manager or environment variables).

## Running the Sync Tomorrow
1. Open PowerShell, activate the virtualenv (`.venv\Scripts\Activate.ps1`).
2. Navigate to the project directory.
3. Execute the sync command (adjust server/base/user/password as needed):
   ```
   python scripts/sync_local_ad_groups.py ^
     --server your-dc.example.local ^
     --base-dn "DC=example,DC=local" ^
     --user "DOMAIN\SyncUser" ^
     --password "secret"
   ```
4. Observe the log output for counts and warnings.
5. Open the web dashboard, hit the new **Sync Directory Groups** button (in Employee Details) to refresh the UI cache from the database.
6. Export an offboarding checklist for a recently offboarded user to validate orphan detection.

## Provisioning New Employees
1. Confirm `.env` contains the new provisioning settings:
   - `APP_ADMIN_USERS=admin:pbkdf2:sha256:...`
   - `LOCAL_AD_STAFF_OU=OU=Staff`
   - `LOCAL_AD_MATCH_BY=NAME`
2. Restart the backend after updating `.env` so the settings reload.
3. Sign in to the UI with one of the admin accounts.
4. Click **Add Employee**, populate the form (password must be >= 8 chars, default is to force a reset).
5. On success, the user is created in Local AD, Microsoft 365, and stored in the SQLite database. A success banner appears and the employee list refreshes.
6. If provisioning fails, check:
   - The account does not already exist in AD/M365.
   - The provisioning credentials have create permissions (`LOCAL_AD_PROVISION_USER` or the default sync user).
   - Certificates are trusted if using LDAPS.
   - If initial password is not set (when LDAPS is disabled), the account stays disabled until you set a password manually.
   - Microsoft 365 requires a password; if none is provided a random one is generated and the account remains blocked until you reset it.

## Disable or Delete a User
1. Select an employee in the dashboard.
2. Click **Disable Account** to disable the Local AD and Microsoft 365 account (status toggles to inactive).
3. Click **Delete Employee** to remove the account from Local AD, Microsoft 365, and the asset database.
   - The modal requires typing the employee’s full name to confirm.
   - After deletion the export snapshot is generated automatically.

## Resetting Passwords
1. Select an employee and click **Reset Password**.
2. Leave the password blank to generate a random one, or enter/confirm a new value (minimum 8 characters).
3. Choose whether to force a password change at next sign-in and whether to re-enable Local AD or Microsoft 365 access.
4. Submit the form and securely record the displayed password—it is only shown once.

## Authentication Notes
- Generate password hashes for `.env` with:
  ```powershell
  python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('SuperSecret!'))"
  ```
- Multiple admins can be configured by separating entries with commas:  
  `APP_ADMIN_USERS=alice:hash,bob:hash`
- Sessions are cookie-based; if a 401 appears in the UI, log back in to refresh the session.

