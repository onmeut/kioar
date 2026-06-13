-- Add aspect-ratio and crop-window columns to profile_media_items.
-- All columns are nullable: existing rows have no metadata, and non-image
-- items never need them. Crop coordinates are relative [0,1] so they survive
-- image URL changes.
ALTER TABLE "profile_media_items"
  ADD COLUMN IF NOT EXISTS "aspect_ratio_w" integer,
  ADD COLUMN IF NOT EXISTS "aspect_ratio_h" integer,
  ADD COLUMN IF NOT EXISTS "crop_x" double precision,
  ADD COLUMN IF NOT EXISTS "crop_y" double precision,
  ADD COLUMN IF NOT EXISTS "crop_w" double precision,
  ADD COLUMN IF NOT EXISTS "crop_h" double precision;
