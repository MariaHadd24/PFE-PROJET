# Backend (FastAPI)

Backend REST API for the Vite/React frontend.

## Run

```bash
cd backend
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```


Open API docs:
- http://localhost:8000/docs

## Frontend integration

The frontend already defaults to `http://localhost:8000` (see `VITE_API_BASE_URL`).

If needed:

```bash
set VITE_API_BASE_URL=http://localhost:8000
```

## Notes

- Storage is **in-memory**: restarting the server resets data.
- CORS is enabled for `http://localhost:5173`.

## SQL Server persistence (optional)

This project can run with SQL Server instead of in-memory storage.

1) Create the database schema in SQL Server (see `database/sqlserver_schema.sql` at the repo root).

Prerequisite: install a Microsoft SQL Server ODBC driver (recommended: **ODBC Driver 18 for SQL Server**).

```powershell
$env:PFE_STORAGE = "sqlserver"
$env:SQLSERVER_SERVER = "localhost\\SQLEXPRESS"
$env:SQLSERVER_DATABASE = "PFE_PROJET"
```

Optional overrides:

```powershell
$env:SQLSERVER_DRIVER = "ODBC Driver 17 for SQL Server"
$env:SQLSERVER_ENCRYPT = "yes"   # useful with ODBC Driver 18+
# Or set a full connection string:
# $env:SQLSERVER_CONNECTION_STRING = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=PFE_PROJET;Trusted_Connection=yes;TrustServerCertificate=yes;"
```

3) Install dependencies and run:

```bash
pip install -r requirements-sqlserver.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Run fullstack (frontend + backend) in SQL Server mode

From the repo root:

```powershell
npm.cmd run dev:full:sqlserver
```

Note: the SQL Server backend launcher runs uvicorn **without** `--reload` (on this Windows setup the reload server process was not inheriting environment variables reliably). If you change backend code, restart the command.

If your SQL Server instance is not `.;SQLEXPRESS`, edit `backend/.env.sqlserver` and set `SQLSERVER_SERVER` to the exact “Server name” you see in SSMS.

## Optional: Local free LLM (Ollama) for the in-app chatbot

The frontend chatbot can call a backend endpoint `POST /chat` which proxies to a local Ollama instance.
This keeps everything free and local (no paid API key).

1) Install Ollama: https://ollama.com/

2) Pull a small model (fast):

```bash
ollama pull llama3.2:3b
```

3) Ollama runs on (default):

- http://127.0.0.1:11434

4) (Optional) Configure env vars before starting the backend:

- `PFE_OLLAMA_URL` (default: `http://127.0.0.1:11434`)
- `PFE_LLM_MODEL` (default: `llama3.2:3b`)

Latency tuning (optional):

- `PFE_LLM_MAX_TOKENS` (default: `160`) – shorter answers = faster
- `PFE_LLM_CONTEXT` (default: `1024`) – smaller context = faster
- `PFE_LLM_KEEP_ALIVE` (default: `5m`) – keep the model loaded in memory
- `PFE_LLM_TIMEOUT_SECONDS` (default: `30`)

Tip: if you want ~3–5s responses on typical laptops, use a smaller model like `qwen2.5:1.5b`:

```bash
ollama pull qwen2.5:1.5b
```

Then set `PFE_LLM_MODEL=qwen2.5:1.5b` before starting the backend.

If Ollama is not running, `/chat` returns `503` and the frontend falls back to the rule-based assistant.

## Email notifications (SMTP)

The backend can send an email whenever it emits an in-app notification (best-effort).

Configure SMTP via environment variables (recommended in `backend/.env.local`):

- `PFE_SMTP_HOST`
- `PFE_SMTP_PORT` (default `587`)
- `PFE_SMTP_USER`
- `PFE_SMTP_PASSWORD`
- `PFE_SMTP_FROM` (defaults to `PFE_SMTP_USER`)
- `PFE_SMTP_TLS` (default `true`)
- `PFE_SMTP_SSL` (default `false`)
- (optional) `PFE_APP_BASE_URL` (default `http://localhost:5173`) for the link inside emails

If you see an error like `5.7.139 ... SmtpClientAuthentication is disabled for the Mailbox`, SMTP login is disabled for that mailbox. In that case, prefer **Microsoft Graph** (below).

### Professional email services (recommended)

If you want to avoid Outlook/Gmail limitations, use a transactional email provider. Most of them expose an SMTP relay, so you can keep using the same `PFE_SMTP_*` variables.

Important:
- Use a **verified sender** (domain or email) provided by the service.
- Set `PFE_SMTP_FROM` to that verified sender.

#### SendGrid (SMTP relay)

Typical configuration:

```powershell
$env:PFE_SMTP_HOST = "smtp.sendgrid.net"
$env:PFE_SMTP_PORT = "587"
$env:PFE_SMTP_TLS = "true"
$env:PFE_SMTP_SSL = "false"
$env:PFE_SMTP_USER = "apikey"
$env:PFE_SMTP_PASSWORD = "<SENDGRID_API_KEY>"
$env:PFE_SMTP_FROM = "<verified-sender@yourdomain.com>"
```

#### Brevo (Sendinblue) (SMTP relay)

Typical configuration:

```powershell
$env:PFE_SMTP_HOST = "smtp-relay.brevo.com"
$env:PFE_SMTP_PORT = "587"
$env:PFE_SMTP_TLS = "true"
$env:PFE_SMTP_SSL = "false"
$env:PFE_SMTP_USER = "<your-brevo-login-or-smtp-user>"
$env:PFE_SMTP_PASSWORD = "<BREVO_SMTP_KEY>"
$env:PFE_SMTP_FROM = "<verified-sender@yourdomain.com>"
```

#### Amazon SES (SMTP)

SES SMTP endpoints are region-specific. Example pattern:

```powershell
$env:PFE_SMTP_HOST = "email-smtp.<region>.amazonaws.com"
$env:PFE_SMTP_PORT = "587"
$env:PFE_SMTP_TLS = "true"
$env:PFE_SMTP_SSL = "false"
$env:PFE_SMTP_USER = "<SES_SMTP_USERNAME>"
$env:PFE_SMTP_PASSWORD = "<SES_SMTP_PASSWORD>"
$env:PFE_SMTP_FROM = "<verified-sender@yourdomain.com>"
```

### Outlook example

For a mailbox like `Leoni.it.notif@outlook.fr` (consumer Outlook), typically:

```powershell
$env:PFE_SMTP_HOST = "smtp-mail.outlook.com"
$env:PFE_SMTP_PORT = "587"
$env:PFE_SMTP_TLS = "true"
$env:PFE_SMTP_SSL = "false"
$env:PFE_SMTP_USER = "Leoni.it.notif@outlook.fr"
$env:PFE_SMTP_FROM = "Leoni.it.notif@outlook.fr"
$env:PFE_SMTP_PASSWORD = "<PASSWORD_OR_APP_PASSWORD>"
```

To set the password without echoing it in the terminal:

```powershell
$sec = Read-Host "SMTP password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$env:PFE_SMTP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
```

Notes:
- If the account has MFA, you may need an **app password** and/or to enable SMTP auth in the account settings.
- For Microsoft 365 (work/school) accounts, the host is often `smtp.office365.com` with port `587` + TLS.

### Quick SMTP test

After setting the env vars, run:

```powershell
# If your current directory is repo root:
python backend\scripts\test_email.py --to "<your-recipient@email>" --debug

# If your current directory is backend/:
python scripts\test_email.py --to "<your-recipient@email>" --debug
```

Tip: to quickly check the script parses (from `backend/`):

```powershell
python -m py_compile scripts\test_email.py
```

Alternatively, use the PowerShell wrappers (they handle the working directory automatically):

```powershell
# From repo root:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-email.ps1 -- --to "<your-recipient@email>" --debug

# From backend/:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-email.ps1 -- --to "<your-recipient@email>" --debug
```

## Email notifications (Microsoft Graph) — recommended for Outlook / M365

When SMTP auth is disabled, use Microsoft Graph with an Azure App Registration.

1) Create an **App Registration** in Azure Portal.
2) Create a **Client Secret**.
3) Give it **Application** permission: `Mail.Send`.
4) Click **Grant admin consent**.

Then configure env vars:

```powershell
$env:PFE_EMAIL_PROVIDER = "graph"
$env:PFE_GRAPH_TENANT_ID = "<tenant-id>"
$env:PFE_GRAPH_CLIENT_ID = "<app-client-id>"
$env:PFE_GRAPH_CLIENT_SECRET = "<client-secret>"
$env:PFE_GRAPH_FROM = "Leoni.it.notif@outlook.fr"  # mailbox to send as
```

Test:

```powershell
cd backend
python scripts\test_email.py --to "<your-recipient@email>" --debug
```

## Email notifications (Gmail API via Google Cloud) — free option

If you want a free option without Azure and without SMTP restrictions, you can send emails using the **Gmail API**.

This sends emails **from a Gmail account** (e.g. `yourname@gmail.com`) and your app will email each user using their `users.email`.

### Step-by-step (Google Cloud Console)

1) Go to Google Cloud Console and create a **Project**.
2) In **APIs & Services** → **Library**:
	- Enable **Gmail API**.
3) In **APIs & Services** → **OAuth consent screen**:
	- Choose **External** (for personal Gmail).
	- Fill App name + support email.
	- Add yourself as a **Test user**.
4) In **APIs & Services** → **Credentials**:
	- Create credentials → **OAuth client ID**
	- Application type: **Desktop app**
	- Download the JSON file.

### Get a refresh token

From `backend/` run:

```powershell
python scripts\gmail_auth.py --credentials-json "C:\\path\\to\\client_secret_XXXX.json" --from "yourname@gmail.com"
```

It prints `PFE_GMAIL_REFRESH_TOKEN` and other values.

### Configure env vars

Set the env vars (recommended in `backend/.env.local`, do NOT commit secrets):

```powershell
$env:PFE_EMAIL_PROVIDER = "gmail"
$env:PFE_GMAIL_CLIENT_ID = "<printed>"
$env:PFE_GMAIL_CLIENT_SECRET = "<printed>"
$env:PFE_GMAIL_REFRESH_TOKEN = "<printed>"
$env:PFE_GMAIL_FROM = "yourname@gmail.com"
```

### Test

```powershell
python scripts\test_email.py --to "<your-recipient@email>" --debug
```
