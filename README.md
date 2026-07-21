# گزارش زنده کمپین — Campaign Live Report

A responsive RTL Persian single-page campaign live report website with a full admin panel.

## Features

- **Public page (`/`)**: Live campaign dashboard with KPIs, billboards, posters (version timeline), videos, analytics charts, and user submissions
- **Admin panel (`/admin`)**: CRUD for all content, publish/unpublish, form validation (Zod + React Hook Form), confirmation dialogs
- **Mock data fallback**: Works without Supabase configuration
- **Auto refresh**: Public page refreshes every 30 seconds
- **RTL Persian UI** with Vazirmatn font

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style components
- Recharts
- Supabase (optional)
- Zod + React Hook Form

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public report.

### Admin Login

- URL: `/admin/login`
- Credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or the admin account stored in the database).
- Set a strong `AUTH_SECRET` (16+ random characters). In production the app will not start with a missing or weak secret.

## Deploy on Coolify

### 1. PostgreSQL in Coolify

1. In Coolify, create a **PostgreSQL** database service.
2. Copy the internal connection string (example):
   `postgres://user:pass@postgres:5432/dashboard`

### 2. Run migration (once)

From your machine or Coolify terminal (with `DATABASE_URL` set):

```bash
npm run db:migrate
```

Or run `database/schema.sql` manually in PostgreSQL.

### 3. Deploy the app

1. Add a new **Application** in Coolify → connect GitHub repo `Dashboard-info`.
2. Build pack: **Dockerfile** (auto-detected).
3. Port: **3000**
4. Health check path: `/api/health`

### 4. Environment variables (Coolify)

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgres://...` |
| `ADMIN_EMAIL` | Yes | `admin@example.com` |
| `ADMIN_PASSWORD` | Yes | strong password |
| `AUTH_SECRET` | Yes | random 32+ chars |
| `CRON_SECRET` | Yes (for daily auto-refresh) | random 32+ chars |
| `NODE_ENV` | Yes | `production` |

### 5. Daily link metrics refresh (Coolify Scheduled Job)

The app refreshes Eitaa views and site/press link metadata via:

`GET|POST /api/cron/refresh-link-metrics`

1. In Coolify, open the app → **Scheduled Tasks** (or Cron Jobs).
2. Schedule: once per day, e.g. `0 3 * * *` (03:00 server time).
3. Command:

```bash
curl -fsS -X POST "$APP_URL/api/cron/refresh-link-metrics" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Replace `$APP_URL` with your public app URL (or internal service URL) and ensure `CRON_SECRET` is set in the app environment.

What it updates:
- **Eitaa posts**: views (and empty title/description/cover)
- **Aparat videos**: views, likes, comments (and empty title/description/cover)
- **Site publications** + **magazine/newspaper** with a link: Open Graph title/description/cover when empty

### 5b. Daily campaign ZIP backup

### 5b. Daily disaster-recovery backup

Nightly job (Tehran **00:00–05:59** catch-up window, **once per day**):

1. `pg_dump` → `BACKUP_DIR/db-dump-YYYY-MM-DD.sql`
2. Per-campaign **data-only** ZIP (users/sections JSON, **no media files**)

Media files stay on the persistent `UPLOAD_DIR` volume — do not rely on huge ZIPs for nightly runs.

**To bring the app back after total loss:**

1. Restore Postgres from the latest `db-dump-*.sql`
2. Mount/restore the `UPLOAD_DIR` volume (or copy files back)
3. Optionally restore campaign JSON from a backup ZIP (Admin → پشتیبان‌گیری → بازیابی کامل)
4. Start the app

Manual buttons:

- **بکاپ سریع (بدون رسانه)** — small, recommended daily/manual
- **بکاپ کامل با رسانه** — large; runs in background; use when you need a portable ZIP with files

Persist volumes: `BACKUP_DIR` (default `/app/data/backups`) and `UPLOAD_DIR` (default `/app/data/uploads`).

Set `DISABLE_DAILY_BACKUP_SCHEDULER=1` to turn off nightly automation.

### 6. Local Docker test

Create a `.env` next to `docker-compose.yml` with strong `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `AUTH_SECRET`, then:

```bash
docker compose up --build
```

Open [http://localhost:3030](http://localhost:3030) — login with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_USE_MOCK_DATA=false
```

Set `NEXT_PUBLIC_USE_MOCK_DATA=true` to force mock data even when Supabase is configured.

## Supabase Setup

1. Create a Supabase project
2. Run `supabase/schema.sql` in the SQL Editor
3. Create a storage bucket `campaign-media` for uploads (optional)
4. Create an admin user via Supabase Auth
5. Add env variables to `.env.local`

## Project Structure

```
app/
  page.tsx                 # Public campaign report
  api/campaign/route.ts    # JSON API for client refresh
  admin/
    login/page.tsx         # Admin login
    (panel)/               # Protected admin pages
components/
  public/                  # Public page sections
  admin/                   # Admin CRUD components
  ui/                      # shadcn-style UI
  charts/                  # Recharts wrappers
  media/                   # Lightbox, video modal, timeline
lib/
  types.ts                 # TypeScript interfaces
  mock-data.ts             # Mock data + in-memory store
  data-access/             # Data fetching layer
  supabase/                # Supabase clients
  actions/                 # Server actions
```

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Public Sections

1. خلاصه کمپین — Campaign overview & KPIs
2. بیلبوردها — Billboards with filters
3. پوسترها — Posters with version timeline
4. ویدیوها — Videos with version timeline
5. آمار بازدید سایت — Analytics charts
6. مشارکت کاربران — Approved submissions

## Admin Pages

- Dashboard overview
- Campaign settings
- Billboards CRUD
- Posters (categories, items, versions)
- Videos (categories, items, versions)
- Analytics metrics
- Submissions (approve/reject)

## License

MIT
