export interface PermissionUser {
  is_admin: boolean
  permissions: string[]
}

export interface Permission {
  key: string
  label: string
  hint: string
  parent: string | null
}

export interface PermissionGroup {
  key: string
  label: string
  permissions: Permission[]
}

export interface Role {
  id: number
  name: string
  handle: string
  permissions: string[]
  users: number
  created_at: string
}

export interface RoleSummary {
  id: number
  name: string
  permissions: string[]
}

export function hasPermission(user: PermissionUser, permission: string): boolean {
  if (user.is_admin) {
    return true
  }
  return user.permissions.includes(permission)
}
