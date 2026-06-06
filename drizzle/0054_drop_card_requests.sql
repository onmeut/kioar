-- Drop the legacy card_requests table and its dedicated enum types.
-- The new physical-card flow uses the `cards` and `card_orders` tables (migration 0053).

DROP TABLE IF EXISTS "card_requests";
DROP TYPE IF EXISTS "card_request_status";
DROP TYPE IF EXISTS "card_type";
DROP TYPE IF EXISTS "card_design";
