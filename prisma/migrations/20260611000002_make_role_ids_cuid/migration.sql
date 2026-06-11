-- Replace the UUID with a CUID for consistency with other tables
-- FK constraints have ON UPDATE CASCADE, so related rows update automatically.
UPDATE "roles"
SET "id" = 'cmq9ubegj000000ucfz0cch31'
WHERE "id" = 'afb34c4f-5f53-4d1b-ad20-0e01ae067589';
