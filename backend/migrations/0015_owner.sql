-- Accounts made with create-admin on the command line own the install and get a crown in the users list.
ALTER TABLE users ADD COLUMN owner BOOLEAN NOT NULL DEFAULT false;

-- Until now that was the first super user.
UPDATE users SET owner = true WHERE id = (SELECT MIN(id) FROM users WHERE user_is_super(id));
