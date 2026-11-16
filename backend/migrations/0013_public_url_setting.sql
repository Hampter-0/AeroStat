-- The status page address is used for links, notification pictures and
-- passkeys, so it moves from the notification settings to the site settings.
INSERT INTO settings (key, value)
SELECT 'public_url', public_url FROM notification_settings WHERE public_url IS NOT NULL
ON CONFLICT (key) DO NOTHING;

ALTER TABLE notification_settings DROP COLUMN public_url;
