export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}

export type PaginationMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type PaginatedResponse<T> = {
  items: T[]
  meta: PaginationMeta
}

/** A member of the selected organization (or a global admin) with how many factories they have. */
export type UserFactorySummaryRecord = {
  userId: string
  userName?: string | null
  fullName?: string | null
  email?: string | null
  isActive: boolean
  /** A global admin or the organization's admin: sees every factory without a list. */
  isUnrestricted: boolean
  noOfFactories: number
  lastChangedDate?: string | null
}

export type UserFactoryRow = {
  factoryId: string
  name: string
  displayName: string
  code?: string | null
  isActive: boolean
  isAssigned: boolean
  assignedDate?: string | null
  assignedByName?: string | null
}

/** Every factory of the organization, with whether the user has it. */
export type UserFactoryAccessRecord = {
  userId: string
  userName?: string | null
  fullName?: string | null
  isUnrestricted: boolean
  factoryIds: string[]
  factories: UserFactoryRow[]
}

/** Only UserToFactoryParams properties (search, isActive). Status: "true" / "false", "" = all. */
export type UserFactoryFilterValues = {
  search: string
  isActive: string
}

export const EMPTY_FILTERS: UserFactoryFilterValues = {
  search: "",
  isActive: "",
}

/** The caller's own factories in the selected organization (the top bar's factory switcher). */
export type MyFactoriesRecord = {
  /** A global or organization admin: sees every factory of the organization. */
  isUnrestricted: boolean
  /** The user's default factory ("Set as default factory") while it is one of `factories`; else null. */
  defaultFactoryId?: string | null
  factories: { id: string; name: string; displayName: string; code?: string | null }[]
}
