-- A Discord channel is often public, so the certificate warning is opt-in
-- there. Email keeps it for whoever gets "service down".
UPDATE notification_settings SET events = array_remove(events, 'service_certificate');

-- Super users get failed backups and security changes by email from the start.
UPDATE users
SET email_events = email_events || ARRAY['admin_backup_failed', 'admin_security']
WHERE user_is_super(id) AND NOT 'admin_security' = ANY(email_events);
