"use client"

// The Details grid of the GMT Costing entry dialog: one row per fabric / item x size group x color group x
// part, every column of ClickERP's grid in the desktop's order. Typing a qty or price writes its dozen pair
// and recalculates the row; a fabric cost sets the item price. Bulk actions act on the checked rows.

import { useMemo, useState, type ClipboardEvent } from "react"
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eraser,
  ListPlus,
  MoreHorizontal,
  Plus,
  Replace,
  Ruler,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
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

import {
  applyGroupToRow,
  copyDetail,
  copyFabricCost,
  editDetailNumber,
  emptyDetail,
  findPreGroupName,
  groupDisplayNameOf,
  groupItemsOf,
  num,
  withFabricCost,
  type GroupKind,
  type GroupItem,
} from "../gmt-costing.calc"
import type { GmtCostingDetail, GmtFabricCost, StyleInfo } from "../gmt-costing.types"
import { CELL_INPUT_CLASS, LookupCombobox, NumInput, TD_CLASS, TH_CLASS, formatNumber } from "./gmt-ui"
import { PickLookupDialog } from "./pick-lookup-dialog"

type Load = (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>

export type DetailsGridProps = {
  rows: GmtCostingDetail[]
  onRowsChange: (rows: GmtCostingDetail[]) => void
  readOnly: boolean
  isGmtForward: boolean
  style: StyleInfo | null
  loadMaterials: Load
  loadParts: Load
  loadColors: Load
  /** The item's unit and whether it is a fabric (Is Color Wise). */
  resolveMaterial: (id: number) => Promise<{ unitId: number | null; unitName: string; isColorWise: boolean } | null>
  onOpenFabricCost: (clientId: string) => void
  onOpenGroup: (clientId: string, kind: GroupKind) => void
}

type Clipboard =
  | { kind: "fabricCost"; cost: GmtFabricCost; label: string }
  | { kind: "color" | "size"; name: string; items: GroupItem[] }

const NUMBER_PASTE_FIELDS = ["fabricReqQtyPerPcsGmt", "fabricReqQtyPerDznGmt"] as const

export function GmtDetailsGrid({
  rows,
  onRowsChange,
  readOnly,
  isGmtForward,
  style,
  loadMaterials,
  loadParts,
  loadColors,
  resolveMaterial,
  onOpenFabricCost,
  onOpenGroup,
}: DetailsGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [picker, setPicker] = useState<"fabric" | "part" | null>(null)

  const selectedRows = rows.filter((r) => selected.has(r.clientId))
  const allSelected = rows.length > 0 && selectedRows.length === rows.length

  const totals = useMemo(
    () => ({
      pcs: rows.reduce((s, r) => s + num(r.totalFaricPricePerPcsGmt), 0),
      dzn: rows.reduce((s, r) => s + num(r.totalFaricPricePerDznGmt), 0),
    }),
    [rows],
  )

  const patch = (clientId: string, change: (row: GmtCostingDetail) => GmtCostingDetail) =>
    onRowsChange(rows.map((r) => (r.clientId === clientId ? change(r) : r)))

  const setNumber = (clientId: string, field: keyof GmtCostingDetail, value: number) =>
    patch(clientId, (r) => editDetailNumber(r, field, value, isGmtForward))

  const insertAt = (index: number, newRows: GmtCostingDetail[]) => {
    const next = [...rows]
    next.splice(index, 0, ...newRows)
    onRowsChange(next)
  }

  const removeRows = (ids: Set<string>) => {
    onRowsChange(rows.filter((r) => !ids.has(r.clientId)))
    setSelected(new Set())
  }

  async function pickMaterial(clientId: string, option: AppComboboxOption | null) {
    if (!option) {
      patch(clientId, (r) => ({ ...r, fabricItemId: 0, fabricItemName: "", uomId: null, uomName: "" }))
      return
    }
    const id = Number(option.value)
    patch(clientId, (r) => ({ ...r, fabricItemId: id, fabricItemName: option.label }))
    const info = await resolveMaterial(id)
    if (!info) return
    onRowsChange(
      rows.map((r) =>
        r.clientId === clientId
          ? { ...r, fabricItemId: id, fabricItemName: option.label, uomId: info.unitId, uomName: info.unitName, isColorWise: info.isColorWise }
          : r,
      ),
    )
  }

  /** Change Fabric on the checked rows: the item, its unit and Is Color Wise; nothing else changes. */
  async function changeFabricOfSelected(option: AppComboboxOption) {
    const id = Number(option.value)
    const info = await resolveMaterial(id)
    onRowsChange(
      rows.map((r) =>
        selected.has(r.clientId)
          ? {
              ...r,
              fabricItemId: id,
              fabricItemName: option.label,
              uomId: info?.unitId ?? r.uomId,
              uomName: info?.unitName ?? r.uomName,
              isColorWise: info?.isColorWise ?? r.isColorWise,
            }
          : r,
      ),
    )
    toast.success(`Fabric / item changed on ${selected.size} row(s).`)
  }

  function changePartOfSelected(option: AppComboboxOption) {
    onRowsChange(rows.map((r) => (selected.has(r.clientId) ? { ...r, gmtPartsId: Number(option.value), gmtPartsName: option.label } : r)))
    toast.success(`GMT parts changed on ${selected.size} row(s).`)
  }

  function pasteToSelected() {
    if (!clipboard) return
    if (selected.size === 0) {
      toast.error("Select at least one row first.")
      return
    }
    onRowsChange(
      rows.map((r) => {
        if (!selected.has(r.clientId)) return r
        if (clipboard.kind === "fabricCost") return withFabricCost(r, copyFabricCost(clipboard.cost), isGmtForward)
        return applyGroupToRow(r, clipboard.kind, clipboard.name, clipboard.items)
      }),
    )
    toast.success(`Pasted on ${selected.size} row(s).`)
    setClipboard(null)
  }

  /** Add by Individual Size: a copy of the row per style size, each size its own group, All Color. */
  function addByIndividualSize(row: GmtCostingDetail, replace: boolean) {
    const sizes = style?.sizes ?? []
    if (sizes.length === 0) {
      toast.error("The style has no sizes.")
      return
    }
    const copies = sizes.map((size) => {
      const name = findPreGroupName(rows, "size", [size.id]) || size.name
      return applyGroupToRow(copyDetail(row), "size", name, [size])
    })
    const index = rows.findIndex((r) => r.clientId === row.clientId)
    const next = [...rows]
    next.splice(replace ? index : index + 1, replace ? 1 : 0, ...copies)
    onRowsChange(next)
    toast.success(`${copies.length} row(s) added, one per size.`)
  }

  /** Paste a column from Excel: one value per row, from the pasted-into row down. */
  function onColumnPaste(event: ClipboardEvent<HTMLDivElement>, index: number, field: (typeof NUMBER_PASTE_FIELDS)[number]) {
    const values = event.clipboardData.getData("text").split(/\r?\n/).map((line) => line.split("\t")[0].trim())
    while (values.length && values[values.length - 1] === "") values.pop()
    if (values.length < 2) return
    event.preventDefault()
    const next = [...rows]
    let bad = 0
    values.forEach((raw, offset) => {
      const at = index + offset
      if (at >= next.length) return
      const parsed = raw === "" ? 0 : Number(raw.replace(/,/g, ""))
      if (!Number.isFinite(parsed)) {
        bad += 1
        return
      }
      next[at] = editDetailNumber(next[at], field, parsed, isGmtForward)
    })
    onRowsChange(next)
    if (values.length > rows.length - index) toast.warning("Values past the last row were left out.")
    if (bad) toast.error(`${bad} value(s) were not numbers and were left blank.`)
  }

  const fabricLocked = (r: GmtCostingDetail) => num(r.fabricCostPerKg) > 0

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Badge variant="outline" className="rounded-md">{rows.length} row(s)</Badge>
          {selected.size ? <Badge className="rounded-md bg-blue-600/15 text-blue-700 dark:text-blue-200">{selected.size} checked</Badge> : null}
          {clipboard ? (
            <Badge variant="outline" className="rounded-md border-amber-300 text-amber-700 dark:text-amber-200">
              Copied: {clipboard.kind === "fabricCost" ? `fabric costing (${clipboard.label})` : `${clipboard.kind} group ${clipboard.name}`}
            </Badge>
          ) : null}
          <span>
            Total item price: <b className="tabular-nums">{formatNumber(totals.pcs)}</b> / pcs ·{" "}
            <b className="tabular-nums">{formatNumber(totals.dzn)}</b> / dzn
          </span>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => onRowsChange([...rows, emptyDetail()])}>
              <Plus className="size-3" /> Add row
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="rounded-lg">
                  <MoreHorizontal className="size-3" /> Bulk actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={() => insertAt(0, [emptyDetail()])}>
                  <ListPlus className="size-3.5" /> Insert row at top
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px]">Checked rows</DropdownMenuLabel>
                <DropdownMenuItem disabled={!clipboard || !selected.size} onSelect={pasteToSelected}>
                  <ClipboardPaste className="size-3.5" /> Paste {clipboard?.kind === "fabricCost" ? "fabric costing" : clipboard ? `${clipboard.kind} group` : "copied"}
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
        <table className="w-full min-w-[2900px] border-collapse text-xs">
          <thead className="bg-slate-50/80 dark:bg-white/5">
            <tr className="border-b">
              <th rowSpan={2} className={cn(TH_CLASS, "sticky left-0 z-10 w-16 bg-slate-50 dark:bg-[#17131d]")}>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={allSelected ? true : selected.size ? "indeterminate" : false}
                    onCheckedChange={(checked) => setSelected(checked ? new Set(rows.map((r) => r.clientId)) : new Set())}
                    aria-label="Check all rows"
                  />
                  SL
                </div>
              </th>
              <th rowSpan={2} className={cn(TH_CLASS, "sticky left-16 z-10 min-w-56 bg-slate-50 dark:bg-[#17131d]")}>Fabric / Item</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-32")}>Size</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-32")}>Color</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-40")}>Fabric Color</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-36")}>GMT Parts</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")}>Fabric GSM</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")}>Finish Dia/ Width</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")}>Fabric Form</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>F. Req. Qty</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-16")}>UOM</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-28")}>Fabric Cost ($)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")} title="The sum of the row's GMT wastage (Wastage section)">GMT W%</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>Total Fabric/Item Qty</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>Fabric/Item Price ($)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Import Charge (%)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-24")}>Import/ Additional Price ($)</th>
              <th colSpan={2} className={cn(TH_CLASS, "text-center")}>Total Item Price ($)</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-16 text-center")}>Color Wise?</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20 text-center")}>Show Cost In Budget?</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Collar %</th>
              <th rowSpan={2} className={cn(TH_CLASS, "w-20")}>Collar Qty</th>
              <th rowSpan={2} className={cn(TH_CLASS, "min-w-44")}>Remarks</th>
              <th rowSpan={2} className={cn(TH_CLASS, "sticky right-0 z-10 w-14 bg-slate-50 text-right dark:bg-[#17131d]")}>Action</th>
            </tr>
            <tr className="border-b">
              <th className={cn(TH_CLASS, "w-24")} title="A">Pcs GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="B = A x 12">Dzn GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="D = A grown by GMT W%">Pcs GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="E = B grown by GMT W%">Dzn GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="F">Unit</th>
              <th className={cn(TH_CLASS, "w-24")} title="G = F x 12">Dzn</th>
              <th className={cn(TH_CLASS, "w-24")} title="H = D x F">Pcs GMT</th>
              <th className={cn(TH_CLASS, "w-24")} title="I = E x G">Dzn GMT</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={28} className="p-8 text-center text-sm text-slate-500">
                  No rows yet.{readOnly ? "" : " Add a row for each fabric or item of the garment."}
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => {
              const checked = selected.has(row.clientId)
              const stickyBg = checked ? "bg-blue-50 dark:bg-[#1a2140]" : "bg-white dark:bg-[#17131d]"
              return (
                <tr key={row.clientId} className={cn("border-b align-middle transition-colors", checked ? "bg-blue-50/70 dark:bg-blue-500/10" : "hover:bg-muted/40")}>
                  <td className={cn(TD_CLASS, "sticky left-0 z-[1]", stickyBg)}>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const next = new Set(selected)
                          if (value) next.add(row.clientId)
                          else next.delete(row.clientId)
                          setSelected(next)
                        }}
                        aria-label={`Check row ${index + 1}`}
                      />
                      <span className="tabular-nums">{index + 1}</span>
                    </div>
                  </td>
                  <td className={cn(TD_CLASS, "sticky left-16 z-[1]", stickyBg)}>
                    <LookupCombobox
                      value={row.fabricItemId}
                      label={row.fabricItemName}
                      loadItems={loadMaterials}
                      placeholder="Fabric / item"
                      disabled={readOnly}
                      onChange={(option) => void pickMaterial(row.clientId, option)}
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <GroupCell row={row} kind="size" readOnly={readOnly} onOpen={() => onOpenGroup(row.clientId, "size")} />
                  </td>
                  <td className={TD_CLASS}>
                    <GroupCell row={row} kind="color" readOnly={readOnly} onOpen={() => onOpenGroup(row.clientId, "color")} />
                  </td>
                  <td className={TD_CLASS}>
                    <LookupCombobox
                      value={row.fabricColorId}
                      label={row.fabricColorName}
                      loadItems={loadColors}
                      placeholder="Fabric color"
                      disabled={readOnly}
                      onChange={(option) =>
                        patch(row.clientId, (r) => ({ ...r, fabricColorId: option ? Number(option.value) : null, fabricColorName: option?.label ?? "" }))
                      }
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <LookupCombobox
                      value={row.gmtPartsId}
                      label={row.gmtPartsName}
                      loadItems={loadParts}
                      placeholder="Part"
                      disabled={readOnly}
                      onChange={(option) =>
                        patch(row.clientId, (r) => ({ ...r, gmtPartsId: option ? Number(option.value) : null, gmtPartsName: option?.label ?? "" }))
                      }
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <TextCell value={row.fabricGsm} readOnly={readOnly} maxLength={50} onChange={(v) => patch(row.clientId, (r) => ({ ...r, fabricGsm: v }))} />
                  </td>
                  <td className={TD_CLASS}>
                    <TextCell value={row.finishDia} readOnly={readOnly} maxLength={50} onChange={(v) => patch(row.clientId, (r) => ({ ...r, finishDia: v }))} />
                  </td>
                  <td className={TD_CLASS}>
                    <TextCell value={row.fabricForm} readOnly={readOnly} maxLength={50} onChange={(v) => patch(row.clientId, (r) => ({ ...r, fabricForm: v }))} />
                  </td>
                  {NUMBER_PASTE_FIELDS.map((field) => (
                    <td key={field} className={TD_CLASS}>
                      <div onPaste={readOnly ? undefined : (event) => onColumnPaste(event, index, field)}>
                        <NumInput value={row[field]} onValueChange={readOnly ? undefined : (v) => setNumber(row.clientId, field, v)} />
                      </div>
                    </td>
                  ))}
                  <td className={cn(TD_CLASS, "text-slate-600 dark:text-slate-300")}>{row.uomName || "--"}</td>
                  <td className={TD_CLASS}>
                    <Button
                      type="button"
                      variant={fabricLocked(row) ? "secondary" : "outline"}
                      size="sm"
                      className="w-full justify-end rounded-sm tabular-nums"
                      disabled={!row.fabricItemId && !row.FabricCost}
                      onClick={() => onOpenFabricCost(row.clientId)}
                      title={readOnly ? "View fabric costing" : "Fabric costing of this row"}
                    >
                      {num(row.fabricCostPerKg) > 0 ? formatNumber(row.fabricCostPerKg) : readOnly ? "--" : "Cost..."}
                    </Button>
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput
                      value={row.gmtWastagePercentage}
                      onValueChange={readOnly || row.lstGMTWastage.length > 0 ? undefined : (v) => setNumber(row.clientId, "gmtWastagePercentage", v)}
                      title={row.lstGMTWastage.length ? "Set in the GMT Wastage section" : undefined}
                    />
                  </td>
                  <td className={TD_CLASS}><NumInput value={row.totalFabricItemQtyPerPcsGmt} /></td>
                  <td className={TD_CLASS}><NumInput value={row.totalFabricItemQtyPerDznGmt} /></td>
                  <td className={TD_CLASS}>
                    <NumInput
                      value={row.fabricItemPricePerUnitKg}
                      onValueChange={readOnly || fabricLocked(row) ? undefined : (v) => setNumber(row.clientId, "fabricItemPricePerUnitKg", v)}
                      title={fabricLocked(row) ? "Set by the fabric costing" : undefined}
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput
                      value={row.fabricItemPricePerDzn}
                      onValueChange={readOnly || fabricLocked(row) ? undefined : (v) => setNumber(row.clientId, "fabricItemPricePerDzn", v)}
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.importChargePercentage} onValueChange={readOnly ? undefined : (v) => setNumber(row.clientId, "importChargePercentage", v)} />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.additionalPrice} onValueChange={readOnly ? undefined : (v) => setNumber(row.clientId, "additionalPrice", v)} />
                  </td>
                  <td className={TD_CLASS}><NumInput value={row.totalFaricPricePerPcsGmt} /></td>
                  <td className={TD_CLASS}><NumInput value={row.totalFaricPricePerDznGmt} /></td>
                  <td className={cn(TD_CLASS, "text-center")}>
                    <Checkbox
                      checked={row.isColorWise}
                      disabled={readOnly}
                      onCheckedChange={(v) => patch(row.clientId, (r) => ({ ...r, isColorWise: Boolean(v) }))}
                      aria-label="Is color wise"
                    />
                  </td>
                  <td className={cn(TD_CLASS, "text-center")}>
                    <Checkbox
                      checked={row.isShowCostInBudget}
                      disabled={readOnly}
                      onCheckedChange={(v) => patch(row.clientId, (r) => ({ ...r, isShowCostInBudget: Boolean(v) }))}
                      aria-label="Show cost in budget"
                    />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.collarPercentage} onValueChange={readOnly ? undefined : (v) => patch(row.clientId, (r) => ({ ...r, collarPercentage: v }))} />
                  </td>
                  <td className={TD_CLASS}>
                    <NumInput value={row.collarQty} onValueChange={readOnly ? undefined : (v) => patch(row.clientId, (r) => ({ ...r, collarQty: v }))} />
                  </td>
                  <td className={TD_CLASS}>
                    <TextCell value={row.remarks} readOnly={readOnly} maxLength={500} onChange={(v) => patch(row.clientId, (r) => ({ ...r, remarks: v }))} />
                  </td>
                  <td className={cn(TD_CLASS, "sticky right-0 z-[1] text-right", stickyBg)}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Row actions">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        {!readOnly ? (
                          <>
                            <DropdownMenuItem onSelect={() => insertAt(index + 1, [emptyDetail()])}>
                              <Plus className="size-3.5" /> Insert row below
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => insertAt(index + 1, [copyDetail(row)])}>
                              <CopyPlus className="size-3.5" /> Duplicate row
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => addByIndividualSize(row, false)}>
                              <Ruler className="size-3.5" /> Add by individual size
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => addByIndividualSize(row, true)}>
                              <Ruler className="size-3.5" /> Replace by individual sizes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}
                        <DropdownMenuItem
                          disabled={!row.FabricCost || row.FabricCost.lastYarnDtls.length === 0}
                          onSelect={() =>
                            row.FabricCost && setClipboard({ kind: "fabricCost", cost: row.FabricCost, label: row.fabricItemName || `row ${index + 1}` })
                          }
                        >
                          <Copy className="size-3.5" /> Copy fabric costing
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setClipboard({ kind: "color", name: groupDisplayNameOf(row, "color"), items: groupItemsOf(row, "color") })}
                        >
                          <Copy className="size-3.5" /> Copy color group
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setClipboard({ kind: "size", name: groupDisplayNameOf(row, "size"), items: groupItemsOf(row, "size") })}
                        >
                          <Copy className="size-3.5" /> Copy size group
                        </DropdownMenuItem>
                        {!readOnly ? (
                          <>
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
          Paste a column from Excel into an F. Req. Qty cell to fill the rows below it. A row with a fabric cost takes its item price
          from the costing. Copy a row&apos;s fabric costing or group from its menu, check rows, then use Bulk actions › Paste.
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
          else changePartOfSelected(option)
          setPicker(null)
        }}
      />
    </div>
  )
}

function TextCell({ value, onChange, readOnly, maxLength }: { value: string; onChange: (v: string) => void; readOnly: boolean; maxLength?: number }) {
  return <Input value={value} maxLength={maxLength} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} className={CELL_INPUT_CLASS} />
}

function GroupCell({ row, kind, readOnly, onOpen }: { row: GmtCostingDetail; kind: GroupKind; readOnly: boolean; onOpen: () => void }) {
  const items = groupItemsOf(row, kind)
  return (
    <button
      type="button"
      onClick={onOpen}
      title={items.map((i) => i.name).join(", ") || (readOnly ? "" : `Pick the ${kind}s of this row's group`)}
      className={cn(
        "flex h-7 w-full items-center justify-between gap-1 rounded-sm border px-1.5 text-left text-xs",
        items.length ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-slate-200 dark:border-white/10",
      )}
    >
      <span className="truncate">{groupDisplayNameOf(row, kind)}</span>
      {items.length ? <span className="text-[10px] text-slate-500">{items.length}</span> : null}
    </button>
  )
}

