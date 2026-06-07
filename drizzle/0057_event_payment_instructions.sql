-- Add free-text payment instructions for paid events.
--
-- There's no real checkout: paid events show the attendee the amount and the
-- host's own instructions on HOW to pay (card number, contact, etc.). Null for
-- free events or when the host leaves it blank. Rendered on the public payment
-- block alongside the amount.

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "payment_instructions" text;
