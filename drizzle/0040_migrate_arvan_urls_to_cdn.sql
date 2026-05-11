-- Migrate all stored ArvanStorage URLs to the new CDN domain.
-- Old prefix: https://s3.ir-thr-at1.arvanstorage.ir/kioar-uploads
-- New prefix: https://cdn.kioar.com/kioar-bucket
-- This is a pure data migration — no schema changes.

DO $$
DECLARE
  old_prefix text := 'https://s3.ir-thr-at1.arvanstorage.ir/kioar-uploads';
  new_prefix text := 'https://cdn.kioar.com/kioar-bucket';
BEGIN
  UPDATE profiles
    SET avatar_url = replace(avatar_url, old_prefix, new_prefix)
    WHERE avatar_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE profiles
    SET og_image_url = replace(og_image_url, old_prefix, new_prefix)
    WHERE og_image_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE profile_links
    SET image_url = replace(image_url, old_prefix, new_prefix)
    WHERE image_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE profile_links
    SET icon_url = replace(icon_url, old_prefix, new_prefix)
    WHERE icon_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE events
    SET cover_url = replace(cover_url, old_prefix, new_prefix)
    WHERE cover_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE profile_booking_blocks
    SET avatar_url = replace(avatar_url, old_prefix, new_prefix)
    WHERE avatar_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE profile_product_blocks
    SET icon_url = replace(icon_url, old_prefix, new_prefix)
    WHERE icon_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE profile_product_blocks
    SET image_url = replace(image_url, old_prefix, new_prefix)
    WHERE image_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';

  UPDATE product_items
    SET image_url = replace(image_url, old_prefix, new_prefix)
    WHERE image_url LIKE 'https://s3.ir-thr-at1.arvanstorage.ir/%';
END;
$$;
