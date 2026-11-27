// The factory chosen in the top bar, one per organization ("" = all factories, which only an organization admin
// or a global admin may work in). The O2S adapter sends it as x-factory-id on every call, with the page's menu as
// x-menu-name: the backend hides and refuses the factory-based screens (Employee Setup, Payroll Processing, Job,
// Order Placement, Create Budget) in a factory the user may not use them in, and lists their records for the
// selected factory only.

import { readSelectedOrganizationId } from "@/lib/organization-selection"
import { MODULE_NAVIGATION, type ModuleNavItem } from "@/lib/module-navigation"
import { toO2sMenuName } from "@/lib/o2s/menus"

const STORAGE_KEY = "selected_factory_ids"

function readAll(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** The factory selected for the organization selected now ("" = all / none). */
export function readSelectedFactoryId(organizationId = readSelectedOrganizationId()) {
  if (!organizationId) return ""
  return String(readAll()[organizationId] ?? "").trim()
}

/** Remembers the factory for the selected organization. The caller reloads the page so every screen follows it. */
export function writeSelectedFactoryId(factoryId: string, organizationId = readSelectedOrganizationId()) {
  if (typeof window === "undefined" || !organizationId) return
  const all = readAll()
  if (factoryId.trim()) all[organizationId] = factoryId.trim()
  else delete all[organizationId]
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // storage blocked: the selection lasts until the page reloads
  }
}

function flatten(items: ModuleNavItem[]): ModuleNavItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])])
}

const MENU_ITEMS = MODULE_NAVIGATION.flatMap((module) => module.groups.flatMap((group) => flatten(group.items)))
  .filter((item) => item.permissionMenuName)
  .sort((a, b) => b.href.length - a.href.length)

/** The O2S menu name of the page open now (the sidebar item whose route it is under), or "". */
export function currentPageMenuName() {
  if (typeof window === "undefined") return ""
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  const item = MENU_ITEMS.find((entry) => path === entry.href || path.startsWith(`${entry.href}/`))
  return item?.permissionMenuName ? toO2sMenuName(item.permissionMenuName) : ""
}
