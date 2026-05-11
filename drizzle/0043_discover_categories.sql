-- ---------------------------------------------------------------------------
-- Discover Categories table (replaces the hardcoded DISCOVER_CATEGORIES
-- constant in src/lib/discover.ts). Admin-editable via /admin/categories.
--
-- Slug is the stable identifier persisted in profiles.discover_category.
-- Slug renames are handled transactionally in the admin action: both the
-- discover_categories row and all referencing profiles rows are updated.
--
-- icon_key matches the link-icon system (e.g. "t:music", "t:star").
-- sort_order drives display order in pickers and the Discover directory.
-- ---------------------------------------------------------------------------
CREATE TABLE "discover_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"icon_key" text DEFAULT 't:star' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE UNIQUE INDEX "discover_categories_slug_idx" ON "discover_categories" ("slug");
-->statement-breakpoint
CREATE INDEX "discover_categories_sort_idx" ON "discover_categories" ("sort_order") WHERE "is_active" = true;
-->statement-breakpoint
-- Seed initial categories from the previously-hardcoded list
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
