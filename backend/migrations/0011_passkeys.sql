-- Passkeys (WebAuthn). The browser identifies a user by webauthn_id, so the
-- username can change without breaking them.
ALTER TABLE users ADD COLUMN webauthn_id TEXT UNIQUE;
-- Off means this user can only sign in with a passkey.
ALTER TABLE users ADD COLUMN password_login BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE passkeys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    credential_id BYTEA NOT NULL UNIQUE,
    passkey JSONB NOT NULL,
    discoverable BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    UNIQUE (user_id, name)
);
CREATE INDEX idx_passkeys_user ON passkeys (user_id);
