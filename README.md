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

### Admin Login (Mock Mode)

When Supabase is not configured:

- URL: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- Email: `admin@example.com`
- Password: `admin123`

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
| `NODE_ENV` | Yes | `production` |

### 5. Local Docker test

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) — login with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

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
