-- 0066_backfill_product_block_slugs.sql
-- Assign default slugs to existing product blocks that have none (slug IS NULL).
--
-- Rules (match what product-builder-dialog.tsx now defaults):
--   preset = 'menu'     → slug 'menu'
--   preset = 'services' → slug 'services'
--   preset = 'shop'     → slug 'products'
--   anything else       → skip (packages, portfolio, custom stay inline-only)
--
-- Collision handling: if a profile already has another block occupying the
-- desired slug, append -2, -3, … up to -99. Blocks that still collide after
-- 99 suffixes are left as NULL (extremely unlikely; avoids infinite loops).
--
-- The unique index "profile_product_blocks_profile_slug_idx" enforces
-- per-profile uniqueness with NULLs excluded, so these UPDATEs are safe to
-- run inside a single transaction — later rows in the same profile will see
-- the slugs committed by earlier rows within the same UPDATE pass because
-- we process them via a numbered CTE rather than row-by-row.

DO $$
DECLARE
  suffix  int;
  base    text;
  candidate text;
  rec     RECORD;
BEGIN
  FOR rec IN
    SELECT id, profile_id, preset
    FROM profile_product_blocks
    WHERE slug IS NULL
      AND preset IN ('menu', 'services', 'shop')
    ORDER BY profile_id, sort_order
  LOOP
    base := CASE rec.preset
              WHEN 'menu'     THEN 'menu'
              WHEN 'services' THEN 'services'
              WHEN 'shop'     THEN 'products'
            END;

    -- Try base slug first, then base-2 … base-99.
    candidate := base;
    suffix := 1;
    LOOP
      EXIT WHEN suffix > 99;  -- safety escape

      -- Check collision against ALL blocks on this profile (product + booking).
      IF NOT EXISTS (
        SELECT 1 FROM profile_product_blocks
         WHERE profile_id = rec.profile_id AND slug = candidate
      ) AND NOT EXISTS (
        SELECT 1 FROM profile_booking_blocks
         WHERE profile_id = rec.profile_id AND slug = candidate
      ) THEN
        UPDATE profile_product_blocks
           SET slug = candidate
         WHERE id = rec.id;
        EXIT;  -- done for this block
      END IF;

      suffix := suffix + 1;
      candidate := base || '-' || suffix;
    END LOOP;
  END LOOP;
END $$;
