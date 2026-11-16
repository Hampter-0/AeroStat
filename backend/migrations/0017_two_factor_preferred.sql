-- The method shown first at sign-in when someone has both the app and email
-- codes on: 'app' or 'email'. Empty means the app.
ALTER TABLE users ADD COLUMN two_factor_preferred TEXT;
