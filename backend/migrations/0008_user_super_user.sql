-- A user can be a super user directly, without a super user role.
ALTER TABLE users ADD COLUMN super_user BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION user_is_super(uid BIGINT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM users WHERE id = uid AND super_user)
        OR EXISTS (
            SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = uid AND r.super_user
        )
$$;
