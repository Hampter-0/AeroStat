-- Per service: a fixed limit on top of "slower than usual", and a way to turn
-- slow warnings off for a service whose speed always varies.
ALTER TABLE services
    ADD COLUMN slow_above_ms INT,
    ADD COLUMN slow_alerts BOOLEAN NOT NULL DEFAULT true;

-- What a failed check got back (headers and the start of the answer), for the
-- check log in the panel. Cleared after a week.
ALTER TABLE metrics ADD COLUMN details TEXT;

-- Docker hosts get their own permission. Whoever could change the monitoring
-- settings, which held the Docker hosts before, keeps that.
UPDATE roles
SET permissions = array_append(permissions, 'settings.docker')
WHERE 'settings.monitoring' = ANY(permissions) AND NOT 'settings.docker' = ANY(permissions);

UPDATE users
SET permissions = array_append(permissions, 'settings.docker')
WHERE 'settings.monitoring' = ANY(permissions) AND NOT 'settings.docker' = ANY(permissions);
