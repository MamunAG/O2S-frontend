"use client"

// The Details grid of the GMT Budget entry dialog: the costing's rows on this PO, with the budgeted figures
// editable. A cell edit follows the desktop grid's CellEndEdit (applyCellEdit below), then every row is
// worked out again against the PO.

import { useMemo, useState, type ClipboardEvent } from "react"
import { ClipboardPaste, Copy, CopyPlus, Eraser, ListPlus, MoreHorizontal, Plus, Replace, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
import { AppSelect } from "@/components/app-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { CELL_INPUT_CLASS, LookupCombobox, NumInput, TD_CLASS, TH_CLASS, formatNumber } from "../../gmt-costing/component/gmt-ui"
import { PickLookupDialog } from "../../gmt-costing/component/pick-lookup-dialog"
import {
  ALL_COLOR,
  ALL_SIZE,
  additionalPriceOf,
  applySampleQty,
  consumptionFromTotal,
  consumptionOf,
  copyBudgetDetail,
  copyBudgetFabricCost,
  emptyBudgetDetail,
  importChargeOf,
  itemWiseTotalValueOf,
  recalcBudgetRow,
  roundEven,
  withBudgetFabricCost,
} from "../gmt-budget.calc"
import type { BudgetDetail, BudgetFabricCost, PoStyleContext } from "../gmt-budget.types"

type Load = (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>

export type FillDownMode = "off" | "fabric" | "all"

export type EditableField =
  | "fabricReqQtyPerPcsGmtInitial"
  | "fabricReqQtyPerDznGmtInitial"
  | "fabricItemPricePerUnitKgBudget"
  | "fabricItemPricePerDznBudget"
  | "importChargePercentageBudget"
  | "additionalPriceBudget"
  | "cadWastagePercentage"
  | "sampleFabricQty"
  | "totalRequiredQty"
  | "collarQty"
  | "gmtWastagePercentageBudget"
  | "fabricGsm"
  | "finishDia"
  | "fabricForm"

const n = (v: unknown) => Number(v ?? 0) || 0

/**
 * desktop CellEndEdit: price spreads to the rows below of the same item; consumption, import charge,
 * additional price, GSM, dia, form and CAD wastage reach the rows Fill Down names; sample qty swaps itself
 * into Total Req. Qty; a typed Total Req. Qty becomes the working consumption. Then every row is worked out
 * again (Total Req. Qty kept), the typed cell's own value left as typed.
 */
export function applyCellEdit(
  rows: BudgetDetail[],
  index: number,
  field: EditableField,
  value: number | string,
  po: PoStyleContext | null,
  fillDown: FillDownMode,
): BudgetDetail[] {
  const previous = rows[index]
  if (!previous) return rows
  const next = rows.map((r) => ({ ...r }))
  next[index] = { ...previous, [field]: value } as BudgetDetail
  const row = next[index]
  const sameItemFrom = (start: number) => next.map((r, j) => ({ r, j })).filter(({ r, j }) => j >= start && r.fabricItemId === row.fabricItemId)
  const fillTargets = (start: number) => {
    if (fillDown === "all") return next.map((r, j) => ({ r, j })).filter(({ j }) => j >= start)
    if (fillDown === "fabric" && !!row.fabricItemId) return sameItemFrom(start)
    return start <= index ? [{ r: row, j: index }] : []
  }
  const patch = (j: number, change: Partial<BudgetDetail>) => {
    next[j] = { ...next[j], ...change }
  }

  switch (field) {
    case "fabricReqQtyPerPcsGmtInitial":
    case "fabricReqQtyPerDznGmtInitial": {
      const consumption = consumptionOf(field, n(value))
      fillTargets(index).forEach(({ j }) => {
        patch(j, consumption)
        // Total Req. Qty back to D × L, then the row's sample qty on top
        next[j] = applySampleQty(recalcBudgetRow(next[j], po, true), 0)
      })
      break
    }
    case "fabricItemPricePerUnitKgBudget":
    case "fabricItemPricePerDznBudget": {
      const isDozen = field === "fabricItemPricePerDznBudget"
      const unit = isDozen ? roundEven(n(value) / 12, 6) : n(value)
      const dozen = roundEven(isDozen ? n(value) : n(value) * 12, 6)
      sameItemFrom(index).forEach(({ j }) => patch(j, { fabricItemPricePerUnitKgBudget: unit, fabricItemPricePerDznBudget: dozen }))
      break
    }
    case "importChargePercentageBudget":
      fillTargets(index).forEach(({ r, j }) =>
        patch(j, { importChargePercentageBudget: n(value), additionalPriceBudget: additionalPriceOf(n(r.fabricItemPricePerUnitKgBudget), n(value)) }),
      )
      break
    case "additionalPriceBudget":
      fillTargets(index).forEach(({ r, j }) =>
        patch(j, { additionalPriceBudget: n(value), importChargePercentageBudget: importChargeOf(n(r.fabricItemPricePerUnitKgBudget), n(value)) }),
      )
      break
    case "fabricGsm":
    case "fabricForm":
    case "finishDia":
    case "cadWastagePercentage":
      fillTargets(index + 1).forEach(({ j }) => patch(j, { [field]: value } as Partial<BudgetDetail>))
      break
    case "sampleFabricQty":
      next[index] = applySampleQty(row, n(previous.sampleFabricQty))
      break
    case "totalRequiredQty": {
      const consumption = consumptionFromTotal(row)
      if (consumption) patch(index, consumption)
      break
    }
    default:
      break
  }

  return next.map((r, j) => {
    const done = recalcBudgetRow(r, po, false)
    return j === index && (field === "collarQty" || field === "additionalPriceBudget") ? { ...done, [field]: value } : done
  })
}

type Clipboard = { kind: "fabricCost"; cost: BudgetFabricCost; label: string }

const PASTE_FIELDS = ["fabricReqQtyPerPcsGmtInitial", "fabricReqQtyPerDznGmtInitial"] as const

export function GmtBudgetDetailsGrid({
  rows,
  po,
  readOnly,
  onRowsChange,
  loadMaterials,
  loadParts,
  loadColors,
  resolveMaterial,
  onOpenFabricCost,
  onOpenGroup,
}: {
  rows: BudgetDetail[]
  po: PoStyleContext | null
  readOnly: boolean
  onRowsChange: (rows: BudgetDetail[]) => void
  loadMaterials: Load
  loadParts: Load
  loadColors: Load
  resolveMaterial: (id: string) => Promise<{ unitId: string | null; unitName: string; isColorWise: boolean } | null>
  onOpenFabricCost: (clientId: string) => void
  onOpenGroup: (clientId: string, kind: "size" | "color") => void
}) {
  const [fillDown, setFillDown] = useState<FillDownMode>("fabric")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [picker, setPicker] = useState<"fabric" | "part" | null>(null)

  const totals = useMemo(
    () => ({
      pcs: rows.reduce((s, r) => s + n(r.totalFabricPricePerPcsGmtBudget), 0),
      value: rows.reduce((s, r) => s + itemWiseTotalValueOf(r), 0),
    }),
    [rows],
  )

  const edit = (index: number, field: EditableField, value: number | string) => onRowsChange(applyCellEdit(rows, index, field, value, po, fillDown))
  const patch = (clientId: string, change: (r: BudgetDetail) => BudgetDetail) => onRowsChange(rows.map((r) => (r.clientId === clientId ? change(r) : r)))
  const insertAt = (at: number, added: BudgetDetail[]) => {
    const next = [...rows]
    next.splice(at, 0, ...added)
    onRowsChange(next.map((r) => recalcBudgetRow(r, po, !r.id && added.includes(r))))
  }
  const removeRows = (ids: Set<string>) => {
    onRowsChange(rows.filter((r) => !ids.has(r.clientId)))
    setSelected(new Set())
  }

  async function pickMaterial(clientId: string, option: AppComboboxOption | null) {
    const id = option ? String(option.value) : ""
    const info = id ? await resolveMaterial(id) : null
    patch(clientId, (r) => ({
      ...r,
      fabricItemId: id,
      fabricItemName: option?.label ?? "",
      uomId: info?.unitId ?? (id ? r.uomId : null),
      uomName: info?.unitName ?? (id ? r.uomName : ""),
      isColorWise: info?.isColorWise ?? r.isColorWise,
    }))
  }

  async function changeFabricOfSelected(option: AppComboboxOption) {
    const info = await resolveMaterial(String(option.value))
    onRowsChange(
      rows.map((r) =>
        selected.has(r.clientId)
          ? { ...r, fabricItemId: String(option.value ?? ""), fabricItemName: option.label, uomId: info?.unitId ?? r.uomId, uomName: info?.unitName ?? r.uomName, isColorWise: info?.isColorWise ?? r.isColorWise }
          : r,
      ),
    )
    toast.success(`Fabric changed to ${option.label} on ${selected.size} row(s).`)
  }

  function onColumnPaste(event: ClipboardEvent<HTMLDivElement>, index: number, field: (typeof PASTE_FIELDS)[number]) {
    const values = event.clipboardData.getData("text").split(/\r?\n/).map((line) => line.split("\t")[0].trim())
    while (values.length && values[values.length - 1] === "") values.pop()
    if (values.length < 2) return
    event.preventDefault()
    let next = [...rows]
    let bad = 0
    values.forEach((raw, offset) => {
      const at = index + offset
      if (at >= next.length) return
      const parsed = raw === "" ? 0 : Number(raw.replace(/,/g, ""))
      if (!Number.isFinite(parsed)) {
        bad += 1
        return
      }
      next[at] = applySampleQty(recalcBudgetRow({ ...next[at], ...consumptionOf(field, parsed) }, po, true), 0)
    })
    next = next.map((r) => recalcBudgetRow(r, po, false))
    onRowsChange(next)
    if (values.length > rows.length - index) toast.warning("Values past the last row were left out.")
    if (bad) toast.error(`${bad} value(s) were not numbers and were left out.`)
  }

  const locked = (r: BudgetDetail) => n(r.fabricCostPerKgBudget) > 0
  const stickyBg = (checked: boolean) => (checked ? "bg-blue-50 dark:bg-[#1a2140]" : "bg-white dark:bg-[#17131d]")

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Badge variant="outline" className="rounded-md">{rows.length} row(s)</Badge>
          {selected.size ? <Badge className="rounded-md bg-blue-600/15 text-blue-700 dark:text-blue-200">{selected.size} checked</Badge> : null}
          {clipboard ? <Badge variant="outline" className="rounded-md border-amber-300 text-amber-700">Copied: fabric costing ({clipboard.label})</Badge> : null}
          <span>
            Item price <b className="tabular-nums">{formatNumber(totals.pcs)}</b> / pcs · item value <b className="tabular-nums">{formatNumber(totals.value, 2)}</b>
          </span>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Fill down</span>
              <div className="w-44">
                <AppSelect
                  value={fillDown}
                  onValueChange={(v) => setFillDown(v as FillDownMode)}
                  options={[
                    { value: "fabric", label: "Same fabric below" },
                    { value: "all", label: "Every row below" },
                    { value: "off", label: "Off (this row)" },
                  ]}
                />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => insertAt(rows.length, [emptyBudgetDetail({ colorGroupName: ALL_COLOR, sizeGroupName: ALL_SIZE })])}>
              <Plus className="size-3" /> Add row
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="rounded-lg">
                  <MoreHorizontal className="size-3" /> Bulk actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={() => insertAt(0, [emptyBudgetDetail({ colorGroupName: ALL_COLOR, sizeGroupName: ALL_SIZE })])}>
                  <ListPlus className="size-3.5" /> Insert row at top
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px]">Checked rows</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={!clipboard || !selected.size}
                  onSelect={() => {
                    if (!clipboard) return
                    onRowsChange(rows.map((r) => (selected.has(r.clientId) ? recalcBudgetRow(withBudgetFabricCost(r, copyBudgetFabricCost(clipboard.cost)), po, false) : r)))
                    toast.success(`Fabric costing pasted on ${selected.size} row(s).`)
                    setClipboard(null)
                  }}
                >
                  <ClipboardPaste className="size-3.5" /> Paste fabric costing
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!selected.size} onSelect={() => setPicker("fabric")}>
                  <Replace className="size-3.5" /> Change fabric / item
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!selected.size} onSelect={() => setPicker("part")}>
                  <Replace className="size-3.5" /> Change GMT parts
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" disabled={!selected.size} onSelect={() => removeRows(selected)}>
                  <Trash2 className="size-3.5" /> Remove checked rows
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={!rows.length} onSelect={() => removeRows(new Set(rows.map((r) => r.clientId)))}>
                  <Eraser className="size-3.5" /> Clear all rows
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-md border border-slate-200/70 pb-2 [scrollbar-gutter:stable] dark:border-white/10">
        <table className="w-full min-w-[3100px] border-collapse text-xs">
          <thead className="bg-slate-50/80 dark:bg-white/5">
            <tr className="border-b">
              <th rowSpan={2} className={cn(TH_CLASS, "sticky left-0 z-10 w-16 bg-slate-50 dark:bg-[#17131d]")}>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={rows.length > 0 && selected.size === rows.length ? true : selected.size ? "indeterminate" : false}
                    onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.clientId)) : new Set())}
                    aria-label="Check all rows"
                  />
                  SL
                </div>
              </th>
              <th rowSpan={2} className={cn(TH_CLASS, "sticky left-16 z-10 min-w-56 bg-slate-50 dark:bg-[#17131d]")}>Fabric / Item</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-28")}>Size</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-28")}>Color</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-40")}>Fabric Color</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-36")}>GMT Parts</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Fabric GSM</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Finish Dia / Width</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Fabric Form</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-14")}>UOM</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>F. Req. Qty</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Cad Wastage %</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-28")}>Fabric Cost ($)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")} title="C: the sum of the row's GMT wastage">GMT W%</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>Total Fabric/Item Qty</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>Fabric/Item Price ($)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Import Charge (%)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")}>Additional Price ($)</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>Total Item Price ($)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")} title="L: the PO qty of the row's colours and sizes">PO Qty</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")} title="M">Sample Fabric Qty</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-28")} title="N = D × L + M; typing it rewrites the working consumption">Total Req. Qty</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")} title="(PO Qty + GMT W%) × 2 for a Double Pcs Qty row">Collar Qty (pcs)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-28")} title="PO Qty × Total Item Price / Pcs">Item-Wise Total Value</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-40")}>Remarks</th>
              <th rowSpan={2} className={cn(TH_CLASS, "sticky right-0 z-10 w-12 bg-slate-50 text-right dark:bg-[#17131d]")}>Action</th>
            </tr>
            <tr className="border-b">
              <th className={cn(TH_CLASS, "w-24")} title="A">Pcs GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="B = A × 12">Dzn GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="D = A × (1 + C/100)">Pcs GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="E = D × 12">Dzn GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="F">Unit</th>
              <th className={cn(TH_CLASS, "w-24")} title="G = F × 12">Dzn</th>
              <th className={cn(TH_CLASS, "w-24")} title="H = D × (F + additional)">Pcs GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="I = H × 12">Dzn GMT</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={31} className="p-8 text-center text-sm text-slate-500">No rows yet. Pick the PO and the GMT costing: its rows come in split by the PO&apos;s colours.</td>
              </tr>
            ) : null}
            {rows.map((row, index) => {
              const checked = selected.has(row.clientId)
              return (
                <tr key={row.clientId} className={cn("border-b align-middle", checked ? "bg-blue-50/70 dark:bg-blue-500/10" : "hover:bg-muted/40")}>
                  <td className={cn(TD_CLASS, "sticky left-0 z-[1]", stickyBg(checked))}>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = new Set(selected)
                          if (v) next.add(row.clientId)
                          else next.delete(row.clientId)
                          setSelected(next)
                        }}
                        aria-label={`Check row ${index + 1}`}
                      />
                      <span className="tabular-nums">{index + 1}</span>
                    </div>
                  </td>
                  <td className={cn(TD_CLASS, "sticky left-16 z-[1]", stickyBg(checked))}>
                    <LookupCombobox value={row.fabricItemId} label={row.fabricItemName} loadItems={loadMaterials} placeholder="Fabric / item" disabled={readOnly} onChange={(o) => void pickMaterial(row.clientId, o)} />
                  </td>
                  <td className={TD_CLASS}>
                    <GroupButton label={row.sizes.length ? row.sizeGroupName : ALL_SIZE} count={row.sizes.length} onClick={() => onOpenGroup(row.clientId, "size")} />
                  </td>
                  <td className={TD_CLASS}>
                    <GroupButton label={row.colors.length ? row.colorGroupName : ALL_COLOR} count={row.colors.length} onClick={() => onOpenGroup(row.clientId, "color")} />
                  </td>
                  <td className={TD_CLASS}>
                    <LookupCombobox
                      value={row.fabricColorId}
                      label={row.fabricColorName}
                      loadItems={loadColors}
                      placeholder="Fabric color"
                      disabled={readOnly}
                      onChange={(o) => patch(row.clientId, (r) => ({ ...r, fabricColorId: o ? String(o.value) : null, fabricColorName: o?.label ?? "" }))}
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <LookupCombobox
                      value={row.gmtPartsId}
                      label={row.gmtPartsName}
                      loadItems={loadParts}
                      placeholder="Part"
                      disabled={readOnly}
                      onChange={(o) => patch(row.clientId, (r) => ({ ...r, gmtPartsId: o ? String(o.value) : null, gmtPartsName: o?.label ?? "" }))}
                    />
                  </td>
                  {(["fabricGsm", "finishDia", "fabricForm"] as const).map((field) => (
                    <td key={field} className={TD_CLASS}>
                      <Input value={row[field]} readOnly={readOnly} maxLength={50} className={CELL_INPUT_CLASS} onChange={(e) => edit(index, field, e.target.value)} />
                    </td>
                  ))}
                  <td className={cn(TD_CLASS, "text-slate-600 dark:text-slate-300")}>{row.uomName || "--"}</td>
                  {PASTE_FIELDS.map((field) => (
                    <td key={field} className={TD_CLASS}>
                      <div onPaste={readOnly ? undefined : (e) => onColumnPaste(e, index, field)}>
                        <NumInput value={row[field]} onValueChange={readOnly ? undefined : (v) => edit(index, field, v)} />
                      </div>
                    </td>
                  ))}
                  <td className={TD_CLASS}>
                    <NumInput value={row.cadWastagePercentage} onValueChange={readOnly ? undefined : (v) => edit(index, "cadWastagePercentage", v)} />
                  </td>
                  <td className={TD_CLASS}>
                    <Button
                      type="button"
                      variant={locked(row) ? "secondary" : "outline"}
                      size="sm"
                      className="w-full justify-end rounded-sm tabular-nums"
                      title={row.fabricCostPerKg ? `Costing: ${formatNumber(row.fabricCostPerKg)} $/kg` : "Fabric costing of this row"}
                      onClick={() => onOpenFabricCost(row.clientId)}
                    >
                      {n(row.fabricCostPerKgBudget) > 0 ? formatNumber(row.fabricCostPerKgBudget) : readOnly ? "--" : "Cost..."}
                    </Button>
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput
                      value={row.gmtWastagePercentageBudget}
                      title={row.wastages.length ? "Set in the GMT Wastage section" : `Costing: ${formatNumber(row.gmtWastagePercentage, 2)}%`}
                      onValueChange={readOnly || row.wastages.length ? undefined : (v) => edit(index, "gmtWastagePercentageBudget", v)}
                    />
                  </td>
                  <td className={TD_CLASS}><NumInput value={row.totalFabricItemQtyPerPcsGmtBudget} /></td>
                  <td className={TD_CLASS}><NumInput value={row.totalFabricItemQtyPerDznGmtBudget} /></td>
                  <td className={TD_CLASS}>
                    <NumInput
                      value={row.fabricItemPricePerUnitKgBudget}
                      title={locked(row) ? "Set by the fabric costing" : `Costing: ${formatNumber(row.fabricItemPricePerUnitKg)}`}
                      onValueChange={readOnly || locked(row) ? undefined : (v) => edit(index, "fabricItemPricePerUnitKgBudget", v)}
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.fabricItemPricePerDznBudget} onValueChange={readOnly || locked(row) ? undefined : (v) => edit(index, "fabricItemPricePerDznBudget", v)} />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.importChargePercentageBudget} onValueChange={readOnly ? undefined : (v) => edit(index, "importChargePercentageBudget", v)} />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.additionalPriceBudget} onValueChange={readOnly ? undefined : (v) => edit(index, "additionalPriceBudget", v)} />
                  </td>
                  <td className={TD_CLASS}><NumInput value={row.totalFabricPricePerPcsGmtBudget} /></td>
                  <td className={TD_CLASS}><NumInput value={row.totalFabricPricePerDznGmtBudget} /></td>
                  <td className={TD_CLASS}><NumInput value={row.poQty} /></td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.sampleFabricQty} onValueChange={readOnly ? undefined : (v) => edit(index, "sampleFabricQty", v)} />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.totalRequiredQty} onValueChange={readOnly ? undefined : (v) => edit(index, "totalRequiredQty", v)} />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.collarQty} onValueChange={readOnly ? undefined : (v) => edit(index, "collarQty", Math.max(0, Math.round(v)))} />
                  </td>
                  <td className={cn(TD_CLASS, "text-right tabular-nums")}>{formatNumber(itemWiseTotalValueOf(row), 2)}</td>
                  <td className={TD_CLASS}>
                    <Input value={row.remarks} readOnly={readOnly} maxLength={500} className={CELL_INPUT_CLASS} onChange={(e) => patch(row.clientId, (r) => ({ ...r, remarks: e.target.value }))} />
                  </td>
                  <td className={cn(TD_CLASS, "sticky right-0 z-[1] text-right", stickyBg(checked))}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Row actions">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => onOpenFabricCost(row.clientId)}>Fabric costing</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!row.fabricCost?.yarns.length}
                          onSelect={() => row.fabricCost && setClipboard({ kind: "fabricCost", cost: row.fabricCost, label: row.fabricItemName || `row ${index + 1}` })}
                        >
                          <Copy className="size-3.5" /> Copy fabric costing
                        </DropdownMenuItem>
                        {!readOnly ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => insertAt(index + 1, [emptyBudgetDetail({ colorGroupName: ALL_COLOR, sizeGroupName: ALL_SIZE })])}>
                              <Plus className="size-3.5" /> Insert row below
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => insertAt(index + 1, [copyBudgetDetail(row)])}>
                              <CopyPlus className="size-3.5" /> Duplicate row
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => removeRows(new Set([row.clientId]))}>
                              <Trash2 className="size-3.5" /> Remove row
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <p className="text-[11px] text-slate-500">
          A price reaches every row below with the same fabric / item; consumption, import charge, additional price, GSM, dia, form and
          CAD wastage follow Fill down. Paste a column from Excel into an F. Req. Qty cell to fill the rows below it.
        </p>
      ) : null}

      <PickLookupDialog
        open={picker !== null}
        title={picker === "fabric" ? "Change fabric / item" : "Change GMT parts"}
        description={`Sets it on the ${selected.size} checked row(s); nothing else on them changes.`}
        loadItems={picker === "fabric" ? loadMaterials : loadParts}
        onOpenChange={(open) => !open && setPicker(null)}
        onPick={(option) => {
          if (picker === "fabric") void changeFabricOfSelected(option)
          else {
            onRowsChange(rows.map((r) => (selected.has(r.clientId) ? { ...r, gmtPartsId: String(option.value ?? ""), gmtPartsName: option.label } : r)))
            toast.success(`GMT parts changed on ${selected.size} row(s).`)
          }
          setPicker(null)
        }}
      />
    </div>
  )
}

function GroupButton({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 w-full items-center justify-between gap-1 rounded-sm border px-1.5 text-left text-xs",
        count ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-slate-200 dark:border-white/10",
      )}
    >
      <span className="truncate">{label}</span>
      {count ? <span className="text-[10px] text-slate-500">{count}</span> : null}
    </button>
  )
}
