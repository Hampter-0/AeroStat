-- Roles, service groups and system actions get their own filter in the
-- activity log.
UPDATE activity_log SET category = 'roles' WHERE category = 'users' AND action LIKE '% role';
UPDATE activity_log SET category = 'groups' WHERE category = 'services' AND action LIKE '% group';
UPDATE activity_log SET category = 'system' WHERE category = 'settings' AND action = 'sent a test email';
