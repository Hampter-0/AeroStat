'use client'

import type { Permission, PermissionGroup, PermissionUser } from '@/lib/permissions'

export default function PermissionTree({
  title,
  groups,
  actor,
  selected,
  onChange,
  disabled,
  locked,
}: {
  title: string
  groups: PermissionGroup[]
  actor: PermissionUser
  selected: string[]
  onChange: (next: string[]) => void
  disabled: boolean
  locked: string[]
}) {
  const all: Permission[] = []
  for (const group of groups) {
    for (const permission of group.permissions) {
      all.push(permission)
    }
  }

  function find(key: string): Permission | null {
    for (const permission of all) {
      if (permission.key === key) {
        return permission
      }
    }
    return null
  }

  function allowed(permission: Permission): boolean {
    if (disabled) {
      return false
    }
    if (actor.is_admin) {
      return true
    }
    return actor.permissions.includes(permission.key)
  }

  function withParents(list: string[], key: string): string[] {
    const result = list.slice()
    let current = find(key)
    while (current) {
      if (!result.includes(current.key)) {
        result.push(current.key)
      }
      if (current.parent) {
        current = find(current.parent)
      } else {
        current = null
      }
    }
    return result
  }

  function dependsOn(key: string, ancestor: string): boolean {
    let current = find(key)
    while (current && current.parent) {
      if (current.parent === ancestor) {
        return true
      }
      current = find(current.parent)
    }
    return false
  }

  function setMany(keys: string[], checked: boolean) {
    let next = selected.slice()
    if (checked) {
      for (const key of keys) {
        next = withParents(next, key)
      }
    } else {
      next = next.filter(function (item) {
        for (const key of keys) {
          if (item === key || dependsOn(item, key)) {
            return false
          }
        }
        return true
      })
    }
    onChange(next)
  }

  function allowedKeys(permissions: Permission[]): string[] {
    const keys: string[] = []
    for (const permission of permissions) {
      if (allowed(permission)) {
        keys.push(permission.key)
      }
    }
    return keys
  }

  function allChecked(keys: string[]): boolean {
    if (keys.length === 0) {
      return false
    }
    for (const key of keys) {
      if (!selected.includes(key) && !locked.includes(key)) {
        return false
      }
    }
    return true
  }

  const everyKey = allowedKeys(all)
  const everything = allChecked(everyKey)

  function toggleEverything() {
    setMany(everyKey, !everything)
  }

  let everythingText = 'Check all'
  if (everything) {
    everythingText = 'Uncheck all'
  }

  return (
    <>
      <div className="role-permissions-head">
        <h2>{title}</h2>
        {everyKey.length > 0 && (
          <button type="button" className="button-secondary" onClick={toggleEverything}>
            {everythingText}
          </button>
        )}
      </div>
      {groups.map(function (group) {
        const keys = allowedKeys(group.permissions)
        const groupChecked = allChecked(keys)
        let groupText = 'Check all'
        if (groupChecked) {
          groupText = 'Uncheck all'
        }
        function toggleGroup() {
          setMany(keys, !groupChecked)
        }
        return (
          <section className="manage-panel" key={group.key}>
            <div className="panel-heading">
              <h2>{group.label}</h2>
              {keys.length > 0 && (
                <button type="button" className="link-button" onClick={toggleGroup}>
                  {groupText}
                </button>
              )}
            </div>
            <div className="permission-tree">
              {group.permissions.map(function (permission) {
                let className = 'check-row hint-row'
                if (permission.parent) {
                  className = 'check-row hint-row permission-child'
                }
                const fromRole = locked.includes(permission.key)
                let hint = permission.hint
                if (fromRole) {
                  hint = hint + ' Already given by a role.'
                }
                function change(event: React.ChangeEvent<HTMLInputElement>) {
                  setMany([permission.key], event.target.checked)
                }
                return (
                  <label className={className} key={permission.key}>
                    <input
                      type="checkbox"
                      value={permission.key}
                      checked={selected.includes(permission.key) || fromRole}
                      onChange={change}
                      disabled={!allowed(permission) || fromRole}
                    />
                    <span>
                      <strong>{permission.label}</strong>
                      <small>{hint}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
      {selected.map(function (key) {
        return <input type="hidden" name="permissions" value={key} key={key} />
      })}
    </>
  )
}
