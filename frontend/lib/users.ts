import type { PermissionGroup, PermissionUser, RoleSummary } from './permissions'

export interface UserRecord {
  id: number
  username: string
  email: string | null
  is_admin: boolean
  role_ids: number[]
  super_user: boolean
  permissions: string[]
  two_factor: boolean
  two_factor_required: boolean
  passkeys: number
  password_login: boolean
  owner: boolean
  created_at: string
  last_login_at: string | null
  avatar_version: number | null
}

export interface UsersResponse {
  users: UserRecord[]
  roles: RoleSummary[]
  permission_groups: PermissionGroup[]
}

export function canGiveRole(actor: PermissionUser, role: RoleSummary): boolean {
  if (actor.is_admin) {
    return true
  }
  if (role.super_user) {
    return false
  }
  for (const permission of role.permissions) {
    if (!actor.permissions.includes(permission)) {
      return false
    }
  }
  return true
}

export function roleDescription(role: RoleSummary): string {
  if (role.super_user) {
    return 'Super user, can do everything'
  }
  if (role.permissions.length === 1) {
    return '1 permission'
  }
  return role.permissions.length + ' permissions'
}
