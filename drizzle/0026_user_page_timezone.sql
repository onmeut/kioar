-- Phase: timezone — add IANA timezone columns to users, profiles, bookings.
-- All values are stored as IANA names (e.g. "Asia/Tehran"), never offsets.
-- Nullable on existing tables; display falls back to detected zone or
-- Asia/Tehran when null.

ALTER TABLE "users" ADD COLUMN "timezone" text;
ALTER TABLE "profiles" ADD COLUMN "timezone" text;
ALTER TABLE "bookings" ADD COLUMN "host_timezone" text;
