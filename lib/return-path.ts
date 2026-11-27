// Where to go after signing in: the page the user was on when their session ended, if it is still there for
// whoever signs in now; otherwise the home page.

import { fetchMenuPermissions } from "@/features/iam/menu-permissions/menu-permission.service"
import { AUTH_PAGES, isGlobalAdmin, RETURN_PATH_KEY, type AuthUser } from "@/lib/auth-session"
import { canOpenIam } from "@/lib/iam-access"
import {
  filterModuleNavigationByPermissions,
  filterModuleSidebarGroupsByPermissions,
  MODULE_NAVIGATION,
  type ModuleNavItem,
} from "@/lib/module-navigation"
import { readSelectedOrganizationId } from "@/lib/organization-selection"

/** Pages every signed-in user has; no menu permission behind them. */
const OPEN_PAGES = ["/", "/profile", "/account", "/notifications", "/organization-access-request"]

function pathOnly(path: string) {
  return path.split(/[?#]/)[0].replace(/\/+$/, "") || "/"
}

/** The remembered page, once (it is forgotten as it is read). */
function takeReturnPath() {
  try {
    const path = window.sessionStorage.getItem(RETURN_PATH_KEY)
    window.sessionStorage.removeItem(RETURN_PATH_KEY)
    return path ?? ""
  } catch {
    return ""
  }
}

function flatten(items: ModuleNavItem[]): ModuleNavItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])])
}

/** The sidebar page a path belongs to: the longest href that is the path or a parent of it. */
function findNavItem(path: string, items: ModuleNavItem[]) {
  return items
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

/**
 * The page to open after signing in. The remembered page when it is a page of this app that the signed-in user may
 * open (a sidebar page they have a menu permission for, a module they see, or a page open to everyone); "/" when there
 * is none, it is unknown, it is not theirs (another user signed in, a permission was taken away) or it can't be checked.
 */
export async function resolveReturnPath({
  apiUrl,
  accessToken,
  user,
}: {
  apiUrl: string
  accessToken: string
  user: AuthUser | null
}): Promise<string> {
  const target = takeReturnPath()
  // only a path of this site (not "//host/…" or a full URL)
  if (!target.startsWith("/") || target.startsWith("//")) return "/"
  const path = pathOnly(target)
  if (AUTH_PAGES.includes(path)) return "/"
  if (OPEN_PAGES.includes(path)) return target

  const allItems = MODULE_NAVIGATION.flatMap((module) => module.groups.flatMap((group) => flatten(group.items)))
  const navItem = findNavItem(path, allItems)
  const moduleHome = MODULE_NAVIGATION.find((entry) => path === entry.href)
  if (!navItem && !moduleHome) return "/"
  if (isGlobalAdmin(user)) return target

  const organizationId = readSelectedOrganizationId()
  if (!user?.id || !organizationId) return "/"
  try {
    // IAM is for the organization's admins only, page by page as well.
    if (path === "/iam" || path.startsWith("/iam/")) {
      return (await canOpenIam({ apiUrl, accessToken, user, organizationId })) ? target : "/"
    }
    const permissions = await fetchMenuPermissions({ apiUrl, accessToken, userId: user.id, organizationId })
    if (moduleHome) {
      return filterModuleNavigationByPermissions([moduleHome], permissions, false).length ? target : "/"
    }
    const visible = MODULE_NAVIGATION.flatMap((entry) =>
      filterModuleSidebarGroupsByPermissions(entry.groups, permissions, false).flatMap((group) => flatten(group.items)),
    )
    return visible.some((item) => item.href === navItem!.href) ? target : "/"
  } catch {
    return "/"
  }
}
