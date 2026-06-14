# Coolify deployment — Dashboard-info

This stack uses **unique service, network, and volume names** so it can run on the same server as other Coolify apps without conflicts.

## Architecture

| Resource | Name | Notes |
|----------|------|--------|
| App service | `dashboard-app` | Next.js standalone, listens on `0.0.0.0:3030` |
| Postgres service | `dashboard-postgres` | Internal only — **no** `5432:5432` host mapping |
| Network | `dashboard-info-net` | Isolated compose network |
| Postgres volume | `dashboard_postgres_data` | Persistent DB data |
| Uploads volume | `dashboard_uploads` | Persistent uploaded media |

## Required Coolify environment variables

Set these on the **Application** service in Coolify:

| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `3030` |
| `HOSTNAME` | Yes | `0.0.0.0` |
| `APP_URL` | Yes | `https://campain.pixlink.ir` |
| `SERVICE_FQDN_APP` | Yes | `campain.pixlink.ir` |
| `DATABASE_URL` | Yes | `postgres://dashboard:YOUR_PASSWORD@dashboard-postgres:5432/dashboard` |
| `POSTGRES_USER` | Yes | `dashboard` |
| `POSTGRES_PASSWORD` | Yes | strong password (same as in `DATABASE_URL`) |
| `POSTGRES_DB` | Yes | `dashboard` |
| `ADMIN_EMAIL` | Yes | your admin email |
| `ADMIN_PASSWORD` | Yes | strong admin password |
| `AUTH_SECRET` | Yes | random string, 32+ characters |
| `NEXT_PUBLIC_USE_MOCK_DATA` | Yes | `false` |
| `UPLOAD_DIR` | Yes | `/app/data/uploads` |
| `BILLBOARD_API_BASE_URL` | Optional | `https://billboard.pixlink.ir` |

Coolify often sets `SERVICE_FQDN_APP` automatically when you assign the domain. Keep `APP_URL` in sync with your HTTPS URL.

## Coolify application settings

1. **Build pack**: Dockerfile (repository root).
2. **Compose file**: `docker-compose.yaml` (recommended for Coolify).
3. **Public port / container port**: `3030`.
4. **Health check path**: `/api/health`.
5. **Domain**: `campain.pixlink.ir` → HTTPS via Coolify proxy.

Do **not** map Postgres to host port `5432` unless you explicitly need external DB access.

## Redeploy steps

1. Push changes to GitHub (`main`).
2. In Coolify → your **Dashboard-info** application → **Environment**:
   - Confirm all variables above (especially `DATABASE_URL` host = `dashboard-postgres`).
   - Set `NEXT_PUBLIC_USE_MOCK_DATA=false`.
3. **Redeploy** the application (Rebuild + restart).
4. Wait for `dashboard-postgres` health check to pass, then `dashboard-app` starts.
5. On first boot, entrypoint runs `database/schema.sql` and seeds if empty.
6. Open `https://campain.pixlink.ir/api/health` — expect JSON with database mode `postgres`.
7. Log in at `https://campain.pixlink.ir/admin/login`.

## Local Docker test (same stack, port on host)

```bash
docker compose up --build
```

Open [http://localhost:3030](http://localhost:3030).

Postgres stays internal; only port **3030** is published locally.

## Separate managed PostgreSQL in Coolify

If Postgres is a **separate** Coolify database service (not `dashboard-postgres` in this compose file):

1. Remove or disable the `dashboard-postgres` service from compose.
2. Set `DATABASE_URL` to Coolify’s internal connection string for that database.
3. Run migration once: `npm run db:migrate` from a Coolify terminal with `DATABASE_URL` set.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| App uses mock data | `DATABASE_URL` set? `NEXT_PUBLIC_USE_MOCK_DATA=false`? |
| DB connection refused | Host in `DATABASE_URL` must match service name (`dashboard-postgres`) |
| Port conflict on server | Use `expose: 3030` in Coolify compose, not `3032:3032` for Postgres |
| Uploads lost on redeploy | Volume `dashboard_uploads` mounted at `/app/data/uploads` |
