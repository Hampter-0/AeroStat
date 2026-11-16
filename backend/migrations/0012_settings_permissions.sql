-- Settings are split per tab. Whoever could change site settings keeps every
-- tab they could open before.
UPDATE roles SET permissions = ARRAY(
    SELECT DISTINCT p FROM unnest(permissions || ARRAY['settings.appearance', 'settings.monitoring', 'settings.time']) p ORDER BY p
)
WHERE 'settings.general' = ANY(permissions);

UPDATE users SET permissions = ARRAY(
    SELECT DISTINCT p FROM unnest(permissions || ARRAY['settings.appearance', 'settings.monitoring', 'settings.time']) p ORDER BY p
)
WHERE 'settings.general' = ANY(permissions);
