CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'http',
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    expected_status INT[] NOT NULL DEFAULT ARRAY[200],
    check_interval_seconds INT NOT NULL DEFAULT 300,
    next_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE metrics (
    id BIGSERIAL PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    response_time INT NOT NULL,
    status_code INT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metrics_service_checked ON metrics (service_id, checked_at DESC);

CREATE TABLE incidents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'investigating', -- investigating/identified/monitoring/resolved
    severity TEXT NOT NULL DEFAULT 'minor',
    affected_services TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE incident_updates (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- investigating/identified/monitoring/resolved
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_updates_incident ON incident_updates (incident_id, created_at DESC);

CREATE TABLE maintenance (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled/in_progress/completed/cancelled
    affected_services TEXT[],
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE maintenance_updates (
    id BIGSERIAL PRIMARY KEY,
    maintenance_id BIGINT NOT NULL REFERENCES maintenance(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- scheduled/in_progress/completed/cancelled
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maintenance_updates_maintenance ON maintenance_updates (maintenance_id, created_at DESC);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    email TEXT,
    avatar BYTEA,
    avatar_type TEXT,
    avatar_updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_users_email ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE brand_assets (
    name TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    target_label TEXT,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    details JSONB
);
CREATE INDEX idx_activity_log_category ON activity_log (category, id DESC);
CREATE INDEX idx_activity_log_created_at ON activity_log (created_at);
