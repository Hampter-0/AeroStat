-- Roles hold the permissions; users get one or more roles.
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    super_user BOOLEAN NOT NULL DEFAULT false,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_roles_role ON user_roles (role_id);

ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;

CREATE FUNCTION user_is_super(uid BIGINT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = uid AND r.super_user
    )
$$;

CREATE FUNCTION user_permissions(uid BIGINT) RETURNS TEXT[] LANGUAGE sql STABLE AS $$
    SELECT COALESCE(array_agg(DISTINCT p ORDER BY p), '{}')
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id, unnest(r.permissions) p
    WHERE ur.user_id = uid
$$;

-- Old permissions were one per area; each becomes every new permission in
-- that area, so nobody gains or loses access.
CREATE FUNCTION pg_temp.expand_permission(old TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE old
        WHEN 'incidents' THEN ARRAY['incidents.view', 'incidents.create', 'incidents.update', 'incidents.edit', 'incidents.delete']
        WHEN 'maintenance' THEN ARRAY['maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.edit', 'maintenance.cancel', 'maintenance.delete']
        WHEN 'services' THEN ARRAY['services.view', 'services.create', 'services.edit', 'services.delete', 'services.groups', 'services.check']
        WHEN 'settings' THEN ARRAY['settings.general', 'settings.notifications']
        ELSE ARRAY[]::TEXT[]
    END
$$;

CREATE FUNCTION pg_temp.area_label(old TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE old
        WHEN 'incidents' THEN 'Incidents'
        WHEN 'maintenance' THEN 'Maintenance'
        WHEN 'services' THEN 'Services'
        WHEN 'settings' THEN 'Settings'
        ELSE old
    END
$$;

INSERT INTO roles (name, handle, super_user) VALUES ('Admin', 'admin', true);
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.is_admin AND r.handle = 'admin';

-- One role per combination of old permissions. Activity was visible to these
-- users before, so they keep it.
WITH sets AS (
    SELECT DISTINCT ARRAY(SELECT DISTINCT p FROM unnest(permissions) p ORDER BY p) AS perms
    FROM users
    WHERE NOT is_admin AND cardinality(permissions) > 0
)
INSERT INTO roles (name, handle, permissions)
SELECT
    (SELECT string_agg(pg_temp.area_label(p), ', ' ORDER BY p) FROM unnest(perms) p),
    array_to_string(perms, '-'),
    ARRAY(
        SELECT DISTINCT x
        FROM unnest(perms) p, unnest(pg_temp.expand_permission(p) || ARRAY['activity.view']) x
        ORDER BY x
    )
FROM sets;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.handle = array_to_string(ARRAY(SELECT DISTINCT p FROM unnest(u.permissions) p ORDER BY p), '-')
WHERE NOT u.is_admin AND cardinality(u.permissions) > 0;

ALTER TABLE users DROP COLUMN is_admin;
ALTER TABLE users DROP COLUMN permissions;
