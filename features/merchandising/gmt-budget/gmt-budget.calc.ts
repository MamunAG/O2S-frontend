// The GMT Budget screen's logic, without React. Ported from ClickERP's gmt-budget.calc.ts / .schema.ts
// (the desktop ucGmtBudget.cs and frmImportFabricCosting_Budget.cs): a budget copies one style's costing
// onto one PO + style, splits it by the PO's colours and works every total out from the PO's quantities.
// GMT and fabric wastage are always forward here, as the desktop budget is.

import { newClientId } from "../gmt-costing/gmt-costing.calc"
import type { GmtCosting, GmtCostingDetail } from "../gmt-costing/gmt-costing.types"
import type {
  BudgetCommission,
  BudgetCostPerPcs,
  BudgetDetail,
  BudgetFabricCost,
  BudgetOtherCost,
  BudgetYarn,
  GmtBudget,
  PoStyleContext,
} from "./gmt-budget.types"

export const ALL_COLOR = "All Color"
export const ALL_SIZE = "All Size"

const n = (value: unknown) => Number(value ?? 0) || 0
const s = (value: unknown) => (value === null || value === undefined ? "" : String(value))
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
const optionalId = (value: unknown) => (value === null || value === undefined || value === "" || value === 0 ? null : String(value))

/** Math.Round(value, digits, MidpointRounding.ToEven): the desktop's rounding. */
export function roundEven(value: number, digits = 0): number {
  const factor = 10 ** digits
  const scaled = value * factor
  const floor = Math.floor(scaled)
  const rounded = Math.abs(scaled - floor - 0.5) < 1e-9 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled)
  return rounded / factor
}
const round6 = (value: number) => roundEven(value, 6)

// ---------- master ----------

/** desktop ReadAllFOB: Σ(qty × FOB) over the PO's lines of the style. */
export const totalFobOf = (po: PoStyleContext) => roundEven(po.lines.reduce((sum, l) => sum + l.qty * l.fob, 0), 6)

/** desktop totalValue: FOB less the buying commission %. */
export const balanceValueOf = (totalFob: number, buyingCommission: number) =>
  roundEven(totalFob - (totalFob * buyingCommission) / 100, 2)

export const poStyleQtyOf = (po: PoStyleContext) => po.lines.reduce((sum, l) => sum + l.qty, 0)

// ---------- one row ----------

/** desktop UpdatePOQty_dgvBudgetDetails: the PO qty of the row's colours and sizes (none = all). */
export function poQtyOf(row: BudgetDetail, po: PoStyleContext): number {
  const colorIds = row.colors.length ? row.colors.map((c) => c.gmtColorId) : null
  const sizeIds = row.sizes.length ? row.sizes.map((x) => x.gmtSizeId) : null
  return po.lines
    .filter((l) => (!colorIds || colorIds.includes(l.colorId)) && (!sizeIds || sizeIds.includes(l.sizeId)))
    .reduce((sum, l) => sum + l.qty, 0)
}

/** desktop SetAdditionalPriceByImportChargePer: the additional price an import charge % means. */
export function additionalPriceOf(unitPrice: number, importChargePercentage: number): number {
  if (importChargePercentage >= 100) return 0
  const importPrice = round6(unitPrice / (1 - importChargePercentage / 100))
  return round6(importPrice - unitPrice)
}

/** desktop SetImportChargePerByAdditionalPrice: the import charge % an additional price means. */
export function importChargeOf(unitPrice: number, additionalPrice: number): number {
  const total = unitPrice + additionalPrice
  return total === 0 ? 0 : round6((additionalPrice / total) * 100)
}

/**
 * desktop CalculateRowWiseTotalFabricQtyByWastage + CalculateRowWiseTotalFabricPrice, budgeted: qty per pcs
 * = working consumption grown by the budget GMT W%; price = item price + additional price (an import charge %
 * rewrites the additional price first).
 */
export function rowTotals(row: BudgetDetail) {
  const consumption = round6(n(row.fabricReqQtyPerPcsGmt))
  const wastage = round6(n(row.gmtWastagePercentageBudget))
  const qtyPerPcs = round6((consumption * wastage) / 100 + consumption)
  const unitPrice = round6(n(row.fabricItemPricePerUnitKgBudget))
  const importCharge = round6(n(row.importChargePercentageBudget))
  const additionalPrice = importCharge > 0 ? additionalPriceOf(unitPrice, importCharge) : round6(n(row.additionalPriceBudget))
  const price = round6(unitPrice + additionalPrice)
  return {
    additionalPriceBudget: additionalPrice,
    totalFabricItemQtyPerPcsGmtBudget: qtyPerPcs,
    totalFabricItemQtyPerDznGmtBudget: round6(qtyPerPcs * 12),
    totalFabricPricePerPcsGmtBudget: round6(qtyPerPcs * price),
    totalFabricPricePerDznGmtBudget: round6(qtyPerPcs * price * 12),
  }
}

/** desktop updateRowWiseTotalRequiredQty: the row's qty for the whole PO. */
export const totalRequiredQtyOf = (qtyPerPcs: number, poQty: number) => roundEven(qtyPerPcs * poQty, 2)

/** desktop onTotalQtyChangeInDgv: the working consumption a typed Total Req. Qty means (null: no PO qty). */
export function consumptionFromTotal(row: BudgetDetail) {
  const poQty = n(row.poQty)
  if (poQty <= 0) return null
  const qty = (100 * n(row.totalRequiredQty)) / (n(row.gmtWastagePercentageBudget) + 100)
  const perPcs = qty / poQty
  return { fabricReqQtyPerPcsGmt: round6(perPcs), fabricReqQtyPerDznGmt: round6(perPcs * 12) }
}

/** A typed consumption (either half): both visible halves and the working pair. */
export function consumptionOf(field: "fabricReqQtyPerPcsGmtInitial" | "fabricReqQtyPerDznGmtInitial", typed: number) {
  const isDozen = field === "fabricReqQtyPerDznGmtInitial"
  const perPcs = isDozen ? round6(typed / 12) : typed
  const perDzn = round6(isDozen ? typed : typed * 12)
  return {
    fabricReqQtyPerPcsGmtInitial: perPcs,
    fabricReqQtyPerDznGmtInitial: perDzn,
    fabricReqQtyPerPcsGmt: perPcs,
    fabricReqQtyPerDznGmt: perDzn,
  }
}

/** Item-Wise Total Value: PO qty × budgeted price per garment (always live). */
export const itemWiseTotalValueOf = (row: BudgetDetail) => roundEven(n(row.poQty) * n(row.totalFabricPricePerPcsGmtBudget), 4)

/** Collar Qty(pcs): (PO qty + its GMT W% in whole pieces) × 2 for a Double Pcs Qty row. */
export function collarQtyOf(poQty: number, percentage: number, isDouble: boolean): number {
  const wastage = roundEven((poQty * percentage) / 100, 0)
  return Math.ceil((poQty + wastage) * (isDouble ? 2 : 1))
}

/** Double Pcs Qty: the row's flag or, for older budgets, any wastage line's. */
export const isDoubleRow = (row: BudgetDetail) => row.isDoubleInPcsQty || row.wastages.some((w) => w.isWastageDouble)

/**
 * Every derived figure of one row from its inputs and the PO (desktop CalculateRowWiseAndTotalGMTCost plus
 * the PO qty / Total Req. Qty refresh). `refreshTotalRequired` false keeps a typed Total Req. Qty.
 */
export function recalcBudgetRow(row: BudgetDetail, po: PoStyleContext | null, refreshTotalRequired: boolean): BudgetDetail {
  const poQty = po ? poQtyOf(row, po) : n(row.poQty)
  const totals = rowTotals(row)
  return {
    ...row,
    ...(n(row.importChargePercentageBudget) > 0 ? totals : { ...totals, additionalPriceBudget: row.additionalPriceBudget }),
    poQty,
    totalRequiredQty: refreshTotalRequired ? totalRequiredQtyOf(totals.totalFabricItemQtyPerPcsGmtBudget, poQty) : n(row.totalRequiredQty),
    collarQty: collarQtyOf(poQty, n(row.gmtWastagePercentageBudget), isDoubleRow(row)),
  }
}

/** The sample fabric qty step: Total Req. Qty swaps the sample it held for the row's current one, then
 *  becomes the working consumption. Run with previous 0 after a consumption edit reset the total. */
export function applySampleQty(row: BudgetDetail, previous: number): BudgetDetail {
  const sample = n(row.sampleFabricQty)
  if (sample === previous) return row
  const next = { ...row, totalRequiredQty: roundEven(n(row.totalRequiredQty) - previous + sample, 2) }
  const consumption = consumptionFromTotal(next)
  return consumption ? { ...next, ...consumption } : next
}

/** A row's budgeted price once it has a budgeted fabric cost: the cost per unit, x12 per dozen. */
export function withBudgetFabricCost(row: BudgetDetail, cost: BudgetFabricCost | null): BudgetDetail {
  const perUnit = round6(n(cost?.totalFabricCostBudget))
  return {
    ...row,
    fabricCost: cost,
    fabricCostPerKg: cost ? n(cost.totalFabricCost) : row.fabricCostPerKg,
    fabricCostPerKgBudget: perUnit,
    ...(perUnit > 0 ? { fabricItemPricePerUnitKgBudget: perUnit, fabricItemPricePerDznBudget: round6(perUnit * 12) } : {}),
  }
}

/** GMT W% = the sum of the row's GMT process lines (a row with no lines keeps its own). */
export function syncGmtWastageTotal(row: BudgetDetail): BudgetDetail {
  if (row.wastages.length === 0) return row
  return {
    ...row,
    gmtWastagePercentage: round6(row.wastages.reduce((t, w) => t + n(w.gmtWastagePercentage), 0)),
    gmtWastagePercentageBudget: round6(row.wastages.reduce((t, w) => t + n(w.gmtWastagePercentageBudget), 0)),
  }
}

// ---------- fabric costing ----------

export type ProcessGroups = { knittingProcessIds: string[]; yarnDyeingProcessIds: string[] }

/**
 * desktop frmImportFabricCosting_Budget CalculateTotalQty + CalculateTotalPrice, on the budgeted values:
 * each yarn's qty grows by its processes' wastage (forward), its price by the import charge plus every
 * process rate; the fabric cost per kg is the sum over the yarns. Each yarn takes the common processes
 * plus its own. Grey qty leaves out knitting and yarn dyeing wastage, dyed qty yarn dyeing.
 */
export function recalcFabricCostBudget(fc: BudgetFabricCost, groups: ProcessGroups): BudgetFabricCost {
  const n6 = (v: unknown) => round6(n(v))
  const wastageOf = (processes: Array<{ processId: string; wastagePercentageBuget: number }>, leaveOut: string[] = []) =>
    round6(processes.filter((p) => !leaveOut.includes(p.processId)).reduce((sum, p) => sum + n6(p.wastagePercentageBuget), 0))
  const commonRate = round6(fc.processes.reduce((sum, p) => sum + n6(p.processRatePerKgFabricBuget), 0))
  const yarns = fc.yarns.map((y) => {
    const processes = [...fc.processes, ...y.yarnWiseProcesses]
    const rate = round6(y.yarnWiseProcesses.reduce((sum, p) => sum + n6(p.processRatePerKgFabricBuget), commonRate))
    const reqQty = n6(y.yarnReqQtyPerKgFabric)
    const totalQty = round6(reqQty * (1 + wastageOf(processes) / 100))
    const importPercent = n6(y.importChargePercentagePerKgYarnBudget)
    const yarnPrice = importPercent >= 100 ? 0 : round6(n6(y.rowYarnPricePerKgBudget) / (1 - importPercent / 100))
    return {
      ...y,
      totalYarnReqQtyPerKgFabric: totalQty,
      totalGreyReqQtyPerKgFabric: round6(reqQty * (1 + wastageOf(processes, [...groups.knittingProcessIds, ...groups.yarnDyeingProcessIds]) / 100)),
      totalDyedYarnReqQtyPerKgFabric: round6(reqQty * (1 + wastageOf(processes, groups.yarnDyeingProcessIds) / 100)),
      importChargePerKgYarnBudget: round6(yarnPrice - n6(y.rowYarnPricePerKgBudget)),
      totalYarnPricePerKgBudget: yarnPrice,
      yarnPricePerKgBudget: yarnPrice,
      totalYarnPricePerKgFabricBudget: round6(totalQty * (yarnPrice + rate)),
    }
  })
  return { ...fc, yarns, totalFabricCostBudget: round6(yarns.reduce((sum, y) => sum + n(y.totalYarnPricePerKgFabricBudget), 0)) }
}

/** The fabric's wastage %: (Σ total qty ÷ Σ req qty − 1) × 100, 2 decimals. */
export function fabricWastageBudget(yarns: BudgetYarn[]) {
  const req = round6(yarns.reduce((sum, y) => sum + n(y.yarnReqQtyPerKgFabric), 0))
  const total = round6(yarns.reduce((sum, y) => sum + n(y.totalYarnReqQtyPerKgFabric), 0))
  return req > 0 ? roundEven((total / req - 1) * 100, 2) : 0
}

export const emptyBudgetYarn = (): BudgetYarn => ({
  clientId: newClientId(), id: "", fabricCostMstId: "", yarnId: "", yarnName: "", uomId: null, uomName: "",
  yarnReqQtyPerKgFabric: 0, rowYarnPricePerKg: 0, rowYarnPricePerKgBudget: 0, yarnPricePerKgBudget: 0,
  importChargePercentagePerKgYarn: 0, importChargePercentagePerKgYarnBudget: 0, importChargePerKgYarn: 0, importChargePerKgYarnBudget: 0,
  totalYarnPricePerKg: 0, totalYarnPricePerKgBudget: 0, totalYarnReqQtyPerKgFabric: 0, totalYarnPricePerKgFabric: 0,
  totalYarnPricePerKgFabricBudget: 0, yarnDyeingColorId: null, yarnDyeingColorName: "", totalGreyReqQtyPerKgFabric: 0,
  totalDyedYarnReqQtyPerKgFabric: 0, stripMeasurement: "", yarnDyeingCost: 0, yarnWiseProcesses: [],
})

export const emptyBudgetProcess = () => ({
  clientId: newClientId(), id: "", fabricCostMstId: "", processId: "", processName: "",
  processRatePerKgFabric: 0, processRatePerKgFabricBuget: 0, wastagePercentage: 0, wastagePercentageBuget: 0,
})

export const emptyBudgetYarnProcess = () => ({
  clientId: newClientId(), id: "", detailsFcYarnsTableId: "", processId: "", processName: "",
  processRatePerKgFabric: 0, processRatePerKgFabricBuget: 0, wastagePercentage: 0, wastagePercentageBuget: 0,
})

export const emptyBudgetFabricCost = (row?: BudgetDetail): BudgetFabricCost => ({
  id: "", detailsId: "", costTemplateName: "", fabricId: row?.fabricItemId ?? "", fabricName: row?.fabricItemName ?? "",
  totalFabricCost: 0, totalFabricCostBudget: 0, fabricWastagePercentage: null, processes: [], yarns: [],
})

export function copyBudgetFabricCost(fc: BudgetFabricCost): BudgetFabricCost {
  return {
    ...fc,
    id: "",
    detailsId: "",
    processes: fc.processes.map((p) => ({ ...p, clientId: newClientId(), id: "", fabricCostMstId: "" })),
    yarns: fc.yarns.map((y) => ({
      ...y,
      clientId: newClientId(),
      id: "",
      fabricCostMstId: "",
      yarnWiseProcesses: y.yarnWiseProcesses.map((p) => ({ ...p, clientId: newClientId(), id: "", detailsFcYarnsTableId: "" })),
    })),
  }
}

// ---------- rows ----------

export function emptyBudgetDetail(partial: Partial<BudgetDetail> = {}): BudgetDetail {
  return {
    clientId: newClientId(), id: "", masterId: "", fabricItemId: "", fabricItemName: "", uomId: null, uomName: "",
    gmtPartsId: null, gmtPartsName: "", fabricColorId: null, fabricColorName: "", colorGroupName: "", sizeGroupName: "",
    fabricGsm: "", finishDia: "", knitMcDia: "", fabricCostPerKg: 0, fabricCostPerKgBudget: 0,
    fabricReqQtyPerPcsGmt: 0, fabricReqQtyPerDznGmt: 0, fabricReqQtyPerPcsGmtInitial: 0, fabricReqQtyPerDznGmtInitial: 0,
    fabricReqQtyPerPcsGmtLength: 0, fabricReqQtyPerDznGmtLength: 0, gmtWastagePercentage: 0, gmtWastagePercentageBudget: 0,
    cadWastagePercentage: 0, totalFabricItemQtyPerPcsGmt: 0, totalFabricItemQtyPerDznGmt: 0,
    totalFabricItemQtyPerPcsGmtBudget: 0, totalFabricItemQtyPerDznGmtBudget: 0,
    totalFabricItemQtyPerPcsGmtBudgetLength: 0, totalFabricItemQtyPerDznGmtBudgetLength: 0,
    fabricItemPricePerUnitKg: 0, fabricItemPricePerUnitKgBudget: 0, fabricItemPricePerDzn: 0, fabricItemPricePerDznBudget: 0,
    additionalPrice: 0, additionalPriceBudget: 0, totalFabricPricePerPcsGmt: 0, totalFabricPricePerDznGmt: 0,
    totalFabricPricePerPcsGmtBudget: 0, totalFabricPricePerDznGmtBudget: 0, importChargePercentage: 0, importChargePercentageBudget: 0,
    poQty: 0, sampleFabricQty: 0, totalRequiredQty: 0, totalRequiredQtyLength: 0, isColorWise: false, isShowCostInBudget: true,
    fabricForm: "", remarks: "", collarPercentage: 0, collarQty: 0, isDoubleInPcsQty: false,
    colors: [], sizes: [], wastages: [], fabricCost: null,
    ...partial,
  }
}

export function copyBudgetDetail(row: BudgetDetail, partial: Partial<BudgetDetail> = {}): BudgetDetail {
  return {
    ...row,
    clientId: newClientId(),
    id: "",
    masterId: "",
    colors: row.colors.map((c) => ({ ...c, clientId: newClientId(), id: "", detailsId: "" })),
    sizes: row.sizes.map((x) => ({ ...x, clientId: newClientId(), id: "", detailsId: "" })),
    wastages: row.wastages.map((w) => ({ ...w, clientId: newClientId(), id: "", detailsId: "" })),
    fabricCost: row.fabricCost ? copyBudgetFabricCost(row.fabricCost) : null,
    ...partial,
  }
}

const groupName = (name: string, items: unknown[], all: string) => (items.length ? name || all : all)

/** The group of a row as the costing's group dialog reads it (lstGMT_SIZEs / lstGMT_COLORs). */
export function asCostingRow(row: BudgetDetail): GmtCostingDetail {
  return {
    clientId: row.clientId,
    fabricItemName: row.fabricItemName,
    colorGroupName: row.colors.length ? row.colorGroupName : "",
    sizeGroupName: row.sizes.length ? row.sizeGroupName : "",
    lstGMT_SIZEs: row.sizes,
    lstGMT_COLORs: row.colors,
  } as unknown as GmtCostingDetail
}

/** The groups the costing's group dialog wrote, back onto the budget rows. */
export function fromCostingRows(rows: BudgetDetail[], edited: GmtCostingDetail[]): BudgetDetail[] {
  const byId = new Map(edited.map((r) => [r.clientId, r]))
  return rows.map((row) => {
    const e = byId.get(row.clientId)
    if (!e) return row
    return {
      ...row,
      colorGroupName: groupName(e.colorGroupName, e.lstGMT_COLORs, ALL_COLOR),
      sizeGroupName: groupName(e.sizeGroupName, e.lstGMT_SIZEs, ALL_SIZE),
      colors: e.lstGMT_COLORs.map((c) => ({ clientId: c.clientId, id: c.id, detailsId: c.detailsId, colorGroupName: c.colorGroupName, gmtColorId: c.gmtColorId, gmtColorName: c.gmtColorName })),
      sizes: e.lstGMT_SIZEs.map((x) => ({ clientId: x.clientId, id: x.id, detailsId: x.detailsId, sizeGroupName: x.sizeGroupName, gmtSizeId: x.gmtSizeId, gmtSizeName: x.gmtSizeName })),
    }
  })
}

// ---------- cost per pcs ----------

const isAll = (name: string, all: string) => !name.trim() || name.trim().toLowerCase() === all.toLowerCase()

/**
 * desktop CalculateGMTCost: one price per colour group × size group, the budgeted price per garment of its
 * rows (an "All" row counts in every group), plus the other costs ("All Color" takes them all; a named group
 * the colourless ones and those of its colours), then the commission % and the commission value.
 */
export function buildCostPerPcs(details: BudgetDetail[], otherCosts: BudgetOtherCost[], commissions: BudgetCommission[], current: BudgetCostPerPcs[]) {
  if (details.length === 0) return []
  const colorGroups = [...new Set(details.filter((r) => r.colors.length).map((r) => r.colorGroupName || ""))]
  const sizeGroups = [...new Set(details.filter((r) => r.sizes.length).map((r) => r.sizeGroupName || ""))]
  if (!colorGroups.length) colorGroups.push(ALL_COLOR)
  if (!sizeGroups.length) sizeGroups.push(ALL_SIZE)
  const percent = commissions.reduce((sum, c) => sum + n(c.commissionPercentageBudget), 0)
  const value = commissions.reduce((sum, c) => sum + n(c.commissionValueBudget), 0)
  const out: BudgetCostPerPcs[] = []
  for (const colorGroup of colorGroups) {
    for (const sizeGroup of sizeGroups) {
      const inGroup = details.filter(
        (r) => (r.colorGroupName === colorGroup || !r.colors.length) && (r.sizeGroupName === sizeGroup || !r.sizes.length),
      )
      let price = inGroup.reduce((sum, r) => sum + n(r.totalFabricPricePerPcsGmtBudget), 0)
      if (isAll(colorGroup, ALL_COLOR)) price += otherCosts.reduce((sum, o) => sum + n(o.costPerPcsGmtBudget), 0)
      else {
        const colorIds = new Set(
          details.filter((r) => r.colorGroupName === colorGroup || !r.colors.length).flatMap((r) => r.colors.map((c) => c.gmtColorId)),
        )
        otherCosts.forEach((o) => {
          if (!o.lstColors.length || o.lstColors.some((c) => colorIds.has(c.gmtColorId))) price += n(o.costPerPcsGmtBudget)
        })
      }
      price += (price * percent) / 100 + value
      const saved = current.find((c) => c.colorGroupName === colorGroup && c.sizeGroupName === sizeGroup)
      out.push({
        clientId: saved?.clientId ?? newClientId(),
        id: saved?.id ?? "",
        masterId: saved?.masterId ?? "",
        colorGroupName: colorGroup,
        sizeGroupName: sizeGroup,
        costingPricePerPcs: round6(price),
        confirmPricePerPcs: saved?.confirmPricePerPcs ?? 0,
      })
    }
  }
  return out
}

// ---------- from the costing ----------

/**
 * desktop GMTBudgetUtility.UpdateBudgetDataForNewBudget: a costing row as a budget row, every budget figure
 * at its costing value, or 0 for a row the costing marked "do not show cost in budget".
 */
function costingRowToBudget(d: GmtCostingDetail): BudgetDetail {
  const show = d.isShowCostInBudget !== false
  const fc = d.FabricCost
  const v = (x: number) => (show ? x : 0)
  const row = emptyBudgetDetail({
    fabricItemId: d.fabricItemId, fabricItemName: d.fabricItemName, uomId: d.uomId, uomName: d.uomName,
    gmtPartsId: d.gmtPartsId, gmtPartsName: d.gmtPartsName, fabricColorId: d.fabricColorId, fabricColorName: d.fabricColorName,
    colorGroupName: d.lstGMT_COLORs.length ? d.colorGroupName : ALL_COLOR, sizeGroupName: d.lstGMT_SIZEs.length ? d.sizeGroupName : ALL_SIZE,
    fabricGsm: d.fabricGsm, finishDia: d.finishDia, fabricForm: d.fabricForm, remarks: d.remarks,
    isColorWise: d.isColorWise, isShowCostInBudget: d.isShowCostInBudget,
    fabricReqQtyPerPcsGmt: d.fabricReqQtyPerPcsGmt, fabricReqQtyPerDznGmt: d.fabricReqQtyPerDznGmt,
    fabricReqQtyPerPcsGmtInitial: v(d.fabricReqQtyPerPcsGmt), fabricReqQtyPerDznGmtInitial: v(d.fabricReqQtyPerDznGmt),
    fabricCostPerKg: d.fabricCostPerKg, gmtWastagePercentage: d.gmtWastagePercentage,
    totalFabricItemQtyPerPcsGmt: d.totalFabricItemQtyPerPcsGmt, totalFabricItemQtyPerDznGmt: d.totalFabricItemQtyPerDznGmt,
    fabricItemPricePerUnitKg: d.fabricItemPricePerUnitKg, fabricItemPricePerDzn: d.fabricItemPricePerDzn,
    importChargePercentage: d.importChargePercentage, additionalPrice: d.additionalPrice,
    totalFabricPricePerPcsGmt: d.totalFaricPricePerPcsGmt, totalFabricPricePerDznGmt: d.totalFaricPricePerDznGmt,
    fabricCostPerKgBudget: v(n(fc?.totalFabricCost)), gmtWastagePercentageBudget: v(d.gmtWastagePercentage),
    totalFabricItemQtyPerPcsGmtBudget: v(d.totalFabricItemQtyPerPcsGmt), totalFabricItemQtyPerDznGmtBudget: v(d.totalFabricItemQtyPerDznGmt),
    fabricItemPricePerUnitKgBudget: v(d.fabricItemPricePerUnitKg), fabricItemPricePerDznBudget: v(d.fabricItemPricePerDzn),
    importChargePercentageBudget: v(d.importChargePercentage), additionalPriceBudget: v(d.additionalPrice),
    totalFabricPricePerPcsGmtBudget: v(d.totalFaricPricePerPcsGmt), totalFabricPricePerDznGmtBudget: v(d.totalFaricPricePerDznGmt),
    collarPercentage: d.collarPercentage, collarQty: d.collarQty, isDoubleInPcsQty: d.isDoubleInPcsQty,
    colors: d.lstGMT_COLORs.map((c) => ({ clientId: newClientId(), id: "", detailsId: "", colorGroupName: c.colorGroupName, gmtColorId: c.gmtColorId, gmtColorName: c.gmtColorName })),
    sizes: d.lstGMT_SIZEs.map((x) => ({ clientId: newClientId(), id: "", detailsId: "", sizeGroupName: x.sizeGroupName, gmtSizeId: x.gmtSizeId, gmtSizeName: x.gmtSizeName })),
    wastages: d.lstGMTWastage.map((w) => ({
      clientId: newClientId(), id: "", detailsId: "", gmtProcessId: w.gmtProcessId, gmtProcessName: w.gmtProcessName,
      gmtWastagePercentage: w.gmtWastagePercentage, gmtWastagePercentageBudget: v(w.gmtWastagePercentage), isWastageDouble: d.isDoubleInPcsQty,
    })),
    fabricCost: fc
      ? {
          id: "", detailsId: "", costTemplateName: fc.costTemplateName, fabricId: fc.fabricId || d.fabricItemId, fabricName: fc.fabricName,
          totalFabricCost: fc.totalFabricCost, totalFabricCostBudget: v(fc.totalFabricCost), fabricWastagePercentage: fc.fabricWastagePercentage,
          yarns: fc.lastYarnDtls.map((y) => ({
            ...emptyBudgetYarn(),
            yarnId: y.yarnId, yarnName: y.yarnName, uomId: y.uomId, uomName: y.uomName,
            yarnReqQtyPerKgFabric: y.yarnReqQtyPerKgFabric, totalYarnReqQtyPerKgFabric: y.totalYarnReqQtyPerKgFabric,
            totalGreyReqQtyPerKgFabric: y.totalGreyReqQtyPerKgFabric, totalDyedYarnReqQtyPerKgFabric: y.totalDyedYarnReqQtyPerKgFabric,
            rowYarnPricePerKg: y.rowYarnPricePerKg, importChargePercentagePerKgYarn: y.importChargePercentagePerKgYarn,
            importChargePerKgYarn: n(y.importChargePerKgYarn), totalYarnPricePerKg: y.totalYarnPricePerKg,
            totalYarnPricePerKgFabric: y.totalYarnPricePerKgFabric, rowYarnPricePerKgBudget: v(y.rowYarnPricePerKg),
            importChargePercentagePerKgYarnBudget: v(y.importChargePercentagePerKgYarn), totalYarnPricePerKgBudget: v(y.totalYarnPricePerKg),
            yarnPricePerKgBudget: v(y.totalYarnPricePerKg), totalYarnPricePerKgFabricBudget: v(y.totalYarnPricePerKgFabric),
            yarnDyeingColorId: y.yarnDyeingColorId, yarnDyeingColorName: y.yarnDyeingColorName, stripMeasurement: y.stripMeasurement,
            yarnDyeingCost: y.yarnDyeingCost,
            yarnWiseProcesses: y.lstYarnWiseProcessDtls.map((p) => ({
              clientId: newClientId(), id: "", detailsFcYarnsTableId: "", processId: p.processId, processName: p.processName,
              processRatePerKgFabric: p.processRatePerKgFabric, wastagePercentage: p.wastagePercentage,
              processRatePerKgFabricBuget: v(p.processRatePerKgFabric), wastagePercentageBuget: v(p.wastagePercentage),
            })),
          })),
          processes: fc.lstProcessDtls.map((p) => ({
            clientId: newClientId(), id: "", fabricCostMstId: "", processId: p.processId, processName: p.processName,
            processRatePerKgFabric: p.processRatePerKgFabric, wastagePercentage: p.wastagePercentage,
            processRatePerKgFabricBuget: v(p.processRatePerKgFabric), wastagePercentageBuget: v(p.wastagePercentage),
          })),
        }
      : null,
  })
  return syncGmtWastageTotal(row)
}

/**
 * desktop ucGmtBudget.AddDetailsDataInDgv: a row with colours, or a colour-wise row, becomes one row per
 * colour, only the colours the PO has for the style (a colour-wise row with none gets every PO colour);
 * every other row stays one "All Color" row.
 */
export function splitRowsByPoColors(rows: BudgetDetail[], po: PoStyleContext): BudgetDetail[] {
  const poColorIds = new Set(po.colors.map((c) => c.id))
  const out: BudgetDetail[] = []
  for (const row of rows) {
    if (!(row.colors.length > 0 || row.isColorWise)) {
      out.push({ ...row, colorGroupName: row.colors.length ? row.colorGroupName : ALL_COLOR })
      continue
    }
    const colors = row.colors.length
      ? row.colors.filter((c) => poColorIds.has(c.gmtColorId))
      : po.colors.map((c) => ({ clientId: newClientId(), id: "", detailsId: "", colorGroupName: c.name, gmtColorId: c.id, gmtColorName: c.name }))
    for (const color of colors) {
      out.push(
        copyBudgetDetail(row, {
          colorGroupName: color.gmtColorName,
          colors: [{ ...color, clientId: newClientId(), colorGroupName: color.gmtColorName }],
          fabricColorId: row.fabricColorId || color.gmtColorId,
          fabricColorName: row.fabricColorId ? row.fabricColorName : color.gmtColorName,
        }),
      )
    }
  }
  return out.sort(
    (a, b) =>
      a.colorGroupName.localeCompare(b.colorGroupName) ||
      a.fabricItemName.localeCompare(b.fabricItemName) ||
      a.sizeGroupName.localeCompare(b.sizeGroupName) ||
      a.fabricColorName.localeCompare(b.fabricColorName),
  )
}

/** Colour names of the costing's rows that the PO does not have for the style (dropped, with a warning). */
export function missingPoColors(costing: GmtCosting, po: PoStyleContext) {
  const ids = new Set(po.colors.map((c) => c.id))
  const missing = new Set<string>()
  costing.lstDetails.forEach((d) => d.lstGMT_COLORs.forEach((c) => !ids.has(c.gmtColorId) && missing.add(c.gmtColorName)))
  return [...missing]
}

/** desktop LoadDataByGMTCost: the costing's rows split by the PO's colours, its other costs and commissions
 *  with every budget copy set, each row worked out against the PO. */
export function costingToBudget(costing: GmtCosting, po: PoStyleContext) {
  const rows = splitRowsByPoColors(costing.lstDetails.map(costingRowToBudget), po).map((r) => recalcBudgetRow(r, po, true))
  return {
    costId: costing.id,
    costingNo: costing.costName,
    techSheetId: costing.techSheetId,
    techSheet: costing.technicalSheetNo,
    details: rows,
    otherCosts: costing.lstGMTOtherCost.map<BudgetOtherCost>((o) => ({
      clientId: newClientId(), id: "", masterId: "", costId: o.costId, costName: o.costName,
      costPerPcsGmt: o.costPerPcsGmt, costPerDznGmt: o.costPerDznGmt, costPerPcsGmtBudget: o.costPerPcsGmt, costPerDznGmtBudget: o.costPerDznGmt,
      lstColors: o.lstColors.map((c) => ({ clientId: newClientId(), id: "", otherCostDtlsId: "", gmtColorId: c.gmtColorId, gmtColorName: c.gmtColorName })),
    })),
    // the desktop copies the commission % into its budget copy, not the value
    commissions: costing.lstGMTCommission.map<BudgetCommission>((c) => ({
      clientId: newClientId(), id: "", masterId: "", commissionId: c.commissionId, commissionName: c.commissionName,
      commissionPercentage: c.commissionPercentage, commissionPercentageBudget: c.commissionPercentage,
      commissionValue: c.commissionValue, commissionValueBudget: 0,
    })),
    missingColors: missingPoColors(costing, po),
  }
}

// ---------- PO lines ----------

/** The PO + style's job lines (JobDto.details) as the budget's PO context. */
export function poContextOf(lines: Array<Record<string, unknown>>): PoStyleContext {
  const colors = new Map<string, string>()
  const sizes = new Map<string, string>()
  const out = lines.map((l) => {
    const colorObj = (l.colors ?? l.color) as Record<string, unknown> | undefined
    const sizeObj = (l.sizes ?? l.size) as Record<string, unknown> | undefined
    const line = {
      colorId: s(l.colorId),
      colorName: s(colorObj?.colorName ?? l.colorId),
      sizeId: s(l.sizeId),
      sizeName: s(sizeObj?.sizeName ?? l.sizeId),
      qty: n(l.quantity),
      fob: n(l.fob),
    }
    if (line.colorId) colors.set(line.colorId, line.colorName)
    if (line.sizeId) sizes.set(line.sizeId, line.sizeName)
    return line
  })
  return {
    lines: out,
    colors: [...colors].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: [...sizes].map(([id, name]) => ({ id, name })),
  }
}

// ---------- dto <-> screen ----------

const day = (value: unknown) => (typeof value === "string" ? value.slice(0, 10) : "")
export const today = () => new Date().toISOString().slice(0, 10)

export function emptyBudget(): GmtBudget {
  return {
    id: "", budgetName: "", budgetDate: today(), buyerId: "", buyer: "", styleId: "", style: "", styleName: "", poId: "", po: "",
    costId: "", costingNo: "", totalFob: 0, buyingCommission: 0, balanceValue: 0, techSheetId: null, techSheet: "",
    fabricSourceId: null, fabricSource: "", commercialFactoryId: null, commercialFactory: "",
    details: [], specialTreatments: [], revises: [], otherCosts: [], mstFiles: [], costPerPcs: [], commissions: [],
    bookingComments: [], budgetComments: [],
  }
}

type Raw = Record<string, unknown>
const process = (p: Raw) => ({
  clientId: newClientId(), id: s(p.id), processId: s(p.processId), processName: s(p.processName),
  processRatePerKgFabric: n(p.processRatePerKgFabric), processRatePerKgFabricBuget: n(p.processRatePerKgFabricBuget),
  wastagePercentage: n(p.wastagePercentage), wastagePercentageBuget: n(p.wastagePercentageBuget),
})

function fabricCostFromDto(raw: unknown): BudgetFabricCost | null {
  if (!raw || typeof raw !== "object") return null
  const f = raw as Raw
  return {
    id: s(f.id), detailsId: s(f.detailsId), costTemplateName: s(f.costTemplateName), fabricId: s(f.fabricId), fabricName: s(f.fabricName),
    totalFabricCost: n(f.totalFabricCost), totalFabricCostBudget: n(f.totalFabricCostBudget),
    fabricWastagePercentage: f.fabricWastagePercentage === null || f.fabricWastagePercentage === undefined ? null : n(f.fabricWastagePercentage),
    processes: list<Raw>(f.processes).map((p) => ({ ...process(p), fabricCostMstId: s(p.fabricCostMstId) })),
    yarns: list<Raw>(f.yarns).map((y) => ({
      ...emptyBudgetYarn(),
      ...(Object.fromEntries(Object.entries(y).filter(([k]) => k !== "yarnWiseProcesses")) as Partial<BudgetYarn>),
      clientId: newClientId(),
      yarnName: s(y.yarnName), uomName: s(y.uomName), yarnDyeingColorName: s(y.yarnDyeingColorName), stripMeasurement: s(y.stripMeasurement),
      uomId: optionalId(y.uomId), yarnDyeingColorId: optionalId(y.yarnDyeingColorId),
      yarnWiseProcesses: list<Raw>(y.yarnWiseProcesses).map((p) => ({ ...process(p), detailsFcYarnsTableId: s(p.detailsFcYarnsTableId) })),
    })),
  }
}

function detailFromDto(d: Raw): BudgetDetail {
  const base = emptyBudgetDetail()
  const row = emptyBudgetDetail({
    ...(Object.fromEntries(
      Object.entries(d).filter(([k, v]) => k in base && typeof v !== "object" && v !== null && v !== undefined),
    ) as Partial<BudgetDetail>),
    clientId: newClientId(),
    uomId: optionalId(d.uomId), gmtPartsId: optionalId(d.gmtPartsId), fabricColorId: optionalId(d.fabricColorId),
    colors: list<Raw>(d.colors).map((c) => ({ clientId: newClientId(), id: s(c.id), detailsId: s(c.detailsId), colorGroupName: s(c.colorGroupName), gmtColorId: s(c.gmtColorId), gmtColorName: s(c.gmtColorName) })),
    sizes: list<Raw>(d.sizes).map((x) => ({ clientId: newClientId(), id: s(x.id), detailsId: s(x.detailsId), sizeGroupName: s(x.sizeGroupName), gmtSizeId: s(x.gmtSizeId), gmtSizeName: s(x.gmtSizeName) })),
    wastages: list<Raw>(d.wastages).map((w) => ({
      clientId: newClientId(), id: s(w.id), detailsId: s(w.detailsId), gmtProcessId: s(w.gmtProcessId), gmtProcessName: s(w.gmtProcessName),
      gmtWastagePercentage: n(w.gmtWastagePercentage), gmtWastagePercentageBudget: n(w.gmtWastagePercentageBudget), isWastageDouble: Boolean(w.isWastageDouble),
    })),
    fabricCost: fabricCostFromDto(list(d.fabricCosts)[0]),
  })
  // an initial consumption never stored reads as the working one (desktop BudgetService.GetBudget)
  if (!row.fabricReqQtyPerDznGmtInitial) {
    row.fabricReqQtyPerPcsGmtInitial = row.fabricReqQtyPerPcsGmt
    row.fabricReqQtyPerDznGmtInitial = row.fabricReqQtyPerDznGmt
  }
  if (row.fabricCost) {
    row.fabricCostPerKg = row.fabricCost.totalFabricCost
    row.fabricCostPerKgBudget = row.fabricCost.totalFabricCostBudget
  }
  if (!row.colorGroupName || !row.colors.length) row.colorGroupName = row.colors.length ? row.colorGroupName : ALL_COLOR
  if (!row.sizeGroupName || !row.sizes.length) row.sizeGroupName = row.sizes.length ? row.sizeGroupName : ALL_SIZE
  return syncGmtWastageTotal(row)
}

export function budgetFromDto(raw: unknown): GmtBudget {
  const r = (raw ?? {}) as Raw
  return {
    ...emptyBudget(),
    id: s(r.id), budgetName: s(r.budgetName), budgetDate: day(r.budgetDate) || today(),
    buyerId: s(r.buyerId), buyer: s(r.buyer), styleId: s(r.styleId), style: s(r.style), styleName: s(r.styleName),
    poId: s(r.poId), po: s(r.po), costId: s(r.costId), costingNo: s(r.costingNo),
    totalFob: n(r.totalFob), buyingCommission: n(r.buyingCommission), balanceValue: n(r.balanceValue),
    techSheetId: optionalId(r.techSheetId), techSheet: s(r.techSheet), fabricSourceId: optionalId(r.fabricSourceId), fabricSource: s(r.fabricSource),
    commercialFactoryId: optionalId(r.commercialFactoryId), commercialFactory: s(r.commercialFactory),
    details: list<Raw>(r.details).map(detailFromDto),
    specialTreatments: list<Raw>(r.specialTreatments).map((t) => ({ clientId: newClientId(), id: s(t.id), masterId: s(t.masterId), specialTreatmentId: s(t.specialTreatmentId), treatment: s(t.treatment) })),
    revises: list<Raw>(r.revises).map((v) => ({ clientId: newClientId(), id: s(v.id), masterId: s(v.masterId), reviceNo: n(v.reviceNo), reviceDate: day(v.reviceDate), reviceReason: s(v.reviceReason), revisedByName: s(v.revisedByName || v.revisedBy) })),
    otherCosts: list<Raw>(r.otherCosts).map((o) => ({
      clientId: newClientId(), id: s(o.id), masterId: s(o.masterId), costId: s(o.costId), costName: s(o.costName),
      costPerPcsGmt: n(o.costPerPcsGmt), costPerDznGmt: n(o.costPerDznGmt), costPerPcsGmtBudget: n(o.costPerPcsGmtBudget), costPerDznGmtBudget: n(o.costPerDznGmtBudget),
      lstColors: list<Raw>(o.lstColors).map((c) => ({ clientId: newClientId(), id: s(c.id), otherCostDtlsId: s(c.otherCostDtlsId), gmtColorId: s(c.gmtColorId), gmtColorName: s(c.gmtColorName) })),
    })),
    mstFiles: list<Raw>(r.mstFiles).map((f) => ({ clientId: newClientId(), id: s(f.id), masterId: s(f.masterId), fileAttachmentId: s(f.fileAttachmentId), fileName: s(f.fileName) })),
    costPerPcs: list<Raw>(r.costPerPcs).map((c) => ({ clientId: newClientId(), id: s(c.id), masterId: s(c.masterId), colorGroupName: s(c.colorGroupName), sizeGroupName: s(c.sizeGroupName), costingPricePerPcs: n(c.costingPricePerPcs), confirmPricePerPcs: n(c.confirmPricePerPcs) })),
    commissions: list<Raw>(r.commissions).map((c) => ({
      clientId: newClientId(), id: s(c.id), masterId: s(c.masterId), commissionId: s(c.commissionId), commissionName: s(c.commissionName),
      commissionPercentage: n(c.commissionPercentage), commissionPercentageBudget: n(c.commissionPercentageBudget),
      commissionValue: n(c.commissionValue), commissionValueBudget: n(c.commissionValueBudget),
    })),
    bookingComments: list<Raw>(r.bookingComments).map((c) => ({ clientId: newClientId(), id: s(c.id), masterId: s(c.masterId), comments: s(c.comments) })),
    budgetComments: list<Raw>(r.budgetComments).map((c) => ({ clientId: newClientId(), id: s(c.id), masterId: s(c.masterId), comments: s(c.comments) })),
    createdByName: (r.createdByName as string) ?? null, createdDate: (r.createdDate as string) ?? null,
    updatedByName: (r.updatedByName as string) ?? null, updatedDate: (r.updatedDate as string) ?? null,
  }
}

function stripClientIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripClientIds)
  if (!value || typeof value !== "object") return value
  const out: Raw = {}
  for (const [key, v] of Object.entries(value as Raw)) if (key !== "clientId") out[key] = stripClientIds(v)
  return out
}

/** The save / update body (the row's fabric costing goes back as fabricCosts[0]). */
export function budgetToDto(budget: GmtBudget) {
  const body = {
    ...budget,
    budgetName: budget.budgetName.trim() || `${budget.po} Budget`,
    techSheetId: budget.techSheetId || null,
    fabricSourceId: budget.fabricSourceId || null,
    commercialFactoryId: budget.commercialFactoryId || null,
    details: budget.details.map(({ fabricCost, ...row }) => ({
      ...row,
      colorGroupName: row.colors.length ? row.colorGroupName : null,
      sizeGroupName: row.sizes.length ? row.sizeGroupName : null,
      uomId: row.uomId || null,
      gmtPartsId: row.gmtPartsId || null,
      fabricColorId: row.fabricColorId || null,
      fabricCosts:
        fabricCost && (fabricCost.yarns.length || fabricCost.processes.length)
          ? [
              {
                ...fabricCost,
                fabricId: fabricCost.fabricId || row.fabricItemId,
                fabricWastagePercentage: fabricWastageBudget(fabricCost.yarns),
                yarns: fabricCost.yarns.filter((y) => !!y.yarnId).map((y) => ({
                  ...y,
                  uomId: y.uomId || null,
                  yarnDyeingColorId: y.yarnDyeingColorId || null,
                  yarnWiseProcesses: y.yarnWiseProcesses.filter((p) => !!p.processId),
                })),
                processes: fabricCost.processes.filter((p) => !!p.processId),
              },
            ]
          : [],
    })),
    otherCosts: budget.otherCosts.filter((o) => !!o.costId),
    commissions: budget.commissions.filter((c) => !!c.commissionId),
    specialTreatments: budget.specialTreatments.filter((t) => !!t.specialTreatmentId),
    budgetComments: budget.budgetComments.filter((c) => c.comments.trim()),
    bookingComments: budget.bookingComments.filter((c) => c.comments.trim()),
    revises: budget.revises.map((v) => ({ ...v, reviceDate: v.reviceDate || today() })),
  }
  const { createdByName: _c, updatedByName: _u, ...payload } = body
  void _c
  void _u
  return stripClientIds(payload)
}
