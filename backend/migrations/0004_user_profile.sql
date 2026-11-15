ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN avatar BYTEA;
ALTER TABLE users ADD COLUMN avatar_type TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_users_email ON users (lower(email)) WHERE email IS NOT NULL;
