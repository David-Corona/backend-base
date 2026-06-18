SELECT p.key FROM permissions p
JOIN role_permissions rp ON rp."permissionId" = p.id
JOIN roles r ON r.id = rp."roleId"
WHERE r.name = 'admin' AND p.key LIKE 'sessions:%';
