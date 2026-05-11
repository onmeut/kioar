-- ---------------------------------------------------------------------------
-- 0046_industries_categories
-- ---------------------------------------------------------------------------
-- Two-level taxonomy (industries → categories) sourced from Instagram's 2026
-- category list adapted for Iran. Replaces the flat `discover_categories`
-- table (29 rows) with 27 industries and ~190 categories.
--
-- Account-type ("personal" / "business") is per-category. Industries record
-- which account-types they contain so onboarding can filter chips by the
-- user's selected page type.
--
-- profiles.discover_category continues to store a slug — it now points at
-- categories.slug instead of discover_categories.slug. Existing slugs are
-- remapped in-place so live profiles continue to render their category.
--
-- Generated from scripts/build-categories-seed.ts on 2026-05-11T21:01:18.093Z.
-- ---------------------------------------------------------------------------

CREATE TABLE "industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_fa" text NOT NULL,
	"title_en" text NOT NULL,
	"icon_key" text DEFAULT 't:star' NOT NULL,
	"account_types" text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE UNIQUE INDEX "industries_slug_idx" ON "industries" ("slug");
-->statement-breakpoint
CREATE INDEX "industries_sort_idx" ON "industries" ("sort_order") WHERE "is_active" = true;
-->statement-breakpoint

CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry_id" uuid NOT NULL REFERENCES "industries"("id") ON DELETE RESTRICT,
	"slug" text NOT NULL,
	"title_fa" text NOT NULL,
	"title_en" text NOT NULL,
	"icon_key" text DEFAULT 't:star' NOT NULL,
	"account_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_account_type_check"
		CHECK ("account_type" IN ('personal','business'))
);
-->statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" ("slug");
-->statement-breakpoint
CREATE INDEX "categories_industry_account_sort_idx"
	ON "categories" ("industry_id","account_type","sort_order")
	WHERE "is_active" = true;
-->statement-breakpoint

-- Seed industries -----------------------------------------------------------
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('creator','سازندگان محتوا','Creator','t:video',ARRAY['personal']::text[],0,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('arts-entertainment','هنر و سرگرمی','Arts & Entertainment','t:palette',ARRAY['personal']::text[],10,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('food-beverage','غذا و نوشیدنی','Food & Beverage','t:chef-hat',ARRAY['business','personal']::text[],20,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('beauty','زیبایی','Beauty','t:sparkles',ARRAY['business','personal']::text[],30,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('agencies-marketing','آژانس و بازاریابی','Agencies & Marketing','t:speakerphone',ARRAY['business']::text[],40,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('real-estate','املاک','Real Estate','t:building',ARRAY['business']::text[],50,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('retail','فروشگاه','Retail','t:shopping-bag',ARRAY['business']::text[],60,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('technology','فناوری اطلاعات','Technology','t:code',ARRAY['business']::text[],70,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('fashion','مد و پوشاک','Fashion','t:shirt',ARRAY['business','personal']::text[],80,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('education','آموزش','Education','t:book',ARRAY['business','personal']::text[],90,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('finance','امور مالی','Finance','t:coin',ARRAY['business','personal']::text[],100,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('gaming-tech','بازی و فناوری','Gaming & Tech','t:dice',ARRAY['personal']::text[],110,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('health-medical','پزشکی و سلامت','Health & Medical','t:stethoscope',ARRAY['business','personal']::text[],120,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('professional-services','خدمات تخصصی','Professional Services','t:briefcase',ARRAY['business','personal']::text[],130,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('home-services','خدمات منزل','Home Services','t:home',ARRAY['business']::text[],140,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('automotive','خودرو','Automotive','t:car',ARRAY['business']::text[],150,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('community-nonprofit','خیریه و انجمن','Community & Nonprofit','t:heart',ARRAY['business']::text[],160,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('media','رسانه','Media','t:news',ARRAY['business']::text[],170,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('events','رویدادها','Events','t:confetti',ARRAY['business']::text[],180,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('lifestyle','سبک زندگی','Lifestyle','t:heart',ARRAY['personal']::text[],190,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('entertainment','سرگرمی','Entertainment','t:confetti',ARRAY['business']::text[],200,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('travel-tourism','سفر و گردشگری','Travel & Tourism','t:plane',ARRAY['business']::text[],210,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('health-wellness','سلامت و تندرستی','Health & Wellness','t:yoga',ARRAY['personal']::text[],220,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('design-creative','طراحی و خلاقیت','Design & Creative','t:palette',ARRAY['personal']::text[],230,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('business-professional','کسب‌وکار و حرفه‌ای','Business & Professional','t:briefcase',ARRAY['business','personal']::text[],240,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('agriculture','کشاورزی','Agriculture','t:plant',ARRAY['business']::text[],250,true);
INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ('sports-fitness','ورزش و تناسب اندام','Sports & Fitness','t:basketball',ARRAY['business','personal']::text[],260,true);
-->statement-breakpoint
-- Seed categories -----------------------------------------------------------
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'blogger', 'بلاگر', 'Blogger', 't:pencil', 'personal', 0, true FROM "industries" WHERE "slug" = 'creator';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'public-figure', 'چهره عمومی', 'Public Figure', 't:user', 'personal', 10, true FROM "industries" WHERE "slug" = 'creator';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'digital-creator', 'سازنده محتوای دیجیتال', 'Digital Creator', 't:video', 'personal', 20, true FROM "industries" WHERE "slug" = 'creator';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'entrepreneur', 'کارآفرین', 'Entrepreneur', 't:rocket', 'personal', 30, true FROM "industries" WHERE "slug" = 'creator';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'personal-blog', 'وبلاگ شخصی', 'Personal Blog', 't:pencil', 'personal', 40, true FROM "industries" WHERE "slug" = 'creator';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'author-writer', 'نویسنده کتاب', 'Author / Writer', 't:book', 'personal', 50, true FROM "industries" WHERE "slug" = 'creator';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'actor', 'بازیگر', 'Actor', 't:user', 'personal', 0, true FROM "industries" WHERE "slug" = 'arts-entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'photographer', 'عکاس', 'Photographer', 't:camera', 'personal', 10, true FROM "industries" WHERE "slug" = 'arts-entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'comedian', 'کمدین', 'Comedian', 't:smile', 'personal', 20, true FROM "industries" WHERE "slug" = 'arts-entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'musician-band', 'نوازنده / گروه موسیقی', 'Musician / Band', 't:music', 'personal', 30, true FROM "industries" WHERE "slug" = 'arts-entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'artist', 'هنرمند', 'Artist', 't:palette', 'personal', 40, true FROM "industries" WHERE "slug" = 'arts-entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'band', 'گروه موسیقی', 'Band', 't:music', 'personal', 50, true FROM "industries" WHERE "slug" = 'arts-entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'painter', 'نقاش', 'Painter', 't:palette', 'personal', 60, true FROM "industries" WHERE "slug" = 'arts-entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'restaurant', 'رستوران', 'Restaurant', 't:soup', 'business', 0, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'homemade-food', 'غذای خانگی', 'Homemade Food', 't:chef-hat', 'business', 10, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'coffee-shop', 'کافی‌شاپ', 'Coffee Shop', 't:coffee', 'business', 20, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'bakery', 'نانوایی و شیرینی‌پزی', 'Bakery', 't:cake', 'business', 30, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'ice-cream-shop', 'بستنی‌فروشی', 'Ice Cream Shop', 't:ice-cream', 'business', 40, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'pizza-place', 'پیتزافروشی', 'Pizza Place', 't:pizza', 'business', 50, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'dessert-shop', 'دسرفروشی', 'Dessert Shop', 't:cake', 'business', 60, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'japanese-restaurant', 'رستوران ژاپنی', 'Japanese Restaurant', 't:soup', 'business', 70, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'barbecue-restaurant', 'رستوران کبابی', 'Barbecue Restaurant', 't:meat', 'business', 80, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'mediterranean-restaurant', 'رستوران مدیترانه‌ای', 'Mediterranean Restaurant', 't:soup', 'business', 90, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'indian-restaurant', 'رستوران هندی', 'Indian Restaurant', 't:soup', 'business', 100, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'chef', 'سرآشپز', 'Chef', 't:chef-hat', 'personal', 110, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'chocolate-shop', 'شکلات‌فروشی', 'Chocolate Shop', 't:candy', 'business', 120, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'confectionery', 'شیرینی‌فروشی', 'Confectionery', 't:cake', 'business', 130, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'food-and-beverage', 'غذا و نوشیدنی', 'Food & Beverage', 't:soup', 'business', 140, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'fast-food-restaurant', 'فست‌فود', 'Fast Food Restaurant', 't:burger', 'business', 150, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'cafe', 'کافه', 'Cafe', 't:coffee', 'business', 160, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'chicken-joint', 'مرغ‌سرا', 'Chicken Joint', 't:meat', 'business', 170, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'argentinian-restaurant', 'رستوران آرژانتینی', 'Argentinian Restaurant', 't:soup', 'business', 180, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'asian-fusion-restaurant', 'رستوران آسیایی فیوژن', 'Asian Fusion Restaurant', 't:soup', 'business', 190, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'african-restaurant', 'رستوران آفریقایی', 'African Restaurant', 't:soup', 'business', 200, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'australian-restaurant', 'رستوران استرالیایی', 'Australian Restaurant', 't:soup', 'business', 210, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'buffet-restaurant', 'رستوران بوفه', 'Buffet Restaurant', 't:soup', 'business', 220, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'thai-restaurant', 'رستوران تایلندی', 'Thai Restaurant', 't:soup', 'business', 230, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'chinese-restaurant', 'رستوران چینی', 'Chinese Restaurant', 't:soup', 'business', 240, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'health-food-restaurant', 'رستوران غذای سالم', 'Health Food Restaurant', 't:salad', 'business', 250, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'canadian-restaurant', 'رستوران کانادایی', 'Canadian Restaurant', 't:soup', 'business', 260, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'korean-restaurant', 'رستوران کره‌ای', 'Korean Restaurant', 't:soup', 'business', 270, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'colombian-restaurant', 'رستوران کلمبیایی', 'Colombian Restaurant', 't:soup', 'business', 280, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'butcher-shop', 'قصابی', 'Butcher Shop', 't:meat', 'business', 290, true FROM "industries" WHERE "slug" = 'food-beverage';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'hair-salon', 'آرایشگاه', 'Hair Salon', 't:scissors', 'business', 0, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'beauty-salon', 'سالن زیبایی', 'Beauty Salon', 't:sparkles', 'business', 10, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'photo-studio', 'آتلیه عکاسی', 'Photo Studio', 't:camera', 'business', 20, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'makeup-artist', 'آرایشگر', 'Makeup Artist', 't:sparkles', 'personal', 30, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'spa', 'اسپا', 'Spa', 't:yoga', 'business', 40, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'tattoo-and-piercing-shop', 'تتو و پیرسینگ', 'Tattoo & Piercing Shop', 't:sparkles', 'business', 50, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'barber-shop', 'سلمانی', 'Barber Shop', 't:scissors', 'business', 60, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'nail-salon', 'ناخن‌کاری', 'Nail Salon', 't:sparkles', 'business', 70, true FROM "industries" WHERE "slug" = 'beauty';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'marketing-agency', 'آژانس بازاریابی', 'Marketing Agency', 't:speakerphone', 'business', 0, true FROM "industries" WHERE "slug" = 'agencies-marketing';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'brand-agency', 'آژانس برندینگ', 'Brand Agency', 't:sparkles', 'business', 10, true FROM "industries" WHERE "slug" = 'agencies-marketing';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'advertising-agency', 'آژانس تبلیغاتی', 'Advertising Agency', 't:speakerphone', 'business', 20, true FROM "industries" WHERE "slug" = 'agencies-marketing';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'printing-and-advertising', 'چاپ و تبلیغات', 'Printing & Advertising', 't:printer', 'business', 30, true FROM "industries" WHERE "slug" = 'agencies-marketing';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'internet-marketing-service', 'خدمات بازاریابی آنلاین', 'Internet Marketing Service', 't:world', 'business', 40, true FROM "industries" WHERE "slug" = 'agencies-marketing';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'real-estate-company', 'املاک', 'Real Estate Company', 't:building', 'business', 0, true FROM "industries" WHERE "slug" = 'real-estate';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'apartment-and-condo-building', 'ساختمان مسکونی', 'Apartment & Condo Building', 't:building', 'business', 10, true FROM "industries" WHERE "slug" = 'real-estate';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'e-commerce-website', 'فروشگاه اینترنتی', 'E-Commerce Website', 't:shopping-cart', 'business', 0, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'candy-store', 'آبنبات‌فروشی', 'Candy Store', 't:candy', 'business', 10, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'baby-and-childrens-clothing-store', 'پوشاک نوزاد و کودک', 'Baby & Children''s Clothing Store', 't:baby', 'business', 20, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'jewelry-watches', 'جواهرات و ساعت', 'Jewelry / Watches', 't:diamond', 'business', 30, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'shopping-and-retail', 'خرید و خرده‌فروشی', 'Shopping & Retail', 't:shopping-bag', 'business', 40, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'grocery-store', 'خواربارفروشی', 'Grocery Store', 't:shopping-cart', 'business', 50, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'supermarket', 'سوپرمارکت', 'Supermarket', 't:shopping-cart', 'business', 60, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'gold-and-jewelry-store', 'طلا و جواهرفروشی', 'Gold & Jewelry Store', 't:diamond', 'business', 70, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'pet-store', 'فروشگاه حیوانات خانگی', 'Pet Store', 't:paw', 'business', 80, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'gift-shop', 'فروشگاه هدایا', 'Gift Shop', 't:gift', 'business', 90, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'footwear-store', 'کفش‌فروشی', 'Footwear Store', 't:shopping-bag', 'business', 100, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'bags-and-luggage-store', 'کیف و چمدان', 'Bags & Luggage Store', 't:backpack', 'business', 110, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'florist', 'گل‌فروشی', 'Florist', 't:flower', 'business', 120, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'hardware-store', 'ابزارفروشی', 'Hardware Store', 't:tools', 'business', 130, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'accessories', 'اکسسوری', 'Accessories', 't:diamond', 'business', 140, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'fabric-store', 'پارچه‌فروشی', 'Fabric Store', 't:shopping-bag', 'business', 150, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'garden-center', 'تجهیزات باغبانی', 'Garden Center', 't:plant', 'business', 160, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'antique-store', 'عتیقه‌فروشی', 'Antique Store', 't:archive', 'business', 170, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'discount-store', 'فروشگاه تخفیف', 'Discount Store', 't:tag', 'business', 180, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'camera-store', 'فروشگاه دوربین', 'Camera Store', 't:camera', 'business', 190, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'organic-grocery-store', 'فروشگاه مواد ارگانیک', 'Organic Grocery Store', 't:salad', 'business', 200, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'vintage-store', 'فروشگاه وینتیج', 'Vintage Store', 't:archive', 'business', 210, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'bookstore', 'کتاب‌فروشی', 'Bookstore', 't:book', 'business', 220, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'baby-goods-kids-goods', 'لوازم کودک و نوزاد', 'Baby Goods / Kids Goods', 't:baby', 'business', 230, true FROM "industries" WHERE "slug" = 'retail';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'software-company', 'شرکت نرم‌افزاری', 'Software Company', 't:code', 'business', 0, true FROM "industries" WHERE "slug" = 'technology';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'tech-company', 'شرکت فناوری', 'Tech Company', 't:devices', 'business', 10, true FROM "industries" WHERE "slug" = 'technology';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'app-page', 'اپلیکیشن', 'App Page', 't:mobile', 'business', 20, true FROM "industries" WHERE "slug" = 'technology';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'biotechnology-company', 'شرکت بیوتکنولوژی', 'Biotechnology Company', 't:dna', 'business', 30, true FROM "industries" WHERE "slug" = 'technology';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'clothing-brand', 'برند پوشاک', 'Clothing (Brand)', 't:shirt', 'business', 0, true FROM "industries" WHERE "slug" = 'fashion';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'apparel-distributor', 'پخش پوشاک', 'Apparel Distributor', 't:package', 'business', 10, true FROM "industries" WHERE "slug" = 'fashion';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'womens-clothing-store', 'پوشاک زنانه', 'Women''s Clothing Store', 't:shirt', 'business', 20, true FROM "industries" WHERE "slug" = 'fashion';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'tailor', 'خیاطی', 'Tailor', 't:scissors', 'business', 30, true FROM "industries" WHERE "slug" = 'fashion';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'fashion-designer', 'طراح مد', 'Fashion Designer', 't:shirt', 'personal', 40, true FROM "industries" WHERE "slug" = 'fashion';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'clothing-store', 'فروشگاه پوشاک', 'Clothing Store', 't:shirt', 'business', 50, true FROM "industries" WHERE "slug" = 'fashion';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'dance-school', 'آموزشگاه رقص', 'Dance School', 't:music', 'business', 0, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'online-tutor', 'تدریس خصوصی', 'Online Tutor', 't:book', 'personal', 10, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'education', 'آموزش عمومی', 'Education', 't:school', 'business', 20, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'driving-school', 'آموزشگاه رانندگی', 'Driving School', 't:car', 'business', 30, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'language-school', 'آموزشگاه زبان', 'Language School', 't:book', 'business', 40, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'child-care-service', 'خدمات نگهداری کودک', 'Child Care Service', 't:baby', 'business', 50, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'university', 'دانشگاه', 'University', 't:school', 'business', 60, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'college-and-university', 'کالج و دانشگاه', 'College & University', 't:school', 'business', 70, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'library', 'کتابخانه', 'Library', 't:book', 'business', 80, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'school', 'مدرسه', 'School', 't:school', 'business', 90, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'teacher-educator', 'معلم', 'Teacher / Educator', 't:school', 'personal', 100, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'day-care', 'مهدکودک', 'Day Care', 't:baby', 'business', 110, true FROM "industries" WHERE "slug" = 'education';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'bank', 'بانک', 'Bank', 't:cash', 'business', 0, true FROM "industries" WHERE "slug" = 'finance';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'retail-bank', 'بانک خرد', 'Retail Bank', 't:cash', 'business', 10, true FROM "industries" WHERE "slug" = 'finance';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'investment-bank', 'بانک سرمایه‌گذاری', 'Investment Bank', 't:chart-line', 'business', 20, true FROM "industries" WHERE "slug" = 'finance';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'finance-company', 'شرکت مالی', 'Finance Company', 't:chart-line', 'business', 30, true FROM "industries" WHERE "slug" = 'finance';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'credit-union', 'صندوق اعتباری', 'Credit Union', 't:cash', 'business', 40, true FROM "industries" WHERE "slug" = 'finance';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'financial-consultant', 'مشاور مالی', 'Financial Consultant', 't:coin', 'personal', 50, true FROM "industries" WHERE "slug" = 'finance';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'gamer', 'گیمر', 'Gamer', 't:dice', 'personal', 0, true FROM "industries" WHERE "slug" = 'gaming-tech';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'veterinarian', 'دامپزشک', 'Veterinarian', 't:dog', 'business', 0, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'dentist', 'دندان‌پزشک', 'Dentist', 't:stethoscope', 'business', 10, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'cosmetic-dentist', 'دندان‌پزشک زیبایی', 'Cosmetic Dentist', 't:stethoscope', 'business', 20, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'medical-center', 'مرکز درمانی', 'Medical Center', 't:stethoscope', 'business', 30, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'optometrist', 'بینایی‌سنج', 'Optometrist', 't:eye', 'personal', 40, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'doctor', 'پزشک', 'Doctor', 't:stethoscope', 'personal', 50, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'family-doctor', 'پزشک خانواده', 'Family Doctor', 't:stethoscope', 'personal', 60, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'audiologist', 'شنوایی‌سنج', 'Audiologist', 't:stethoscope', 'personal', 70, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'physical-therapist', 'فیزیوتراپ', 'Physical Therapist', 't:stethoscope', 'personal', 80, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'occupational-therapist', 'کاردرمانگر', 'Occupational Therapist', 't:stethoscope', 'personal', 90, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'chiropractor', 'کایروپراکتیک', 'Chiropractor', 't:stethoscope', 'personal', 100, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'allergist', 'متخصص آلرژی', 'Allergist', 't:stethoscope', 'personal', 110, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'family-medicine-practice', 'مطب پزشک خانواده', 'Family Medicine Practice', 't:stethoscope', 'business', 120, true FROM "industries" WHERE "slug" = 'health-medical';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'engineering-service', 'خدمات مهندسی', 'Engineering Service', 't:tools', 'business', 0, true FROM "industries" WHERE "slug" = 'professional-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'environmental-consultant', 'مشاور محیط‌زیست', 'Environmental Consultant', 't:leaf', 'personal', 10, true FROM "industries" WHERE "slug" = 'professional-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'lawyer', 'وکیل', 'Lawyer', 't:briefcase', 'personal', 20, true FROM "industries" WHERE "slug" = 'professional-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'lawyer-and-law-firm', 'وکیل و دفتر حقوقی', 'Lawyer & Law Firm', 't:briefcase', 'business', 30, true FROM "industries" WHERE "slug" = 'professional-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'cleaning-service', 'خدمات نظافت', 'Cleaning Service', 't:droplet', 'business', 0, true FROM "industries" WHERE "slug" = 'home-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'landscape-company', 'محوطه‌سازی', 'Landscape Company', 't:plant', 'business', 10, true FROM "industries" WHERE "slug" = 'home-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'kitchen-and-bath-contractor', 'پیمانکار آشپزخانه و حمام', 'Kitchen & Bath Contractor', 't:tools', 'business', 20, true FROM "industries" WHERE "slug" = 'home-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'appliance-repair-service', 'تعمیر لوازم خانگی', 'Appliance Repair Service', 't:tools', 'business', 30, true FROM "industries" WHERE "slug" = 'home-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'dry-cleaner', 'خشک‌شویی', 'Dry Cleaner', 't:droplet', 'business', 40, true FROM "industries" WHERE "slug" = 'home-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'construction-company', 'شرکت ساختمانی', 'Construction Company', 't:hammer', 'business', 50, true FROM "industries" WHERE "slug" = 'home-services';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'car-wash-and-detailing', 'کارواش', 'Car Wash & Detailing', 't:droplet', 'business', 0, true FROM "industries" WHERE "slug" = 'automotive';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'car-dealership', 'نمایشگاه خودرو', 'Car Dealership', 't:car', 'business', 10, true FROM "industries" WHERE "slug" = 'automotive';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'exotic-car-rental', 'اجاره خودروی لوکس', 'Exotic Car Rental', 't:car', 'business', 20, true FROM "industries" WHERE "slug" = 'automotive';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'gas-station', 'پمپ‌بنزین', 'Gas Station', 't:fire-extinguisher', 'business', 30, true FROM "industries" WHERE "slug" = 'automotive';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'automotive-repair-shop', 'تعمیرگاه خودرو', 'Automotive Repair Shop', 't:tools', 'business', 40, true FROM "industries" WHERE "slug" = 'automotive';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'nonprofit-organization', 'سازمان مردم‌نهاد', 'Nonprofit Organization', 't:heart', 'business', 0, true FROM "industries" WHERE "slug" = 'community-nonprofit';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'community-organization', 'سازمان مردمی', 'Community Organization', 't:users', 'business', 10, true FROM "industries" WHERE "slug" = 'community-nonprofit';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'christian-church', 'کلیسا', 'Christian Church', 't:heart', 'business', 20, true FROM "industries" WHERE "slug" = 'community-nonprofit';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'recycling-center', 'مرکز بازیافت', 'Recycling Center', 't:refresh', 'business', 30, true FROM "industries" WHERE "slug" = 'community-nonprofit';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'media-company', 'شرکت رسانه‌ای', 'Media Company', 't:news', 'business', 0, true FROM "industries" WHERE "slug" = 'media';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'magazine', 'مجله', 'Magazine', 't:news', 'business', 10, true FROM "industries" WHERE "slug" = 'media';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'publishing-company', 'انتشارات', 'Publishing Company', 't:book', 'business', 20, true FROM "industries" WHERE "slug" = 'media';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'newspaper', 'روزنامه', 'Newspaper', 't:news', 'business', 30, true FROM "industries" WHERE "slug" = 'media';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'event-planner', 'برگزارکننده رویداد', 'Event Planner', 't:confetti', 'business', 0, true FROM "industries" WHERE "slug" = 'events';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'wedding-hall', 'تالار عروسی', 'Wedding Hall', 't:confetti', 'business', 10, true FROM "industries" WHERE "slug" = 'events';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'wedding-planning-service', 'خدمات برگزاری عروسی', 'Wedding Planning Service', 't:confetti', 'business', 20, true FROM "industries" WHERE "slug" = 'events';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'astrologist-and-psychic', 'فال‌گیر و طالع‌بین', 'Astrologist & Psychic', 't:moon', 'personal', 0, true FROM "industries" WHERE "slug" = 'lifestyle';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'life-coach', 'کوچ زندگی', 'Life Coach', 't:target', 'personal', 10, true FROM "industries" WHERE "slug" = 'lifestyle';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'comedy-club', 'کلوب کمدی', 'Comedy Club', 't:smile', 'business', 0, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'talent-agency', 'آژانس استعدادیابی', 'Talent Agency', 't:sparkles', 'business', 10, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'aquarium', 'آکواریوم', 'Aquarium', 't:fish', 'business', 20, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'escape-game-room', 'اتاق فرار', 'Escape Game Room', 't:puzzle', 'business', 30, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'board-game', 'بازی رومیزی', 'Board Game', 't:dice', 'business', 40, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'botanical-garden', 'باغ گیاه‌شناسی', 'Botanical Garden', 't:plant', 'business', 50, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'zoo', 'باغ وحش', 'Zoo', 't:paw', 'business', 60, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'theme-park', 'پارک موضوعی', 'Theme Park', 't:confetti', 'business', 70, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'race-track', 'پیست مسابقه', 'Race Track', 't:flag', 'business', 80, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'concert-tour', 'تور کنسرت', 'Concert Tour', 't:music', 'business', 90, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'entertainment-website', 'وب‌سایت سرگرمی', 'Entertainment Website', 't:world', 'business', 100, true FROM "industries" WHERE "slug" = 'entertainment';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'travel-company-agency', 'آژانس مسافرتی', 'Travel Company / Agency', 't:plane', 'business', 0, true FROM "industries" WHERE "slug" = 'travel-tourism';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'hotel-and-lodging', 'هتل و اقامتگاه', 'Hotel & Lodging', 't:bed', 'business', 10, true FROM "industries" WHERE "slug" = 'travel-tourism';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'sightseeing-tour-agency', 'آژانس تور گردشگری', 'Sightseeing Tour Agency', 't:map', 'business', 20, true FROM "industries" WHERE "slug" = 'travel-tourism';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'vacation-home-rental', 'اجاره خانه ویلایی', 'Vacation Home Rental', 't:home', 'business', 30, true FROM "industries" WHERE "slug" = 'travel-tourism';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'cabin-rental', 'اجاره کلبه جنگلی', 'Cabin Rental', 't:home', 'business', 40, true FROM "industries" WHERE "slug" = 'travel-tourism';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'beach-resort', 'اقامتگاه ساحلی', 'Beach Resort', 't:umbrella', 'business', 50, true FROM "industries" WHERE "slug" = 'travel-tourism';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'national-park', 'پارک ملی', 'National Park', 't:tree', 'business', 60, true FROM "industries" WHERE "slug" = 'travel-tourism';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'health-and-wellness-coach', 'کوچ سلامتی', 'Health & Wellness Coach', 't:target', 'personal', 0, true FROM "industries" WHERE "slug" = 'health-wellness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'aromatherapy-service', 'آروماتراپی', 'Aromatherapy Service', 't:flower', 'personal', 10, true FROM "industries" WHERE "slug" = 'health-wellness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'acupuncturist', 'طب سوزنی', 'Acupuncturist', 't:dna', 'personal', 20, true FROM "industries" WHERE "slug" = 'health-wellness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'alternative-and-holistic-health', 'طب مکمل', 'Alternative & Holistic Health', 't:yoga', 'personal', 30, true FROM "industries" WHERE "slug" = 'health-wellness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'graphic-designer', 'طراح گرافیک', 'Graphic Designer', 't:palette', 'personal', 0, true FROM "industries" WHERE "slug" = 'design-creative';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'event-videographer', 'فیلم‌بردار رویداد', 'Event Videographer', 't:video', 'personal', 10, true FROM "industries" WHERE "slug" = 'design-creative';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'architect-architectural-designer', 'معمار', 'Architect / Architectural Designer', 't:building', 'personal', 20, true FROM "industries" WHERE "slug" = 'design-creative';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'consulting-agency', 'آژانس مشاوره', 'Consulting Agency', 't:briefcase', 'business', 0, true FROM "industries" WHERE "slug" = 'business-professional';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'business-service', 'خدمات کسب‌وکار', 'Business Service', 't:briefcase', 'business', 10, true FROM "industries" WHERE "slug" = 'business-professional';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'industrial-company', 'شرکت صنعتی', 'Industrial Company', 't:building', 'business', 20, true FROM "industries" WHERE "slug" = 'business-professional';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'local-business', 'کسب‌وکار محلی', 'Local Business', 't:briefcase', 'business', 30, true FROM "industries" WHERE "slug" = 'business-professional';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'business-center', 'مرکز تجاری', 'Business Center', 't:building', 'business', 40, true FROM "industries" WHERE "slug" = 'business-professional';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'consultant', 'مشاور', 'Consultant', 't:briefcase', 'personal', 50, true FROM "industries" WHERE "slug" = 'business-professional';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'urban-farm', 'کشاورزی شهری', 'Urban Farm', 't:plant', 'business', 0, true FROM "industries" WHERE "slug" = 'agriculture';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'yoga-studio', 'استودیو یوگا', 'Yoga Studio', 't:yoga', 'business', 0, true FROM "industries" WHERE "slug" = 'sports-fitness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'gym-physical-fitness-center', 'باشگاه ورزشی', 'Gym / Physical Fitness Center', 't:basketball', 'business', 10, true FROM "industries" WHERE "slug" = 'sports-fitness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'fitness-trainer', 'مربی بدنسازی', 'Fitness Trainer', 't:basketball', 'personal', 20, true FROM "industries" WHERE "slug" = 'sports-fitness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'athlete', 'ورزشکار', 'Athlete', 't:trophy', 'personal', 30, true FROM "industries" WHERE "slug" = 'sports-fitness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'sports-league', 'لیگ ورزشی', 'Sports League', 't:trophy', 'business', 40, true FROM "industries" WHERE "slug" = 'sports-fitness';
INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") SELECT id, 'boat-sailing-instructor', 'مربی قایقرانی', 'Boat / Sailing Instructor', 't:sailboat', 'personal', 50, true FROM "industries" WHERE "slug" = 'sports-fitness';
-->statement-breakpoint
-- Remap profiles.discover_category from legacy slugs to new categories.slug.
-- Any old slug with no semantic equivalent (NULL in legacyMap) is cleared.
UPDATE "profiles" SET "discover_category" = 'musician-band' WHERE "discover_category" = 'music';
UPDATE "profiles" SET "discover_category" = 'graphic-designer' WHERE "discover_category" = 'design';
UPDATE "profiles" SET "discover_category" = 'online-tutor' WHERE "discover_category" = 'education';
UPDATE "profiles" SET "discover_category" = 'life-coach' WHERE "discover_category" = 'coaching';
UPDATE "profiles" SET "discover_category" = 'shopping-retail' WHERE "discover_category" = 'shop';
UPDATE "profiles" SET "discover_category" = 'restaurant' WHERE "discover_category" = 'restaurant';
UPDATE "profiles" SET "discover_category" = 'doctor' WHERE "discover_category" = 'doctor';
UPDATE "profiles" SET "discover_category" = 'lawyer' WHERE "discover_category" = 'lawyer';
UPDATE "profiles" SET "discover_category" = 'consultant' WHERE "discover_category" = 'consultant';
UPDATE "profiles" SET "discover_category" = 'blogger' WHERE "discover_category" = 'blogger';
UPDATE "profiles" SET "discover_category" = 'athlete' WHERE "discover_category" = 'athlete';
UPDATE "profiles" SET "discover_category" = 'photographer' WHERE "discover_category" = 'photographer';
UPDATE "profiles" SET "discover_category" = 'software-company' WHERE "discover_category" = 'developer';
UPDATE "profiles" SET "discover_category" = 'hair-salon' WHERE "discover_category" = 'salon';
UPDATE "profiles" SET "discover_category" = 'digital-creator' WHERE "discover_category" = 'content_creator';
UPDATE "profiles" SET "discover_category" = 'gym-physical-fitness-center' WHERE "discover_category" = 'fitness';
UPDATE "profiles" SET "discover_category" = 'beauty-salon' WHERE "discover_category" = 'beauty';
UPDATE "profiles" SET "discover_category" = 'travel-company-agency' WHERE "discover_category" = 'travel';
UPDATE "profiles" SET "discover_category" = 'chef' WHERE "discover_category" = 'food';
UPDATE "profiles" SET "discover_category" = 'therapist' WHERE "discover_category" = 'psychology';
UPDATE "profiles" SET "discover_category" = 'artist' WHERE "discover_category" = 'artist';
UPDATE "profiles" SET "discover_category" = 'writer' WHERE "discover_category" = 'writer';
UPDATE "profiles" SET "discover_category" = 'financial-consultant' WHERE "discover_category" = 'financial';
UPDATE "profiles" SET "discover_category" = 'real-estate-company' WHERE "discover_category" = 'real_estate';
UPDATE "profiles" SET "discover_category" = 'cafe' WHERE "discover_category" = 'cafe';
UPDATE "profiles" SET "discover_category" = 'architect-architectural-designer' WHERE "discover_category" = 'architect';
UPDATE "profiles" SET "discover_category" = 'event-planner' WHERE "discover_category" = 'event';
UPDATE "profiles" SET "discover_category" = 'nonprofit-organization' WHERE "discover_category" = 'nonprofit';
UPDATE "profiles" SET "discover_category" = NULL WHERE "discover_category" = 'other';
-- Any remaining legacy slug (i.e. user-created in admin since launch)
-- that doesn't match a new category gets cleared to avoid dangling refs.
UPDATE "profiles" SET "discover_category" = NULL
	WHERE "discover_category" IS NOT NULL
		AND "discover_category" NOT IN (SELECT "slug" FROM "categories");
-->statement-breakpoint
-- Drop the legacy flat table after backfilling profiles.
DROP TABLE IF EXISTS "discover_categories";
