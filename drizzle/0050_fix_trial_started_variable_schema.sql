-- Fix: reorder variableSchema for trial_started from ["plan","days"] to
-- ["days","plan"]. Kavenegar's positional tokens are mapped by array index:
--   index 0 → %token  (previously: plan name; now: trial days e.g. 7)
--   index 1 → %token2 (previously: days;      now: plan name e.g. Pro)
-- The kioar-trial-started template on Kavenegar uses %token and expects
-- the trial day count, not the plan name.
UPDATE sms_templates
SET    variable_schema = '["days","plan"]'::jsonb,
       updated_at      = now()
WHERE  key             = 'trial_started'
  AND  variable_schema = '["plan","days"]'::jsonb;
