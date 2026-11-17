-- HTTP stays the default. A TCP check keeps "host:port" in url, a DNS check
-- the name to look up.
ALTER TABLE services
    ADD COLUMN check_type TEXT NOT NULL DEFAULT 'http',
    ADD COLUMN keyword TEXT,
    ADD COLUMN keyword_absent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN dns_record_type TEXT,
    ADD COLUMN dns_expected TEXT,
    ADD COLUMN cert_warn_days INT,
    ADD COLUMN cert_expires_at TIMESTAMPTZ,
    ADD COLUMN cert_checked_at TIMESTAMPTZ,
    ADD COLUMN cert_warned_for TIMESTAMPTZ,
    ADD CONSTRAINT services_check_type CHECK (check_type IN ('http', 'tcp', 'dns'));

-- Existing HTTPS services warn two weeks before their certificate runs out.
UPDATE services SET cert_warn_days = 14 WHERE url ILIKE 'https://%';

-- Why a check failed, shown in notifications. Empty for good checks.
ALTER TABLE metrics ADD COLUMN error TEXT;

-- Whoever gets "service down" also gets the certificate warning.
UPDATE notification_settings
SET events = array_append(events, 'service_certificate')
WHERE 'service_down' = ANY(events) AND NOT 'service_certificate' = ANY(events);

UPDATE users
SET email_events = array_append(email_events, 'service_certificate')
WHERE 'service_down' = ANY(email_events) AND NOT 'service_certificate' = ANY(email_events);
