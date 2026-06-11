-- Fix: use a proper cuid-generated ID instead of the ad-hoc string
-- FK constraints have ON UPDATE CASCADE, so related rows update automatically.
UPDATE "roles"
SET "id" = 'cmq9ubegj000000ucfz0cch31'
WHERE "id" = 'cmq9u7p5pb733f6f1';
