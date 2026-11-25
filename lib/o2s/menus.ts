// The screens check permissions by code-crafter's menu names ("Buyer Setup"); O2S's menus are named by its
// endpoints' menuName constants ("Buyer"). These maps translate both ways. Names not listed are the same in
// both (most HR menus).

/** code-crafter menu name -> O2S menu name. */
export const MENU_NAME_TO_O2S: Record<string, string> = {
  "Country Setup": "Country",
  "Currency Setup": "Currency",
  "Unit Setup": "Unit",
  "Supplier Entry": "Supplier",
  "Material Group Entry": "Material Group",
  "Material Entry": "Material",
  "Factory Setup": "Factory",
  Factory: "Factory",
  Module: "Module Entry",
  Menu: "Menu Entry",
  Organization: "Company",
  "Organization Setup": "Company",
  "Menu Permission": "User Menu Permission",
  "User Directory": "User Management",
  "Buyer Setup": "Buyer",
  "Style Setup": "Style",
  "Fabric Process Setup": "Fabric Process",
  "GMT Cost Scope Setup": "GMT Cost Scope",
  "Color Setup": "Color",
  "Size Setup": "Size",
  "Embellishment Setup": "Embellishment",
  "Job Entry": "Job",
  "TNA Task Setup": "TNA Task",
  "GMT Costing": "Gmt Costing",
  Booking: "Create Fabric Booking",
  "Budget Approval": "Create Budget",
  "HR Audit Log": "Audit Log",
  "Merchandising Audit Log": "Audit Log",
  "IAM Audit Log": "Audit Log",
}

/** code-crafter module labels -> O2S module names. */
export const MODULE_NAME_TO_O2S: Record<string, string> = {
  "App Config": "Configuration",
  "Hr-Payroll": "HR & Payroll",
  Merchandising: "Merchandising",
  IAM: "Configuration",
}

function invert(map: Record<string, string>) {
  const out: Record<string, string[]> = {}
  for (const [from, to] of Object.entries(map)) (out[to] ??= []).push(from)
  return out
}

const MENU_NAMES_FROM_O2S = invert(MENU_NAME_TO_O2S)
const MODULE_NAMES_FROM_O2S = invert(MODULE_NAME_TO_O2S)

export function toO2sMenuName(name: string) {
  return MENU_NAME_TO_O2S[name.trim()] ?? name.trim()
}

/** Every code-crafter name an O2S menu stands for (itself included, so either name matches). */
export function fromO2sMenuName(name: string): string[] {
  return [...new Set([name, ...(MENU_NAMES_FROM_O2S[name] ?? [])])]
}

/** The code-crafter module label of an O2S module (the first one listed), else the name itself. */
export function fromO2sModuleName(name: string | null | undefined) {
  if (!name) return ""
  return MODULE_NAMES_FROM_O2S[name]?.[0] ?? name
}
