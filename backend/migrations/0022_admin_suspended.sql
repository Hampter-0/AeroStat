-- Admin is now one switch on the user. Roles only hold permissions.

-- Everyone who was a super user through a role becomes an admin themselves,
-- so nobody loses access.
UPDATE users SET super_user = true
WHERE id IN (
    SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.super_user
);

-- A super user role without permissions of its own has no use any more.
DELETE FROM roles WHERE super_user AND cardinality(permissions) = 0;

CREATE OR REPLACE FUNCTION user_is_super(uid BIGINT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM users WHERE id = uid AND super_user)
$$;

ALTER TABLE roles DROP COLUMN super_user;

-- A suspended user can't sign in and gets no notifications.
ALTER TABLE users ADD COLUMN suspended BOOLEAN NOT NULL DEFAULT false;
