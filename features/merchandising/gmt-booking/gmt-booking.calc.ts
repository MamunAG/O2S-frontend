// The GMT Booking screen's logic, without React: dto <-> screen, which rows are fabrics, which yarn rows
// belong to a fabric row, the yarn grid's per-kg columns and the summary tables. Ported from ClickERP's
// gmt-booking.schema.ts / .summary.ts. No wastage is worked out here: the budget's figures carry it.

import { newClientId } from "../gmt-costing/gmt-costing.calc"
import type { BookingFabricRow, BookingWastage, BookingYarnRow, GmtBooking } from "./gmt-booking.types"

type Raw = Record<string, unknown>
const n = (v: unknown) => Number(v ?? 0) || 0
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v))
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const day = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null)

/** Every key of `template`, read from `raw`: numbers as numbers, text as text, nullable ids as null. */
function shape<T extends object>(template: T, raw: Raw, nullable: string[] = []): T {
  const out: Record<string, unknown> = { ...(template as Record<string, unknown>) }
  for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
    const v = raw[key]
    if (nullable.includes(key)) out[key] = Number(v) > 0 ? Number(v) : null
    else if (typeof value === "number") out[key] = n(v)
    else if (typeof value === "boolean") out[key] = Boolean(v)
    else if (typeof value === "string" && key !== "clientId") out[key] = s(v)
  }
  out.clientId = newClientId()
  return out as T
}

const FABRIC_TEMPLATE: BookingFabricRow = {
  clientId: "", id: 0, masterId: 0, fabricOrMtlId: 0, fabricItem: "", gmtColorId: null, gmtColor: "", gmtSizeId: null, gmtSize: "",
  mtlColorId: null, materialColor: "", poQty: 0, bomQty: 0, totalBomReqQty: 0, costingConPerPcs: 0, extraPer: 0, bookingConPerPcs: 0,
  fabricBookingConPerPcs: 0, totalBookingQty: 0, totalFabricBookingQty: 0, uomId: null, uom: "", totalPricePerPcs: 0, useAreaId: null,
  gmtParts: "", comBomParentMtlConPerPcs: 0, factoryPricePerUnitMtl: 0, totalComBomProcessWastage: 0, factoryGmtWastagePer: 0,
  customConsumptionPerPcs: 0, finishDia: "", fabricGsm: "", fabricForm: "", yarnTableAddIds: 0, pcsQty: 0, sampleFabricQty: 0,
  fabricReqQtyPerPcsGmtInitial: 0, fabricReqQtyPerDznGmtInitial: 0, remarks: "", knitMcDia: "", totalFabricBookingQtyLength: 0, materialGroup: "",
}

const YARN_TEMPLATE: BookingYarnRow = {
  clientId: "", id: 0, masterId: 0, materialId: 0, yarn: "", comBomParentsMtlId: null, fabricItem: "", gmtColorId: null, gmtColor: "",
  gmtSizeId: null, gmtSize: "", mtlColorId: null, materialColor: "", poQty: 0, bomQty: 0, totalBomReqQty: 0, costingConPerPcs: 0, extraPer: 0,
  bookingConPerPcs: 0, fabricBookingConPerPcs: 0, totalBookingQty: 0, totalFabricBookingQty: 0, uomId: null, uom: "", totalPricePerPcs: 0,
  useAreaId: null, gmtParts: "", comBomParentMtlConPerPcs: 0, factoryPricePerUnitMtl: 0, totalComBomProcessWastage: 0, factoryGmtWastagePer: 0,
  customConsumptionPerPcs: 0, finishDia: "", fabricGsm: "", fabricForm: "", yarnTableAddId: 0, yarnDyeingColorId: null, yarnDyeingColor: "",
  budgetTotalGreyQtyPerPcsGmt: 0, factoryTotalGreyBookingConPerpcsGmt: 0, factoryTotalGreyBookingQuantity: 0, budgetTotalDyedYarnQtyPerPcsGmt: 0,
  factoryTotalDyedYarnBookingConPerpcsGmt: 0, factoryTotalDyedYarnBookingQuantity: 0, stripMeasurement: "",
}

const WASTAGE_TEMPLATE: BookingWastage = {
  clientId: "", id: 0, masterId: 0, parentsMtlId: null, fabricItem: "", colorGroupId: null, gmtColor: "", useAreaId: null, gmtParts: "",
  costId: null, costName: "", factoryWastagePercentage: 0, momWastage: 0, finishDia: "", finishGsm: "", gmtSizeId: null, wastageType: "",
  isWastageDouble: false, materialColorId: null, materialColor: "",
}

const IDS = ["gmtColorId", "gmtSizeId", "mtlColorId", "uomId", "useAreaId", "comBomParentsMtlId", "yarnDyeingColorId", "parentsMtlId", "colorGroupId", "costId", "materialColorId"]

export const fabricRowFromDto = (r: Raw) => shape(FABRIC_TEMPLATE, r, IDS)
export const yarnRowFromDto = (r: Raw) => shape(YARN_TEMPLATE, r, IDS)
export const wastageFromDto = (r: Raw) => shape(WASTAGE_TEMPLATE, r, IDS)

export function emptyBooking(): GmtBooking {
  return {
    id: 0, bomNo: "", buyerId: 0, buyer: "", poId: 0, poNo: "", styleId: 0, style: "", styleName: "", budgetId: null, budgetName: "",
    fabricSourceId: null, fabricSource: "", isApproved: false, isOpenDia: false, revisedNo: 0, bookingReleaseDate: null,
    details: [], fabricDetails: [], wastages: [], comments: [], specialTreatments: [], revises: [],
  }
}

export function bookingFromDto(raw: unknown): GmtBooking {
  const r = (raw ?? {}) as Raw
  return {
    ...emptyBooking(),
    id: n(r.id), bomNo: s(r.bomNo), buyerId: n(r.buyerId), buyer: s(r.buyer), poId: n(r.poId), poNo: s(r.poNo),
    styleId: n(r.styleId), style: s(r.style), styleName: s(r.styleName), budgetId: Number(r.budgetId) > 0 ? n(r.budgetId) : null,
    budgetName: s(r.budgetName), fabricSourceId: Number(r.fabricSourceId) > 0 ? n(r.fabricSourceId) : null, fabricSource: s(r.fabricSource),
    isApproved: Boolean(r.isApproved), isOpenDia: Boolean(r.isOpenDia), revisedNo: n(r.revisedNo), bookingReleaseDate: day(r.bookingReleaseDate),
    details: list<Raw>(r.details).map(yarnRowFromDto),
    fabricDetails: list<Raw>(r.fabricDetails).map(fabricRowFromDto),
    wastages: list<Raw>(r.wastages).map(wastageFromDto),
    comments: list<Raw>(r.comments).map((c) => ({ clientId: newClientId(), id: n(c.id), masterId: n(c.masterId), comments: s(c.comments) })),
    specialTreatments: list<Raw>(r.specialTreatments).map((t) => ({ clientId: newClientId(), id: n(t.id), masterId: n(t.masterId), specialTreatmId: n(t.specialTreatmId), treatment: s(t.treatment) })),
    revises: list<Raw>(r.revises).map((v) => ({ clientId: newClientId(), id: n(v.id), masterId: n(v.masterId), reviceNo: n(v.reviceNo), reviceDate: day(v.reviceDate) ?? "", reviceReason: s(v.reviceReason), revisedByName: s(v.revisedByName || v.revisedBy) })),
    createdByName: (r.createdByName as string) ?? null, createdDate: (r.createdDate as string) ?? null,
    updatedByName: (r.updatedByName as string) ?? null, updatedDate: (r.updatedDate as string) ?? null,
  }
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip)
  if (!value || typeof value !== "object") return value
  const out: Raw = {}
  for (const [key, v] of Object.entries(value as Raw)) if (key !== "clientId") out[key] = strip(v)
  return out
}

export function bookingToDto(b: GmtBooking) {
  const { createdByName: _c, updatedByName: _u, ...rest } = b
  void _c
  void _u
  return strip({
    ...rest,
    budgetId: b.budgetId || null,
    fabricSourceId: b.fabricSourceId || null,
    comments: b.comments.filter((c) => c.comments.trim()),
    specialTreatments: b.specialTreatments.filter((t) => t.specialTreatmId > 0),
    revises: b.revises.map((v) => ({ ...v, reviceDate: v.reviceDate || new Date().toISOString().slice(0, 10) })),
  })
}

// ---------- which rows ----------

/** A fabric row: its item's material group is one of the fabric group names (none set: every row). */
export const isFabricRow = (row: BookingFabricRow, groupNames: string[]) =>
  groupNames.length === 0 || groupNames.includes(row.materialGroup.trim().toUpperCase())

/** A fabric row's yarn rows share its budget details row (yarnTableAddIds / yarnTableAddId) and GMT colour. */
export const isYarnOfFabric = (yarn: BookingYarnRow, fabric: BookingFabricRow) =>
  fabric.yarnTableAddIds > 0 && yarn.yarnTableAddId === fabric.yarnTableAddIds && (yarn.gmtColorId ?? 0) === (fabric.gmtColorId ?? 0)

export type YarnGridRow = BookingYarnRow & { yarnRatio: number; yarnPerKg: number; greyPerKg: number; dyedPerKg: number }

/** H = I ÷ B, J = K ÷ E, M = N ÷ E, P = Q ÷ E, by the yarn row's fabric row (display only, never saved). */
export function yarnGridRows(yarns: BookingYarnRow[], fabrics: BookingFabricRow[]): YarnGridRow[] {
  const per = (v: number, by: number) => (by ? v / by : 0)
  return yarns.map((y) => {
    const f = fabrics.find((x) => isYarnOfFabric(y, x))
    return {
      ...y,
      yarnRatio: per(y.customConsumptionPerPcs, f?.customConsumptionPerPcs ?? 0),
      yarnPerKg: per(y.bookingConPerPcs, f?.fabricBookingConPerPcs ?? 0),
      greyPerKg: per(y.factoryTotalGreyBookingConPerpcsGmt, f?.fabricBookingConPerPcs ?? 0),
      dyedPerKg: per(y.factoryTotalDyedYarnBookingConPerpcsGmt, f?.fabricBookingConPerPcs ?? 0),
    }
  })
}

// ---------- summary ----------

/** PO qty per GMT colour + size group a summary row covers, each slice once (an item on two budget rows
 *  is not divided by double the PO qty). */
type Slices = Record<string, number>
type Sliced = { poQtyBySlice: Slices }

export type FabricSummary = Sliced & { key: string; item: string; uom: string; greyQty: number; finishQty: number }
export type YarnSummary = Sliced & { key: string; yarn: string; uom: string; yarnQty: number }
export type OtherSummary = Sliced & { key: string; item: string; materialGroup: string; uom: string; qty: number }

const addSlice = (g: Sliced, r: { gmtColorId: number | null; gmtSizeId: number | null; poQty: number }) => {
  g.poQtyBySlice[`${r.gmtColorId ?? 0}|${r.gmtSizeId ?? 0}`] = n(r.poQty)
}

export const poQtyOf = (rows: Sliced[]) =>
  Object.values(Object.assign({}, ...rows.map((r) => r.poQtyBySlice)) as Slices).reduce((sum, v) => sum + v, 0)

export const consumptionOf = (qty: number, poQty: number) => (poQty ? qty / poQty : 0)

function groupBy<R, G>(rows: R[], keyOf: (r: R) => string, start: (r: R, key: string) => G, add: (g: G, r: R) => void) {
  const groups = new Map<string, G>()
  for (const r of rows) {
    const key = keyOf(r)
    if (!groups.has(key)) groups.set(key, start(r, key))
    add(groups.get(key)!, r)
  }
  return [...groups.values()]
}

/** Per fabric + UOM: finish qty = the fabric rows' booking qty; grey qty = the grey qty of their yarn rows. */
export const fabricSummaryOf = (fabrics: BookingFabricRow[], yarns: BookingYarnRow[]) =>
  groupBy<BookingFabricRow, FabricSummary>(
    fabrics,
    (r) => `${r.fabricOrMtlId}|${r.uom}`,
    (r, key) => ({ key, item: r.fabricItem || "-", uom: r.uom, greyQty: 0, finishQty: 0, poQtyBySlice: {} }),
    (g, r) => {
      addSlice(g, r)
      g.finishQty += n(r.totalFabricBookingQty)
      g.greyQty += yarns.filter((y) => isYarnOfFabric(y, r)).reduce((sum, y) => sum + n(y.factoryTotalGreyBookingQuantity), 0)
    },
  )

/** Per yarn + UOM: the yarn qty (every process wastage in). */
export const yarnSummaryOf = (yarns: BookingYarnRow[]) =>
  groupBy<BookingYarnRow, YarnSummary>(
    yarns,
    (r) => `${r.materialId}|${r.uom}`,
    (r, key) => ({ key, yarn: r.yarn || "-", uom: r.uom, yarnQty: 0, poQtyBySlice: {} }),
    (g, r) => {
      addSlice(g, r)
      g.yarnQty += n(r.totalBookingQty)
    },
  )

/** Per item + UOM of the Other Items grid: the booking qty. */
export const otherSummaryOf = (others: BookingFabricRow[]) =>
  groupBy<BookingFabricRow, OtherSummary>(
    others,
    (r) => `${r.fabricOrMtlId}|${r.uom}`,
    (r, key) => ({ key, item: r.fabricItem || "-", materialGroup: r.materialGroup, uom: r.uom, qty: 0, poQtyBySlice: {} }),
    (g, r) => {
      addSlice(g, r)
      g.qty += n(r.totalFabricBookingQty)
    },
  )

/** Total rows per UOM (units are never added together): the summed qty over its combined PO qty. */
export function totalsByUom<T extends Sliced & { uom: string }>(rows: T[], qtyOf: (r: T) => number) {
  return groupBy<T, { uom: string; qty: number; rows: T[] }>(
    rows,
    (r) => r.uom,
    (r) => ({ uom: r.uom, qty: 0, rows: [] }),
    (g, r) => {
      g.qty += qtyOf(r)
      g.rows.push(r)
    },
  ).map((g) => ({ uom: g.uom, qty: g.qty, consumption: consumptionOf(g.qty, poQtyOf(g.rows)) }))
}
