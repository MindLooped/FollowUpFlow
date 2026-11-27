# FollowUpFlow

A production-ready MVP for managing client relationships and follow-ups. The web app is a normal React + Flask application. **There is no AI SDK, chat widget, model API or embedded chatbot in the application.** Claude is the only AI actor and reaches FollowUpFlow exclusively through the MCP server.

## Architecture

```text
Browser (React / Vite / Tailwind)
        |
        | REST + Bearer token
        v
Flask API (Render)
        |
        | psycopg 3 / SQL
        v
Supabase PostgreSQL  <----  Python MCP server (Render, Streamable HTTP)
                                      ^
                                      |
                                   Claude
```

Both the REST API and the MCP server call the same `backend/service.py` layer and write to the same database, so records created by Claude appear immediately in the dashboard.

## What is included

- Dashboard with total clients, pending, completed, overdue, upcoming reminders, pipeline, upcoming list and recent activity.
- Full client CRUD, search and client detail view with its follow-ups.
- Full follow-up CRUD, filters, priority, rescheduling and completion.
- Activity log for every manual and MCP action.
- Eight MCP tools over Streamable HTTP with optional Bearer-token protection.
- Optional local SQLite demo database; production uses Supabase PostgreSQL.
- Deployment configuration for Vercel (frontend), Render (API + MCP) and Supabase (database).

## 1. Local development

Requirements: Node 20+, Python 3.13+, a Supabase project for production mode.

```bash
cd followupflow

python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cp .env.example backend/.env
cp .env.example .env.local

npm install
```

For local work, leave `DEMO_MODE=true` and `DATABASE_URL` empty in `backend/.env`. This uses a real local SQLite database at `backend/data/followupflow.db`; no mock data is generated.

Terminal 1 — Flask API:

```bash
source .venv/bin/activate
flask --app backend.app run --port 5000
```

Terminal 2 — Vite frontend:

```bash
npm run dev
```

Terminal 3 — MCP server (only when testing Claude):

```bash
source .venv/bin/activate
python -m uvicorn backend.mcp_server:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:5173`. Using `127.0.0.1` instead of `localhost` avoids a port-5000 conflict with macOS AirPlay Receiver. The MCP endpoint is `http://127.0.0.1:8000/mcp`.

### Verify locally

```bash
npm run build
source .venv/bin/activate
python -m unittest discover -s backend/tests -v
```

The tests start temporary SQLite databases and a temporary MCP server; they never touch production data.

## 2. Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it. This creates `clients`, `followups`, `activity_logs`, indexes, update triggers and row level security.
3. On the project page, click **Connect → Session pooler → URI** and copy the URI. Replace the password placeholder with your database password. Session pooler is correct for persistent backends like Render; transaction pooler is for serverless/edge runtimes.
4. Use that URI as `DATABASE_URL` on **both** Render services. Example shape:

```text
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require
```

Never put this value in the frontend, in `vercel.json`, in `render.yaml`, or in source control. The app's SQL is parameterised, and public/anon access is not granted on the tables.

## 3. Deploy the backend and MCP server on Render

`render.yaml` defines two Python web services. You can deploy it as a Blueprint or create the services manually with these settings.

### API service: `followupflow-api`

| Setting | Value |
| --- | --- |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `gunicorn backend.app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120` |
| Health check | `/api/health` |
| `PYTHON_VERSION` | `3.13.0` |
| `DEMO_MODE` | `false` |
| `APP_ACCESS_TOKEN` | long random secret, e.g. `openssl rand -hex 32` |
| `DATABASE_URL` | Supabase session-pooler URI |
| `CLIENT_ORIGIN` | your Vercel origin, e.g. `https://followupflow.vercel.app` |

### MCP service: `followupflow-mcp`

| Setting | Value |
| --- | --- |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `uvicorn backend.mcp_server:app --host 0.0.0.0 --port $PORT` |
| Health check | `/health` |
| `PYTHON_VERSION` | `3.13.0` |
| `DEMO_MODE` | `false` |
| `APP_ACCESS_TOKEN` | the exact same token as the API service |
| `DATABASE_URL` | the exact same Supabase session-pooler URI as the API service |
| `MCP_ALLOWED_HOSTS` | `your-mcp.onrender.com,your-mcp.onrender.com:*` |
| `MCP_ALLOWED_ORIGINS` | `https://claude.ai` for Claude's browser connector; leave empty for Claude Desktop |

`MCP_ALLOWED_HOSTS` is required in production. Without it the SDK's DNS-rebinding protection rejects requests to a non-local hostname with HTTP 421. Keep the same access token on both services; otherwise the frontend and Claude will get HTTP 401.

Free Render services sleep when idle, so the first request after inactivity can take a few seconds.

## 4. Deploy the frontend on Vercel

1. Import the `followupflow` repository/folder into Vercel.
2. Framework preset: **Vite**. Root directory: repository root.
3. Build command: `npm run build`. Output directory: `dist`.
4. Add an environment variable:

```text
VITE_API_URL=https://followupflow-api.onrender.com/api
```

5. Deploy. `vercel.json` already contains the SPA fallback rewrite.

The frontend never receives `DATABASE_URL` or service-role credentials. It only stores the optional bearer token in localStorage when you enter it on the Settings page.

## 5. Connect Claude through MCP

### Claude Desktop

1. Quit Claude Desktop.
2. Open the config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
3. Add the server (replace the endpoint and token):

```json
{
  "mcpServers": {
    "followupflow": {
      "type": "http",
      "url": "https://followupflow-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_APP_ACCESS_TOKEN"
      }
    }
  }
}
```

4. Restart Claude Desktop. Confirm the eight tools are listed in the MCP/tools menu.
5. If Claude asks for permission to run a tool, approve it.

### Claude web / remote connector

Where custom remote MCP connectors are available, add the same endpoint `https://followupflow-mcp.onrender.com/mcp` and the same bearer token. Set `MCP_ALLOWED_ORIGINS=https://claude.ai` on the MCP service so browser-originated requests and preflights are accepted. The Claude Desktop configuration above is the most deterministic option.

### Natural language example

Ask Claude:

> Add a client named Rahul from ABC Technologies. He is interested in website development worth Rs. 50,000. Schedule a follow-up for three days from today.

Claude should call `create_client`, then `create_followup` with `due_in_days: 3`, and confirm both records. Reload the FollowUpFlow dashboard: the client and follow-up are there, with a `client_created` and `followup_created` activity entry.

The tool descriptions explicitly teach Claude to use `due_in_days` for relative dates and `client_name` when no id is known. `create_client` returns the new id so Claude can chain the next call.

## 6. MCP tools

| Tool | Purpose |
| --- | --- |
| `create_client` | Create a client with name, company, email, phone, project details and notes. |
| `create_followup` | Schedule a follow-up by `client_id` or by resolving `client_name`; accepts `due_date` or `due_in_days`. |
| `list_clients` | List clients, optionally with a search term. |
| `list_followups` | List follow-ups filtered by `status`, `client_id`, search text and limit. |
| `update_followup` | Change title, description, client, due date, priority or status. |
| `complete_followup` | Mark a follow-up completed and log the completion time. |
| `delete_followup` | Permanently delete one follow-up. |
| `get_dashboard_stats` | Return all dashboard counters, upcoming follow-ups and recent activity. |

## 7. REST API

All `/api/*` routes except `/api/health` and `/api/settings` require `Authorization: Bearer <token>` when `APP_ACCESS_TOKEN` is configured.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| GET | `/api/settings` | Safe, non-secret runtime info |
| GET / POST | `/api/clients` | List (`?q=`) or create |
| GET / PATCH / DELETE | `/api/clients/<id>` | Detail, update or delete |
| GET / POST | `/api/followups` | List (`?status=&client_id=&q=&limit=`) or create |
| GET / PATCH / DELETE | `/api/followups/<id>` | Detail, update or delete |
| POST | `/api/followups/<id>/complete` | Complete |
| GET | `/api/activity?limit=100` | Activity log |
| GET | `/api/dashboard` | Dashboard payload |

Validation errors return HTTP 400 with a `details` object; missing records return 404; unexpected errors are logged server-side and return a generic 500.

## 8. Environment variable reference

| Variable | Used by | Description |
| --- | --- | --- |
| `DEMO_MODE` | Flask + MCP | `true` permits open local access with SQLite; use `false` in production. |
| `APP_ACCESS_TOKEN` | Flask + MCP | Shared bearer secret. When set, auth is enforced. |
| `DATABASE_URL` | Flask + MCP | Supabase PostgreSQL connection URI. Empty selects SQLite. |
| `SQLITE_PATH` | Flask + MCP | Local demo database path. |
| `CLIENT_ORIGIN` | Flask | Comma-separated CORS origins for the Vercel frontend. |
| `MCP_ALLOWED_HOSTS` | MCP | Comma-separated public hostname allowlist. |
| `MCP_ALLOWED_ORIGINS` | MCP | Comma-separated browser origins/CORS allowlist. |
| `VITE_API_URL` | Vite | Full REST base URL ending in `/api`, baked in at build time. |

See `.env.example` for a copyable template.

## 9. End-to-end acceptance check

1. Open the deployed frontend and confirm the dashboard loads from Supabase.
2. Ask Claude to create a client and a follow-up.
3. Watch Claude call `create_client` and `create_followup`.
4. Refresh the dashboard; both records and new activity appear.
5. Open **Clients**, edit the client, save.
6. Open **Follow-ups**, reschedule or change priority, save, then mark the follow-up completed.
7. Confirm the counters and Activity page reflect every change.

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Frontend shows “Cannot reach the API” | Check `VITE_API_URL`, redeploy Vercel, and confirm the API health route. |
| HTTP 401 | The token in Settings or Claude config does not match `APP_ACCESS_TOKEN` on both services. |
| HTTP 421 from MCP | Set `MCP_ALLOWED_HOSTS` to the exact Render hostname (with and without `:*`). |
| Browser CORS error | Add the frontend origin to `CLIENT_ORIGIN`; add `https://claude.ai` to `MCP_ALLOWED_ORIGINS` for browser MCP. |
| Dashboard looks stale | Use the Refresh button; free-tier cold starts can delay the first response. |
| Tools missing in Claude | Restart Claude Desktop after editing the config and approve the tools when prompted. |
| `no such table` | Run `supabase/schema.sql`, or delete the local SQLite file so it can be recreated. |

## Security notes

- No database credentials are bundled into frontend assets.
- All SQL uses bound parameters; request bodies and query parameters are validated and length-limited.
- API errors never expose stack traces to clients.
- Supabase tables have RLS enabled and are granted only to `service_role`; the app connects with a server-side `DATABASE_URL`.
- Demo mode is intended for localhost only. Set a strong `APP_ACCESS_TOKEN` before exposing either service publicly.
- The shared token is suitable for a single-user/small-team MVP. For per-user accounts, add an identity provider and per-workspace scopes in a later iteration.
