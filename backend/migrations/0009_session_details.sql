-- What the Sessions page shows, and which IPs are known for an account so a
-- sign-in block for strangers doesn't lock out the owner.
ALTER TABLE sessions ADD COLUMN id BIGSERIAL;
ALTER TABLE sessions ADD CONSTRAINT sessions_id_key UNIQUE (id);
ALTER TABLE sessions ADD COLUMN ip TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN last_used_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_sessions_user_ip ON sessions (user_id, ip);
