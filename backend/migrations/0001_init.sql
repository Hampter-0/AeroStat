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