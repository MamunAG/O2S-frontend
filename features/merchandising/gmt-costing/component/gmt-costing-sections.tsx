"use client"

// The sections of the GMT Costing entry dialog below the details grid: Other Cost, Commission, GMT Wastage,
// Price (cost per pcs), IE Info, Item-wise Supplier and Files. ClickERP put most of these in its Other
// Cost & Wastage dialog; here each is a section of the entry dialog and edits the costing directly.

import { useMemo, useRef, useState } from "react"
import { Download, Loader2, Paperclip, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
import { AppCombobox } from "@/components/app-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import {
  comboKeyOf,
  emptyCommission,
  emptyOtherCost,
  gmtWastageTotalOf,
  newClientId,
  num,
  recalcRow,
  wastageCombos,
  type PriceRow,
} from "../gmt-costing.calc"
import type {
  CostScope,
  GmtCommission,
  GmtCostPerPcs,
  GmtCosting,
  GmtCostingDetail,
  GmtDetailsWastage,
  GmtItemSupplier,
  GmtOtherCost,
  StyleInfo,
} from "../gmt-costing.types"
import { CELL_INPUT_CLASS, COMBO_CONTENT_CLASS, FIELD_CLASS, FieldLabel, LookupCombobox, NumInput, TD_CLASS, TH_CLASS, formatNumber } from "./gmt-ui"

type Load = (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>

const scopeOptions = (scopes: CostScope[]) => scopes.map((s) => ({ value: String(s.id), label: s.name }))

export function ScopePicker({
  value,
  label,
  options,
  disabled,
  placeholder,
  onChange,
}: {
  value: number
  label: string
  options: AppComboboxOption[]
  disabled: boolean
  placeholder: string
  onChange: (o: AppComboboxOption | null) => void
}) {
  return (
    <AppCombobox
      items={options}
      value={value ? { value: String(value), label: label || String(value) } : null}
      onValueChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      inputClassName={CELL_INPUT_CLASS}
      contentClassName={COMBO_CONTENT_CLASS}
    />
  )
}

export function Table({ minWidth, head, children }: { minWidth: string; head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-slate-200/70 dark:border-white/10">
      <table className={cn("w-full border-collapse text-xs", minWidth)}>
        <thead className="bg-slate-50/80 dark:bg-white/5">
          <tr className="border-b">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function EmptyRow({ span, text }: { span: number; text: string }) {
  return (
    <tr>
      <td colSpan={span} className="p-4 text-center text-slate-500">{text}</td>
    </tr>
  )
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
      <Trash2 className="size-3.5 text-red-600" />
    </Button>
  )
}

// ---------- Other cost ----------

export function OtherCostSection({
  rows,
  scopes,
  style,
  readOnly,
  onChange,
}: {
  rows: GmtOtherCost[]
  scopes: CostScope[]
  style: StyleInfo | null
  readOnly: boolean
  onChange: (rows: GmtOtherCost[]) => void
}) {
  const options = useMemo(() => scopeOptions(scopes.filter((s) => s.isOtherTypeCost)), [scopes])
  const patch = (id: string, change: Partial<GmtOtherCost>) => onChange(rows.map((r) => (r.clientId === id ? { ...r, ...change } : r)))
  const total = rows.reduce((s, r) => s + num(r.costPerPcsGmt), 0)
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[820px]"
        head={
          <>
            <th className={cn(TH_CLASS, "w-10")}>SL</th>
            <th className={cn(TH_CLASS, "min-w-56")}>Cost</th>
            <th className={cn(TH_CLASS, "w-32")}>Cost/Pcs GMT ($)</th>
            <th className={cn(TH_CLASS, "w-32")}>Cost/Dzn GMT ($)</th>
            <th className={cn(TH_CLASS, "min-w-56")} title="No color = every color">Colors</th>
            <th className={cn(TH_CLASS, "w-10")} />
          </>
        }
      >
        {rows.length === 0 ? <EmptyRow span={6} text="No other cost." /> : null}
        {rows.map((row, i) => (
          <tr key={row.clientId} className="border-b">
            <td className={TD_CLASS}>{i + 1}</td>
            <td className={TD_CLASS}>
              <ScopePicker
                value={row.costId}
                label={row.costName}
                options={options}
                disabled={readOnly}
                placeholder="Cost"
                onChange={(o) => patch(row.clientId, { costId: o ? Number(o.value) : 0, costName: o?.label ?? "" })}
              />
            </td>
            <td className={TD_CLASS}>
              <NumInput
                value={row.costPerPcsGmt}
                onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { costPerPcsGmt: v, costPerDznGmt: Number((v * 12).toFixed(2)) })}
              />
            </td>
            <td className={TD_CLASS}>
              <NumInput
                value={row.costPerDznGmt}
                onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { costPerDznGmt: v, costPerPcsGmt: Number((v / 12).toFixed(4)) })}
              />
            </td>
            <td className={TD_CLASS}>
              <ColorPicker
                selected={row.lstColors.map((c) => ({ id: c.gmtColorId, name: c.gmtColorName }))}
                options={style?.colors ?? []}
                readOnly={readOnly}
                onChange={(colors) =>
                  patch(row.clientId, {
                    lstColors: colors.map((c) => {
                      const kept = row.lstColors.find((x) => x.gmtColorId === c.id)
                      return kept ?? { clientId: newClientId(), id: 0, otherCostDtlsId: 0, gmtColorId: c.id, gmtColorName: c.name }
                    }),
                  })
                }
              />
            </td>
            <td className={cn(TD_CLASS, "text-right")}>
              {!readOnly ? <RemoveButton label="Remove cost" onClick={() => onChange(rows.filter((r) => r.clientId !== row.clientId))} /> : null}
            </td>
          </tr>
        ))}
      </Table>
      <div className="flex items-center justify-between text-xs">
        <span>
          Total <b className="tabular-nums">{formatNumber(total)}</b> / pcs
        </span>
        {!readOnly ? (
          <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => onChange([...rows, emptyOtherCost()])}>
            <Plus className="size-3" /> Add cost
          </Button>
        ) : null}
      </div>
      {options.length === 0 ? <p className="text-[11px] text-slate-500">No cost scope is marked as an other cost (GMT Cost Scope setup).</p> : null}
    </div>
  )
}

export function ColorPicker({
  selected,
  options,
  readOnly,
  onChange,
}: {
  selected: Array<{ id: number; name: string }>
  options: Array<{ id: number; name: string }>
  readOnly: boolean
  onChange: (colors: Array<{ id: number; name: string }>) => void
}) {
  const label = selected.length ? selected.map((c) => c.name).join(", ") : "All colors"
  if (readOnly) return <span className="block truncate" title={label}>{label}</span>
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-7 w-full items-center rounded-sm border border-slate-200 px-1.5 text-left dark:border-white/10" title={label}>
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 text-xs">
        {options.length === 0 ? <p className="text-slate-500">Pick a style with colors first.</p> : null}
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {options.map((color) => {
            const checked = selected.some((c) => c.id === color.id)
            return (
              <label key={color.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-white/5">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => onChange(v ? [...selected, color] : selected.filter((c) => c.id !== color.id))}
                />
                {color.name}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------- Commission ----------

export function CommissionSection({
  rows,
  scopes,
  readOnly,
  onChange,
}: {
  rows: GmtCommission[]
  scopes: CostScope[]
  readOnly: boolean
  onChange: (rows: GmtCommission[]) => void
}) {
  const options = useMemo(() => scopeOptions(scopes.filter((s) => s.isCommission)), [scopes])
  const patch = (id: string, change: Partial<GmtCommission>) => onChange(rows.map((r) => (r.clientId === id ? { ...r, ...change } : r)))
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[640px]"
        head={
          <>
            <th className={cn(TH_CLASS, "w-10")}>SL</th>
            <th className={cn(TH_CLASS, "min-w-56")}>Commission</th>
            <th className={cn(TH_CLASS, "w-32")}>Commission %</th>
            <th className={cn(TH_CLASS, "w-32")}>Value / Pcs ($)</th>
            <th className={cn(TH_CLASS, "w-10")} />
          </>
        }
      >
        {rows.length === 0 ? <EmptyRow span={5} text="No commission." /> : null}
        {rows.map((row, i) => (
          <tr key={row.clientId} className="border-b">
            <td className={TD_CLASS}>{i + 1}</td>
            <td className={TD_CLASS}>
              <ScopePicker
                value={row.commissionId}
                label={row.commissionName}
                options={options}
                disabled={readOnly}
                placeholder="Commission"
                onChange={(o) => patch(row.clientId, { commissionId: o ? Number(o.value) : 0, commissionName: o?.label ?? "" })}
              />
            </td>
            <td className={TD_CLASS}>
              <NumInput
                value={row.commissionPercentage}
                onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { commissionPercentage: v, ...(v ? { commissionValue: 0 } : {}) })}
              />
            </td>
            <td className={TD_CLASS}>
              <NumInput
                value={row.commissionValue}
                onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { commissionValue: v, ...(v ? { commissionPercentage: 0 } : {}) })}
              />
            </td>
            <td className={cn(TD_CLASS, "text-right")}>
              {!readOnly ? <RemoveButton label="Remove commission" onClick={() => onChange(rows.filter((r) => r.clientId !== row.clientId))} /> : null}
            </td>
          </tr>
        ))}
      </Table>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">A row is a % of the price or a value per pcs, not both.</span>
        {!readOnly ? (
          <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => onChange([...rows, emptyCommission()])}>
            <Plus className="size-3" /> Add commission
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// ---------- GMT wastage ----------

/**
 * Each fabric / color group / part of the details, and per GMT process (cost scopes marked GMT process) its
 * wastage %. A change is written to every details row of that combination: its wastage lines, its GMT W%
 * (their sum) and the totals built on it. Double Pcs Qty goes to the same rows.
 */
export function WastageSection({
  rows,
  scopes,
  readOnly,
  isGmtForward,
  onChange,
}: {
  rows: GmtCostingDetail[]
  scopes: CostScope[]
  readOnly: boolean
  isGmtForward: boolean
  onChange: (rows: GmtCostingDetail[]) => void
}) {
  const processes = useMemo(() => scopes.filter((s) => s.isGmtProcess), [scopes])
  const combos = useMemo(() => wastageCombos(rows), [rows])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const current = combos.find((c) => c.key === selectedKey) ?? combos[0] ?? null
  const sample = current ? rows.find((r) => comboKeyOf(r) === current.key) : undefined

  const totalOf = (key: string) => {
    const row = rows.find((r) => comboKeyOf(r) === key)
    return row ? gmtWastageTotalOf(row.lstGMTWastage) : 0
  }

  function applyToCombo(change: (row: GmtCostingDetail) => GmtCostingDetail) {
    if (!current) return
    onChange(rows.map((r) => (comboKeyOf(r) === current.key ? change(r) : r)))
  }

  function setPercent(processId: number, processName: string, value: number) {
    applyToCombo((row) => {
      const others = row.lstGMTWastage.filter((w) => w.gmtProcessId !== processId)
      const existing = row.lstGMTWastage.find((w) => w.gmtProcessId === processId)
      const lines: GmtDetailsWastage[] =
        value > 0
          ? [...others, { ...(existing ?? { clientId: newClientId(), id: 0, detailsId: 0 }), gmtProcessId: processId, gmtProcessName: processName, gmtWastagePercentage: value }]
          : others
      return recalcRow({ ...row, lstGMTWastage: lines, gmtWastagePercentage: gmtWastageTotalOf(lines) }, isGmtForward)
    })
  }

  if (combos.length === 0) {
    return <p className="text-xs text-slate-500">Add details rows with a fabric / item first; their wastage is set here.</p>
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Table
        minWidth="min-w-[480px]"
        head={
          <>
            <th className={TH_CLASS}>Fabric / Item</th>
            <th className={TH_CLASS}>Color</th>
            <th className={TH_CLASS}>Parts</th>
            <th className={cn(TH_CLASS, "w-20 text-right")}>W %</th>
            <th className={cn(TH_CLASS, "w-20 text-center")}>Double Pcs Qty</th>
          </>
        }
      >
        {combos.map((combo) => {
          const active = combo.key === current?.key
          return (
            <tr
              key={combo.key}
              onClick={() => setSelectedKey(combo.key)}
              className={cn("cursor-pointer border-b", active ? "border-l-2 border-l-blue-500 bg-blue-500/10" : "hover:bg-muted/40")}
            >
              <td className={TD_CLASS}>{combo.fabric}</td>
              <td className={TD_CLASS}>{combo.color}</td>
              <td className={TD_CLASS}>{combo.part || "--"}</td>
              <td className={cn(TD_CLASS, "text-right tabular-nums")}>{formatNumber(totalOf(combo.key), 2)}</td>
              <td className={cn(TD_CLASS, "text-center")} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={combo.isDoubleInPcsQty}
                  disabled={readOnly}
                  onCheckedChange={(v) => onChange(rows.map((r) => (comboKeyOf(r) === combo.key ? { ...r, isDoubleInPcsQty: Boolean(v) } : r)))}
                  aria-label="Double pcs qty"
                />
              </td>
            </tr>
          )
        })}
      </Table>
      <div className="space-y-2">
        {current ? (
          <p className="rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1 text-xs dark:border-blue-500/30 dark:bg-blue-500/10">
            {current.fabric} · {current.color} · {current.part || "no part"}
          </p>
        ) : null}
        <Table
          minWidth="min-w-[320px]"
          head={
            <>
              <th className={TH_CLASS}>GMT Process</th>
              <th className={cn(TH_CLASS, "w-28")}>Wastage %</th>
            </>
          }
        >
          {processes.length === 0 ? <EmptyRow span={2} text="No cost scope is marked as a GMT process." /> : null}
          {processes.map((process) => {
            const line = sample?.lstGMTWastage.find((w) => w.gmtProcessId === process.id)
            return (
              <tr key={process.id} className="border-b">
                <td className={TD_CLASS}>{process.name}</td>
                <td className={TD_CLASS}>
                  <NumInput
                    value={line?.gmtWastagePercentage ?? 0}
                    onValueChange={readOnly ? undefined : (v) => setPercent(process.id, process.name, v)}
                  />
                </td>
              </tr>
            )
          })}
        </Table>
      </div>
    </div>
  )
}

// ---------- Price ----------

export function PriceSection({
  prices,
  perPcs,
  readOnly,
  onChange,
}: {
  prices: PriceRow[]
  perPcs: GmtCostPerPcs[]
  readOnly: boolean
  onChange: (rows: GmtCostPerPcs[]) => void
}) {
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[560px]"
        head={
          <>
            <th className={TH_CLASS}>Color Group</th>
            <th className={TH_CLASS}>Size Group</th>
            <th className={cn(TH_CLASS, "w-36 text-right")}>Costing Price / Pcs ($)</th>
            <th className={cn(TH_CLASS, "w-36")}>Confirm Price / Pcs ($)</th>
          </>
        }
      >
        {perPcs.length === 0 ? <EmptyRow span={4} text="Add details rows to see the price." /> : null}
        {perPcs.map((row) => {
          const live = prices.find((p) => p.colorGroupName === row.colorGroupName && p.sizeGroupName === row.sizeGroupName)
          return (
            <tr key={row.clientId} className="border-b">
              <td className={TD_CLASS}>{row.colorGroupName}</td>
              <td className={TD_CLASS}>{row.sizeGroupName}</td>
              <td className={cn(TD_CLASS, "text-right font-semibold tabular-nums")}>$ {formatNumber(live?.price ?? row.costingPricePerPcs)}</td>
              <td className={TD_CLASS}>
                <NumInput
                  value={row.confirmPricePerPcs}
                  onValueChange={
                    readOnly ? undefined : (v) => onChange(perPcs.map((p) => (p.clientId === row.clientId ? { ...p, confirmPricePerPcs: v } : p)))
                  }
                />
              </td>
            </tr>
          )
        })}
      </Table>
      <p className="text-[11px] text-slate-500">
        Per color group x size group: the rows&apos; total item price / pcs, plus the other costs (a named color group takes the costs
        with no color and those of its colors), then the commission %, then the commission values.
      </p>
    </div>
  )
}

// ---------- IE info ----------

export function IeInfoSection({
  costing,
  readOnly,
  onChange,
}: {
  costing: GmtCosting
  readOnly: boolean
  onChange: (change: Partial<GmtCosting>) => void
}) {
  const fields: Array<{ key: "smv" | "cpm" | "operators" | "helper" | "ironMan"; label: string; unit: string }> = [
    { key: "smv", label: "SMV", unit: "min" },
    { key: "cpm", label: "CPM", unit: "$/min" },
    { key: "operators", label: "Operators", unit: "persons" },
    { key: "helper", label: "Helpers", unit: "persons" },
    { key: "ironMan", label: "Iron Man", unit: "persons" },
  ]
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {fields.map((f) => (
          <div key={f.key} className={FIELD_CLASS}>
            <FieldLabel>
              {f.label} <span className="font-normal text-slate-500">({f.unit})</span>
            </FieldLabel>
            <NumInput
              value={costing[f.key]}
              onValueChange={
                readOnly
                  ? undefined
                  : (v) => onChange({ [f.key]: f.key === "smv" || f.key === "cpm" ? v : Math.max(0, Math.round(v)) } as Partial<GmtCosting>)
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Item-wise supplier ----------

export function SupplierSection({
  rows,
  readOnly,
  loadSuppliers,
  onChange,
}: {
  rows: GmtItemSupplier[]
  readOnly: boolean
  loadSuppliers: Load
  onChange: (rows: GmtItemSupplier[]) => void
}) {
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[640px]"
        head={
          <>
            <th className={cn(TH_CLASS, "w-10")}>SL</th>
            <th className={cn(TH_CLASS, "min-w-56")}>Item / Yarn</th>
            <th className={TH_CLASS}>Suppliers</th>
          </>
        }
      >
        {rows.length === 0 ? <EmptyRow span={3} text="Add details rows (and their yarns) to pick suppliers." /> : null}
        {rows.map((row, i) => (
          <tr key={row.clientId} className="border-b align-top">
            <td className={TD_CLASS}>{i + 1}</td>
            <td className={TD_CLASS}>{row.itemName}</td>
            <td className={TD_CLASS}>
              <div className="flex flex-wrap items-center gap-1">
                {row.lstSupplierDetails.map((s) => (
                  <Badge key={s.clientId} variant="outline" className="gap-1 rounded-md">
                    {s.supplierName}
                    {!readOnly ? (
                      <button
                        type="button"
                        aria-label={`Remove ${s.supplierName}`}
                        onClick={() =>
                          onChange(
                            rows.map((r) =>
                              r.clientId === row.clientId ? { ...r, lstSupplierDetails: r.lstSupplierDetails.filter((x) => x.clientId !== s.clientId) } : r,
                            ),
                          )
                        }
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </Badge>
                ))}
                {!readOnly ? (
                  <LookupCombobox
                    key={row.lstSupplierDetails.length}
                    className="w-48"
                    value={null}
                    label=""
                    loadItems={loadSuppliers}
                    placeholder="Add supplier"
                    onChange={(o) => {
                      if (!o || row.lstSupplierDetails.some((s) => s.supplierId === Number(o.value))) return
                      onChange(
                        rows.map((r) =>
                          r.clientId === row.clientId
                            ? {
                                ...r,
                                lstSupplierDetails: [
                                  ...r.lstSupplierDetails,
                                  { clientId: newClientId(), id: 0, itemWiseSupplierMasterId: r.id, supplierId: Number(o.value), supplierName: o.label },
                                ],
                              }
                            : r,
                        ),
                      )
                    }}
                  />
                ) : row.lstSupplierDetails.length === 0 ? (
                  <span className="text-slate-400">--</span>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-[11px] text-slate-500">Every yarn of the fabric costings, and the item of each row without yarn. Only items with a supplier are saved.</p>
    </div>
  )
}

// ---------- Files ----------

export function FilesSection({
  files,
  readOnly,
  onUpload,
  onDownload,
  onChange,
}: {
  files: GmtCosting["lstFile"]
  readOnly: boolean
  onUpload: (file: File) => Promise<{ id: number; fileName: string }>
  onDownload: (id: number, fileName: string) => void
  onChange: (files: GmtCosting["lstFile"]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    const added: GmtCosting["lstFile"] = []
    for (const file of Array.from(list)) {
      try {
        const saved = await onUpload(file)
        added.push({ clientId: newClientId(), id: 0, masterId: 0, fileAttachmentId: saved.id, fileName: saved.fileName || file.name })
      } catch (caught) {
        toast.error(`${file.name}: ${caught instanceof Error ? caught.message : "upload failed"}`)
      }
    }
    if (added.length) onChange([...files, ...added])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div
      className="space-y-2"
      onDragOver={(e) => !readOnly && e.preventDefault()}
      onDrop={(e) => {
        if (readOnly) return
        e.preventDefault()
        void upload(e.dataTransfer.files)
      }}
    >
      {files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-white/10">
          No attachments.{readOnly ? "" : " Drop files here or attach them."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200/70 rounded-md border border-slate-200/70 text-xs dark:divide-white/10 dark:border-white/10">
          {files.map((file, i) => (
            <li key={file.clientId} className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-6 text-slate-500">{i + 1}</span>
              <Paperclip className="size-3.5 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
              <Badge variant="outline" className="rounded-md uppercase">{file.fileName.split(".").pop()}</Badge>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Download" onClick={() => onDownload(file.fileAttachmentId, file.fileName)}>
                <Download className="size-3.5" />
              </Button>
              {!readOnly ? <RemoveButton label="Remove file" onClick={() => onChange(files.filter((f) => f.clientId !== file.clientId))} /> : null}
            </li>
          ))}
        </ul>
      )}
      {!readOnly ? (
        <>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
          <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />} Attach files
          </Button>
        </>
      ) : null}
    </div>
  )
}
