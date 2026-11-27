import type { MenuRecord } from "@/features/app-config/menu/menu.types"
import type {
  OrganizationMemberUserRecord,
  OrganizationMembershipRecord,
} from "@/features/organization/organization.types"

export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
  timestamp?: string
}

export type UserOptionRecord = OrganizationMemberUserRecord & {
  role?: "admin" | "user"
  status?: string
}

export type ManageableUserMappingRecord = OrganizationMembershipRecord

export type MenuOrganizationMapRecord = {
  menuId: string
  organizationId: string
  menu?: MenuRecord
}

export type MenuPermissionRecord = {
  id: string
  organizationId: string
  userId: string
  menuId: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  menu?: MenuRecord
  user?: OrganizationMemberUserRecord
}

export type MenuPermissionValue = {
  menuId: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  /** Factory-based screens only: the factories the user may use it in; [] = every factory they have. */
  factoryIds?: string[]
}

export type MenuFactoryChoice = {
  id: string
  name: string
  displayName: string
}

/** A user's per-factory menu limits in one organization (O2S SEC_USER_MENU_FACTORY). */
export type MenuFactoryLimits = {
  /** The factories a limit can name: the user's own (all of the organization's for an admin). */
  choices: MenuFactoryChoice[]
  /** The menus that work per factory (Employee Setup, Payroll Processing, Job, Order Placement, Create Budget). */
  scopedMenuIds: string[]
  /** menuId -> factory ids; a missing or empty list = every factory the user has. */
  limits: Record<string, string[]>
}
