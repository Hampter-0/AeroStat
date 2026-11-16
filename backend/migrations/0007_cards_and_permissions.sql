-- The image in a notification shows what happened at that moment and never
-- changes, so an old message doesn't show today's status.
CREATE TABLE share_cards (
    id TEXT PRIMARY KEY,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    headline TEXT NOT NULL,
    subline TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_cards_created ON share_cards (created_at);

-- Permissions given to one user directly, next to their roles.
ALTER TABLE users ADD COLUMN permissions TEXT[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION user_permissions(uid BIGINT) RETURNS TEXT[] LANGUAGE sql STABLE AS $$
    SELECT COALESCE(array_agg(DISTINCT p ORDER BY p), '{}')
    FROM (
        SELECT unnest(r.permissions) AS p
        FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = uid
        UNION ALL
        SELECT unnest(u.permissions) FROM users u WHERE u.id = uid
    ) granted
$$;

-- Managing users, roles and groups is now split per action.
UPDATE roles SET permissions = ARRAY(
    SELECT DISTINCT x
    FROM unnest(permissions) p,
         unnest(CASE p
             WHEN 'users.manage' THEN ARRAY['users.view', 'users.create', 'users.edit', 'users.delete']
             WHEN 'roles.manage' THEN ARRAY['roles.view', 'roles.create', 'roles.edit', 'roles.delete']
             WHEN 'services.groups' THEN ARRAY['groups.create', 'groups.edit', 'groups.delete']
             ELSE ARRAY[p]
         END) x
    ORDER BY x
);
