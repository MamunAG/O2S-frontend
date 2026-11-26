// The GMT Costing screen's logic, without React: dto <-> screen mappers, the row and fabric costing maths,
// the color / size group rules, the price per group and the item-wise supplier list. Ported from ClickERP's
// React page (gmt-costing-budget-booking/gmt-costing), which ported the desktop ucGarmentsCosting.cs.

import type {
  CostScope,
  GmtCommission,
  GmtCostPerPcs,
  GmtCosting,
  GmtCostingDetail,
  GmtDetailsColor,
  GmtDetailsSize,
  GmtDetailsWastage,
  GmtFabricCost,
  GmtFabricCostProcess,
  GmtFabricCostYarn,
  GmtFabricCostYarnProcess,
  GmtItemSupplier,
  GmtOtherCost,
} from "./gmt-costing.types"

export const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
/** Every figure counts at most 6 decimals, typed ones as well. */
export const round6 = (value: number) => round(value, 6)
export const num = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? round6(parsed) : 0
}
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value))
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
const optionalId = (value: unknown) => (value === null || value === undefined || value === "" || value === 0 ? null : String(value))

// ---------- settings (ClickERP's page configurations; per browser here) ----------

export type GmtCostingSettings = {
  /** Fabric costing: qty + qty x W% (forward) or qty / (1 - W%) (backward). */
  isFabricForwardCalculation: boolean
  /** Details grid: Total qty = req qty grown by GMT W%, forward or backward. */
  isGmtForwardCalculation: boolean
  /** Material group names (comma-separated) whose items are fabrics: Is Color Wise is ticked for them. */
  fabricMaterialGroupNames: string
  /** Cost scope names (comma-separated) that are knitting: left out of the grey yarn qty. */
  knittingProcessNames: string
  /** Cost scope names that are yarn dyeing: left out of the grey and dyed yarn qty. */
  yarnDyeingProcessNames: string
}

export const DEFAULT_SETTINGS: GmtCostingSettings = {
  isFabricForwardCalculation: false,
  isGmtForwardCalculation: false,
  fabricMaterialGroupNames: "Fabric",
  knittingProcessNames: "Knitting",
  yarnDyeingProcessNames: "Yarn Dyed",
}

const SETTINGS_KEY = "o2s.gmt-costing.settings"

export function readSettings(): GmtCostingSettings {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<GmtCostingSettings> | null
    return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function writeSettings(settings: GmtCostingSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // private window: the settings last for this visit only
  }
}

const nameList = (names: string) =>
  names.split(",").map((n) => n.trim().toLowerCase()).filter(Boolean)

/** Is Color Wise for an item of this material group: one of the fabric group names (exact, any case). */
export const isFabricGroup = (groupName: string, settings: GmtCostingSettings) =>
  nameList(settings.fabricMaterialGroupNames || "Fabric").includes(groupName.trim().toLowerCase())

export type ProcessGroups = { knittingProcessIds: string[]; yarnDyeingProcessIds: string[] }

/** The cost scopes whose name is one of the knitting / yarn dyeing names. */
export function processGroupsOf(scopes: CostScope[], settings: GmtCostingSettings): ProcessGroups {
  const knitting = nameList(settings.knittingProcessNames)
  const dyeing = nameList(settings.yarnDyeingProcessNames)
  return {
    knittingProcessIds: scopes.filter((s) => knitting.includes(s.name.trim().toLowerCase())).map((s) => s.id),
    yarnDyeingProcessIds: scopes.filter((s) => dyeing.includes(s.name.trim().toLowerCase())).map((s) => s.id),
  }
}

// ---------- groups ----------

export type GroupKind = "size" | "color"
export type GroupItem = { id: string; name: string }

export const SIZE_GROUP_DEFAULT_NAME = "All Size"
export const COLOR_GROUP_DEFAULT_NAME = "All Color"
export const groupDefaultName = (kind: GroupKind) => (kind === "size" ? SIZE_GROUP_DEFAULT_NAME : COLOR_GROUP_DEFAULT_NAME)

export const groupItemsOf = (row: GmtCostingDetail, kind: GroupKind): GroupItem[] =>
  kind === "size"
    ? row.lstGMT_SIZEs.map((s) => ({ id: s.gmtSizeId, name: s.gmtSizeName }))
    : row.lstGMT_COLORs.map((c) => ({ id: c.gmtColorId, name: c.gmtColorName }))

export const groupNameOf = (row: GmtCostingDetail, kind: GroupKind) =>
  (kind === "size" ? row.sizeGroupName : row.colorGroupName) || ""

/** "All Size" / "All Color" whenever the row's group holds nothing. */
export const groupDisplayNameOf = (row: GmtCostingDetail, kind: GroupKind) =>
  groupItemsOf(row, kind).length === 0 ? groupDefaultName(kind) : groupNameOf(row, kind) || groupDefaultName(kind)

const idSignature = (ids: string[]) => [...ids].sort().join("_")

/** The name of a row already holding exactly these items (desktop GetPreSizeGroupName), else "". */
export function findPreGroupName(rows: GmtCostingDetail[], kind: GroupKind, ids: string[]) {
  if (ids.length === 0) return groupDefaultName(kind)
  const signature = idSignature(ids)
  for (const row of rows) {
    const rowIds = groupItemsOf(row, kind).map((i) => i.id)
    if (rowIds.length === ids.length && idSignature(rowIds) === signature) return groupNameOf(row, kind)
  }
  return ""
}

/** Sizes suggest a range (first-last), colors are joined with "+". */
export function groupNameSuggestion(kind: GroupKind, items: GroupItem[]) {
  if (items.length === 0) return ""
  if (kind === "size") return items.length === 1 ? items[0].name : `${items[0].name}-${items[items.length - 1].name}`
  return items.map((i) => i.name).join("+")
}

export function applyGroupToRow(row: GmtCostingDetail, kind: GroupKind, groupName: string, items: GroupItem[]): GmtCostingDetail {
  if (kind === "size") {
    return {
      ...row,
      sizeGroupName: items.length ? groupName : "",
      lstGMT_SIZEs: items.map<GmtDetailsSize>((item) => ({
        clientId: newClientId(), id: "", detailsId: "", sizeGroupName: groupName, gmtSizeId: item.id, gmtSizeName: item.name,
      })),
    }
  }
  return {
    ...row,
    colorGroupName: items.length ? groupName : "",
    lstGMT_COLORs: items.map<GmtDetailsColor>((item) => ({
      clientId: newClientId(), id: "", detailsId: "", colorGroupName: groupName, gmtColorId: item.id, gmtColorName: item.name,
    })),
  }
}

/**
 * Sets a group on a row. A named group the grid already has changes on every row holding that name (a group
 * is shared by name); a row with no group yet, or a new name, changes this row only.
 */
export function setGroup(
  rows: GmtCostingDetail[],
  kind: GroupKind,
  clientId: string,
  oldName: string,
  newName: string,
  items: GroupItem[],
  scope: "group" | "row",
): GmtCostingDetail[] {
  return rows.map((row) => {
    const inScope = scope === "row" || oldName === "" ? row.clientId === clientId : groupNameOf(row, kind) === oldName
    return inScope ? applyGroupToRow(row, kind, newName, items) : row
  })
}

/** A color cannot sit in two color groups (desktop ColourGroupColorValidation): the clashing group, or null. */
export function findColorConflict(rows: GmtCostingDetail[], ownGroupName: string, clientId: string, colorId: string) {
  for (const row of rows) {
    const isOwn = ownGroupName === "" ? row.clientId === clientId : groupNameOf(row, "color") === ownGroupName
    if (isOwn) continue
    if (row.lstGMT_COLORs.some((c) => c.gmtColorId === colorId)) return groupDisplayNameOf(row, "color")
  }
  return null
}

/** Every group of the grid of one kind, with its items and row count (the default group counted too). */
export function groupsOfGrid(rows: GmtCostingDetail[], kind: GroupKind) {
  const groups = new Map<string, { name: string; items: GroupItem[]; rows: number }>()
  for (const row of rows) {
    const name = groupDisplayNameOf(row, kind)
    const entry = groups.get(name) ?? { name, items: groupItemsOf(row, kind), rows: 0 }
    entry.rows += 1
    groups.set(name, entry)
  }
  return [...groups.values()]
}

// ---------- the details row ----------

export function emptyDetail(partial: Partial<GmtCostingDetail> = {}): GmtCostingDetail {
  return {
    clientId: newClientId(),
    id: "",
    masterId: "",
    fabricItemId: "",
    fabricItemName: "",
    uomId: null,
    uomName: "",
    gmtPartsId: null,
    gmtPartsName: "",
    fabricColorId: null,
    fabricColorName: "",
    fabricCostPerKg: 0,
    colorGroupName: "",
    sizeGroupName: "",
    fabricGsm: "",
    finishDia: "",
    fabricReqQtyPerPcsGmt: 0,
    fabricReqQtyPerDznGmt: 0,
    gmtWastagePercentage: 0,
    totalFabricItemQtyPerPcsGmt: 0,
    totalFabricItemQtyPerDznGmt: 0,
    fabricItemPricePerUnitKg: 0,
    fabricItemPricePerDzn: 0,
    additionalPrice: 0,
    totalFaricPricePerPcsGmt: 0,
    totalFaricPricePerDznGmt: 0,
    isColorWise: false,
    isShowCostInBudget: false,
    importChargePercentage: 0,
    fabricForm: "",
    remarks: "",
    collarPercentage: 0,
    collarQty: 0,
    isDoubleInPcsQty: false,
    lstGMT_SIZEs: [],
    lstGMT_COLORs: [],
    FabricCost: null,
    lstGMTWastage: [],
    ...partial,
  }
}

/** A copy with every saved id reset (a new row, a new fabric costing). */
export function copyDetail(row: GmtCostingDetail, partial: Partial<GmtCostingDetail> = {}): GmtCostingDetail {
  return {
    ...row,
    clientId: newClientId(),
    id: "",
    masterId: "",
    lstGMT_SIZEs: row.lstGMT_SIZEs.map((s) => ({ ...s, clientId: newClientId(), id: "", detailsId: "" })),
    lstGMT_COLORs: row.lstGMT_COLORs.map((c) => ({ ...c, clientId: newClientId(), id: "", detailsId: "" })),
    lstGMTWastage: row.lstGMTWastage.map((w) => ({ ...w, clientId: newClientId(), id: "", detailsId: "" })),
    FabricCost: row.FabricCost ? copyFabricCost(row.FabricCost) : null,
    ...partial,
  }
}

export function copyFabricCost(cost: GmtFabricCost): GmtFabricCost {
  return {
    ...cost,
    id: "",
    detailsId: "",
    lastYarnDtls: cost.lastYarnDtls.map((y) => ({
      ...y,
      clientId: newClientId(),
      id: "",
      fabricCostMstId: "",
      lstYarnWiseProcessDtls: y.lstYarnWiseProcessDtls.map((p) => ({ ...p, clientId: newClientId(), id: "", detailsFcYarnsTableId: "" })),
    })),
    lstProcessDtls: cost.lstProcessDtls.map((p) => ({ ...p, clientId: newClientId(), id: "", fabricCostMstId: "" })),
  }
}

/**
 * The four derived columns (letters as in the grid's headers):
 *   D Total Qty/Pcs = A Req Qty/Pcs grown by C GMT W%     E Total Qty/Dzn = B Req Qty/Dzn grown by C
 *   H Total Price/Pcs = D x F Item Price/Unit             I Total Price/Dzn = E x G Item Price/Dzn
 * Grown forward: qty x (1 + C/100); backward: qty / (1 - C/100), 0 at 100% or more (desktop
 * CalculateRowWiseTotalFabricQtyByWastage / CalculateRowWiseTotalFabricPrice).
 */
export function recalcRow(row: GmtCostingDetail, isGmtForward: boolean): GmtCostingDetail {
  const wastage = num(row.gmtWastagePercentage)
  const grow = (qty: number) => {
    if (isGmtForward) return round6(qty * (1 + wastage / 100))
    const factor = 1 - wastage / 100
    return factor <= 0 ? 0 : round6(qty / factor)
  }
  const totalPcs = grow(num(row.fabricReqQtyPerPcsGmt))
  const totalDzn = grow(num(row.fabricReqQtyPerDznGmt))
  return {
    ...row,
    totalFabricItemQtyPerPcsGmt: totalPcs,
    totalFabricItemQtyPerDznGmt: totalDzn,
    totalFaricPricePerPcsGmt: round6(totalPcs * num(row.fabricItemPricePerUnitKg)),
    totalFaricPricePerDznGmt: round6(totalDzn * num(row.fabricItemPricePerDzn)),
  }
}

/** Per pcs / per dozen pairs: typing one half writes the other at x12 or /12. */
export const DOZEN_PAIRS: Array<[keyof GmtCostingDetail, keyof GmtCostingDetail]> = [
  ["fabricReqQtyPerPcsGmt", "fabricReqQtyPerDznGmt"],
  ["fabricItemPricePerUnitKg", "fabricItemPricePerDzn"],
]

/** A typed value on a row: its dozen pair follows, the totals are recalculated. */
export function editDetailNumber(
  row: GmtCostingDetail,
  field: keyof GmtCostingDetail,
  value: number,
  isGmtForward: boolean,
): GmtCostingDetail {
  const next = { ...row, [field]: value } as GmtCostingDetail
  const pair = DOZEN_PAIRS.find(([unit, dzn]) => unit === field || dzn === field)
  if (pair) {
    const [unit, dzn] = pair
    if (field === unit) (next as Record<string, unknown>)[dzn] = round6(value * 12)
    else (next as Record<string, unknown>)[unit] = round6(value / 12)
  }
  return recalcRow(next, isGmtForward)
}

/** A row's item price once it has a fabric cost: the cost per unit, x12 per dozen. */
export function withFabricCost(row: GmtCostingDetail, cost: GmtFabricCost | null, isGmtForward: boolean): GmtCostingDetail {
  const perUnit = num(cost?.totalFabricCost ?? 0)
  return recalcRow(
    {
      ...row,
      FabricCost: cost,
      fabricCostPerKg: perUnit,
      ...(perUnit > 0 ? { fabricItemPricePerUnitKg: perUnit, fabricItemPricePerDzn: round6(perUnit * 12) } : {}),
    },
    isGmtForward,
  )
}

export const gmtWastageTotalOf = (lines: GmtDetailsWastage[]) =>
  round(lines.reduce((sum, line) => sum + num(line.gmtWastagePercentage), 0), 6)

// ---------- fabric costing ----------

const sumWastage = (processes: Array<{ processId: string; wastagePercentage: number }>, exclude: string[] = []) =>
  round6(processes.filter((p) => !exclude.includes(p.processId)).reduce((total, p) => total + num(p.wastagePercentage), 0))

/**
 * Every derived yarn field and the fabric cost per kg (desktop frmImportFabricCosting CalculateTotalQty /
 * CalculateTotalPrice). Each yarn is costed on the common processes plus its own process rows. Total qty
 * counts every process; grey qty leaves out knitting and yarn dyeing; dyed qty leaves out yarn dyeing.
 */
export function recalcFabricCost(
  yarns: GmtFabricCostYarn[],
  processes: GmtFabricCostProcess[],
  groups: ProcessGroups,
  isForward: boolean,
): { yarns: GmtFabricCostYarn[]; totalFabricCost: number } {
  const withWastage = (qty: number, wastage: number) => {
    if (isForward) return round6(qty * (1 + wastage / 100))
    const factor = 1 - wastage / 100
    return factor <= 0 ? 0 : round6(qty / factor)
  }
  const calculated = yarns.map((yarn) => {
    const all = [...processes, ...yarn.lstYarnWiseProcessDtls]
    const reqQty = num(yarn.yarnReqQtyPerKgFabric)
    const totalProcessCost = round6(all.reduce((total, p) => total + num(p.processRatePerKgFabric), 0))
    const totalYarnReqQtyPerKgFabric = withWastage(reqQty, sumWastage(all))
    const totalGreyReqQtyPerKgFabric = withWastage(reqQty, sumWastage(all, [...groups.knittingProcessIds, ...groups.yarnDyeingProcessIds]))
    const totalDyedYarnReqQtyPerKgFabric = withWastage(reqQty, sumWastage(all, groups.yarnDyeingProcessIds))
    // the import charge is a markup on the raw price
    const importFactor = 1 - num(yarn.importChargePercentagePerKgYarn) / 100
    const totalYarnPricePerKg = importFactor <= 0 ? 0 : round6(num(yarn.rowYarnPricePerKg) / importFactor)
    return {
      ...yarn,
      importChargePerKgYarn: round6(totalYarnPricePerKg - num(yarn.rowYarnPricePerKg)),
      totalYarnReqQtyPerKgFabric,
      totalGreyReqQtyPerKgFabric,
      totalDyedYarnReqQtyPerKgFabric,
      totalYarnPricePerKg,
      totalYarnPricePerKgFabric: round6(totalYarnReqQtyPerKgFabric * (totalYarnPricePerKg + totalProcessCost)),
    }
  })
  return { yarns: calculated, totalFabricCost: round6(calculated.reduce((t, y) => t + y.totalYarnPricePerKgFabric, 0)) }
}

/** The % that grows the yarns' req qty into their total qty, in the page's direction (2 decimals). */
export function fabricWastagePercent(yarns: GmtFabricCostYarn[], isForward: boolean) {
  const req = round6(yarns.reduce((s, y) => s + num(y.yarnReqQtyPerKgFabric), 0))
  const total = round6(yarns.reduce((s, y) => s + num(y.totalYarnReqQtyPerKgFabric), 0))
  if (isForward) return req > 0 ? round((total / req - 1) * 100, 2) : 0
  return total > 0 ? round((1 - req / total) * 100, 2) : 0
}

export const emptyYarn = (): GmtFabricCostYarn => ({
  clientId: newClientId(),
  id: "",
  fabricCostMstId: "",
  yarnId: "",
  yarnName: "",
  uomId: null,
  uomName: "",
  yarnReqQtyPerKgFabric: 0,
  rowYarnPricePerKg: 0,
  importChargePercentagePerKgYarn: 0,
  importChargePerKgYarn: 0,
  totalYarnPricePerKg: 0,
  totalYarnReqQtyPerKgFabric: 0,
  totalYarnPricePerKgFabric: 0,
  yarnDyeingColorId: null,
  yarnDyeingColorName: "",
  totalGreyReqQtyPerKgFabric: 0,
  totalDyedYarnReqQtyPerKgFabric: 0,
  stripMeasurement: "",
  yarnDyeingCost: 0,
  lstYarnWiseProcessDtls: [],
})

export const emptyProcess = (): GmtFabricCostProcess => ({
  clientId: newClientId(), id: "", fabricCostMstId: "", processId: "", processName: "", processRatePerKgFabric: 0, wastagePercentage: 0,
})

export const emptyYarnProcess = (): GmtFabricCostYarnProcess => ({
  clientId: newClientId(), id: "", detailsFcYarnsTableId: "", processId: "", processName: "", processRatePerKgFabric: 0, wastagePercentage: 0,
})

export const emptyFabricCost = (): GmtFabricCost => ({
  id: "", detailsId: "", costTemplateName: "", fabricId: null, fabricName: "", totalFabricCost: 0, fabricWastagePercentage: null,
  lastYarnDtls: [], lstProcessDtls: [],
})

/** Costings on the other rows of this costing, identical ones once (the fabric costing dialog's This tab). */
export function thisCostingItems(rows: GmtCostingDetail[], excludeClientId: string) {
  const seen = new Set<string>()
  const out: Array<{ key: string; label: string; cost: GmtFabricCost }> = []
  for (const row of rows) {
    const cost = row.FabricCost
    if (!cost || cost.lastYarnDtls.length === 0 || row.clientId === excludeClientId) continue
    const signature = JSON.stringify([
      row.fabricItemId,
      cost.totalFabricCost,
      cost.lastYarnDtls.map((y) => [y.yarnId, y.yarnReqQtyPerKgFabric, y.rowYarnPricePerKg]),
      cost.lstProcessDtls.map((p) => [p.processId, p.processRatePerKgFabric, p.wastagePercentage]),
    ])
    if (seen.has(signature)) continue
    seen.add(signature)
    out.push({
      key: row.clientId,
      label: [row.fabricItemName, row.gmtPartsName, groupDisplayNameOf(row, "color")].filter(Boolean).join(" · "),
      cost,
    })
  }
  return out
}

// ---------- other cost / commission / price ----------

export const emptyOtherCost = (scope?: CostScope): GmtOtherCost => ({
  clientId: newClientId(), id: "", masterId: "", costId: scope?.id ?? "", costName: scope?.name ?? "", costPerPcsGmt: 0, costPerDznGmt: 0, lstColors: [],
})

export const emptyCommission = (scope?: CostScope): GmtCommission => ({
  clientId: newClientId(), id: "", masterId: "", commissionId: scope?.id ?? "", commissionName: scope?.name ?? "", commissionPercentage: 0, commissionValue: 0,
})

const isAllGroup = (name: string, kind: GroupKind) =>
  name.trim() === "" || name.trim().toLowerCase() === groupDefaultName(kind).toLowerCase()

const groupNamesOf = (rows: GmtCostingDetail[], kind: GroupKind) => {
  const names: string[] = []
  rows.forEach((row) => {
    const name = groupDisplayNameOf(row, kind).trim()
    if (!isAllGroup(name, kind) && !names.includes(name)) names.push(name)
  })
  return names.length ? names : [groupDefaultName(kind)]
}

export type PriceRow = { colorGroupName: string; sizeGroupName: string; price: number }

/**
 * Desktop CalculateGMTCost, per color group x size group: the rows' Total Item Price/Pcs plus the other
 * costs ("All Color" takes all; a named group the colorless ones and those tagged with one of its colors),
 * then the commission % of that, then the commission values.
 */
export function buildPriceRows(rows: GmtCostingDetail[], otherCosts: GmtOtherCost[], commissions: GmtCommission[]): PriceRow[] {
  if (rows.length === 0) return []
  const percent = commissions.reduce((s, c) => s + num(c.commissionPercentage), 0)
  const value = commissions.reduce((s, c) => s + num(c.commissionValue), 0)
  const out: PriceRow[] = []
  for (const colorGroupName of groupNamesOf(rows, "color")) {
    const groupColorIds = new Set(
      rows.filter((r) => groupDisplayNameOf(r, "color") === colorGroupName).flatMap((r) => r.lstGMT_COLORs.map((c) => c.gmtColorId)),
    )
    const other = otherCosts.reduce((sum, cost) => {
      const applies =
        isAllGroup(colorGroupName, "color") || cost.lstColors.length === 0 || cost.lstColors.some((c) => groupColorIds.has(c.gmtColorId))
      return applies ? sum + num(cost.costPerPcsGmt) : sum
    }, 0)
    for (const sizeGroupName of groupNamesOf(rows, "size")) {
      const items = rows.reduce((sum, row) => {
        const color = groupDisplayNameOf(row, "color")
        const size = groupDisplayNameOf(row, "size")
        const match = (isAllGroup(color, "color") || color === colorGroupName) && (isAllGroup(size, "size") || size === sizeGroupName)
        return match ? sum + num(row.totalFaricPricePerPcsGmt) : sum
      }, 0)
      const cost = items + other
      out.push({ colorGroupName, sizeGroupName, price: round6(cost + (cost * percent) / 100 + value) })
    }
  }
  return out
}

/** The cost per pcs list from the price rows, keeping each group's confirmed price. */
export function costPerPcsFromPrices(prices: PriceRow[], current: GmtCostPerPcs[]): GmtCostPerPcs[] {
  return prices.map((price) => {
    const saved = current.find((c) => c.colorGroupName === price.colorGroupName && c.sizeGroupName === price.sizeGroupName)
    return {
      clientId: saved?.clientId ?? newClientId(),
      id: saved?.id ?? "",
      masterId: saved?.masterId ?? "",
      colorGroupName: price.colorGroupName,
      sizeGroupName: price.sizeGroupName,
      costingPricePerPcs: round(price.price, 4),
      confirmPricePerPcs: saved?.confirmPricePerPcs ?? 0,
    }
  })
}

// ---------- GMT wastage combos ----------

export type WastageCombo = { key: string; fabric: string; color: string; part: string; isDoubleInPcsQty: boolean }

export const comboKeyOf = (row: GmtCostingDetail) =>
  [row.fabricItemId, groupDisplayNameOf(row, "color"), row.gmtPartsId ?? ""].join("|")

/** Each distinct fabric / color group / part of the details, in their order. */
export function wastageCombos(rows: GmtCostingDetail[]): WastageCombo[] {
  const seen = new Map<string, WastageCombo>()
  for (const row of rows) {
    if (!row.fabricItemId) continue
    const key = comboKeyOf(row)
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        fabric: row.fabricItemName,
        color: groupDisplayNameOf(row, "color"),
        part: row.gmtPartsName,
        isDoubleInPcsQty: row.isDoubleInPcsQty,
      })
    }
  }
  return [...seen.values()]
}

// ---------- item-wise supplier ----------

/** Every yarn of the rows' fabric costs, plus the item of each row with no yarn; saved entries first. */
export function itemWiseSupplierRows(saved: GmtItemSupplier[], details: GmtCostingDetail[]): GmtItemSupplier[] {
  const items = new Map<string, string>()
  const add = (id: string, name: string) => {
    if (id && !items.has(id)) items.set(id, name)
  }
  details.forEach((row) => row.FabricCost?.lastYarnDtls.forEach((y) => add(y.yarnId, y.yarnName)))
  details.forEach((row) => {
    if (!row.FabricCost?.lastYarnDtls.length) add(row.fabricItemId, row.fabricItemName)
  })
  const out: GmtItemSupplier[] = []
  const seen = new Set<string>()
  for (const entry of saved) {
    if (!entry.itemId || seen.has(entry.itemId)) continue
    if (!items.has(entry.itemId) && entry.lstSupplierDetails.length === 0) continue
    seen.add(entry.itemId)
    out.push({ ...entry, itemName: entry.itemName || items.get(entry.itemId) || "" })
  }
  items.forEach((itemName, itemId) => {
    if (seen.has(itemId)) return
    out.push({ clientId: newClientId(), id: "", masterId: "", itemId, itemName, lstSupplierDetails: [] })
  })
  return out
}

// ---------- dto <-> screen ----------

export const today = () => new Date().toISOString().slice(0, 10)
const day = (value: unknown) => (typeof value === "string" ? value.slice(0, 10) : "")

export function emptyCosting(): GmtCosting {
  return {
    id: "",
    costName: "",
    buyerId: "",
    buyerName: "",
    styleId: "",
    styleNo: "",
    styleName: "",
    costDate: today(),
    shipDate: "",
    confirmDate: "",
    leadTime: 0,
    techSheetId: null,
    technicalSheetNo: "",
    gmtTotalCostFob: 0,
    expectedOrderQty: 0,
    smv: 0,
    cpm: 0,
    operators: 0,
    helper: 0,
    ironMan: 0,
    isActive: true,
    lstGMTCostPerPcs: [],
    lstDetails: [],
    lstGMTOtherCost: [],
    lstGMTCommission: [],
    lstFile: [],
    lstItemWiseSupplier: [],
  }
}

type Raw = Record<string, unknown>

export function fabricCostFromDto(raw: unknown): GmtFabricCost | null {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Raw
  return {
    id: text(c.id),
    detailsId: text(c.detailsId),
    costTemplateName: text(c.costTemplateName),
    fabricId: optionalId(c.fabricId),
    fabricName: text(c.fabricName),
    totalFabricCost: num(c.totalFabricCost),
    fabricWastagePercentage: c.fabricWastagePercentage === null || c.fabricWastagePercentage === undefined ? null : num(c.fabricWastagePercentage),
    lastYarnDtls: list<Raw>(c.lastYarnDtls).map((y) => ({
      ...emptyYarn(),
      id: text(y.id),
      fabricCostMstId: text(y.fabricCostMstId),
      yarnId: text(y.yarnId),
      yarnName: text(y.yarnName),
      uomId: optionalId(y.uomId),
      uomName: text(y.uomName),
      yarnReqQtyPerKgFabric: num(y.yarnReqQtyPerKgFabric),
      rowYarnPricePerKg: num(y.rowYarnPricePerKg),
      importChargePercentagePerKgYarn: num(y.importChargePercentagePerKgYarn),
      importChargePerKgYarn: num(y.importChargePerKgYarn),
      totalYarnPricePerKg: num(y.totalYarnPricePerKg),
      totalYarnReqQtyPerKgFabric: num(y.totalYarnReqQtyPerKgFabric),
      totalYarnPricePerKgFabric: num(y.totalYarnPricePerKgFabric),
      yarnDyeingColorId: optionalId(y.yarnDyeingColorId),
      yarnDyeingColorName: text(y.yarnDyeingColorName),
      totalGreyReqQtyPerKgFabric: num(y.totalGreyReqQtyPerKgFabric),
      totalDyedYarnReqQtyPerKgFabric: num(y.totalDyedYarnReqQtyPerKgFabric),
      stripMeasurement: text(y.stripMeasurement),
      yarnDyeingCost: num(y.yarnDyeingCost),
      lstYarnWiseProcessDtls: list<Raw>(y.lstYarnWiseProcessDtls).map((p) => ({
        clientId: newClientId(),
        id: text(p.id),
        detailsFcYarnsTableId: text(p.detailsFcYarnsTableId),
        processId: text(p.processId),
        processName: text(p.processName),
        processRatePerKgFabric: num(p.processRatePerKgFabric),
        wastagePercentage: num(p.wastagePercentage),
      })),
    })),
    lstProcessDtls: list<Raw>(c.lstProcessDtls).map((p) => ({
      clientId: newClientId(),
      id: text(p.id),
      fabricCostMstId: text(p.fabricCostMstId),
      processId: text(p.processId),
      processName: text(p.processName),
      processRatePerKgFabric: num(p.processRatePerKgFabric),
      wastagePercentage: num(p.wastagePercentage),
    })),
  }
}

export function detailFromDto(d: Raw): GmtCostingDetail {
  return emptyDetail({
    id: text(d.id),
    masterId: text(d.masterId),
    fabricItemId: text(d.fabricItemId),
    fabricItemName: text(d.fabricItemName),
    uomId: optionalId(d.uomId),
    uomName: text(d.uomName),
    gmtPartsId: optionalId(d.gmtPartsId),
    gmtPartsName: text(d.gmtPartsName),
    fabricColorId: optionalId(d.fabricColorId),
    fabricColorName: text(d.fabricColorName),
    fabricCostPerKg: num(d.fabricCostPerKg),
    colorGroupName: text(d.colorGroupName),
    sizeGroupName: text(d.sizeGroupName),
    fabricGsm: text(d.fabricGsm),
    finishDia: text(d.finishDia),
    fabricReqQtyPerPcsGmt: num(d.fabricReqQtyPerPcsGmt),
    fabricReqQtyPerDznGmt: num(d.fabricReqQtyPerDznGmt),
    gmtWastagePercentage: num(d.gmtWastagePercentage),
    totalFabricItemQtyPerPcsGmt: num(d.totalFabricItemQtyPerPcsGmt),
    totalFabricItemQtyPerDznGmt: num(d.totalFabricItemQtyPerDznGmt),
    fabricItemPricePerUnitKg: num(d.fabricItemPricePerUnitKg),
    fabricItemPricePerDzn: num(d.fabricItemPricePerDzn),
    additionalPrice: num(d.additionalPrice),
    totalFaricPricePerPcsGmt: num(d.totalFaricPricePerPcsGmt),
    totalFaricPricePerDznGmt: num(d.totalFaricPricePerDznGmt),
    isColorWise: Boolean(d.isColorWise),
    isShowCostInBudget: Boolean(d.isShowCostInBudget),
    importChargePercentage: num(d.importChargePercentage),
    fabricForm: text(d.fabricForm),
    remarks: text(d.remarks),
    collarPercentage: num(d.collarPercentage),
    collarQty: num(d.collarQty),
    isDoubleInPcsQty: Boolean(d.isDoubleInPcsQty),
    lstGMT_SIZEs: list<Raw>(d.lstGMT_SIZEs).map((s) => ({
      clientId: newClientId(), id: text(s.id), detailsId: text(s.detailsId), sizeGroupName: text(s.sizeGroupName),
      gmtSizeId: text(s.gmtSizeId), gmtSizeName: text(s.gmtSizeName),
    })),
    lstGMT_COLORs: list<Raw>(d.lstGMT_COLORs).map((c) => ({
      clientId: newClientId(), id: text(c.id), detailsId: text(c.detailsId), colorGroupName: text(c.colorGroupName),
      gmtColorId: text(c.gmtColorId), gmtColorName: text(c.gmtColorName),
    })),
    FabricCost: fabricCostFromDto(d.FabricCost),
    lstGMTWastage: list<Raw>(d.lstGMTWastage).map((w) => ({
      clientId: newClientId(), id: text(w.id), detailsId: text(w.detailsId), gmtProcessId: text(w.gmtProcessId),
      gmtProcessName: text(w.gmtProcessName), gmtWastagePercentage: num(w.gmtWastagePercentage),
    })),
  })
}

export function costingFromDto(raw: unknown): GmtCosting {
  const r = (raw ?? {}) as Raw
  return {
    ...emptyCosting(),
    id: text(r.id),
    costName: text(r.costName),
    buyerId: text(r.buyerId),
    buyerName: text(r.buyerName),
    styleId: text(r.styleId),
    styleNo: text(r.styleNo),
    styleName: text(r.styleName),
    costDate: day(r.costDate) || today(),
    shipDate: day(r.shipDate),
    confirmDate: day(r.confirmDate),
    leadTime: num(r.leadTime),
    techSheetId: optionalId(r.techSheetId),
    technicalSheetNo: text(r.technicalSheetNo),
    gmtTotalCostFob: num(r.gmtTotalCostFob),
    expectedOrderQty: num(r.expectedOrderQty),
    smv: num(r.smv),
    cpm: num(r.cpm),
    operators: num(r.operators),
    helper: num(r.helper),
    ironMan: num(r.ironMan),
    isActive: r.isActive !== false,
    lstGMTCostPerPcs: list<Raw>(r.lstGMTCostPerPcs).map((c) => ({
      clientId: newClientId(), id: text(c.id), masterId: text(c.masterId), colorGroupName: text(c.colorGroupName),
      sizeGroupName: text(c.sizeGroupName), costingPricePerPcs: num(c.costingPricePerPcs), confirmPricePerPcs: num(c.confirmPricePerPcs),
    })),
    lstDetails: list<Raw>(r.lstDetails).map(detailFromDto),
    lstGMTOtherCost: list<Raw>(r.lstGMTOtherCost).map((o) => ({
      clientId: newClientId(), id: text(o.id), masterId: text(o.masterId), costId: text(o.costId), costName: text(o.costName),
      costPerPcsGmt: num(o.costPerPcsGmt), costPerDznGmt: num(o.costPerDznGmt),
      lstColors: list<Raw>(o.lstColors).map((c) => ({
        clientId: newClientId(), id: text(c.id), otherCostDtlsId: text(c.otherCostDtlsId), gmtColorId: text(c.gmtColorId), gmtColorName: text(c.gmtColorName),
      })),
    })),
    lstGMTCommission: list<Raw>(r.lstGMTCommission).map((c) => ({
      clientId: newClientId(), id: text(c.id), masterId: text(c.masterId), commissionId: text(c.commissionId), commissionName: text(c.commissionName),
      commissionPercentage: num(c.commissionPercentage), commissionValue: num(c.commissionValue),
    })),
    lstFile: list<Raw>(r.lstFile).map((f) => ({
      clientId: newClientId(), id: text(f.id), masterId: text(f.masterId), fileAttachmentId: text(f.fileAttachmentId), fileName: text(f.fileName),
    })),
    lstItemWiseSupplier: list<Raw>(r.lstItemWiseSupplier).map((s) => ({
      clientId: newClientId(), id: text(s.id), masterId: text(s.masterId), itemId: text(s.itemId), itemName: text(s.itemName),
      lstSupplierDetails: list<Raw>(s.lstSupplierDetails).map((d) => ({
        clientId: newClientId(), id: text(d.id), itemWiseSupplierMasterId: text(d.itemWiseSupplierMasterId),
        supplierId: text(d.supplierId), supplierName: text(d.supplierName),
      })),
    })),
    createdBy: (r.createdBy as string) ?? null,
    createdDate: (r.createdDate as string) ?? null,
    updatedBy: (r.updatedBy as string) ?? null,
    updatedDate: (r.updatedDate as string) ?? null,
    createdByName: (r.createdByName as string) ?? null,
    updatedByName: (r.updatedByName as string) ?? null,
  }
}

/** Drops `clientId` everywhere (deep) and blanks optional dates; the rest is the API's shape already. */
function stripClientIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripClientIds)
  if (!value || typeof value !== "object") return value
  const out: Raw = {}
  for (const [key, v] of Object.entries(value as Raw)) {
    if (key === "clientId") continue
    out[key] = stripClientIds(v)
  }
  return out
}

/** The save / update body. Each fabric costing's wastage % is worked out in the current direction. */
export function costingToDto(costing: GmtCosting, settings: GmtCostingSettings) {
  const body = {
    ...costing,
    shipDate: costing.shipDate || null,
    confirmDate: costing.confirmDate || null,
    techSheetId: costing.techSheetId || null,
    lstDetails: costing.lstDetails.map((row) => ({
      ...row,
      gmtPartsId: row.gmtPartsId || null,
      fabricColorId: row.fabricColorId || null,
      uomId: row.uomId || null,
      FabricCost:
        row.FabricCost && (row.FabricCost.lastYarnDtls.length || row.FabricCost.lstProcessDtls.length)
          ? {
              ...row.FabricCost,
              fabricId: row.FabricCost.fabricId || row.fabricItemId || null,
              fabricWastagePercentage: fabricWastagePercent(row.FabricCost.lastYarnDtls, settings.isFabricForwardCalculation),
              lastYarnDtls: row.FabricCost.lastYarnDtls.filter((y) => !!y.yarnId).map((y) => ({
                ...y,
                uomId: y.uomId || null,
                yarnDyeingColorId: y.yarnDyeingColorId || null,
                lstYarnWiseProcessDtls: y.lstYarnWiseProcessDtls.filter((p) => !!p.processId),
              })),
              lstProcessDtls: row.FabricCost.lstProcessDtls.filter((p) => !!p.processId),
            }
          : null,
    })),
    lstGMTOtherCost: costing.lstGMTOtherCost.filter((o) => !!o.costId),
    lstGMTCommission: costing.lstGMTCommission.filter((c) => !!c.commissionId),
    lstItemWiseSupplier: costing.lstItemWiseSupplier
      .filter((s) => s.lstSupplierDetails.length > 0)
      .map((s) => ({ ...s, lstSupplierDetails: s.lstSupplierDetails.filter((d) => !!d.supplierId) })),
  }
  delete (body as Partial<GmtCosting>).createdByName
  delete (body as Partial<GmtCosting>).updatedByName
  return stripClientIds(body)
}

/** The FOB of the costing: the highest confirmed price, else the highest costing price. */
export function fobOf(perPcs: GmtCostPerPcs[], prices: PriceRow[]) {
  const confirmed = Math.max(0, ...perPcs.map((p) => num(p.confirmPricePerPcs)))
  if (confirmed > 0) return round(confirmed, 4)
  return round(Math.max(0, ...prices.map((p) => p.price)), 4)
}
