-- Which notifications each panel user wants by email. Empty means none.
ALTER TABLE users ADD COLUMN email_events TEXT[] NOT NULL DEFAULT '{}';
