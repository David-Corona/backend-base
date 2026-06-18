-- Add Sessions permissions
INSERT INTO permissions (id, "key", name, description, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'sessions:read', 'Read Sessions', 'View all user sessions', NOW(), NOW()),
  (gen_random_uuid(), 'sessions:terminate', 'Terminate Sessions', 'Terminate any user session', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Assign new permissions to admin role
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p."key" IN ('sessions:read', 'sessions:terminate')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
