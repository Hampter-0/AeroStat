CREATE TABLE activity_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    target_label TEXT,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_category ON activity_log (category, id DESC);
CREATE INDEX idx_activity_log_created_at ON activity_log (created_at);
