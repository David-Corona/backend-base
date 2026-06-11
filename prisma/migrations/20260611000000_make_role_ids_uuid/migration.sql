-- Replace the hardcoded string ID with a proper UUID
-- The FK constraints have ON UPDATE CASCADE, so users.roleId
-- and role_permissions.roleId are updated automatically.
UPDATE "roles"
SET "id" = 'afb34c4f-5f53-4d1b-ad20-0e01ae067589'
WHERE "id" = 'default-user-role';
