-- The bell in the panel: one row per person per event, so each user has
-- their own read and cleared state.
CREATE TABLE panel_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    tone TEXT NOT NULL DEFAULT 'grey',
    path TEXT,
    important BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_panel_notifications_user ON panel_notifications (user_id, created_at DESC);

-- Everything is on in the bell by default; each user turns kinds off on their
-- profile. Muting keeps saving notifications but hides the count.
ALTER TABLE users
    ADD COLUMN panel_events TEXT[] NOT NULL DEFAULT ARRAY[
        'service_down', 'service_up', 'service_certificate',
        'incident_created', 'incident_updated', 'incident_resolved',
        'maintenance_scheduled', 'maintenance_started', 'maintenance_completed', 'maintenance_cancelled',
        'admin_backup_failed', 'admin_update_available', 'admin_account_locked', 'admin_users', 'admin_security'
    ],
    ADD COLUMN panel_muted_until TIMESTAMPTZ;
