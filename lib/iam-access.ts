// The IAM module (users, menu / factory permissions, access requests, audit log) is for the selected
// organization's admins only, plus global admins. Everyone else gets no IAM entry in the module menu or the
// menu search, and the IAM pages show a notice instead (the backend checks every request on its own).

import { fetchUserOrganizationMappings } from "@/features/organization/organization.service"
import { isGlobalAdmin, type AuthUser } from "@/lib/auth-session"
import { MODULE_NAVIGATION, type ModuleNavigationItem } from "@/lib/module-navigation"

const CACHE_MS = 60_000
const cache = new Map<string, { at: number; result: Promise<boolean> }>()

/** True for a global admin, or a member whose role in the selected organization is admin. */
export function canOpenIam({
  apiUrl,
  accessToken,
  user,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  user: AuthUser | null | undefined
  organizationId: string
}): Promise<boolean> {
  if (isGlobalAdmin(user)) return Promise.resolve(true)
  if (!user?.id || !organizationId) return Promise.resolve(false)

  // The module menu, the menu search and the IAM pages all ask at once: one request per user + organization.
  const key = `${user.id}:${organizationId}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result

  const result = fetchUserOrganizationMappings({ apiUrl, accessToken, userId: user.id })
    .then((memberships) =>
      memberships.some((membership) => String(membership.organizationId) === organizationId && membership.role === "admin"),
    )
    .catch((error: unknown) => {
      cache.delete(key)
      throw error
    })
  cache.set(key, { at: Date.now(), result })
  return result
}

/** The modules to show: IAM only when the user may open it, the rest as the permissions gave them. */
export function withIamAccess(modules: ModuleNavigationItem[], iamAllowed: boolean): ModuleNavigationItem[] {
  return MODULE_NAVIGATION.filter((module) =>
    module.key === "iam" ? iamAllowed : modules.some((visible) => visible.key === module.key),
  )
}
