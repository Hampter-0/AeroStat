-- Two-factor sign-in: an authenticator app (secret encrypted with SECRET_KEY),
-- a code by email, and single-use recovery codes.
ALTER TABLE users ADD COLUMN totp_secret TEXT;
-- The last 30-second step a code was accepted for, so a code works only once.
ALTER TABLE users ADD COLUMN totp_last_step BIGINT;
ALTER TABLE users ADD COLUMN email_two_factor BOOLEAN NOT NULL DEFAULT false;
-- Set by an admin: the user has to set up a second factor before using the panel.
ALTER TABLE users ADD COLUMN two_factor_required BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE recovery_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_recovery_codes_user ON recovery_codes (user_id);
