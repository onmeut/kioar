-- Page customization (theme + wallpaper) lives in a single jsonb blob on
-- the profile (page) row. Nullable: existing rows stay null and the
-- renderer falls back to DEFAULT_APPEARANCE so visuals don't change for
-- anyone until the page owner opts in via the design panel.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "appearance" jsonb;
