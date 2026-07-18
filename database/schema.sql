-- Dashboard Info - PostgreSQL Schema (Coolify / self-hosted)
-- Run: npm run db:migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS campaign_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('live', 'completed', 'draft')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  cover_image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '{"billboards":true,"posters":true,"videos":true,"analytics":true,"socialAnalytics":true,"submissions":true,"files":true}',
  analytics_config JSONB NOT NULL DEFAULT '{"site":{"source":"manual"},"social":{"source":"manual"}}'::jsonb,
  billboard_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_owner_label TEXT NOT NULL DEFAULT 'مدیریت',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  location TEXT NOT NULL,
  date DATE NOT NULL,
  thumbnail_url TEXT NOT NULL,
  image_url TEXT,
  external_url TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'api')),
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('poster', 'video')),
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES media_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poster_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES posters(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'revised', 'final')),
  is_final BOOLEAN NOT NULL DEFAULT false,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES media_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  duration TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'revised', 'final')),
  is_final BOOLEAN NOT NULL DEFAULT false,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'site' CHECK (channel IN ('site', 'social')),
  date DATE NOT NULL,
  visitors INT NOT NULL DEFAULT 0,
  unique_visitors INT NOT NULL DEFAULT 0,
  page_views INT NOT NULL DEFAULT 0,
  avg_session_duration INT NOT NULL DEFAULT 0,
  source TEXT CHECK (source IN ('instagram', 'telegram', 'direct', 'google', 'referral', 'other')),
  device TEXT CHECK (device IN ('mobile', 'desktop', 'tablet')),
  page TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL DEFAULT '',
  participant_name TEXT NOT NULL,
  participant_phone TEXT,
  participant_email TEXT,
  title TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaign_submissions
  ADD COLUMN IF NOT EXISTS external_uuid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_campaign_external_uuid
  ON campaign_submissions(campaign_id, external_uuid)
  WHERE external_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_settings_published ON campaign_settings(published, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_billboards_campaign ON billboards(campaign_id, published, sort_order);
CREATE INDEX IF NOT EXISTS idx_posters_campaign ON posters(campaign_id, published, sort_order);
CREATE INDEX IF NOT EXISTS idx_videos_campaign ON videos(campaign_id, published, sort_order);
CREATE INDEX IF NOT EXISTS idx_submissions_campaign ON campaign_submissions(campaign_id, status, published);
CREATE INDEX IF NOT EXISTS idx_analytics_campaign_date ON analytics_metrics(campaign_id, date DESC);

ALTER TABLE campaign_settings
  ADD COLUMN IF NOT EXISTS analytics_config JSONB NOT NULL DEFAULT '{"site":{"source":"manual"},"social":{"source":"manual"}}'::jsonb;

ALTER TABLE campaign_settings
  ADD COLUMN IF NOT EXISTS billboard_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE campaign_settings
  ADD COLUMN IF NOT EXISTS meetings_view_password_hash TEXT;

ALTER TABLE campaign_settings
  ADD COLUMN IF NOT EXISTS page_view_password_hash TEXT;

ALTER TABLE campaign_settings
  ADD COLUMN IF NOT EXISTS admin_owner_label TEXT NOT NULL DEFAULT 'مدیریت';

ALTER TABLE billboards
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE analytics_metrics
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'site';

CREATE TABLE IF NOT EXISTS campaign_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_files_campaign ON campaign_files(campaign_id, published, sort_order);

-- Multi-user access
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('admin', 'contributor')),
  province TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_manager_name TEXT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_region_check;
ALTER TABLE users ADD CONSTRAINT users_region_check
  CHECK (region IS NULL OR region IN ('north', 'south', 'east', 'west'));

CREATE TABLE IF NOT EXISTS user_campaign_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{"billboards":true,"posters":true,"videos":true,"files":true,"analytics":true,"socialPosts":true,"sitePublications":true,"broadcast":true,"meetings":true,"activities":true,"submissions":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, campaign_id)
);

ALTER TABLE user_campaign_access
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"billboards":true,"posters":true,"videos":true,"files":true,"analytics":true,"socialPosts":true,"broadcast":true,"submissions":true}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_campaign_access_campaign ON user_campaign_access(campaign_id);

ALTER TABLE billboards ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE analytics_metrics ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE campaign_submissions ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE campaign_files ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram', 'x', 'telegram', 'linkedin', 'youtube', 'aparat', 'rubika', 'eitaa', 'soroush', 'bale', 'other')),
  title TEXT NOT NULL,
  cover_image_url TEXT,
  views INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  link TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'image' CHECK (content_type IN ('image', 'text', 'video', 'carousel', 'story', 'reel', 'audio')),
  media_url TEXT,
  description TEXT,
  published_date DATE NOT NULL DEFAULT CURRENT_DATE,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_campaign ON social_media_posts(campaign_id, published, sort_order);

CREATE TABLE IF NOT EXISTS social_platform_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'x', 'telegram', 'linkedin', 'youtube', 'aparat', 'rubika', 'eitaa', 'soroush', 'bale', 'other')),
  title TEXT,
  followers INT NOT NULL DEFAULT 0,
  posts INT NOT NULL DEFAULT 0,
  profile_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_platform_stats_campaign ON social_platform_stats(campaign_id, sort_order);

CREATE TABLE IF NOT EXISTS broadcast_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pdf_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  summary_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_reports_campaign ON broadcast_reports(campaign_id, published, sort_order);

CREATE TABLE IF NOT EXISTS campaign_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  discussion_summary TEXT NOT NULL DEFAULT '',
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_url TEXT,
  view_password_hash TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_meetings_campaign ON campaign_meetings(campaign_id, published, sort_order);

ALTER TABLE campaign_meetings ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE campaign_meetings ADD COLUMN IF NOT EXISTS attendees JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE campaign_meetings ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE campaign_meetings ADD COLUMN IF NOT EXISTS view_password_hash TEXT;

CREATE TABLE IF NOT EXISTS meeting_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES campaign_meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_tasks_meeting ON meeting_tasks(meeting_id, sort_order);

CREATE TABLE IF NOT EXISTS meeting_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES campaign_meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meeting ON meeting_decisions(meeting_id, sort_order);

-- Expand social platform enum for existing databases
ALTER TABLE social_media_posts DROP CONSTRAINT IF EXISTS social_media_posts_platform_check;
ALTER TABLE social_media_posts ADD CONSTRAINT social_media_posts_platform_check
  CHECK (platform IN ('site', 'instagram', 'x', 'telegram', 'linkedin', 'youtube', 'aparat', 'rubika', 'eitaa', 'soroush', 'bale', 'other'));

ALTER TABLE social_platform_stats DROP CONSTRAINT IF EXISTS social_platform_stats_campaign_id_platform_key;
DROP INDEX IF EXISTS idx_social_platform_stats_per_owner;
DROP INDEX IF EXISTS idx_social_platform_stats_global;
ALTER TABLE social_platform_stats ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE social_platform_stats DROP CONSTRAINT IF EXISTS social_platform_stats_platform_check;
ALTER TABLE social_platform_stats ADD CONSTRAINT social_platform_stats_platform_check
  CHECK (platform IN ('instagram', 'x', 'telegram', 'linkedin', 'youtube', 'aparat', 'rubika', 'eitaa', 'soroush', 'bale', 'other'));

CREATE TABLE IF NOT EXISTS campaign_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'other',
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  video_url TEXT,
  description TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_activities_campaign ON campaign_activities(campaign_id, published, sort_order);

ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS media_items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS link TEXT NOT NULL DEFAULT '';

ALTER TABLE billboards ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE billboards ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE billboards ADD COLUMN IF NOT EXISTS area_sqm DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS billboard_display_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id UUID NOT NULL REFERENCES billboards(id) ON DELETE CASCADE,
  title TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  billboard_image_url TEXT NOT NULL,
  confirmation_image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billboard_periods_billboard ON billboard_display_periods(billboard_id, sort_order);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'contributor', 'client'));

CREATE TABLE IF NOT EXISTS user_notification_reads (
  reader_key TEXT NOT NULL,
  content_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (reader_key, content_key)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notification_reads'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE user_notification_reads DROP CONSTRAINT IF EXISTS user_notification_reads_user_id_fkey;
    ALTER TABLE user_notification_reads RENAME COLUMN user_id TO reader_key;
    ALTER TABLE user_notification_reads ALTER COLUMN reader_key TYPE TEXT USING reader_key::TEXT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaign_settings ADD COLUMN IF NOT EXISTS content_plans JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE billboards ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE broadcast_reports ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE campaign_meetings ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE campaign_files ADD COLUMN IF NOT EXISTS plan_label TEXT;

CREATE TABLE IF NOT EXISTS raw_media_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  media_kind TEXT NOT NULL DEFAULT 'image' CHECK (media_kind IN ('image', 'video')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_media_uploads_campaign
  ON raw_media_uploads(campaign_id, published, sort_order);

-- Multi-topic labels + numeric scoring (admin/client)
ALTER TABLE billboards ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE broadcast_reports ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE campaign_meetings ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE campaign_files ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE raw_media_uploads ADD COLUMN IF NOT EXISTS plan_labels JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE billboards ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE campaign_activities ADD COLUMN IF NOT EXISTS is_creative BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE broadcast_reports ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE campaign_meetings ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE campaign_files ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE raw_media_uploads ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;

ALTER TABLE social_media_posts DROP CONSTRAINT IF EXISTS social_media_posts_content_type_check;
ALTER TABLE social_media_posts ADD CONSTRAINT social_media_posts_content_type_check
  CHECK (content_type IN ('image', 'text', 'video', 'carousel', 'story', 'reel', 'audio'));

-- Idempotent: attach orphan admin content on the live campaign to tavanir@example.com
DO $$
DECLARE
  target_user_id UUID;
  target_campaign_id UUID := '4f686728-6dbc-4ff7-bfdf-e94b35a27e1a';
BEGIN
  SELECT id INTO target_user_id
  FROM users
  WHERE lower(trim(email)) = 'tavanir@example.com'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'tavanir@example.com not found; skip orphan ownership assign';
    RETURN;
  END IF;

  UPDATE billboards
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE posters
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE videos
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE campaign_files
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE raw_media_uploads
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE social_media_posts
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE campaign_activities
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE broadcast_reports
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE campaign_meetings
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE analytics_metrics
  SET owner_user_id = target_user_id
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;

  UPDATE campaign_submissions
  SET owner_user_id = target_user_id,
      updated_at = now()
  WHERE campaign_id = target_campaign_id
    AND owner_user_id IS NULL;
END $$;

-- User activity audit trail (admin-only reporting)
CREATE TABLE IF NOT EXISTS user_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'db_user'
    CHECK (actor_type IN ('env_admin', 'db_user', 'anonymous')),
  actor_email TEXT,
  actor_name TEXT,
  actor_role TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('auth', 'navigation', 'content', 'ui', 'admin', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  campaign_id UUID REFERENCES campaign_settings(id) ON DELETE SET NULL,
  label TEXT,
  path TEXT,
  method TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_audit_events_created
  ON user_audit_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_audit_events_actor
  ON user_audit_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_audit_events_category
  ON user_audit_events(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_audit_events_action
  ON user_audit_events(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_audit_events_campaign
  ON user_audit_events(campaign_id, created_at DESC);

-- Section tutorials (admin-managed onboarding before first create)
CREATE TABLE IF NOT EXISTS section_tutorials (
  section_key TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_tutorial_completions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  tutorial_version INT NOT NULL CHECK (tutorial_version >= 1),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_user_tutorial_completions_section
  ON user_tutorial_completions(section_key, tutorial_version);

-- User-submitted problem reports (triaged by admin in audit panel)
CREATE TABLE IF NOT EXISTS user_problem_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_type TEXT NOT NULL DEFAULT 'db_user'
    CHECK (reporter_type IN ('env_admin', 'db_user', 'anonymous')),
  reporter_email TEXT,
  reporter_name TEXT,
  reporter_role TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'ui_bug',
      'cant_find',
      'upload',
      'permission',
      'data',
      'performance',
      'other'
    )),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  path TEXT,
  campaign_id UUID REFERENCES campaign_settings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'resolved', 'dismissed')),
  admin_note TEXT,
  -- NULL means the reporter has not opened the latest admin reply yet.
  admin_note_seen_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing deployments created before admin_note_seen_at existed.
ALTER TABLE user_problem_reports
  ADD COLUMN IF NOT EXISTS admin_note_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_problem_reports_status
  ON user_problem_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_problem_reports_reporter
  ON user_problem_reports(reporter_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_problem_reports_created
  ON user_problem_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_problem_reports_unread_reply
  ON user_problem_reports(reporter_user_id, created_at DESC)
  WHERE admin_note IS NOT NULL AND admin_note_seen_at IS NULL;

-- ─── Database privilege + RLS hardening ───
-- ENABLE RLS (without FORCE) so the table-owning app role keeps normal access.
-- Other/non-owner roles need an explicit policy. PUBLIC has no table privileges.

REVOKE ALL ON TABLE users FROM PUBLIC;
REVOKE ALL ON TABLE system_settings FROM PUBLIC;
REVOKE ALL ON TABLE user_campaign_access FROM PUBLIC;
REVOKE ALL ON TABLE user_audit_events FROM PUBLIC;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_app_bypass ON users;
DROP POLICY IF EXISTS users_app_access ON users;
CREATE POLICY users_app_access ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_settings_app_bypass ON system_settings;
DROP POLICY IF EXISTS system_settings_app_access ON system_settings;
CREATE POLICY system_settings_app_access ON system_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE user_campaign_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_campaign_access NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_campaign_access_app_bypass ON user_campaign_access;
DROP POLICY IF EXISTS user_campaign_access_app_access ON user_campaign_access;
CREATE POLICY user_campaign_access_app_access ON user_campaign_access
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE user_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audit_events NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_audit_events_app_bypass ON user_audit_events;
DROP POLICY IF EXISTS user_audit_events_app_access ON user_audit_events;
CREATE POLICY user_audit_events_app_access ON user_audit_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Phone number for SMS notifications (optional until SMS provider is configured)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Directives (دستورکارها): admin/client publish, users acknowledge + download
CREATE TABLE IF NOT EXISTS campaign_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  due_date DATE,
  start_date DATE,
  end_date DATE,
  letter_file_url TEXT,
  letter_file_name TEXT,
  letter_mime_type TEXT,
  letter_file_size INT NOT NULL DEFAULT 0,
  audience_type TEXT NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'region', 'users')),
  audience_region TEXT CHECK (audience_region IS NULL OR audience_region IN ('north', 'south', 'east', 'west')),
  published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaign_directives ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE campaign_directives ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE campaign_directives ADD COLUMN IF NOT EXISTS letter_file_url TEXT;
ALTER TABLE campaign_directives ADD COLUMN IF NOT EXISTS letter_file_name TEXT;
ALTER TABLE campaign_directives ADD COLUMN IF NOT EXISTS letter_mime_type TEXT;
ALTER TABLE campaign_directives ADD COLUMN IF NOT EXISTS letter_file_size INT NOT NULL DEFAULT 0;

UPDATE campaign_directives
SET end_date = due_date
WHERE end_date IS NULL AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_directives_campaign
  ON campaign_directives(campaign_id, published, created_at DESC);

CREATE TABLE IF NOT EXISTS directive_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_id UUID NOT NULL REFERENCES campaign_directives(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE directive_attachments ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_directive_attachments_directive
  ON directive_attachments(directive_id, sort_order);

CREATE TABLE IF NOT EXISTS directive_recipients (
  directive_id UUID NOT NULL REFERENCES campaign_directives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sms_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sms_status IN ('pending', 'sent', 'failed', 'no_phone', 'skipped')),
  sms_error TEXT,
  sms_sent_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (directive_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_directive_recipients_user
  ON directive_recipients(user_id, confirmed, seen_at);

CREATE INDEX IF NOT EXISTS idx_directive_recipients_directive
  ON directive_recipients(directive_id, confirmed);

