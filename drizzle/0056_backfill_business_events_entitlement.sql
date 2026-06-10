-- Backfill `business_events` entitlement for all existing Business pages.
--
-- When a new feature is added to the registry AFTER pages already have active
-- subscriptions, `page_entitlements` is not automatically updated. This migration
-- inserts the missing rows so Business-plan pages can use the رویداد block.
--
-- ON CONFLICT DO NOTHING is safe here: if a page somehow already has the row
-- (e.g. via admin_grant), it is left untouched.

w
