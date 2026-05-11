-- 0045_backfill_missing_data.sql
--
-- Replays data migrations that were skipped on production because
-- 0040/0042/0043 had backdated timestamps and were bypassed when
-- 0044 was applied first.
--
-- All statements are idempotent.

-- ── 0042: Backfill qr_code_customization entitlements ──────────────────────
INSERT INTO "page_entitlements" ("page_id", "feature_key", "source")
SELECT s."page_id", f."key", 'subscription'
FROM "page_subscriptions" s
JOIN "plan_features" pf ON pf."plan_id" = s."plan_id"
JOIN "features" f       ON f."id" = pf."feature_id"
WHERE f."key" = 'qr_code_customization'
ON CONFLICT ("page_id", "feature_key") DO NOTHING;
--> statement-breakpoint

-- ── 0043: Seed discover_categories (table already exists from 0044) ─────────
INSERT INTO "discover_categories" ("slug", "label", "icon_key", "sort_order") VALUES
  ('music',           'موسیقی',                    't:music',        0),
  ('design',          'طراحی',                     't:palette',      1),
  ('education',       'آموزش',                     't:book',         2),
  ('coaching',        'کوچینگ',                    't:target',       3),
  ('shop',            'فروشگاه',                   't:shopping-bag', 4),
  ('restaurant',      'رستوران',                   't:soup',         5),
  ('doctor',          'پزشک',                      't:stethoscope',  6),
  ('lawyer',          'وکیل',                      't:scale',        7),
  ('consultant',      'مشاور',                     't:briefcase',    8),
  ('blogger',         'بلاگر',                     't:pencil',       9),
  ('athlete',         'ورزشکار',                   't:run',          10),
  ('photographer',    'عکاس',                      't:camera',       11),
  ('developer',       'برنامه‌نویس',               't:code',         12),
  ('salon',           'آرایشگاه',                  't:scissors',     13),
  ('content_creator', 'محتواساز',                  't:video',        14),
  ('fitness',         'ورزش و تناسب‌اندام',        't:barbell',      15),
  ('beauty',          'زیبایی و آرایش',            't:sparkles',     16),
  ('travel',          'سفر و گردشگری',             't:plane',        17),
  ('food',            'آشپزی و غذا',               't:chef-hat',     18),
  ('psychology',      'روانشناس',                  't:brain',        19),
  ('artist',          'هنرمند',                    't:brush',        20),
  ('writer',          'نویسنده',                   't:notebook',     21),
  ('financial',       'مشاور مالی',                't:coin',         22),
  ('real_estate',     'مشاور مسکن',                't:building',     23),
  ('cafe',            'کافه',                      't:coffee',       24),
  ('architect',       'معمار و دکوراسیون',         't:building-arch',25),
  ('event',           'رویداد و مراسم',            't:confetti',     26),
  ('nonprofit',       'خیریه و سازمان مردم‌نهاد', 't:heart-handshake', 27),
  ('other',           'سایر',                      't:star',         28)
ON CONFLICT ("slug") DO NOTHING;
