-- More check types. Ping and Docker keep a host or container name in url,
-- the database and game server checks keep "host:port".
ALTER TABLE services DROP CONSTRAINT services_check_type;
ALTER TABLE services ADD CONSTRAINT services_check_type CHECK (check_type IN (
    'http', 'tcp', 'dns', 'ping', 'docker', 'postgres', 'mysql', 'redis', 'minecraft', 'bedrock', 'source'
));

-- Set while a service answers much slower than usual, so the warning is sent
-- once and the status page can say so.
ALTER TABLE services
    ADD COLUMN slow_since TIMESTAMPTZ,
    ADD COLUMN slow_ms INT,
    ADD COLUMN slow_usual_ms INT;

-- One row per service per day, kept after the raw checks are cleaned up, for
-- the uptime history on the status page.
CREATE TABLE daily_uptime (
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    status TEXT NOT NULL,
    downtime_minutes INT NOT NULL,
    avg_response_ms INT,
    PRIMARY KEY (service_id, day)
);

-- Whoever gets "service down" also gets warned about slow response times.
UPDATE notification_settings
SET events = array_append(events, 'service_slow')
WHERE 'service_down' = ANY(events) AND NOT 'service_slow' = ANY(events);

UPDATE users
SET email_events = array_append(email_events, 'service_slow')
WHERE 'service_down' = ANY(email_events) AND NOT 'service_slow' = ANY(email_events);

UPDATE users
SET panel_events = array_append(panel_events, 'service_slow')
WHERE 'service_down' = ANY(panel_events) AND NOT 'service_slow' = ANY(panel_events);

-- New panel users get it as well.
ALTER TABLE users ALTER COLUMN panel_events SET DEFAULT ARRAY[
    'service_down', 'service_up', 'service_certificate', 'service_slow',
    'incident_created', 'incident_updated', 'incident_resolved',
    'maintenance_scheduled', 'maintenance_started', 'maintenance_completed', 'maintenance_cancelled',
    'admin_backup_failed', 'admin_update_available', 'admin_account_locked', 'admin_users', 'admin_security'
];

-- Docker hosts besides the local one: a socket proxy or a remote Docker over
-- HTTP. A Docker check without a host uses DOCKER_HOST or the local socket.
CREATE TABLE docker_hosts (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE services ADD COLUMN docker_host_id BIGINT REFERENCES docker_hosts(id) ON DELETE RESTRICT;
