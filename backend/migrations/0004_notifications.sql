CREATE TABLE notification_settings (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    discord_webhook_url TEXT,
    public_url TEXT,
    events TEXT[] NOT NULL DEFAULT ARRAY[
        'service_down', 'service_up',
        'incident_created', 'incident_updated', 'incident_resolved',
        'maintenance_scheduled', 'maintenance_started', 'maintenance_completed', 'maintenance_cancelled'
    ],
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO notification_settings (id) VALUES (true);

ALTER TABLE maintenance ADD COLUMN start_notified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE maintenance ADD COLUMN end_notified BOOLEAN NOT NULL DEFAULT false;
-- Windows that already started or ended before notifications existed stay quiet.
UPDATE maintenance SET start_notified = scheduled_start <= now(), end_notified = scheduled_end <= now();
