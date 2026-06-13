-- Demo seed for summer-1404 (entrypoint runs this only when campaign_settings is empty)

DO $$
DECLARE
  cid UUID;
  pc1 UUID;
  pc2 UUID;
  vc1 UUID;
  p1 UUID;
  p2 UUID;
  v1 UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM campaign_settings LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO campaign_settings (
    slug, title, description, status, start_date, end_date,
    cover_image_url, published, features
  ) VALUES (
    'summer-1404',
    'کمپین تابستانی ۱۴۰۴',
    'گزارش زنده پیشرفت کمپین تبلیغاتی تابستانی شامل بیلبورد، پوستر، ویدیو، آمار سایت و مشارکت کاربران.',
    'live',
    '2025-03-21',
    '2025-06-21',
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop',
    true,
    '{"billboards":true,"posters":true,"videos":true,"analytics":true,"submissions":true}'::jsonb
  ) RETURNING id INTO cid;

  INSERT INTO billboards (
    campaign_id, title, description, city, location, date, thumbnail_url,
    external_url, status, tags, notes, published, sort_order
  ) VALUES
    (cid, 'بیلبورد میدان ونک', 'نصب در محور اصلی شمال تهران', 'تهران', 'میدان ونک، خیابان ملاصدرا', '2025-04-10', 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=300&fit=crop', 'https://example.com/billboard/1', 'completed', ARRAY['شمال', 'اصلی'], 'نصب با موفقیت انجام شد', true, 1),
    (cid, 'بیلبورد بلوار کشاورز', NULL, 'تهران', 'بلوار کشاورز', '2025-04-15', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop', 'https://example.com/billboard/2', 'completed', ARRAY['مرکز'], NULL, true, 2);

  INSERT INTO media_categories (campaign_id, type, title, sort_order, published)
  VALUES (cid, 'poster', 'پوستر اصلی', 1, true)
  RETURNING id INTO pc1;

  INSERT INTO media_categories (campaign_id, type, title, sort_order, published)
  VALUES (cid, 'poster', 'پوستر استوری', 2, true)
  RETURNING id INTO pc2;

  INSERT INTO media_categories (campaign_id, type, title, sort_order, published)
  VALUES (cid, 'video', 'ویدیو تیزر', 1, true)
  RETURNING id INTO vc1;

  INSERT INTO posters (campaign_id, category_id, title, description, published, sort_order)
  VALUES (cid, pc1, 'پوستر کمپین تابستان', 'طراحی اصلی', true, 1)
  RETURNING id INTO p1;

  INSERT INTO posters (campaign_id, category_id, title, published, sort_order)
  VALUES (cid, pc2, 'استوری معرفی محصول', true, 1)
  RETURNING id INTO p2;

  INSERT INTO poster_versions (poster_id, version_number, image_url, thumbnail_url, notes, status, is_final, date) VALUES
    (p1, 1, 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=1000&fit=crop', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=250&fit=crop', 'نسخه اولیه', 'draft', false, '2025-03-25'),
    (p1, 2, 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&h=1000&fit=crop', 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&h=250&fit=crop', 'اصلاح رنگ', 'revised', false, '2025-04-01'),
    (p1, 3, 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&h=1000&fit=crop', 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=200&h=250&fit=crop', 'نسخه نهایی', 'final', true, '2025-04-10'),
    (p2, 1, 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=700&fit=crop', 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=175&fit=crop', 'استوری نهایی', 'final', true, '2025-04-05');

  INSERT INTO videos (campaign_id, category_id, title, published, sort_order)
  VALUES (cid, vc1, 'تیزر ۳۰ ثانیه‌ای', true, 1)
  RETURNING id INTO v1;

  INSERT INTO video_versions (video_id, version_number, video_url, thumbnail_url, duration, notes, status, is_final, date) VALUES
    (v1, 1, 'https://www.w3schools.com/html/mov_bbb.mp4', 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=225&fit=crop', '0:30', 'اولیه', 'draft', false, '2025-03-28'),
    (v1, 2, 'https://www.w3schools.com/html/mov_bbb.mp4', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b9?w=400&h=225&fit=crop', '0:30', 'نهایی', 'final', true, '2025-04-12');

  INSERT INTO analytics_metrics (
    campaign_id, date, visitors, unique_visitors, page_views,
    avg_session_duration, source, device, page, city
  ) VALUES
    (cid, CURRENT_DATE - 13, 800, 600, 1200, 120, 'instagram', 'mobile', '/', 'تهران'),
    (cid, CURRENT_DATE - 12, 920, 710, 1350, 130, 'telegram', 'desktop', '/about', 'مشهد'),
    (cid, CURRENT_DATE - 11, 880, 650, 1280, 125, 'direct', 'tablet', '/contact', 'اصفهان'),
    (cid, CURRENT_DATE - 10, 950, 720, 1400, 140, 'google', 'mobile', '/campaign', 'شیراز'),
    (cid, CURRENT_DATE - 9, 870, 640, 1260, 118, 'referral', 'desktop', '/', 'تبریز'),
    (cid, CURRENT_DATE - 8, 910, 680, 1320, 135, 'other', 'mobile', '/about', 'تهران'),
    (cid, CURRENT_DATE - 7, 890, 660, 1290, 128, 'instagram', 'tablet', '/contact', 'مشهد'),
    (cid, CURRENT_DATE - 6, 930, 700, 1380, 132, 'telegram', 'mobile', '/campaign', 'اصفهان'),
    (cid, CURRENT_DATE - 5, 860, 630, 1240, 122, 'direct', 'desktop', '/', 'شیراز'),
    (cid, CURRENT_DATE - 4, 940, 730, 1420, 138, 'google', 'mobile', '/about', 'تبریز'),
    (cid, CURRENT_DATE - 3, 900, 670, 1310, 130, 'referral', 'tablet', '/contact', 'تهران'),
    (cid, CURRENT_DATE - 2, 920, 690, 1360, 134, 'other', 'desktop', '/campaign', 'مشهد'),
    (cid, CURRENT_DATE - 1, 880, 650, 1270, 126, 'instagram', 'mobile', '/', 'اصفهان'),
    (cid, CURRENT_DATE, 960, 740, 1440, 142, 'telegram', 'mobile', '/about', 'شیراز');

  INSERT INTO campaign_submissions (
    campaign_id, submission_type, participant_name, participant_phone,
    participant_email, title, text, media_url, status, published
  ) VALUES
    (cid, 'عکس با محصول', 'علی محمدی', '09121234567', 'ali@example.com', 'عکس در پارک', 'عکس گرفتم با محصول کمپین در پارک ملت', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop', 'approved', true),
    (cid, 'ویدیو کوتاه', 'ناشناس', NULL, NULL, 'ویدیو معرفی', 'یک ویدیو کوتاه از تجربه استفاده از محصول', NULL, 'approved', true);
END $$;
