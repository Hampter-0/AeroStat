-- Each user can turn the bell off. Then the panel hides it and nothing is
-- saved for them.
ALTER TABLE users ADD COLUMN panel_enabled BOOLEAN NOT NULL DEFAULT true;
