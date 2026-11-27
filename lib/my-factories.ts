// The signed-in user's factories in the selected organization (GET .../user-factory-permission/mine), shared by
// the factory switcher, the module menu, the menu search and the module pages. A user with none sees no module
// and no menu until an admin gives them a factory (or, as an admin, adds one).

import { fetchMyFactories } from "@/features/iam/user-factory-permissions/user-factory-permission.service"
import type { MyFactoriesRecord } from "@/features/iam/user-factory-permissions/user-factory-permission.types"
import { readSelectedOrganizationId } from "@/lib/organization-selection"

const CACHE_MS = 60_000
const cache = new Map<string, { at: number; result: Promise<MyFactoriesRecord | null> }>()

/** The user's factories in the organization; null when it can't be read (no session, no organization, offline). */
export function loadMyFactories(organizationId = readSelectedOrganizationId()): Promise<MyFactoriesRecord | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
  const accessToken = window.localStorage.getItem("access_token") ?? ""
  if (!apiUrl || !accessToken || !organizationId) return Promise.resolve(null)

  const cached = cache.get(organizationId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result

  const result = fetchMyFactories({ apiUrl, accessToken, organizationId }).catch(() => {
    cache.delete(organizationId)
    return null
  })
  cache.set(organizationId, { at: Date.now(), result })
  return result
}

/** True when the user may work in at least one factory of the organization (modules and menus are shown). */
export async function hasAnyFactory(organizationId = readSelectedOrganizationId()) {
  const mine = await loadMyFactories(organizationId)
  return Boolean(mine && mine.factories.length > 0)
}
